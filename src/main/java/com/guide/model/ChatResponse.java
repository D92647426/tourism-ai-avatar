package com.guide.model;

import java.util.List;

/**
 * 对话响应模型
 */
public class ChatResponse {
    private String reply;
    private boolean fallback;
    private List<String> recommendedRoutes;  // 推荐路线
    private String interest;                 // 回显兴趣标签

    public ChatResponse(String reply, boolean fallback) {
        this.reply = reply;
        this.fallback = fallback;
    }

    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }
    public boolean isFallback() { return fallback; }
    public void setFallback(boolean fallback) { this.fallback = fallback; }
    public List<String> getRecommendedRoutes() { return recommendedRoutes; }
    public void setRecommendedRoutes(List<String> recommendedRoutes) { this.recommendedRoutes = recommendedRoutes; }
    public String getInterest() { return interest; }
    public void setInterest(String interest) { this.interest = interest; }
}
