package com.guide.model;

/**
 * 对话请求模型
 */
public class ChatRequest {
    private String message;
    private String interest;  // 游客兴趣标签：历史人文/自然风光/亲子出游/摄影打卡

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getInterest() { return interest; }
    public void setInterest(String interest) { this.interest = interest; }
}
