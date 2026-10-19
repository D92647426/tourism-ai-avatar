package com.guide.model;

/**
 * 用户模型 — 注册/登录
 */
public class User {
    private String id;
    private String username;
    private String password;
    private String interest;  // 兴趣偏好
    private long createdAt;

    public User() {}

    public User(String id, String username, String password) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getInterest() { return interest; }
    public void setInterest(String interest) { this.interest = interest; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
