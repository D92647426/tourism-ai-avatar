package com.guide.model;

import java.util.List;
import java.util.Map;

/**
 * 数据大屏综合数据
 */
public class DashboardData {
    private int todayVisitors;          // 今日服务人次
    private int weekVisitors;           // 本周服务人次
    private double satisfactionRate;    // 满意度百分比
    private int totalKnowledgeItems;    // 知识库条目数
    private List<Map<String, Object>> hotQuestions;    // 热门问答 Top5
    private List<Map<String, Object>> sentimentTrend;  // 近7天情感趋势
    private List<Map<String, Object>> spotRanking;     // 景点关注度排名
    private List<Map<String, Object>> hourlyDistribution; // 时段分布
    private double avgResponseTime;     // 平均响应耗时(ms)

    public int getTodayVisitors() { return todayVisitors; }
    public void setTodayVisitors(int todayVisitors) { this.todayVisitors = todayVisitors; }
    public int getWeekVisitors() { return weekVisitors; }
    public void setWeekVisitors(int weekVisitors) { this.weekVisitors = weekVisitors; }
    public double getSatisfactionRate() { return satisfactionRate; }
    public void setSatisfactionRate(double satisfactionRate) { this.satisfactionRate = satisfactionRate; }
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
    public double getAvgResponseTime() { return avgResponseTime; }
    public void setAvgResponseTime(double avgResponseTime) { this.avgResponseTime = avgResponseTime; }
}
