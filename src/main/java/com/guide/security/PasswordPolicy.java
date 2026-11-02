package com.guide.security;

import java.nio.charset.StandardCharsets;

/**
 * 密码策略（REQ-030 / GitHub #5）。
 *
 * <p>普通游客沿用原演示代码的“至少 4 位”规则，避免破坏已有游客登录；
 * 本地管理员密码由服务器环境变量提供，要求至少 8 位。两种情况都限制最大长度，
 * 因为 BCrypt 只使用前 72 个 UTF-8 字节，超长密码会因截断产生歧义。
 *
 * <p>文档：[配置说明](../../../../../docs/config_reference.md)、
 * [API 说明](../../../../../docs/api_reference.md)。
 */
public final class PasswordPolicy {

    /** 游客最短密码长度（沿用原逻辑）。 */
    public static final int GUEST_MIN_LENGTH = 4;

    /** 管理员最短密码长度。 */
    public static final int ADMIN_MIN_LENGTH = 8;

    /** 允许的最大字符数。 */
    public static final int MAX_LENGTH = 64;

    /** BCrypt 实际参与计算的 UTF-8 字节上限。 */
    public static final int MAX_BCRYPT_BYTES = 72;

    private PasswordPolicy() {
    }

    /**
     * 校验游客密码。
     *
     * @param password 明文密码
     * @return 不通过时的提示文案；通过返回 {@code null}
     */
    public static String validateGuestPassword(String password) {
        String basic = validateCommon(password, GUEST_MIN_LENGTH);
        if (basic != null) {
            return basic;
        }
        return null;
    }

    /**
     * 校验管理员密码（仅用于环境变量初始化，不用于普通注册）。
     *
     * @param password 明文密码
     * @return 不通过时的提示文案；通过返回 {@code null}
     */
    public static String validateAdminPassword(String password) {
        String basic = validateCommon(password, ADMIN_MIN_LENGTH);
        if (basic != null) {
            return basic;
        }
        return null;
    }

    private static String validateCommon(String password, int minLength) {
        if (password == null || password.isEmpty()) {
            return "密码不能为空";
        }
        if (password.length() < minLength) {
            return "密码至少 " + minLength + " 位";
        }
        if (password.length() > MAX_LENGTH) {
            return "密码不能超过 " + MAX_LENGTH + " 个字符";
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BCRYPT_BYTES) {
            return "密码的 UTF-8 编码不能超过 " + MAX_BCRYPT_BYTES + " 字节";
        }
        return null;
    }
}
