package com.guide.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * REQ-033：{@link AiCompletionClient} 的离线单元测试。
 *
 * <p>全部使用 {@link MockRestServiceServer} 假供应商，不访问真实外网、不读取本机 Key，
 * 覆盖配置启用、请求体、严格响应校验和传输失败不重试。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033）</a>
 */
class AiCompletionClientTest {

    private static final String BASE_URL = "https://fake-provider.example/v1";
    private static final String CHAT_URL = BASE_URL + "/chat/completions";
    private static final MediaType JSON_UTF8 =
            new MediaType("application", "json", StandardCharsets.UTF_8);

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private AiCompletionClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.bindTo(restTemplate).build();
        client = new AiCompletionClient(restTemplate, "test-key", BASE_URL, "fake-model");
    }

    @Test
    void isEnabledReflectsConfiguredKey() {
        assertTrue(client.isEnabled());
        assertFalse(new AiCompletionClient(restTemplate, "   ", BASE_URL, "fake-model").isEnabled());
        assertFalse(new AiCompletionClient(restTemplate, null, BASE_URL, "fake-model").isEnabled());
    }

    @Test
    void disabledClientDoesNotSendRequest() {
        AiCompletionClient disabled = new AiCompletionClient(restTemplate, "", BASE_URL, "fake-model");
        assertThrows(IllegalStateException.class,
                () -> disabled.complete("系统规则", "用户数据", 0.5, 100));
        server.verify();
    }

    @Test
    void completeSendsOpenAiCompatibleRequestAndTrimsReply() {
        server.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("fake-model"))
                .andExpect(jsonPath("$.temperature").value(0.5))
                .andExpect(jsonPath("$.max_tokens").value(100))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[0].content").value("系统规则"))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[1].content").value("用户数据"))
                .andRespond(withSuccess(
                        "{\"choices\":[{\"message\":{\"content\":\"  建议正文  \"}}]}", JSON_UTF8));

        String reply = client.complete("系统规则", "用户数据", 0.5, 100);

        assertEquals("建议正文", reply);
        server.verify();
    }

    @Test
    void rejectsEmptyChoices() {
        server.expect(requestTo(CHAT_URL))
                .andRespond(withSuccess("{}", JSON_UTF8));
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        assertTrue(exception.getMessage().contains("choices"));
        server.verify();
    }

    @Test
    void rejectsMissingMessage() {
        server.expect(requestTo(CHAT_URL))
                .andRespond(withSuccess("{\"choices\":[{}]}", JSON_UTF8));
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        assertTrue(exception.getMessage().contains("message"));
        server.verify();
    }

    @Test
    void rejectsBlankContent() {
        server.expect(requestTo(CHAT_URL))
                .andRespond(withSuccess(
                        "{\"choices\":[{\"message\":{\"content\":\"   \"}}]}", JSON_UTF8));
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        assertTrue(exception.getMessage().contains("content"));
        server.verify();
    }

    @Test
    void rejectsNonTextContent() {
        server.expect(requestTo(CHAT_URL))
                .andRespond(withSuccess(
                        "{\"choices\":[{\"message\":{\"content\":123}}]}", JSON_UTF8));
        assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        server.verify();
    }

    @Test
    void rejectsEmptyOrNonJsonBody() {
        server.expect(requestTo(CHAT_URL)).andRespond(withSuccess("", JSON_UTF8));
        assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        server.verify();

        server.reset();
        server.expect(requestTo(CHAT_URL)).andRespond(withSuccess("not-json", JSON_UTF8));
        assertThrows(IllegalStateException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));
        server.verify();
    }

    @Test
    void transportFailureIsNotRetried() {
        server.expect(requestTo(CHAT_URL))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertThrows(RestClientException.class,
                () -> client.complete("系统规则", "用户数据", 0.5, 100));

        // verify 确认只发生一次请求：本类没有自动重试。
        server.verify();
    }

    @Test
    void productionRestTemplateUsesThreeAndFifteenSecondTimeouts() {
        RestTemplate template = AiCompletionClient.buildDefaultRestTemplate();
        assertTrue(template.getRequestFactory() instanceof SimpleClientHttpRequestFactory);
        SimpleClientHttpRequestFactory factory =
                (SimpleClientHttpRequestFactory) template.getRequestFactory();
        assertEquals(Integer.valueOf(AiCompletionClient.CONNECT_TIMEOUT_MILLIS),
                ReflectionTestUtils.getField(factory, "connectTimeout"));
        assertEquals(Integer.valueOf(AiCompletionClient.READ_TIMEOUT_MILLIS),
                ReflectionTestUtils.getField(factory, "readTimeout"));
        assertEquals(3000, AiCompletionClient.CONNECT_TIMEOUT_MILLIS);
        assertEquals(15000, AiCompletionClient.READ_TIMEOUT_MILLIS);
    }
}
