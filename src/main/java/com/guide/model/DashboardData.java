package com.guide.model;

import java.util.List;
import java.util.Map;

/**
 * 数据大屏综合数据 — API-034 {@code GET /api/admin/dashboard} 响应体。
 *
 * <p>统计口径（REQ-034，详见 docs/analytics_accuracy.md）：
 * 时区固定 Asia/Shanghai；近7天为 today-6 00:00 至本次统计时刻；问答次数按有效日志条数统计，
 * 不按用户/会话去重，也不推断独立访客；问句情绪由关键词规则估计，不等于真实满意度，也不代表真实评价。</p>
 *
 * <p>兼容策略：旧字段 {@code todayVisitors}、{@code weekVisitors}、{@code satisfactionRate}、
 * {@code avgResponseTime} 保留 JSON 键但恒为 {@code null}，表示“未采集”，不再输出伪造数值。
 * 页面只读取新口径字段。</p>
 */
public class DashboardData {

    // ===== 旧口径字段：保留 JSON 键，恒为 null（未采集，不伪造） =====

    private Integer todayVisitors;          // 已废弃：未采集独立访客，恒为 null
    private Integer weekVisitors;           // 已废弃：未采集独立访客，恒为 null
    private Double satisfactionRate;        // 已废弃：未采集真实评价，恒为 null
    private Double avgResponseTime;         // 已废弃：未采集响应耗时，恒为 null

    // ===== 新口径字段（REQ-034 / API-034） =====

    private int todayInteractions;          // 今日问答日志条数（含未知情绪，上海时区自然日）
    private int last7DaysInteractions;      // 近7天问答日志条数（today-6 00:00 至本次统计时刻）
    private int sentimentSampleCount;       // 有效问句情绪样本数（仅 positive/neutral/negative）
    private Double positiveQuestionRate;    // 正向问句占比（%），保留两位小数；无有效样本时为 null
    private String periodStart;             // 统计窗口起始日期（ISO，yyyy-MM-dd）
    private String periodEnd;               // 统计窗口结束日期（ISO，yyyy-MM-dd）
    private String timezone;                // 统计时区，固定 Asia/Shanghai
    private boolean estimated;              // 是否为规则估计口径（恒为 true）

    // ===== 知识库与图表字段 =====

    private int totalKnowledgeItems;    // 知识库条目数
    private List<Map<String, Object>> hotQuestions;        // 近7天热门问答 Top5
    private List<Map<String, Object>> sentimentTrend;      // 近7天问句情绪趋势（positive/neutral/negative/unclassified/total）
    private List<Map<String, Object>> spotRanking;         // 近7天景点关键词提及排名
    private List<Map<String, Object>> hourlyDistribution;  // 近7天时段分布

    public Integer getTodayVisitors() { return todayVisitors; }
    public void setTodayVisitors(Integer todayVisitors) { this.todayVisitors = todayVisitors; }
    public Integer getWeekVisitors() { return weekVisitors; }
    public void setWeekVisitors(Integer weekVisitors) { this.weekVisitors = weekVisitors; }
    public Double getSatisfactionRate() { return satisfactionRate; }
    public void setSatisfactionRate(Double satisfactionRate) { this.satisfactionRate = satisfactionRate; }
    public Double getAvgResponseTime() { return avgResponseTime; }
    public void setAvgResponseTime(Double avgResponseTime) { this.avgResponseTime = avgResponseTime; }

    public int getTodayInteractions() { return todayInteractions; }
    public void setTodayInteractions(int todayInteractions) { this.todayInteractions = todayInteractions; }
    public int getLast7DaysInteractions() { return last7DaysInteractions; }
    public void setLast7DaysInteractions(int last7DaysInteractions) { this.last7DaysInteractions = last7DaysInteractions; }
    public int getSentimentSampleCount() { return sentimentSampleCount; }
    public void setSentimentSampleCount(int sentimentSampleCount) { this.sentimentSampleCount = sentimentSampleCount; }
    public Double getPositiveQuestionRate() { return positiveQuestionRate; }
    public void setPositiveQuestionRate(Double positiveQuestionRate) { this.positiveQuestionRate = positiveQuestionRate; }
    public String getPeriodStart() { return periodStart; }
    public void setPeriodStart(String periodStart) { this.periodStart = periodStart; }
    public String getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(String periodEnd) { this.periodEnd = periodEnd; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public boolean isEstimated() { return estimated; }
    public void setEstimated(boolean estimated) { this.estimated = estimated; }

    public int getTotalKnowledgeItems() { return totalKnowledgeItems; }
    public void setTotalKnowledgeItems(int totalKnowledgeItems) { this.totalKnowledgeItems = totalKnowledgeItems; }
    public List<Map<String, Object>> getHotQuestions() { return hotQuestions; }
    public void setHotQuestions(List<Map<String, Object>> hotQuestions) { this.hotQuestions = hotQuestions; }
    public List<Map<String, Object>> getSentimentTrend() { return sentimentTrend; }
    public void setSentimentTrend(List<Map<String, Object>> sentimentTrend) { this.sentimentTrend = sentimentTrend; }
    public List<Map<String, Object>> getSpotRanking() { return spotRanking; }
    public void setSpotRanking(List<Map<String, Object>> spotRanking) { this.spotRanking = spotRanking; }
    public List<Map<String, Object>> getHourlyDistribution() { return hourlyDistribution; }
    public void setHourlyDistribution(List<Map<String, Object>> hourlyDistribution) { this.hourlyDistribution = hourlyDistribution; }
}
