package com.guide.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 真实 HTTP 下的 Cookie 属性测试（REQ-030 / GitHub #5）。
 *
 * <p>验证 JSESSIONID 具备 HttpOnly 与 SameSite=Lax，CSRF Cookie 可被前端脚本读取
 * （非 HttpOnly），从而支持 Cookie 双提交。使用独立临时数据文件与随机端口。
 *
 * <p>文档：[测试说明](../../../../docs/test_reference.md)。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CookieAttributeTest {

    private static final String ADMIN_USERNAME = "cookie-admin";
    private static final String ADMIN_PASSWORD = "cookie-admin-pass";

    private static final Path DATA_DIR;

    static {
        Path created;
        try {
            created = Files.createTempDirectory("guide-cookie-it-");
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
        DATA_DIR = created;
        Path knowledge = Paths.get("data", "knowledge.json");
        Path config = Paths.get("data", "config.json");
        try {
            if (Files.exists(knowledge)) {
                Files.copy(knowledge, DATA_DIR.resolve("knowledge.json"),
                        StandardCopyOption.REPLACE_EXISTING);
            }
            if (Files.exists(config)) {
                Files.copy(config, DATA_DIR.resolve("config.json"),
                        StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    /**
     * 注入隔离数据文件与管理员初始化环境变量。
     *
     * @param registry Spring 动态属性注册表
     */
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("data.users-file", () -> DATA_DIR.resolve("users.json").toString());
        registry.add("data.knowledge-file", () -> DATA_DIR.resolve("knowledge.json").toString());
        registry.add("data.config-file", () -> DATA_DIR.resolve("config.json").toString());
        registry.add("data.interactions-file", () -> DATA_DIR.resolve("interactions.json").toString());
        registry.add("ai.api-key", () -> "");
        registry.add("APP_ADMIN_USERNAME", () -> ADMIN_USERNAME);
        registry.add("APP_ADMIN_PASSWORD", () -> ADMIN_PASSWORD);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @AfterAll
    static void cleanUp() throws IOException {
        try (Stream<Path> stream = Files.walk(DATA_DIR)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // 清理失败不影响测试结论
                }
            });
        }
    }

    private static String cookieValue(List<String> setCookieHeaders, String name) {
        for (String header : setCookieHeaders) {
            if (header.startsWith(name + "=")) {
                String value = header.substring(name.length() + 1);
                int semicolon = value.indexOf(';');
                return semicolon >= 0 ? value.substring(0, semicolon) : value;
            }
        }
        return null;
    }

    private static String setCookieHeader(List<String> setCookieHeaders, String name) {
        for (String header : setCookieHeaders) {
            if (header.startsWith(name + "=")) {
                return header;
            }
        }
        return null;
    }

    @Test
    void csrfCookieIsReadableAndSessionCookieIsHardened() throws Exception {
        ResponseEntity<String> csrfResponse = restTemplate.getForEntity("/api/auth/csrf", String.class);
        assertEquals(200, csrfResponse.getStatusCodeValue());
        List<String> csrfCookies = csrfResponse.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(csrfCookies, "CSRF 接口必须下发 XSRF-TOKEN Cookie");
        String csrfHeader = setCookieHeader(csrfCookies, "XSRF-TOKEN");
        assertNotNull(csrfHeader);
        assertFalse(csrfHeader.toLowerCase().contains("httponly"),
                "XSRF-TOKEN 必须允许前端读取（不能 HttpOnly）: " + csrfHeader);
        String csrfToken = cookieValue(csrfCookies, "XSRF-TOKEN");
        JsonNode body = objectMapper.readTree(csrfResponse.getBody());
        assertEquals(csrfToken, body.path("token").asText(), "Cookie 与响应体中的 CSRF token 应一致");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(body.path("headerName").asText("X-XSRF-TOKEN"), csrfToken);
        headers.add(HttpHeaders.COOKIE, "XSRF-TOKEN=" + csrfToken);
        HttpEntity<String> request = new HttpEntity<>(
                "{\"username\":\"" + ADMIN_USERNAME + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}", headers);
        ResponseEntity<String> login = restTemplate.exchange("/api/auth/login", HttpMethod.POST, request,
                String.class);
        assertEquals(200, login.getStatusCodeValue());
        assertTrue(login.getBody().contains("\"role\":\"ADMIN\""), login.getBody());

        List<String> loginCookies = login.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(loginCookies, "登录成功必须下发会话 Cookie");
        String sessionHeader = setCookieHeader(loginCookies, "JSESSIONID");
        assertNotNull(sessionHeader, "登录成功必须下发 JSESSIONID");
        assertEquals(true, sessionHeader.toLowerCase().contains("httponly"),
                "JSESSIONID 必须 HttpOnly: " + sessionHeader);
        assertTrue(sessionHeader.toLowerCase().contains("samesite=lax"),
                "JSESSIONID 必须 SameSite=Lax: " + sessionHeader);
    }
}
