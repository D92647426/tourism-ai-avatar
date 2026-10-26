package com.guide.controller;

import com.guide.model.DashboardData;
import com.guide.model.SentimentReport;
import com.guide.service.AnalyticsService;
import com.guide.service.ConfigService;
import com.guide.service.KnowledgeService;
import com.guide.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AdminController 统计/报告端点转发测试（REQ-034 / API-034）。
 *
 * <p>只验证控制器是否把聚合工作交给 AnalyticsService（单次快照入口），并保留 dashboard 原有的 flush 行为；
 * 统计口径本身由 AnalyticsServiceTest 用固定时钟覆盖。本测试不启动 Spring 上下文、不读 data 目录、不联网。</p>
 *
 * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。</p>
 */
@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private KnowledgeService knowledgeService;

    @Mock
    private ConfigService configService;

    @Mock
    private AnalyticsService analyticsService;

    @Mock
    private UserService userService;

    @InjectMocks
    private AdminController adminController;

    @Test
    @DisplayName("dashboard 转发 getDashboardData(knowledgeCount) 并保留 flush")
    void dashboardForwardsSingleSnapshotAggregationAndKeepsFlush() {
        DashboardData data = new DashboardData();
        data.setTodayInteractions(3);
        data.setLast7DaysInteractions(5);
        data.setSentimentSampleCount(4);
        data.setPositiveQuestionRate(50.0);
        data.setPeriodStart("2026-03-04");
        data.setPeriodEnd("2026-03-10");
        data.setTimezone("Asia/Shanghai");
        data.setEstimated(true);
        data.setTotalKnowledgeItems(7);

        when(knowledgeService.getCount()).thenReturn(7);
        when(analyticsService.getDashboardData(7)).thenReturn(data);

        ResponseEntity<DashboardData> response = adminController.getDashboard();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(data, response.getBody());
        assertEquals(3, response.getBody().getTodayInteractions());
        assertEquals(5, response.getBody().getLast7DaysInteractions());
        assertEquals(4, response.getBody().getSentimentSampleCount());
        assertEquals(50.0, response.getBody().getPositiveQuestionRate());
        // API-034：旧字段保留 JSON 键但均为 null（未采集，不伪造）
        assertNull(response.getBody().getTodayVisitors());
        assertNull(response.getBody().getWeekVisitors());
        assertNull(response.getBody().getSatisfactionRate());
        assertNull(response.getBody().getAvgResponseTime());
        verify(analyticsService).flush();
    }

    @Test
    @DisplayName("reports/sentiment 转发 getSentimentReport()，不再自行取满意度")
    void sentimentReportForwardsAggregationEntry() {
        SentimentReport report = new SentimentReport();
        report.setTrend(new ArrayList<>());
        report.setPositiveQuestionRate(null);
        report.setSentimentSampleCount(0);
        report.setPeriodStart("2026-03-04");
        report.setPeriodEnd("2026-03-10");
        report.setTimezone("Asia/Shanghai");
        report.setEstimated(true);
        report.setSatisfactionRate(null);

        when(analyticsService.getSentimentReport()).thenReturn(report);

        ResponseEntity<SentimentReport> response = adminController.getSentimentReport();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(report, response.getBody());
        assertNull(response.getBody().getSatisfactionRate());
        verify(analyticsService).getSentimentReport();
    }
}
