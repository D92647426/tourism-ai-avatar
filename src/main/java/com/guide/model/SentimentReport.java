package com.guide.model;

import java.util.List;
import java.util.Map;

/**
 * 问句情绪统计报告 — API-034 {@code GET /api/admin/reports/sentiment} 响应体。
 *
 * <p>统计口径（REQ-034，详见 docs/analytics_accuracy.md）：时区固定 Asia/Shanghai，
 * 近7天为 today-6 00:00 至本次统计时刻；有效情绪样本仅 positive/neutral/negative，
 * 未知或 null 标记归入 unclassified，计入问答次数但不计入正向占比分母。
 * 正向问句占比 = positive / 有效样本 × 100，保留两位小数；分母为 0 时为 {@code null}（不是 0，也不是 95）。</p>
 *
 * <p>旧字段 {@code satisfactionRate} 保留 JSON 键但恒为 {@code null}，表示未采集真实评价。</p>
 */
public class SentimentReport {

    private List<Map<String, Object>> trend;        // 近7天每日 positive/neutral/negative/unclassified/total
    private Double positiveQuestionRate;            // 正向问句占比（%），无有效样本时 null
    private int sentimentSampleCount;               // 有效问句情绪样本数
    private String periodStart;                     // 统计窗口起始日期（ISO，yyyy-MM-dd）
    private String periodEnd;                       // 统计窗口结束日期（ISO，yyyy-MM-dd）
    private String timezone;                        // 统计时区，固定 Asia/Shanghai
    private boolean estimated;                      // 是否为规则估计口径（恒为 true）
    private Double satisfactionRate;                // 已废弃：恒为 null
    private List<Map<String, Object>> topics;       // 近7天景点关键词提及排名
    private List<Map<String, Object>> suggestions;  // 基于近7天数据的建议（问句规则口径）

    public List<Map<String, Object>> getTrend() { return trend; }
    public void setTrend(List<Map<String, Object>> trend) { this.trend = trend; }
    public Double getPositiveQuestionRate() { return positiveQuestionRate; }
    public void setPositiveQuestionRate(Double positiveQuestionRate) { this.positiveQuestionRate = positiveQuestionRate; }
    public int getSentimentSampleCount() { return sentimentSampleCount; }
    public void setSentimentSampleCount(int sentimentSampleCount) { this.sentimentSampleCount = sentimentSampleCount; }
    public String getPeriodStart() { return periodStart; }
    public void setPeriodStart(String periodStart) { this.periodStart = periodStart; }
    public String getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(String periodEnd) { this.periodEnd = periodEnd; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public boolean isEstimated() { return estimated; }
    public void setEstimated(boolean estimated) { this.estimated = estimated; }
    public Double getSatisfactionRate() { return satisfactionRate; }
    public void setSatisfactionRate(Double satisfactionRate) { this.satisfactionRate = satisfactionRate; }
    public List<Map<String, Object>> getTopics() { return topics; }
    public void setTopics(List<Map<String, Object>> topics) { this.topics = topics; }
    public List<Map<String, Object>> getSuggestions() { return suggestions; }
    public void setSuggestions(List<Map<String, Object>> suggestions) { this.suggestions = suggestions; }
}
