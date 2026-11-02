package com.guide.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 密码策略单元测试（REQ-030 / GitHub #5）。
 *
 * <p>文档：[测试说明](../../../../docs/test_reference.md)。
 */
class PasswordPolicyTest {

    @Test
    void guestPasswordKeepsLegacyMinimumLength() {
        assertNotNull(PasswordPolicy.validateGuestPassword("abc"));
        assertNull(PasswordPolicy.validateGuestPassword("abcd"));
    }

    @Test
    void adminPasswordRequiresLongerSecret() {
        assertNotNull(PasswordPolicy.validateAdminPassword("short7c"));
        assertNull(PasswordPolicy.validateAdminPassword("long-enough-8"));
    }

    @Test
    void emptyPasswordIsRejected() {
        assertEquals("密码不能为空", PasswordPolicy.validateGuestPassword(""));
        assertEquals("密码不能为空", PasswordPolicy.validateAdminPassword(null));
    }

    @Test
    void lengthLimitsProtectBcryptTruncation() {
        StringBuilder sixtyFive = new StringBuilder();
        for (int i = 0; i < 65; i++) {
            sixtyFive.append('a');
        }
        assertNotNull(PasswordPolicy.validateGuestPassword(sixtyFive.toString()));

        StringBuilder twentyFiveChinese = new StringBuilder();
        for (int i = 0; i < 25; i++) {
            twentyFiveChinese.append('密');
        }
        assertNotNull(PasswordPolicy.validateGuestPassword(twentyFiveChinese.toString()));

        StringBuilder twentyFourChinese = new StringBuilder();
        for (int i = 0; i < 24; i++) {
            twentyFourChinese.append('密');
        }
        assertNull(PasswordPolicy.validateGuestPassword(twentyFourChinese.toString()));
    }
}
