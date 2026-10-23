package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.User;
import com.guide.security.PasswordPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户服务 —— JSON 文件持久化，密码只保存 BCrypt 哈希。
 *
 * <p>负责（REQ-030 / GitHub #5）：
 * <ul>
 *   <li>可配置用户文件路径（{@code data.users-file}），测试使用临时文件；</li>
 *   <li>旧版明文 {@code password} 记录的一次性兼容迁移：先备份，再原子写入；</li>
 *   <li>注册只写入 {@code passwordHash}，角色固定为游客；</li>
 *   <li>管理员初始化只来自服务器环境变量，禁止静默提权或覆盖已有管理员密码。</li>
 * </ul>
 *
 * <p>迁移失败会抛出 {@link IllegalStateException} 终止启动，避免以空用户集合覆盖原文件。
 *
 * <p>文档：[配置说明](../../../../../docs/config_reference.md)、
 * [测试说明](../../../../../docs/test_reference.md)。
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    /** 备份文件后缀，形如 users.json.bak-1710000000000，需被 Git 忽略。 */
    private static final String BACKUP_SUFFIX = ".bak-";

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, User> users = new LinkedHashMap<>();
    private final File file;
    private final PasswordEncoder passwordEncoder;

    /**
     * @param usersFile       用户数据文件路径，来自 {@code data.users-file}
     * @param passwordEncoder 密码编码器（BCrypt）
     */
    public UserService(@Value("${data.users-file:data/users.json}") String usersFile,
                       PasswordEncoder passwordEncoder) {
        this.file = new File(usersFile);
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 启动时加载用户数据；旧版明文记录在此完成一次性迁移。
     *
     * @throws IllegalStateException 文件不可读、记录缺少密码字段或迁移写入失败
     */
    @PostConstruct
    public void init() {
        load();
    }

    @SuppressWarnings("deprecation")
    private void load() {
        users.clear();
        if (!file.exists()) {
            log.info("用户数据文件不存在，本次以空用户集合启动: {}", file.getPath());
            return;
        }
        List<User> list;
        try {
            list = mapper.readValue(file, new TypeReference<List<User>>() {
            });
        } catch (IOException e) {
            throw new IllegalStateException(
                    "读取用户数据失败，已停止启动以避免覆盖本地用户文件: " + file.getPath(), e);
        }
        if (list == null) {
            list = new ArrayList<>();
        }

        boolean needsMigration = false;
        boolean needsRewrite = false;
        for (User user : list) {
            if (isBlank(user.getId()) || isBlank(user.getUsername())) {
                throw new IllegalStateException(
                        "用户数据存在缺少 id 或用户名的记录，已停止启动以避免数据损坏: " + file.getPath());
            }
            String legacy = user.getPassword();
            if (!isBlank(user.getPasswordHash())) {
                if (!isBlank(legacy)) {
                    // 已迁移记录残留明文：清掉并重写，绝不保留明文密码。
                    user.setPassword(null);
                    needsRewrite = true;
                }
            } else if (!isBlank(legacy)) {
                needsMigration = true;
            } else {
                throw new IllegalStateException(
                        "用户记录缺少密码凭据，无法完成迁移: id=" + user.getId());
            }
            users.put(user.getId(), user);        }

        if (needsMigration) {
            migrateLegacyPasswords();
        } else if (needsRewrite) {
            save();
        }
        log.info("已加载 {} 个用户", users.size());
    }

    /**
     * 旧版明文密码一次性迁移：先备份原文件，再把明文替换为 BCrypt 哈希并原子写入。
     */
    @SuppressWarnings("deprecation")
    private void migrateLegacyPasswords() {
        Path source = file.toPath();
        Path backup = backupPath();
        try {
            Files.copy(source, backup, StandardCopyOption.COPY_ATTRIBUTES);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "创建用户数据备份失败，已停止迁移以避免丢失旧密码: " + backup, e);
        }

        int migrated = 0;
        for (User user : users.values()) {
            if (isBlank(user.getPasswordHash()) && !isBlank(user.getPassword())) {
                user.setPasswordHash(passwordEncoder.encode(user.getPassword()));
                user.setPassword(null);
                migrated++;
            }
        }
        save();
        log.info("已完成旧版明文密码迁移: {} 条记录，原文件备份为 {}", migrated, backup.getFileName());
    }

    /**
     * 原子写入用户数据：同目录临时文件 + 原子改名，避免中断产生半截 JSON。
     */
    private void save() {
        File parent = file.getAbsoluteFile().getParentFile();
        Path directory = (parent == null ? Paths.get(".") : parent.toPath());
        try {
            if (!Files.exists(directory)) {
                Files.createDirectories(directory);
            }
            Path temp = Files.createTempFile(directory, "users-", ".json.tmp");
            try {
                mapper.writerWithDefaultPrettyPrinter()
                        .writeValue(temp.toFile(), new ArrayList<>(users.values()));
                try {
                    Files.move(temp, file.toPath(), StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException e) {
                    Files.move(temp, file.toPath(), StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException e) {
            throw new IllegalStateException("保存用户数据失败: " + file.getPath(), e);
        }
    }

    private Path backupPath() {
        return file.toPath().resolveSibling(file.getName() + BACKUP_SUFFIX + System.currentTimeMillis());
    }

    /**
     * 注册普通游客账号：密码只保存哈希，角色固定 GUEST。
     *
     * @param username 用户名（调用方已完成格式校验）
     * @param password 明文密码（调用方已完成策略校验）
     * @return 新用户；用户名已存在时返回 {@code null}
     */
    public User register(String username, String password) {
        if (findByUsername(username) != null) {
            return null;
        }
        String id = UUID.randomUUID().toString().substring(0, 8);
        while (users.containsKey(id)) {
            id = UUID.randomUUID().toString().substring(0, 8);
        }
        User user = new User(id, username);
        user.setRole(User.ROLE_GUEST);
        user.setPasswordHash(passwordEncoder.encode(password));
        users.put(id, user);
        save();
        log.info("用户注册: {}", username);
        return user;
    }

    /**
     * 按服务器环境变量初始化本地管理员。
     *
     * <p>规则：两个变量必须同时提供；用户名与游客冲突时明确失败；已存在管理员时
     * 保留原密码，不因重复启动被静默覆盖。
     *
     * @param username 环境变量 APP_ADMIN_USERNAME，可为空
     * @param password 环境变量 APP_ADMIN_PASSWORD，可为空
     * @return 本次是否新建了管理员
     * @throws IllegalStateException 配置不完整、密码不符合策略或用户名已被游客占用
     */
    public boolean bootstrapAdmin(String username, String password) {
        boolean hasUsername = !isBlank(username);
        boolean hasPassword = !isBlank(password);
        if (!hasUsername && !hasPassword) {
            log.info("未配置 APP_ADMIN_USERNAME / APP_ADMIN_PASSWORD，默认不创建管理员账号");
            return false;
        }
        if (!hasUsername || !hasPassword) {
            throw new IllegalStateException(
                    "管理员初始化失败：APP_ADMIN_USERNAME 与 APP_ADMIN_PASSWORD 必须同时配置");
        }
        String name = username.trim();
        if (name.length() < 2 || name.length() > 20) {
            throw new IllegalStateException("管理员初始化失败：APP_ADMIN_USERNAME 需 2-20 个字符");
        }
        String policyError = PasswordPolicy.validateAdminPassword(password);
        if (policyError != null) {
            throw new IllegalStateException("管理员初始化失败：APP_ADMIN_PASSWORD " + policyError);
        }

        User existing = findByUsername(name);
        if (existing != null) {
            if (User.ROLE_ADMIN.equals(existing.getRole())) {
                log.info("管理员账号已存在，保留现有密码，不覆盖: {}", name);
                return false;
            }
            throw new IllegalStateException(
                    "管理员初始化失败：用户名 " + name + " 已被游客账号占用，拒绝静默提权；"
                            + "请更换 APP_ADMIN_USERNAME 或删除该游客记录");
        }

        String id = UUID.randomUUID().toString().substring(0, 8);
        while (users.containsKey(id)) {
            id = UUID.randomUUID().toString().substring(0, 8);
        }
        User admin = new User(id, name);
        admin.setRole(User.ROLE_ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(password));
        users.put(id, admin);
        save();
        log.info("已创建本地管理员账号: {}", name);
        return true;
    }

    /**
     * 更新兴趣偏好（调用方必须使用服务端登录身份，绝不信任客户端传入的 userId）。
     *
     * @param userId   用户 ID
     * @param interest 兴趣偏好
     * @return 更新后的用户；不存在返回 {@code null}
     */
    public User updateInterest(String userId, String interest) {
        User user = users.get(userId);
        if (user != null) {
            user.setInterest(interest);
            save();
        }
        return user;
    }

    /**
     * 按 ID 查找用户。
     *
     * @param id 用户 ID
     * @return 用户或 {@code null}
     */
    public User findById(String id) {
        return users.get(id);
    }

    /**
     * 按用户名查找用户（大小写敏感，与原逻辑一致）。
     *
     * @param username 用户名
     * @return 用户或 {@code null}
     */
    public User findByUsername(String username) {
        if (username == null) {
            return null;
        }
        for (User user : users.values()) {
            if (user.getUsername().equals(username)) {
                return user;
            }
        }
        return null;
    }

    /**
     * 返回全部用户（仅供管理接口转换成安全 DTO 后输出）。
     *
     * @return 用户列表副本
     */
    public List<User> getAllUsers() {
        return new ArrayList<>(users.values());
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
