package com.guide.model;

/**
 * 交互日志实体
 */
public class InteractionLog {
    private long timestamp;
    private String userMessage;
    private String aiReply;
    private String sentiment;      // positive/neutral/negative
    private String interest;       // 游客兴趣标签（可为空）
    private String spotKeyword;    // 提取的景点关键词

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    public String getUserMessage() { return userMessage; }
    public void setUserMessage(String userMessage) { this.userMessage = userMessage; }
    public String getAiReply() { return aiReply; }
    public void setAiReply(String aiReply) { this.aiReply = aiReply; }
    public String getSentiment() { return sentiment; }
    public void setSentiment(String sentiment) { this.sentiment = sentiment; }
    public String getInterest() { return interest; }
    public void setInterest(String interest) { this.interest = interest; }
    public String getSpotKeyword() { return spotKeyword; }
    public void setSpotKeyword(String spotKeyword) { this.spotKeyword = spotKeyword; }
}
