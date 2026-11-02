package com.guide.dto;

import com.guide.model.User;

/**
 * 用户列表的安全响应 DTO —— 管理端 {@code GET /api/admin/users} 使用。
 *
 * <p>只包含 id、用户名、兴趣、角色与注册时间，绝不包含 {@code password}
 * 或 {@code passwordHash}（REQ-030 / GitHub #5）。
 *
 * <p>字段说明见 [API 说明](../../../../../docs/api_reference.md)。
 */
public class UserView {

    private final String id;
    private final String username;
    private final String interest;
    private final String role;
    private final long createdAt;

    private UserView(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.interest = user.getInterest();
        this.role = user.getRole();
        this.createdAt = user.getCreatedAt();
    }

    /**
     * 由持久化实体转换为安全 DTO。
     *
     * @param user 用户记录
     * @return 安全视图
     */
    public static UserView from(User user) {
        return new UserView(user);
    }

    public String getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getInterest() {
        return interest;
    }

    public String getRole() {
        return role;
    }

    public long getCreatedAt() {
        return createdAt;
    }
}
