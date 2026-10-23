package com.guide.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.guide.model.User;

/**
 * 认证接口的安全响应 DTO —— 只包含可对外字段，绝不包含密码或密码哈希。
 *
 * <p>对应 REQ-030 / GitHub #5；字段说明见
 * [API 说明](../../../../../docs/api_reference.md)。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthResult {

    private boolean success;
    private String message;
    private String userId;
    private String username;
    private String interest;
    private String role;

    /**
     * 构造成功响应。
     *
     * @param user 服务端用户记录
     * @return 不含密码字段的响应
     */
    public static AuthResult ok(User user) {
        AuthResult result = new AuthResult();
        result.success = true;
        result.userId = user.getId();
        result.username = user.getUsername();
        result.interest = user.getInterest();
        result.role = user.getRole();
        return result;
    }

    /**
     * 构造失败响应。
     *
     * @param message 可展示给用户的错误提示
     * @return 失败响应
     */
    public static AuthResult error(String message) {
        AuthResult result = new AuthResult();
        result.success = false;
        result.message = message;
        return result;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getInterest() {
        return interest;
    }

    public void setInterest(String interest) {
        this.interest = interest;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
