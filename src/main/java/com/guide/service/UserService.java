package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * 用户服务 — JSON 文件持久化
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final String DATA_DIR = "data";
    private static final String FILE_NAME = "users.json";

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, User> users = new LinkedHashMap<>();
    private final File file;

    public UserService() {
        file = new File(DATA_DIR, FILE_NAME);
        load();
    }

    private void load() {
        try {
            if (file.exists()) {
                List<User> list = mapper.readValue(file, new TypeReference<List<User>>() {});
                for (User u : list) {
                    users.put(u.getId(), u);
                }
                log.info("已加载 {} 个用户", users.size());
            }
        } catch (IOException e) {
            log.warn("加载用户数据失败: {}", e.getMessage());
        }
    }

    private void save() {
        try {
            if (!file.getParentFile().exists()) file.getParentFile().mkdirs();
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, new ArrayList<>(users.values()));
        } catch (IOException e) {
            log.error("保存用户数据失败: {}", e.getMessage());
        }
    }

    /**
     * 注册
     */
    public User register(String username, String password) {
        if (findByUsername(username) != null) return null;
        String id = UUID.randomUUID().toString().substring(0, 8);
        User user = new User(id, username, password);
        users.put(id, user);
        save();
        log.info("用户注册: {}", username);
        return user;
    }

    /**
     * 登录验证
     */
    public User login(String username, String password) {
        User user = findByUsername(username);
        if (user != null && user.getPassword().equals(password)) {
            return user;
        }
        return null;
    }

    /**
     * 更新兴趣偏好
     */
    public User updateInterest(String userId, String interest) {
        User user = users.get(userId);
        if (user != null) {
            user.setInterest(interest);
            save();
        }
        return user;
    }

    public User findById(String id) {
        return users.get(id);
    }

    public User findByUsername(String username) {
        for (User u : users.values()) {
            if (u.getUsername().equals(username)) return u;
        }
        return null;
    }

    public List<User> getAllUsers() {
        return new ArrayList<>(users.values());
    }
}
