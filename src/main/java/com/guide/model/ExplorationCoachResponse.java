package com.guide.model;

/**
 * REQ-033 讲解搭档响应（API-033）。
 *
 * <p>任务：把当前观察任务的建议、后续观察问题、生成方式与来源分开返回给页面。
 * 输入：由 {@code ExplorationCoachService} 组装；输出：JSON
 * {@code {reply,followUp,mode,fallback,reference,source,notice}}。</p>
 *
 * <p>字段语义：{@code reply} 为非空纯文本（模型回复不超过 2400 字）；{@code followUp}
 * 为基于内容包 cues 生成的后续观察问题（不超过 160 字）；{@code mode} 为
 * {@code local-coach} 或 {@code model-coach}；{@code fallback} 表示本次是否降级；
 * {@code reference} 与 {@code source} 始终来自本次有效请求；{@code notice} 说明来源
 * 由内容包提供、未经独立核验且建议不评分。</p>
 *
 * <p>修改位置：字段与序列化在本类；生成规则与降级在 {@code ExplorationCoachService}。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 */
public class ExplorationCoachResponse {

    private String reply;
    private String followUp;
    private String mode;
    private boolean fallback;
    private String reference;
    private ExplorationCoachSource source;
    private String notice;

    public ExplorationCoachResponse() {
    }

    public String getReply() {
        return reply;
    }

    public void setReply(String reply) {
        this.reply = reply;
    }

    public String getFollowUp() {
        return followUp;
    }

    public void setFollowUp(String followUp) {
        this.followUp = followUp;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public boolean isFallback() {
        return fallback;
    }

    public void setFallback(boolean fallback) {
        this.fallback = fallback;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public ExplorationCoachSource getSource() {
        return source;
    }

    public void setSource(ExplorationCoachSource source) {
        this.source = source;
    }

    public String getNotice() {
        return notice;
    }

    public void setNotice(String notice) {
        this.notice = notice;
    }
}
