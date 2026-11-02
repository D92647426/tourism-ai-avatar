package com.guide.controller;

import com.guide.model.DigitalHumanConfig;
import com.guide.service.ConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 公开数字人展示配置：游客端只读，不需要登录（REQ-030 / GitHub #5）。
 *
 * <p>只暴露现有数字人展示字段（名字、欢迎语、声音、模型、颜色、音量、语速），
 * 不包含任何用户或凭据信息。管理端的 GET/PUT {@code /api/admin/digital-human-config}
 * 仍然需要 ADMIN。
 *
 * <p>文档：[API 说明](../../../../../docs/api_reference.md)。
 */
@RestController
@RequestMapping("/api")
public class PublicConfigController {

    private final ConfigService configService;

    public PublicConfigController(ConfigService configService) {
        this.configService = configService;
    }

    /**
     * 读取公开数字人配置。
     *
     * @return 展示配置
     */
    @GetMapping("/digital-human-config")
    public ResponseEntity<DigitalHumanConfig> getPublicConfig() {
        return ResponseEntity.ok(configService.getConfig());
    }
}
