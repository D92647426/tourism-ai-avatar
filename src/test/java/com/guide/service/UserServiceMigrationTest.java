package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 用户数据迁移与管理员初始化测试（REQ-030 / GitHub #5）。
 *
 * <p>全部使用 {@link TempDir} 隔离，不读取、不输出仓库中真实的 data/users.json。
 *
 * <p>文档：[测试说明](../../../../docs/test_reference.md)。
 */
class UserServiceMigrationTest {

    private static final String LEGACY_JSON = "[{"
            + "\"id\":\"u-001\","
            + "\"username\":\"olduser\","
            + "\"password\":\"plain-pass\","
            + "\"interest\":\"历史人文\","
            + "\"createdAt\":1234567890123"
            + "}]";

    private final ObjectMapper mapper = new ObjectMapper();
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    @TempDir
    Path dir;

    private Path usersFile() {
        return dir.resolve("users.json");
    }

    private UserService newService() {
        return new UserService(usersFile().toString(), encoder);
    }

    private void write(String content) throws IOException {
        Files.write(usersFile(), content.getBytes(StandardCharsets.UTF_8));
    }

    private List<String> fileNames() throws IOException {
        try (Stream<Path> stream = Files.list(dir)) {
            return stream.map(p -> p.getFileName().toString()).collect(Collectors.toList());
        }
    }

    @Test
    void legacyPlaintextPasswordIsMigratedWithBackupAndDataPreserved() throws Exception {
        write(LEGACY_JSON);

        UserService service = newService();
        service.init();

        User user = service.findByUsername("olduser");
        assertNotNull(user);
        assertEquals("u-001", user.getId());
        assertEquals("历史人文", user.getInterest());
        assertEquals(1234567890123L, user.getCreatedAt());
        assertEquals(User.ROLE_GUEST, user.getRole());
        assertNull(user.getPassword());
        assertTrue(encoder.matches("plain-pass", user.getPasswordHash()));

        String migrated = new String(Files.readAllBytes(usersFile()), StandardCharsets.UTF_8);
        assertFalse(migrated.contains("plain-pass"), "迁移后文件不应保留明文密码");
        JsonNode node = mapper.readTree(migrated).get(0);
        assertTrue(node.has("passwordHash"));
        assertFalse(node.has("password"));

        List<String> backups = fileNames().stream()
                .filter(name -> name.startsWith("users.json.bak-"))
                .collect(Collectors.toList());
        assertEquals(1, backups.size(), "迁移前必须先创建备份文件");
        assertEquals(LEGACY_JSON, new String(Files.readAllBytes(dir.resolve(backups.get(0))),
                StandardCharsets.UTF_8), "备份文件应保留迁移前的原始内容");
    }

    @Test
    void migrationIsIdempotentAcrossRestarts() throws Exception {
        write(LEGACY_JSON);
        newService().init();

        newService().init();

        long backupCount = fileNames().stream()
                .filter(name -> name.startsWith("users.json.bak-"))
                .count();
        assertEquals(1, backupCount, "已迁移的数据不应在重启时重复备份");
    }

    @Test
    void corruptedFileFailsFastInsteadOfOverwriting() throws Exception {
        write("{not valid json");

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> newService().init());
        assertTrue(error.getMessage().contains("读取用户数据失败"));

        String raw = new String(Files.readAllBytes(usersFile()), StandardCharsets.UTF_8);
        assertEquals("{not valid json", raw, "启动失败时不得改写原文件");
    }

    @Test
    void recordWithoutAnyCredentialFailsFast() throws Exception {
        write("[{\"id\":\"u-002\",\"username\":\"nocred\",\"createdAt\":1}]");

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> newService().init());
        assertTrue(error.getMessage().contains("缺少密码凭据"));
    }

    @Test
    void registrationStoresOnlyBcryptHash() throws Exception {
        UserService service = newService();
        service.init();

        User user = service.register("newguest", "secret12");
        assertNotNull(user);
        assertEquals(User.ROLE_GUEST, user.getRole());
        assertNull(user.getPassword());

        String raw = new String(Files.readAllBytes(usersFile()), StandardCharsets.UTF_8);
        assertFalse(raw.contains("secret12"), "新注册记录不得保存明文密码");
        assertTrue(raw.contains("passwordHash"));

        UserService reloaded = newService();
        reloaded.init();
        assertTrue(encoder.matches("secret12", reloaded.findByUsername("newguest").getPasswordHash()));
    }

    @Test
    void duplicateUsernameRegistrationReturnsNull() {
        UserService service = newService();
        service.init();
        assertNotNull(service.register("dupuser", "pass1234"));
        assertNull(service.register("dupuser", "pass5678"));
    }

    @Test
    void bootstrapWithoutConfigurationCreatesNoAdmin() {
        UserService service = newService();
        service.init();

        assertFalse(service.bootstrapAdmin("", ""));
        assertNull(service.findByUsername("admin"));
        assertFalse(service.getAllUsers().stream()
                .anyMatch(u -> User.ROLE_ADMIN.equals(u.getRole())));
    }

    @Test
    void bootstrapWithPartialConfigurationFails() {
        UserService service = newService();
        service.init();

        assertThrows(IllegalStateException.class, () -> service.bootstrapAdmin("admin", ""));
        assertThrows(IllegalStateException.class, () -> service.bootstrapAdmin("", "password123"));
    }

    @Test
    void bootstrapEnforcesAdminPasswordPolicy() {
        UserService service = newService();
        service.init();

        assertThrows(IllegalStateException.class, () -> service.bootstrapAdmin("admin", "short"));
    }

    @Test
    void bootstrapRefusesGuestUsernameCollisionInsteadOfPromoting() {
        UserService service = newService();
        service.init();
        service.register("guestuser", "pass1234");

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.bootstrapAdmin("guestuser", "admin-pass-123"));
        assertTrue(error.getMessage().contains("拒绝静默提权"));

        assertEquals(User.ROLE_GUEST, service.findByUsername("guestuser").getRole());
    }

    @Test
    void bootstrapDoesNotOverwriteExistingAdminPassword() {
        UserService first = newService();
        first.init();
        assertTrue(first.bootstrapAdmin("rootadmin", "admin-pass-123"));

        UserService restarted = newService();
        restarted.init();
        assertFalse(restarted.bootstrapAdmin("rootadmin", "another-pass-456"));

        User admin = restarted.findByUsername("rootadmin");
        assertEquals(User.ROLE_ADMIN, admin.getRole());
        assertTrue(encoder.matches("admin-pass-123", admin.getPasswordHash()),
                "重复启动不得覆盖已有管理员密码");
        assertFalse(encoder.matches("another-pass-456", admin.getPasswordHash()));
    }
}
