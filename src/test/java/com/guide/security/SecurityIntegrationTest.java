package com.guide.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import javax.servlet.http.Cookie;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 权限边界、CSRF、会话与响应安全集成测试（REQ-030 / GitHub #5）。
 *
 * <p>CSRF token 一律通过真实的 {@code GET /api/auth/csrf} 获取（Cookie 双提交），
 * 不使用 {@code with(csrf())}，因为开发配置使用 CookieCsrfTokenRepository，
 * 直接注入 request attribute 会被框架的 CSRF 过滤器重新校验并拒绝。
 *
 * <p>测试数据全部落在独立临时目录，不读取也不改写仓库里的真实 data/users.json。
 *
 * <p>文档：[测试说明](../../../../docs/test_reference.md)。
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    private static final String ADMIN_USERNAME = "it-admin";
    private static final String ADMIN_PASSWORD = "it-admin-pass-123";

    private static final Path DATA_DIR;

    static {
        Path created;
        try {
            created = Files.createTempDirectory("guide-security-it-");
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
        DATA_DIR = created;
        copyRepoData("knowledge.json");
        copyRepoData("config.json");
    }

    private static void copyRepoData(String fileName) {
        Path source = Paths.get("data", fileName);
        if (!Files.exists(source)) {
            throw new ExceptionInInitializerError("缺少测试依赖数据文件: " + source.toAbsolutePath());
        }
        try {
            Files.copy(source, DATA_DIR.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
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
    private MockMvc mockMvc;

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

    /** 一次 CSRF 取值结果：请求头 token 与需要回传的 Cookie。 */
    private static final class Csrf {
        private final String token;
        private final Cookie cookie;

        private Csrf(String token, Cookie cookie) {
            this.token = token;
            this.cookie = cookie;
        }

        private MockHttpServletRequestBuilder apply(MockHttpServletRequestBuilder builder) {
            MockHttpServletRequestBuilder applied = builder;
            if (cookie != null) {
                applied = applied.cookie(cookie);
            }
            return applied.header("X-XSRF-TOKEN", token);
        }
    }

    private Csrf csrf() throws Exception {
        return csrf(null);
    }

    private Csrf csrf(MockHttpSession session) throws Exception {
        MockHttpServletRequestBuilder builder = get("/api/auth/csrf");
        if (session != null) {
            builder = builder.session(session);
        }
        MvcResult result = mockMvc.perform(builder)
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return new Csrf(body.path("token").asText(),
                result.getResponse().getCookie("XSRF-TOKEN"));
    }

    private MockHttpSession register(String username, String password) throws Exception {
        Csrf csrf = csrf();
        MvcResult result = mockMvc.perform(csrf.apply(post("/api/auth/register"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession login(String username, String password) throws Exception {
        MockHttpSession session = new MockHttpSession();
        Csrf csrf = csrf(session);
        MvcResult result = mockMvc.perform(csrf.apply(post("/api/auth/login"))
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession authenticated = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(authenticated);
        return authenticated;
    }

    /**
     * 以 UTF-8 读取响应体（MockHttpServletResponse 默认按 ISO-8859-1 解码，
     * 含中文的 JSON 必须显式按 UTF-8 读，避免测试自身制造乱码）。
     *
     * @param result MockMvc 结果
     * @return UTF-8 解码后的响应体
     */
    private String jsonBody(MvcResult result) {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    private static String randomGuestName() {
        return "guest" + UUID.randomUUID().toString().substring(0, 6);
    }

    // ===== 匿名 / 游客 / 管理员边界 =====

    @Test
    void anonymousAdminGetReturns401() throws Exception {
        mockMvc.perform(get("/api/admin/dashboard"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void anonymousAdminWriteWithValidCsrfReturns401() throws Exception {
        Csrf csrf = csrf();
        mockMvc.perform(csrf.apply(put("/api/admin/digital-human-config"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"匿名写入\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void guestAdminGetReturns403() throws Exception {
        MockHttpSession guest = register(randomGuestName(), "pass1234");

        mockMvc.perform(get("/api/admin/dashboard").session(guest))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void guestAdminWriteWithValidCsrfReturns403() throws Exception {
        MockHttpSession guest = register(randomGuestName(), "pass1234");
        Csrf csrf = csrf(guest);

        mockMvc.perform(csrf.apply(put("/api/admin/digital-human-config"))
                        .session(guest)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"游客写入\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanReadDashboardAndWriteConfig() throws Exception {
        MockHttpSession admin = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        // 管理端修改配置需要 CSRF；游客端公开配置只读，不返回用户/凭据字段。
        String configName = "集成测试配置" + UUID.randomUUID().toString().substring(0, 4);
        Csrf csrf = csrf(admin);
        mockMvc.perform(csrf.apply(put("/api/admin/digital-human-config"))
                        .session(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + configName + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/dashboard").session(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/digital-human-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(configName));
    }

    @Test
    void adminUsersListNeverExposesPasswordFields() throws Exception {
        MockHttpSession admin = login(ADMIN_USERNAME, ADMIN_PASSWORD);

        MvcResult result = mockMvc.perform(get("/api/admin/users").session(admin))
                .andExpect(status().isOk())
                .andReturn();
        String body = jsonBody(result);
        assertFalse(body.toLowerCase().contains("password"), "用户列表响应不得包含密码字段: " + body);
        assertTrue(body.contains("role"));
    }

    @Test
    void missingCsrfIsRejectedOnAdminWrite() throws Exception {
        MockHttpSession guest = register(randomGuestName(), "pass1234");

        mockMvc.perform(put("/api/admin/digital-human-config")
                        .session(guest)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"无CSRF\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("CSRF 校验失败，请刷新页面后重试"));
    }

    @Test
    void wrongCsrfTokenIsRejected() throws Exception {
        MockHttpSession guest = register(randomGuestName(), "pass1234");
        Csrf csrf = csrf(guest);

        mockMvc.perform(put("/api/admin/digital-human-config")
                        .session(guest)
                        .cookie(csrf.cookie)
                        .header("X-XSRF-TOKEN", "invalid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"错误CSRF\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutInvalidatesServerSessionAndSubsequentRequestIs401() throws Exception {
        MockHttpSession admin = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        Csrf csrf = csrf(admin);

        mockMvc.perform(csrf.apply(post("/api/auth/logout")).session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertTrue(admin.isInvalid(), "退出登录必须让服务端会话失效");

        mockMvc.perform(get("/api/admin/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRotatesSessionId() throws Exception {
        MockHttpSession session = new MockHttpSession();
        csrf(session);
        String before = session.getId();

        Csrf csrf = csrf(session);
        mockMvc.perform(csrf.apply(post("/api/auth/login"))
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + ADMIN_USERNAME + "\",\"password\":\""
                                + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isOk());

        assertNotEquals(before, session.getId(), "登录必须更换 session id 以防止会话固定攻击");
    }

    // ===== 注册与响应安全 =====

    @Test
    void registerIgnoresClientSuppliedAdminRole() throws Exception {
        String username = randomGuestName();
        Csrf csrf = csrf();

        MvcResult result = mockMvc.perform(csrf.apply(post("/api/auth/register"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"pass1234\","
                                + "\"role\":\"ADMIN\",\"isAdmin\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("GUEST"));
        mockMvc.perform(get("/api/admin/dashboard").session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    void authResponsesNeverExposePasswordFields() throws Exception {
        String username = randomGuestName();
        Csrf csrf = csrf();

        MvcResult registerResult = mockMvc.perform(csrf.apply(post("/api/auth/register"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        assertNoPasswordField(jsonBody(registerResult));

        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);
        assertNoPasswordField(jsonBody(mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andReturn()));

        MockHttpSession admin = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        assertNoPasswordField(jsonBody(mockMvc.perform(get("/api/admin/users").session(admin))
                .andExpect(status().isOk()).andReturn()));
    }

    private static void assertNoPasswordField(String body) {
        assertFalse(body.toLowerCase().contains("password"), "响应不得包含密码字段: " + body);
        assertFalse(body.toLowerCase().contains("passwordhash"), "响应不得包含密码哈希: " + body);
    }

    // ===== 兴趣更新只信任服务端身份 =====

    @Test
    void interestUpdateUsesSessionIdentityInsteadOfClientUserId() throws Exception {
        String guestAName = randomGuestName();
        String guestBName = randomGuestName();
        MockHttpSession guestA = register(guestAName, "pass1234");
        MockHttpSession guestB = register(guestBName, "pass1234");

        MvcResult meB = mockMvc.perform(get("/api/auth/me").session(guestB))
                .andExpect(status().isOk())
                .andReturn();
        String guestBId = objectMapper.readTree(jsonBody(meB)).path("userId").asText();

        Csrf csrf = csrf(guestA);
        mockMvc.perform(csrf.apply(post("/api/auth/interest"))
                        .session(guestA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding("UTF-8")
                        .content("{\"userId\":\"" + guestBId + "\",\"interest\":\"摄影打卡\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(guestAName));

        MvcResult users = mockMvc.perform(get("/api/admin/users")
                        .session(login(ADMIN_USERNAME, ADMIN_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode list = objectMapper.readTree(jsonBody(users));
        String guestAInterest = null;
        boolean guestBHasInterest = false;
        for (JsonNode node : list) {
            if (guestAName.equals(node.path("username").asText())) {
                JsonNode interestNode = node.get("interest");
                guestAInterest = interestNode == null || interestNode.isNull()
                        ? null : interestNode.asText();
            }
            if (guestBName.equals(node.path("username").asText())) {
                JsonNode interestNode = node.get("interest");
                guestBHasInterest = interestNode != null && !interestNode.isNull()
                        && !interestNode.asText().isEmpty();
            }
        }
        assertEquals("摄影打卡", guestAInterest, "兴趣应写到当前会话用户");
        assertFalse(guestBHasInterest, "客户端传入的 userId 不得修改他人兴趣");
    }

    // ===== 公开配置与公开页面 =====

    @Test
    void publicConfigIsAnonymousReadableWithoutCredentials() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/digital-human-config"))
                .andExpect(status().isOk())
                .andReturn();
        String body = jsonBody(result);
        assertFalse(body.toLowerCase().contains("password"), "公开配置不得包含凭据字段: " + body);
        assertFalse(body.toLowerCase().contains("user"), "公开配置不得包含用户数据: " + body);
        assertTrue(objectMapper.readTree(body).has("name"));
    }

    @Test
    void publicPagesAndSpotsRemainAnonymousAccessible() throws Exception {
        mockMvc.perform(get("/")).andExpect(status().isOk());
        mockMvc.perform(get("/api/spots")).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/csrf")).andExpect(status().isOk());
    }
}
