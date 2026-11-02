package com.guide.config;

import com.guide.service.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 启动时按服务器环境变量初始化本地管理员（REQ-030 / GitHub #5）。
 *
 * <p>凭据只来自 {@code APP_ADMIN_USERNAME} 与 {@code APP_ADMIN_PASSWORD}，
 * 不写入代码、不提交、不打印密码。两者都不配置时不创建任何默认管理员；
 * 两者只配置一个、用户名与游客冲突、密码不符合策略时启动直接失败。
 *
 * <p>文档：[配置说明](../../../../../docs/config_reference.md)、
 * [README 启动方式](../../../../../README.md)。
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private final UserService userService;
    private final String adminUsername;
    private final String adminPassword;

    public AdminBootstrapRunner(UserService userService,
                                @Value("${APP_ADMIN_USERNAME:}") String adminUsername,
                                @Value("${APP_ADMIN_PASSWORD:}") String adminPassword) {
        this.userService = userService;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        userService.bootstrapAdmin(adminUsername, adminPassword);
    }
}
