package com.guide.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.DigitalHumanConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;

/**
 * 数字人配置管理服务
 */
@Service
public class ConfigService {

    private static final Logger log = LoggerFactory.getLogger(ConfigService.class);

    @Value("${data.config-file:data/config.json}")
    private String configFilePath;

    private final ObjectMapper objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private DigitalHumanConfig config;

    @PostConstruct
    public void init() {
        load();
    }

    private void load() {
        try {
            File file = new File(configFilePath);
            if (file.exists()) {
                config = objectMapper.readValue(file, DigitalHumanConfig.class);
                log.info("数字人配置加载完成: {}", config.getName());
            } else {
                config = new DigitalHumanConfig();
                save();
                log.info("使用默认数字人配置");
            }
        } catch (IOException e) {
            log.warn("配置读取失败，使用默认配置: {}", e.getMessage());
            config = new DigitalHumanConfig();
        }
    }

    private void save() {
        try {
            File file = new File(configFilePath);
            if (!file.getParentFile().exists()) {
                file.getParentFile().mkdirs();
            }
            objectMapper.writeValue(file, config);
        } catch (IOException e) {
            log.error("配置保存失败: {}", e.getMessage());
        }
    }

    public DigitalHumanConfig getConfig() {
        return config;
    }

    public DigitalHumanConfig updateConfig(DigitalHumanConfig newConfig) {
        if (newConfig.getName() != null) config.setName(newConfig.getName());
        if (newConfig.getWelcomeMessage() != null) config.setWelcomeMessage(newConfig.getWelcomeMessage());
        if (newConfig.getVoiceType() != null) config.setVoiceType(newConfig.getVoiceType());
        if (newConfig.getModelName() != null) config.setModelName(newConfig.getModelName());
        if (newConfig.getPrimaryColor() != null) config.setPrimaryColor(newConfig.getPrimaryColor());
        config.setVolume(newConfig.getVolume());
        config.setSpeechRate(newConfig.getSpeechRate());
        save();
        log.info("数字人配置已更新");
        return config;
    }
}
