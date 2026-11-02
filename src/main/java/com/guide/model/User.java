package com.guide.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 用户模型 —— 本地 JSON 文件持久化实体，仅用于服务端。
 *
 * <p>安全说明（REQ-030 / GitHub #5）：
 * <ul>
 *   <li>{@link #passwordHash} 保存 BCrypt 哈希，是新格式的唯一密码字段；</li>
 *   <li>{@link #password} 仅用于读取旧版明文记录，迁移完成后被清空，
 *       {@link JsonInclude.Include#NON_NULL} 保证空值不再写回文件；</li>
 *   <li>该实体不得直接作为 HTTP 响应返回，对外统一使用安全 DTO，
 *       避免密码字段泄漏。</li>
 * </ul>
 *
 * <p>文档：[需求追踪 REQ-030](../../../../../docs/requirements_traceability.md)、
 * [API 说明](../../../../../docs/api_reference.md)。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class User {

    /** 普通游客角色：注册即游客，只有管理员能拥有 ADMIN。 */
    public static final String ROLE_GUEST = "GUEST";

    /** 管理员角色：只能来自服务端用户记录或环境变量初始化。 */
    public static final String ROLE_ADMIN = "ADMIN";

    private String id;
    private String username;

    /** 旧版明文密码（兼容迁移用），迁移后为 null。 */
    private String password;

    /** BCrypt 密码哈希。 */
    private String passwordHash;

    private String interest;
    private String role;
    private long createdAt;

    public User() {
    }

    public User(String id, String username) {
        this.id = id;
        this.username = username;
        this.role = ROLE_GUEST;
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * 旧版明文密码字段，仅用于一次性迁移读取。
     *
     * @deprecated 新代码不得写入或校验该字段，统一使用 {@link #getPasswordHash()}。
     */
    @Deprecated
    public String getPassword() {
        return password;
    }

    /**
     * 旧版明文密码字段，仅用于一次性迁移读取。
     *
     * @deprecated 新代码不得写入或校验该字段，统一使用 {@link #setPasswordHash(String)}。
     */
    @Deprecated
    public void setPassword(String password) {
        this.password = password;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getInterest() {
        return interest;
    }

    public void setInterest(String interest) {
        this.interest = interest;
    }

    /**
     * 返回服务端记录的角色；空值按最小权限解释为游客，未知值同样降级为游客。
     *
     * @return {@link #ROLE_ADMIN} 或 {@link #ROLE_GUEST}
     */
    public String getRole() {
        if (ROLE_ADMIN.equals(role)) {
            return ROLE_ADMIN;
        }
        return ROLE_GUEST;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }
}
