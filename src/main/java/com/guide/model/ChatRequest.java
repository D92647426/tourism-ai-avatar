package com.guide.model;

import com.fasterxml.jackson.annotation.JsonSetter;

/**
 * 对话请求模型
 */
public class ChatRequest {
    private String message;
    private String interest;  // 游客兴趣标签：历史人文/自然风光/亲子出游/摄影打卡
    private Integer spotId;
    private String conversationId;
    private String themeId;
    private Boolean themeLecture;
    private boolean themeFieldsPresent;
    private String narrationMode; // REQ-046: omitted keeps the current conversation's choice.

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getInterest() { return interest; }
    public void setInterest(String interest) { this.interest = interest; }
    public Integer getSpotId() { return spotId; }
    public void setSpotId(Integer spotId) { this.spotId = spotId; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getNarrationMode() { return narrationMode; }
    public void setNarrationMode(String narrationMode) { this.narrationMode = narrationMode; }
    public String getThemeId() { return themeId; }
    public Boolean getThemeLecture() { return themeLecture; }
    public boolean hasThemeFields() { return themeFieldsPresent; }

    /** REQ-052. JSON null/empty means ordinary chat. Other JSON types are invalid. */
    @JsonSetter("themeId")
    public void setThemeId(Object value) {
        if (value != null && !(value instanceof String)) throw new IllegalArgumentException("themeId must be a string or null");
        themeFieldsPresent = true;
        themeId = (String) value;
    }

    /** REQ-052. An optional action must be a JSON boolean when explicitly supplied. */
    @JsonSetter("themeLecture")
    public void setThemeLecture(Object value) {
        if (!(value instanceof Boolean)) throw new IllegalArgumentException("themeLecture must be a boolean");
        themeFieldsPresent = true;
        themeLecture = (Boolean) value;
    }
}
