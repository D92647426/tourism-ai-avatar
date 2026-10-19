package com.guide.model;

/**
 * 知识库条目实体
 */
public class KnowledgeItem {
    private int id;
    private String title;
    private String category;   // 景点讲解/文史资料/常见问题/其他
    private String content;
    private String keywords;   // 逗号分隔的关键词，用于检索匹配
    private String createTime;

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getKeywords() { return keywords; }
    public void setKeywords(String keywords) { this.keywords = keywords; }
    public String getCreateTime() { return createTime; }
    public void setCreateTime(String createTime) { this.createTime = createTime; }
}
