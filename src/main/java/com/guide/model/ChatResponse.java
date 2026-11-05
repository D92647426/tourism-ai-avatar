package com.guide.model;

import java.util.List;
import java.util.Collections;

/**
 * 对话响应模型
 */
public class ChatResponse {
    private String reply;
    private boolean fallback;
    private List<String> recommendedRoutes;  // 推荐路线
    private String interest;                 // 回显兴趣标签
    private String conversationId;
    private Integer spotId;
    private String themeId;
    private boolean themeLecture;
    private String narrationMode = "standard";
    private List<KnowledgeReference> knowledgeReferences = Collections.emptyList();

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
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public Integer getSpotId() { return spotId; }
    public void setSpotId(Integer spotId) { this.spotId = spotId; }
    /** REQ-052. Applied request theme, null when ordinary chat was used. */
    public String getThemeId() { return themeId; }
    public void setThemeId(String themeId) { this.themeId = themeId; }
    public boolean isThemeLecture() { return themeLecture; }
    public void setThemeLecture(boolean themeLecture) { this.themeLecture = themeLecture; }
    public String getNarrationMode() { return narrationMode; }
    public void setNarrationMode(String narrationMode) { this.narrationMode = narrationMode; }
    /** REQ-037/API-037: supplied local candidates, not verified or model-used citations. */
    public List<KnowledgeReference> getKnowledgeReferences() { return knowledgeReferences; }
    public void setKnowledgeReferences(List<KnowledgeReference> references) { this.knowledgeReferences = references; }
}
