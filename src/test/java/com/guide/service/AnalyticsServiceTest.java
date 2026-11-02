package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.DashboardData;
import com.guide.model.InteractionLog;
import com.guide.model.SentimentReport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AnalyticsService 统计口径测试（REQ-034 / GitHub #13，契约见 docs/analytics_accuracy.md，API-034）。
 *
 * <p>测试约定：</p>
 * <ul>
 *   <li>固定时钟 {@code 2026-03-10T12:00:00 Asia/Shanghai}，统计窗口为 2026-03-04 00:00 至该时刻；</li>
 *   <li>日志一律写入 {@link TempDir} 下的临时 JSON，再通过包级
 *       {@link AnalyticsService#setInteractionsFilePathForTesting(String)} + {@link AnalyticsService#init()} 加载，
 *       不读取开发者本机 data/interactions.json；</li>
 *   <li>不启动 Spring 上下文、不联网、不调用真实模型、不使用 Thread.sleep。</li>
 * </ul>
 *
 * <p>覆盖 15 组场景：空数据、真实 0%、未知情绪、按条数统计、七日窗口边界、时区跨日、
 * dashboard/report 一致性、旧 JSON 键、建议措辞、旧 logInteraction、重复加载稳定、
 * 占比四舍五入、单次快照、图表窗口过滤、并发记录与 flush 不丢日志不截断 JSON。</p>
 */
class AnalyticsServiceTest {

    private static final String STATISTICS_TIMEZONE = "Asia/Shanghai";

    private static final ZoneId SHANGHAI = ZoneId.of(STATISTICS_TIMEZONE);

    /** 固定“现在”：2026-03-10 12:00 上海时间（= 2026-03-10T04:00:00Z）。 */
    private static final Instant NOW = LocalDateTime.parse("2026-03-10T12:00:00").atZone(SHANGHAI).toInstant();

    private static final double EPS = 1e-9;

    @TempDir
    Path tempDir;

    // ===== 场景 1：空数据 =====

    @Test
    void emptyDataReportsZeroAndNullRate() throws IOException {
        AnalyticsService service = newService(Clock.fixed(NOW, SHANGHAI), emptyFile("empty.json"));
        DashboardData dashboard = service.getDashboardData(7);

        assertEquals(0, dashboard.getTodayInteractions(), "空数据今日问答次数应为 0");
        assertEquals(0, dashboard.getLast7DaysInteractions(), "空数据近7天问答次数应为 0");
        assertEquals(0, dashboard.getSentimentSampleCount(), "空数据有效情绪样本应为 0");
        assertNull(dashboard.getPositiveQuestionRate(), "空数据正向问句占比必须是 null，不能是 95");
        assertEquals(7, dashboard.getTotalKnowledgeItems());

        // 旧字段语义：保留键但值为 null（未采集，不伪造）。
        assertNull(dashboard.getTodayVisitors(), "todayVisitors 未采集，必须为 null");
        assertNull(dashboard.getWeekVisitors(), "weekVisitors 未采集，必须为 null");
        assertNull(dashboard.getSatisfactionRate(), "satisfactionRate 未采集，必须为 null");
        assertNull(dashboard.getAvgResponseTime(), "avgResponseTime 未采集，必须为 null");

        assertIsoDate(dashboard.getPeriodStart());
        assertIsoDate(dashboard.getPeriodEnd());
        assertEquals("2026-03-04", dashboard.getPeriodStart(), "近7天窗口起点应为 today-6（ISO 日期）");
        assertEquals("2026-03-10", dashboard.getPeriodEnd(), "近7天窗口终点应为 today（ISO 日期）");
        assertEquals(STATISTICS_TIMEZONE, dashboard.getTimezone());
        assertTrue(dashboard.isEstimated(), "统计口径必须标记 estimated=true");

        assertTrendDates(dashboard.getSentimentTrend(), "03-04", "03-10");
        for (Map<String, Object> day : dashboard.getSentimentTrend()) {
            assertEquals(0L, trendValue(day, "positive"), "空数据趋势 positive 应为 0");
            assertEquals(0L, trendValue(day, "neutral"), "空数据趋势 neutral 应为 0");
            assertEquals(0L, trendValue(day, "negative"), "空数据趋势 negative 应为 0");
            assertEquals(0L, trendValue(day, "unclassified"), "空数据趋势 unclassified 应为 0");
            assertEquals(0L, trendValue(day, "total"), "空数据趋势 total 应为 0");
        }
        assertTrue(dashboard.getHotQuestions().isEmpty(), "空数据热门问答应为空列表");
        assertTrue(dashboard.getSpotRanking().isEmpty(), "空数据景点排名应为空列表");
        assertEquals(24, dashboard.getHourlyDistribution().size(), "时段分布固定 24 项");
        for (Map<String, Object> slot : dashboard.getHourlyDistribution()) {
            assertEquals(0, ((Number) slot.get("count")).intValue(), "空数据每小时计数应为 0");
        }

        // 兼容旧命名入口同样不得伪造访客/满意度。
        assertEquals(0, service.getTodayVisitorCount());
        assertEquals(0, service.getWeekVisitorCount());
        assertNull(service.getSatisfactionRate(), "旧 getSatisfactionRate 空数据必须为 null，不能是 95");
        assertNull(service.getSentimentReport().getSatisfactionRate(), "report.satisfactionRate 必须为 null");
    }

    // ===== 场景 2：真实的 0% =====

    @Test
    void zeroPercentWhenOnlyNeutralAndNegativeSamples() throws IOException {
        Path file = writeLogs("zero-percent.json", Arrays.asList(
            entry(epochOf("2026-03-10T09:00:00"), "随便问问", "neutral", null),
            entry(epochOf("2026-03-10T10:00:00"), "太差了", "negative", null)
        ));
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(2, dashboard.getTodayInteractions());
        assertEquals(2, dashboard.getLast7DaysInteractions());
        assertEquals(2, dashboard.getSentimentSampleCount());
        assertNotNull(dashboard.getPositiveQuestionRate(), "有中性/负向有效样本时占比必须是 0.0 而不是 null");
        assertEquals(0.0, dashboard.getPositiveQuestionRate().doubleValue(), EPS, "无正向样本时真实占比为 0%");

        Map<String, Object> today = dashboard.getSentimentTrend().get(6);
        assertEquals("03-10", today.get("date"));
        assertEquals(0L, trendValue(today, "positive"));
        assertEquals(1L, trendValue(today, "neutral"));
        assertEquals(1L, trendValue(today, "negative"));
        assertEquals(0L, trendValue(today, "unclassified"));
        assertEquals(2L, trendValue(today, "total"));
    }

    // ===== 场景 3：未知 / null 情绪归入 unclassified，不进分母 =====

    @Test
    void unknownAndNullSentimentsCountAsUnclassified() throws IOException {
        Path file = writeLogs("unclassified.json", Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "谢谢讲解", "positive", null),
            entry(epochOf("2026-03-10T09:00:00"), "随便看看", "unknown", null),
            entry(epochOf("2026-03-10T10:00:00"), "再问一个", null, null)
        ));
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(3, dashboard.getTodayInteractions(), "未知/null 情绪仍计入今日问答次数");
        assertEquals(3, dashboard.getLast7DaysInteractions(), "未知/null 情绪仍计入近7天问答次数");
        assertEquals(1, dashboard.getSentimentSampleCount(), "只有 positive/neutral/negative 计入有效样本");
        assertNotNull(dashboard.getPositiveQuestionRate());
        assertEquals(100.0, dashboard.getPositiveQuestionRate().doubleValue(), EPS,
            "占比分母只含有效样本：1 正向 / 1 有效样本 = 100%");

        Map<String, Object> today = dashboard.getSentimentTrend().get(6);
        assertEquals(1L, trendValue(today, "positive"));
        assertEquals(0L, trendValue(today, "neutral"), "未知情绪不得偷偷算作 neutral");
        assertEquals(0L, trendValue(today, "negative"));
        assertEquals(2L, trendValue(today, "unclassified"), "unknown 与 null 都归入 unclassified");
        assertEquals(3L, trendValue(today, "total"));
    }

    // ===== 场景 4：同一问句多条日志按条数统计 =====

    @Test
    void sameQuestionCountedPerLogEntry() throws IOException {
        Path file = writeLogs("same-question.json", Arrays.asList(
            entry(epochOf("2026-03-10T09:00:00"), "灵山大佛门票多少钱", "positive", null),
            entry(epochOf("2026-03-10T10:00:00"), "灵山大佛门票多少钱", "positive", null)
        ));
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(2, dashboard.getTodayInteractions(), "同一问句 2 条日志应为 2 次问答，不按会话/问句去重");
        assertEquals(2, dashboard.getLast7DaysInteractions());
        assertEquals(2, dashboard.getSentimentSampleCount());
        assertNotNull(dashboard.getPositiveQuestionRate());
        assertEquals(100.0, dashboard.getPositiveQuestionRate().doubleValue(), EPS);
        assertEquals(2L, trendValue(dashboard.getSentimentTrend().get(6), "total"));
        assertEquals(1, dashboard.getHotQuestions().size(), "相同问句聚合为一条热门问答");
        assertEquals(2L, ((Number) dashboard.getHotQuestions().get(0).get("count")).longValue(),
            "热门问句计数同样按日志条数累计");
    }

    // ===== 场景 5：近7天上海时区窗口边界 =====

    @Test
    void sevenDayWindowShanghaiBoundaries() throws IOException {
        long windowStart = epochOf("2026-03-04T00:00:00");   // today-6 00:00:00，计入
        long beforeWindow = epochOf("2026-03-03T23:59:59"); // today-6 前一天最后一秒，排除
        long nowMillis = NOW.toEpochMilli();                // 本次统计时刻，计入

        List<InteractionLog> logs = new ArrayList<>();
        logs.add(entry(windowStart, "窗口起点问句", "positive", null));
        logs.add(entry(beforeWindow, "窗口前一天问句", "positive", null));
        logs.add(entry(nowMillis, "统计时刻问句", "neutral", null));
        logs.add(entry(nowMillis + 1L, "未来 1ms 问句", "positive", null));
        logs.add(entry(0L, "时间戳 0 问句", "positive", null));
        logs.add(entry(-12345L, "负数时间戳问句", "positive", null));
        logs.add(null);

        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), writeLogs("window-boundary.json", logs))
            .getDashboardData(0);

        assertEquals(2, dashboard.getLast7DaysInteractions(),
            "只有 today-6 00:00:00 与本统计时刻计入；前一天最后一秒、未来、0/负数时间戳、null 条目都排除");
        assertEquals(1, dashboard.getTodayInteractions(), "只有统计时刻当天（03-10）的日志计入今日");
        assertEquals(2, dashboard.getSentimentSampleCount());
        assertNotNull(dashboard.getPositiveQuestionRate());
        assertEquals(50.0, dashboard.getPositiveQuestionRate().doubleValue(), EPS);

        assertTrendDates(dashboard.getSentimentTrend(), "03-04", "03-10");
        assertEquals(1L, trendValue(dashboard.getSentimentTrend().get(0), "positive"),
            "today-6 00:00:00 归入首日 03-04");
        assertEquals(1L, trendValue(dashboard.getSentimentTrend().get(6), "neutral"),
            "统计时刻日志归入末日 03-10");
        long total = 0L;
        for (Map<String, Object> day : dashboard.getSentimentTrend()) {
            total += trendValue(day, "total");
        }
        assertEquals(2L, total, "窗口内趋势 total 合计应为 2");
    }

    // ===== 场景 6：时区跨日边界 =====

    @Test
    void timezoneCrossDayBoundary() throws IOException {
        // 2026-03-03T16:30:00Z = 上海 2026-03-04 00:30，属于窗口首日。
        long inWindow = Instant.parse("2026-03-03T16:30:00Z").toEpochMilli();
        // 2026-03-03T15:59:59Z = 上海 2026-03-03 23:59:59，早于窗口起点，排除。
        long outOfWindow = Instant.parse("2026-03-03T15:59:59Z").toEpochMilli();

        Path file = writeLogs("cross-day.json", Arrays.asList(
            entry(inWindow, "凌晨站点问句", "positive", null),
            entry(outOfWindow, "窗口前一天问句", "positive", null)
        ));
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(1, dashboard.getLast7DaysInteractions(), "UTC 16:30 应换算为上海 03-04 00:30 并计入窗口");
        assertEquals(0, dashboard.getTodayInteractions(), "03-04 的日志不属于今天 03-10");
        assertTrendDates(dashboard.getSentimentTrend(), "03-04", "03-10");
        assertEquals(1L, trendValue(dashboard.getSentimentTrend().get(0), "total"),
            "跨日日志归入上海时区 03-04，而不是 UTC 03-03");
        assertEquals(1, ((Number) dashboard.getHourlyDistribution().get(0).get("count")).intValue(),
            "上海 00:30 应落在 00:00 时段");
    }

    // ===== 场景 7：dashboard 与 report 口径一致 =====

    @Test
    void dashboardAndReportConsistent() throws IOException {
        Path file = writeLogs("consistent.json", Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "谢谢讲解", "positive", "灵山大佛"),
            entry(epochOf("2026-03-10T09:00:00"), "还行吧", "neutral", null),
            entry(epochOf("2026-03-10T10:00:00"), "太差了", "negative", null),
            entry(epochOf("2026-03-10T11:00:00"), "???", null, null)
        ));
        AnalyticsService service = newService(Clock.fixed(NOW, SHANGHAI), file);
        DashboardData dashboard = service.getDashboardData(0);
        SentimentReport report = service.getSentimentReport();

        assertEquals(4, dashboard.getTodayInteractions());
        assertEquals(4, dashboard.getLast7DaysInteractions());
        assertEquals(3, dashboard.getSentimentSampleCount(), "有效样本 3 条（未知 null 不计入）");
        assertNotNull(dashboard.getPositiveQuestionRate());
        assertEquals(33.33, dashboard.getPositiveQuestionRate().doubleValue(), EPS);

        assertEquals(dashboard.getPeriodStart(), report.getPeriodStart());
        assertEquals(dashboard.getPeriodEnd(), report.getPeriodEnd());
        assertEquals(dashboard.getTimezone(), report.getTimezone());
        assertEquals(dashboard.isEstimated(), report.isEstimated());
        assertEquals(dashboard.getPositiveQuestionRate(), report.getPositiveQuestionRate(),
            "dashboard 与 report 的正向问句占比必须一致");
        assertEquals(dashboard.getSentimentSampleCount(), report.getSentimentSampleCount(),
            "dashboard 与 report 的有效样本数必须一致");
        assertEquals(dashboard.getSentimentTrend(), report.getTrend(),
            "dashboard 与 report 的趋势（深度相等）必须一致");
        assertEquals(dashboard.getSpotRanking(), report.getTopics());
        assertNull(report.getSatisfactionRate(), "report.satisfactionRate 必须为 null");
    }

    // ===== 场景 8：旧字段 JSON 键保留且值为 null，新字段键存在且值正确 =====

    @Test
    void legacyJsonKeysPreservedAsNull() throws IOException {
        Path file = writeLogs("json-keys.json", Arrays.asList(
            entry(epochOf("2026-03-10T09:00:00"), "谢谢讲解", "positive", null)
        ));
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        ObjectMapper mapper = new ObjectMapper();
        String json = mapper.writeValueAsString(dashboard);
        JsonNode root = mapper.readTree(json);

        assertTrue(root.has("todayVisitors"), "JSON 必须保留旧键 todayVisitors");
        assertTrue(root.get("todayVisitors").isNull(), "todayVisitors 值必须为 null");
        assertTrue(root.has("weekVisitors"), "JSON 必须保留旧键 weekVisitors");
        assertTrue(root.get("weekVisitors").isNull(), "weekVisitors 值必须为 null");
        assertTrue(root.has("satisfactionRate"), "JSON 必须保留旧键 satisfactionRate");
        assertTrue(root.get("satisfactionRate").isNull(), "satisfactionRate 值必须为 null");
        assertTrue(root.has("avgResponseTime"), "JSON 必须保留旧键 avgResponseTime");
        assertTrue(root.get("avgResponseTime").isNull(), "avgResponseTime 值必须为 null");

        assertTrue(root.has("todayInteractions"));
        assertEquals(1, root.get("todayInteractions").asInt());
        assertTrue(root.has("last7DaysInteractions"));
        assertEquals(1, root.get("last7DaysInteractions").asInt());
        assertTrue(root.has("sentimentSampleCount"));
        assertEquals(1, root.get("sentimentSampleCount").asInt());
        assertTrue(root.has("positiveQuestionRate"));
        assertFalse(root.get("positiveQuestionRate").isNull());
        assertEquals(100.0, root.get("positiveQuestionRate").asDouble(), EPS);
        assertTrue(root.has("periodStart"));
        assertEquals("2026-03-04", root.get("periodStart").asText());
        assertTrue(root.has("periodEnd"));
        assertEquals("2026-03-10", root.get("periodEnd").asText());
        assertTrue(root.has("timezone"));
        assertEquals(STATISTICS_TIMEZONE, root.get("timezone").asText());
        assertTrue(root.has("estimated"));
        assertTrue(root.get("estimated").asBoolean());
    }

    // ===== 场景 9：建议措辞不得伪造评价 / 满意度 / 访客 =====

    @Test
    void suggestionsAvoidFakeEvaluationClaims() throws IOException {
        // 空数据
        SentimentReport emptyReport =
            newService(Clock.fixed(NOW, SHANGHAI), emptyFile("suggestions-empty.json")).getSentimentReport();
        assertFalse(emptyReport.getSuggestions().isEmpty(), "空数据也应有可解释说明");
        assertNoFakeEvaluation(emptyReport.getSuggestions());

        // 含负向样本（负向占比 > 20% 会触发规则提示）
        Path file = writeLogs("suggestions-negative.json", Arrays.asList(
            entry(epochOf("2026-03-10T09:00:00"), "讲解太差了", "negative", null),
            entry(epochOf("2026-03-10T10:00:00"), "谢谢讲解", "positive", null),
            entry(epochOf("2026-03-10T11:00:00"), "还行吧", "neutral", null)
        ));
        SentimentReport negativeReport = newService(Clock.fixed(NOW, SHANGHAI), file).getSentimentReport();
        assertFalse(negativeReport.getSuggestions().isEmpty(), "含负向样本也应给出规则建议");
        assertNoFakeEvaluation(negativeReport.getSuggestions());
        assertTrue(joinSuggestionText(negativeReport.getSuggestions()).contains("规则估计"),
            "建议必须说明占比来自问句关键词规则估计");
    }

    // ===== 场景 10：旧 logInteraction 入口可用，每 10 条落盘 =====

    @Test
    void logInteractionStillWorksAndFlushesEveryTenLogs() throws IOException {
        Path file = emptyFile("log-interaction.json");
        AnalyticsService service = newService(Clock.fixed(NOW, SHANGHAI), file);

        service.logInteraction("谢谢讲解", "不客气", null);
        DashboardData afterFirst = service.getDashboardData(0);
        assertEquals(1, afterFirst.getTodayInteractions(), "logInteraction 后今日问答次数应为 1");
        assertEquals(1, afterFirst.getLast7DaysInteractions());
        assertEquals(1, afterFirst.getSentimentSampleCount());
        assertNotNull(afterFirst.getPositiveQuestionRate());
        assertEquals(100.0, afterFirst.getPositiveQuestionRate().doubleValue(), EPS);
        Map<String, Object> today = afterFirst.getSentimentTrend().get(6);
        assertEquals(1L, trendValue(today, "positive"), "“谢谢讲解”应被规则标记为 positive");

        // 连续 10 条触发一次保存（保持原有每 10 条 flush 行为）。
        for (int i = 2; i <= 10; i++) {
            service.logInteraction("谢谢讲解" + i, "固定回答", null);
        }
        assertTrue(Files.exists(file), "累计 10 条后必须把日志写入临时 JSON");

        DashboardData reloaded = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);
        assertEquals(10, reloaded.getTodayInteractions(), "新实例应能恢复 10 条日志");
        assertEquals(10, reloaded.getLast7DaysInteractions());
        assertEquals(10, reloaded.getSentimentSampleCount(), "10 条都在近7天窗口内且都是有效样本");
        assertNotNull(reloaded.getPositiveQuestionRate());
        assertEquals(100.0, reloaded.getPositiveQuestionRate().doubleValue(), EPS);
    }

    // ===== 场景 11：读取临时 JSON 稳定、重复调用结果不变 =====

    @Test
    void reloadFromTempJsonIsStable() throws IOException {
        Path file = writeLogs("stable.json", Arrays.asList(
            entry(epochOf("2026-03-10T09:00:00"), "谢谢讲解", "positive", null),
            entry(epochOf("2026-03-08T09:00:00"), "随便问问", "neutral", null)
        ));
        DashboardData first = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);
        DashboardData second = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(first.getTodayInteractions(), second.getTodayInteractions());
        assertEquals(first.getLast7DaysInteractions(), second.getLast7DaysInteractions());
        assertEquals(first.getSentimentSampleCount(), second.getSentimentSampleCount());
        assertEquals(first.getPositiveQuestionRate(), second.getPositiveQuestionRate());
        assertEquals(first.getSentimentTrend(), second.getSentimentTrend());
        assertEquals(2, first.getLast7DaysInteractions());
        assertEquals(2, first.getSentimentSampleCount());
        assertNotNull(first.getPositiveQuestionRate());
        assertEquals(50.0, first.getPositiveQuestionRate().doubleValue(), EPS);

        AnalyticsService service = newService(Clock.fixed(NOW, SHANGHAI), file);
        DashboardData firstCall = service.getDashboardData(0);
        DashboardData secondCall = service.getDashboardData(0);
        assertEquals(firstCall.getTodayInteractions(), secondCall.getTodayInteractions());
        assertEquals(firstCall.getLast7DaysInteractions(), secondCall.getLast7DaysInteractions());
        assertEquals(firstCall.getSentimentSampleCount(), secondCall.getSentimentSampleCount());
        assertEquals(firstCall.getPositiveQuestionRate(), secondCall.getPositiveQuestionRate());
        assertEquals(firstCall.getSentimentTrend(), secondCall.getSentimentTrend(),
            "同一实例重复调用不得改变统计结果");
    }

    // ===== 场景 12：正向问句占比四舍五入 =====

    @Test
    void positiveQuestionRateRounding() throws IOException {
        List<InteractionLog> oneOfThree = Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "谢谢讲解", "positive", null),
            entry(epochOf("2026-03-10T09:00:00"), "随便问问", "neutral", null),
            entry(epochOf("2026-03-10T10:00:00"), "还行吧", "neutral", null)
        );
        assertEquals(33.33, rateFor("rounding-1-of-3.json", oneOfThree), EPS,
            "1/3 有效样本应四舍五入为 33.33");

        List<InteractionLog> twoOfThree = Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "谢谢讲解", "positive", null),
            entry(epochOf("2026-03-10T09:00:00"), "真美", "positive", null),
            entry(epochOf("2026-03-10T10:00:00"), "还行吧", "neutral", null)
        );
        assertEquals(66.67, rateFor("rounding-2-of-3.json", twoOfThree), EPS,
            "2/3 有效样本应四舍五入为 66.67");

        List<InteractionLog> oneOfOne = Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "谢谢讲解", "positive", null)
        );
        assertEquals(100.0, rateFor("rounding-1-of-1.json", oneOfOne), EPS,
            "1/1 有效样本为 100.0");

        List<InteractionLog> onlyUnclassified = Arrays.asList(
            entry(epochOf("2026-03-10T08:00:00"), "怎么走", "unknown", null),
            entry(epochOf("2026-03-10T09:00:00"), "在哪里", null, null)
        );
        Path file = writeLogs("rounding-only-unclassified.json", onlyUnclassified);
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);
        assertEquals(0, dashboard.getSentimentSampleCount());
        assertNull(dashboard.getPositiveQuestionRate(), "只有 unclassified 时占比必须为 null");
    }

    // ===== 场景 13：单次快照只取一次时刻 =====

    @Test
    void dashboardUsesSingleClockSnapshot() throws IOException {
        CountingClock countingClock = new CountingClock(NOW, SHANGHAI);
        AnalyticsService service = newService(countingClock, emptyFile("single-snapshot.json"));
        assertEquals(0, countingClock.getInstantCallCount(), "构造与 init 不应提前读取时钟");

        DashboardData dashboard = service.getDashboardData(0);

        assertEquals(1, countingClock.getInstantCallCount(),
            "一次 getDashboardData 只能取一次 Clock.instant()，保证快照内分子分母一致");
        assertEquals("2026-03-04", dashboard.getPeriodStart());
        assertEquals("2026-03-10", dashboard.getPeriodEnd());
        assertEquals(STATISTICS_TIMEZONE, dashboard.getTimezone());
    }

    // ===== 场景 14：时段/景点/热门问答只含窗口内日志 =====

    @Test
    void chartsOnlyUseWindowLogsAndHourlyHas24Slots() throws IOException {
        List<InteractionLog> logs = new ArrayList<>();
        logs.add(entry(epochOf("2026-03-10T09:15:00"), "灵山大佛怎么走", "positive", "灵山大佛")); // 窗口内
        logs.add(entry(epochOf("2026-02-20T10:00:00"), "五印坛城在哪里", "neutral", "五印坛城"));  // 过期
        logs.add(entry(NOW.toEpochMilli() + 3600_000L, "九龙灌浴几点", "positive", "九龙灌浴"));  // 未来
        logs.add(null);                                                                              // null 条目
        Path file = writeLogs("window-charts.json", logs);
        DashboardData dashboard = newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0);

        assertEquals(1, dashboard.getLast7DaysInteractions(), "只有窗口内 1 条日志参与统计");
        assertEquals(1, dashboard.getTodayInteractions());

        List<Map<String, Object>> ranking = dashboard.getSpotRanking();
        assertEquals(1, ranking.size(), "过期/未来日志的景点关键词不得进入排名");
        assertEquals("灵山大佛", ranking.get(0).get("spot"));
        assertEquals(1L, ((Number) ranking.get(0).get("count")).longValue());

        List<Map<String, Object>> hotQuestions = dashboard.getHotQuestions();
        assertEquals(1, hotQuestions.size(), "过期/未来日志不得进入热门问答");
        assertEquals("灵山大佛怎么走", hotQuestions.get(0).get("question"));
        assertEquals(1L, ((Number) hotQuestions.get(0).get("count")).longValue());

        List<Map<String, Object>> hourly = dashboard.getHourlyDistribution();
        assertEquals(24, hourly.size(), "时段分布固定 24 项");
        int hourlySum = 0;
        for (int i = 0; i < hourly.size(); i++) {
            int count = ((Number) hourly.get(i).get("count")).intValue();
            hourlySum += count;
            assertEquals(String.format("%02d:00", i), hourly.get(i).get("hour"));
        }
        assertEquals(1, hourlySum, "时段分布只统计窗口内日志");
        assertEquals(1, ((Number) hourly.get(9).get("count")).intValue(),
            "09:15 的窗口内日志应落在 09:00 时段");

        List<Map<String, Object>> trend = dashboard.getSentimentTrend();
        assertTrendDates(trend, "03-04", "03-10");
        long trendTotal = 0L;
        for (Map<String, Object> day : trend) {
            long categorySum = trendValue(day, "positive") + trendValue(day, "neutral")
                + trendValue(day, "negative") + trendValue(day, "unclassified");
            assertEquals(categorySum, trendValue(day, "total"),
                "每日 total 必须等于 positive+neutral+negative+unclassified: " + day.get("date"));
            trendTotal += trendValue(day, "total");
        }
        assertEquals(1L, trendTotal, "趋势合计等于窗口内日志条数");
    }

    // ===== 场景 15：并发记录与 flush 不丢日志、不截断 JSON =====

    /**
     * 多线程同时 logInteraction（触发每 10 条自动保存）与 flush，验证 save() 在锁内串行落盘：
     * 结束后 JSON 仍可解析、日志条数不缺、每条唯一；不使用 sleep，靠 CountDownLatch 同时起跑，
     * 并用有界线程池 + 超时/ finally shutdownNow 防止测试挂起。
     */
    @Test
    void concurrentLoggingAndFlushKeepJsonComplete() throws Exception {
        Path file = tempDir.resolve("concurrent.json");
        AnalyticsService service = newService(Clock.fixed(NOW, SHANGHAI), file);

        final int loggerThreads = 5;
        final int logsPerThread = 20;
        final int flushCalls = 60;
        final int expectedTotal = loggerThreads * logsPerThread;

        ExecutorService executor = Executors.newFixedThreadPool(loggerThreads + 1);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(loggerThreads + 1);
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (int t = 0; t < loggerThreads; t++) {
                final int threadIndex = t;
                futures.add(executor.submit(() -> {
                    try {
                        start.await();
                        for (int i = 0; i < logsPerThread; i++) {
                            service.logInteraction("并发问句-" + threadIndex + "-" + i, "固定回答", null);
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("并发记录线程被中断", e);
                    } finally {
                        done.countDown();
                    }
                }));
            }
            futures.add(executor.submit(() -> {
                try {
                    start.await();
                    for (int i = 0; i < flushCalls; i++) {
                        service.flush();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("并发 flush 线程被中断", e);
                } finally {
                    done.countDown();
                }
            }));

            start.countDown();
            assertTrue(done.await(30, TimeUnit.SECONDS),
                "并发任务未在 30 秒内结束，可能存在死锁或线程未释放");
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        // 收尾 flush，确保最后一次自动保存之后的增量也已落盘
        service.flush();
        assertTrue(Files.exists(file), "并发结束后日志文件必须存在: " + file);

        List<InteractionLog> persisted =
            new ObjectMapper().readValue(file.toFile(), new TypeReference<List<InteractionLog>>() {});
        assertEquals(expectedTotal, persisted.size(),
            "并发 flush / 每 10 条自动保存后 JSON 不得缺日志，也不得丢最新记录");
        Set<String> messages = new HashSet<>();
        for (InteractionLog item : persisted) {
            assertNotNull(item, "并发写入不得产生 null 日志条目");
            messages.add(item.getUserMessage());
        }
        assertEquals(expectedTotal, messages.size(), "每条并发日志都应唯一持久化，不能互相覆盖");
        for (int t = 0; t < loggerThreads; t++) {
            for (int i = 0; i < logsPerThread; i++) {
                String message = "并发问句-" + t + "-" + i;
                assertTrue(messages.contains(message), "并发写入的日志丢失: " + message);
            }
        }

        // 重新加载同一文件，统计快照也必须是完整 100 条
        AnalyticsService reloaded = newService(Clock.fixed(NOW, SHANGHAI), file);
        assertEquals(expectedTotal, reloaded.getDashboardData(0).getTodayInteractions(),
            "重新加载并发写入的 JSON 后，今日问答次数必须等于已记录条数");
    }

    // ===== 公共设施 =====

    private static InteractionLog entry(long timestamp, String userMessage, String sentiment, String spotKeyword) {
        InteractionLog item = new InteractionLog();
        item.setTimestamp(timestamp);
        item.setUserMessage(userMessage);
        item.setAiReply("固定回答");
        item.setSentiment(sentiment);
        item.setInterest(null);
        item.setSpotKeyword(spotKeyword);
        return item;
    }

    private static long epochOf(String shanghaiLocalDateTime) {
        return LocalDateTime.parse(shanghaiLocalDateTime).atZone(SHANGHAI).toInstant().toEpochMilli();
    }

    private Path emptyFile(String fileName) {
        return tempDir.resolve(fileName);
    }

    private Path writeLogs(String fileName, List<InteractionLog> logs) throws IOException {
        Path file = emptyFile(fileName);
        new ObjectMapper().writeValue(file.toFile(), logs);
        return file;
    }

    private static AnalyticsService newService(Clock clock, Path interactionsFile) {
        AnalyticsService service = new AnalyticsService(clock);
        service.setInteractionsFilePathForTesting(interactionsFile.toString());
        service.init();
        return service;
    }

    private Double rateFor(String fileName, List<InteractionLog> logs) throws IOException {
        Path file = writeLogs(fileName, logs);
        return newService(Clock.fixed(NOW, SHANGHAI), file).getDashboardData(0).getPositiveQuestionRate();
    }

    private static long trendValue(Map<String, Object> day, String key) {
        Object value = day.get(key);
        assertTrue(value instanceof Number, "趋势字段 " + key + " 必须是数字，实际为: " + value);
        return ((Number) value).longValue();
    }

    private static void assertIsoDate(String value) {
        assertNotNull(value, "日期字段不能为 null");
        assertEquals(value, LocalDate.parse(value).toString(), "日期必须是 ISO yyyy-MM-dd: " + value);
    }

    private static void assertTrendDates(List<Map<String, Object>> trend, String firstDate, String lastDate) {
        assertEquals(7, trend.size(), "近7天趋势必须包含 7 个自然日（today-6 至 today）");
        assertEquals(firstDate, trend.get(0).get("date"), "趋势首日日期不符");
        assertEquals(lastDate, trend.get(6).get("date"), "趋势末日日期不符");
        for (Map<String, Object> day : trend) {
            for (String key : Arrays.asList("date", "positive", "neutral", "negative", "unclassified", "total")) {
                assertTrue(day.containsKey(key), "趋势每日必须包含字段 " + key + ": " + day);
            }
        }
    }

    private static String joinSuggestionText(List<Map<String, Object>> suggestions) {
        StringBuilder builder = new StringBuilder();
        for (Map<String, Object> suggestion : suggestions) {
            builder.append(suggestion.get("level")).append('|')
                .append(suggestion.get("title")).append('|')
                .append(suggestion.get("detail")).append('\n');
        }
        return builder.toString();
    }

    /**
     * 建议措辞不得伪装真实满意度 / 真实访客 / 真实评价 / 平均耗时，也不得出现历史伪造值 95。
     * “真实评价”只允许出现在“不是真实评价”这类否定说明中。
     */
    private static void assertNoFakeEvaluation(List<Map<String, Object>> suggestions) {
        assertNotNull(suggestions, "suggestions 不能为 null");
        String text = joinSuggestionText(suggestions);
        assertFalse(text.contains("满意度"), "建议不得声称满意度: " + text);
        assertFalse(text.contains("负面反馈"), "建议不得把负向关键词说成负面反馈: " + text);
        assertFalse(text.contains("游客"), "建议不得归因游客态度: " + text);
        assertFalse(text.contains("平均耗时"), "建议不得声称平均耗时: " + text);
        assertFalse(text.contains("真实访客"), "建议不得声称真实访客: " + text);
        assertFalse(text.contains("95"), "建议不得出现历史伪造值 95: " + text);
        assertFalse(text.replace("不是真实评价", "").contains("真实评价"),
            "建议不得声称真实评价（否定说明除外）: " + text);
        for (Map<String, Object> suggestion : suggestions) {
            String level = String.valueOf(suggestion.get("level"));
            assertTrue("info".equals(level) || "warning".equals(level),
                "建议 level 只能是 info/warning，实际为: " + level);
            assertNotNull(suggestion.get("title"));
            assertNotNull(suggestion.get("detail"));
        }
    }

    /** 统计 Clock.instant() 调用次数的测试时钟，用于证明单次快照只取一个时刻。 */
    private static final class CountingClock extends Clock {

        private final Instant fixedInstant;

        private final ZoneId zone;

        private int instantCallCount;

        private CountingClock(Instant fixedInstant, ZoneId zone) {
            this.fixedInstant = fixedInstant;
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId newZone) {
            return newZone.equals(zone) ? this : new CountingClock(fixedInstant, newZone);
        }

        @Override
        public Instant instant() {
            instantCallCount++;
            return fixedInstant;
        }

        private int getInstantCallCount() {
            return instantCallCount;
        }
    }
}
