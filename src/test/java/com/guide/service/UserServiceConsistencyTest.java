package com.guide.service;

import com.guide.model.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 用户数据一致性测试（REQ-030 / GitHub #5）。
 *
 * <p>覆盖：落盘失败时内存回滚（不留下“幽灵用户”或未持久化的兴趣）、
 * 无效旧数据（空根节点、重复 id、重复用户名、空记录）拒绝加载且保留原文件、
 * 并发注册不丢记录。全部使用 {@link TempDir} 独立目录，不触碰仓库 data/。
 *
 * <p>文档：[测试说明](../../../../docs/test_reference.md)。
 */
class UserServiceConsistencyTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    @TempDir
    Path tempDir;

    private static void writeRaw(Path file, String content) throws IOException {
        Files.createDirectories(file.getParent());
        Files.write(file, content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void registerRollsBackInMemoryWhenSaveFails() throws IOException {
        Path blocked = tempDir.resolve("blocked");
        // 让用户文件的父路径变成一个普通文件，随后写入必然失败
        Files.write(blocked, "not a directory".getBytes(StandardCharsets.UTF_8));
        Path usersFile = blocked.resolve("users.json");
        UserService service = new UserService(usersFile.toString(), encoder);
        service.init();

        assertThrows(IllegalStateException.class, () -> service.register("ghost-user", "guest-pass-1"));

        assertNull(service.findByUsername("ghost-user"), "写入失败后不能留下内存中的幽灵用户");
        assertEquals(0, service.getAllUsers().size());
        assertFalse(Files.exists(usersFile));
    }

    @Test
    void bootstrapAdminRollsBackInMemoryWhenSaveFails() throws IOException {
        Path blocked = tempDir.resolve("blocked-admin");
        Files.write(blocked, "not a directory".getBytes(StandardCharsets.UTF_8));
        Path usersFile = blocked.resolve("users.json");
        UserService service = new UserService(usersFile.toString(), encoder);
        service.init();

        assertThrows(IllegalStateException.class,
                () -> service.bootstrapAdmin("ghost-admin", "admin-pass-1"));

        assertNull(service.findByUsername("ghost-admin"));
        assertEquals(0, service.getAllUsers().size());
    }

    @Test
    void updateInterestRollsBackWhenSaveFails() throws IOException {
        Path dir = tempDir.resolve("data");
        Path usersFile = dir.resolve("users.json");
        UserService writer = new UserService(usersFile.toString(), encoder);
        writer.init();
        User user = writer.register("alice", "guest-pass-1");
        assertNotNull(user);

        UserService loaded = new UserService(usersFile.toString(), encoder);
        loaded.init();

        // 破坏落盘目标：用户文件目录被替换成普通文件，save() 必然失败
        Files.delete(usersFile);
        Files.delete(dir);
        Files.write(dir, "blocked".getBytes(StandardCharsets.UTF_8));

        assertThrows(IllegalStateException.class,
                () -> loaded.updateInterest(user.getId(), "摄影打卡"));

        assertNull(loaded.findById(user.getId()).getInterest(),
                "写入失败后内存兴趣必须回滚到旧值");
    }

    @Test
    void duplicateIdIsRejectedAndFileIsPreserved() throws IOException {
        Path usersFile = tempDir.resolve("dup-id.json");
        writeRaw(usersFile, "[{\"id\":\"dup1\",\"username\":\"a\",\"passwordHash\":\"x\"},"
                + "{\"id\":\"dup1\",\"username\":\"b\",\"passwordHash\":\"x\"}]");
        byte[] original = Files.readAllBytes(usersFile);

        UserService service = new UserService(usersFile.toString(), encoder);
        IllegalStateException error = assertThrows(IllegalStateException.class, service::init);

        assertTrue(error.getMessage().contains("重复 id"), error.getMessage());
        assertArrayEquals(original, Files.readAllBytes(usersFile), "拒绝加载时不能改写原文件");
    }

    @Test
    void duplicateUsernameIsRejectedAndFileIsPreserved() throws IOException {
        Path usersFile = tempDir.resolve("dup-name.json");
        writeRaw(usersFile, "[{\"id\":\"id1\",\"username\":\"same\",\"passwordHash\":\"x\"},"
                + "{\"id\":\"id2\",\"username\":\"same\",\"passwordHash\":\"x\"}]");
        byte[] original = Files.readAllBytes(usersFile);

        UserService service = new UserService(usersFile.toString(), encoder);
        IllegalStateException error = assertThrows(IllegalStateException.class, service::init);

        assertTrue(error.getMessage().contains("重复用户名"), error.getMessage());
        assertArrayEquals(original, Files.readAllBytes(usersFile), "拒绝加载时不能改写原文件");
    }

    @Test
    void nullRootIsRejectedAndFileIsPreserved() throws IOException {
        Path usersFile = tempDir.resolve("null-root.json");
        writeRaw(usersFile, "null");
        byte[] original = Files.readAllBytes(usersFile);

        UserService service = new UserService(usersFile.toString(), encoder);
        assertThrows(IllegalStateException.class, service::init);

        assertArrayEquals(original, Files.readAllBytes(usersFile), "拒绝加载时不能改写原文件");
    }

    @Test
    void nullRecordIsRejectedAndFileIsPreserved() throws IOException {
        Path usersFile = tempDir.resolve("null-record.json");
        writeRaw(usersFile, "[null]");
        byte[] original = Files.readAllBytes(usersFile);

        UserService service = new UserService(usersFile.toString(), encoder);
        assertThrows(IllegalStateException.class, service::init);

        assertArrayEquals(original, Files.readAllBytes(usersFile), "拒绝加载时不能改写原文件");
    }

    @Test
    void concurrentRegistrationsAreAllPersisted() throws Exception {
        Path usersFile = tempDir.resolve("concurrent").resolve("users.json");
        UserService service = new UserService(usersFile.toString(), encoder);
        service.init();

        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<User>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                final int index = i;
                futures.add(pool.submit(() -> {
                    start.await(5, TimeUnit.SECONDS);
                    return service.register("concurrent-" + index, "guest-pass-1");
                }));
            }
            start.countDown();
            for (Future<User> future : futures) {
                assertNotNull(future.get(10, TimeUnit.SECONDS), "并发注册不应失败");
            }
        } finally {
            pool.shutdownNow();
        }
        assertEquals(threads, service.getAllUsers().size());

        UserService reloaded = new UserService(usersFile.toString(), encoder);
        reloaded.init();
        assertEquals(threads, reloaded.getAllUsers().size(), "并发注册后重新加载不能丢记录");
    }

    @Test
    void loadFailureDoesNotLeaveHalfLoadedUsers() throws IOException {
        Path usersFile = tempDir.resolve("half.json");
        writeRaw(usersFile, "[{\"id\":\"ok1\",\"username\":\"ok\",\"passwordHash\":\"x\"},"
                + "{\"id\":\"bad\",\"username\":\"bad\"}]");
        UserService service = new UserService(usersFile.toString(), encoder);

        assertThrows(IllegalStateException.class, service::init);
        assertEquals(0, service.getAllUsers().size(), "加载失败后不能保留半加载的用户");
    }
}
