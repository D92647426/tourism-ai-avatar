package com.guide.model;

/**
 * REQ-033 讲解搭档响应中的来源字段。
 *
 * <p>任务：把本次有效请求携带的资料来源原样回显给页面，供页面单独展示“来源与正文分开”。
 * 输入：来自内容包校验后的 source.title/source.url/source.status；输出：JSON
 * {@code {title,url,status}}。模型回复不能覆盖本对象。</p>
 *
 * <p>修改位置：字段与序列化在本类；校验规则在 {@code ExplorationCoachService}。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 */
public class ExplorationCoachSource {

    private String title;
    private String url;
    private String status;

    public ExplorationCoachSource() {
    }

    /**
     * @param title  来源标题，来自本次请求
     * @param url    来源链接，来自本次请求（后端不访问）
     * @param status 来源状态，inherited-unverified 或 original-demo
     */
    public ExplorationCoachSource(String title, String url, String status) {
        this.title = title;
        this.url = url;
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
