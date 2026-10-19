package com.guide.model;

/**
 * 数字人配置实体
 */
public class DigitalHumanConfig {
    private String name;            // 导游名称，如"灵灵"
    private String welcomeMessage;  // 欢迎语
    private String voiceType;       // 声音类型：female/male
    private String modelName;       // Live2D 模型名称
    private String primaryColor;    // 主题色
    private double volume;          // 音量 0.0~1.0
    private double speechRate;      // 语速 0.5~2.0

    public DigitalHumanConfig() {
        // 默认配置
        this.name = "灵灵";
        this.welcomeMessage = "阿弥陀佛！我是您的AI导游灵灵，欢迎来到灵山胜境，愿您在此感悟灵山，吉祥平安！";
        this.voiceType = "female";
        this.modelName = "haru";
        this.primaryColor = "#c8963e";
        this.volume = 1.0;
        this.speechRate = 1.0;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getWelcomeMessage() { return welcomeMessage; }
    public void setWelcomeMessage(String welcomeMessage) { this.welcomeMessage = welcomeMessage; }
    public String getVoiceType() { return voiceType; }
    public void setVoiceType(String voiceType) { this.voiceType = voiceType; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public String getPrimaryColor() { return primaryColor; }
    public void setPrimaryColor(String primaryColor) { this.primaryColor = primaryColor; }
    public double getVolume() { return volume; }
    public void setVolume(double volume) { this.volume = volume; }
    public double getSpeechRate() { return speechRate; }
    public void setSpeechRate(double speechRate) { this.speechRate = speechRate; }
}
