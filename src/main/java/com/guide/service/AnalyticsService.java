package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.DashboardData;
import com.guide.model.InteractionLog;
import com.guide.model.SentimentReport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 分析统计服务 — 交互日志记录、问句情绪规则估计、可解释统计报告。
 *
 * <p>本服务落实 REQ-034 / GitHub #13 的“诚实统计”口径（契约见 docs/analytics_accuracy.md，API 见 API-034）：</p>
 * <ul>
 *   <li>时区固定 {@code Asia/Shanghai}；近7天窗口为 today-6 当天 00:00 至本次统计时刻，截断未来日志；</li>
 *   <li>问答次数按有效日志条数统计，不按用户/会话去重，也不推断独立访客；</li>
 *   <li>有效情绪样本仅 positive/neutral/negative，未知或 null 标记归入 unclassified（计入次数，不计入占比分母）；</li>
 *   <li>正向问句占比 = positive / 有效样本 × 100，四舍五入两位；有效样本为 0 时返回 {@code null}（空分母不是 0，更不是 95）；</li>
 *   <li>所有图表与建议只使用上述近7天窗口和日志副本，不伪造满意度、平均耗时或真实访客。</li>
 * </ul>
 *
 * <p>一致性：{@link #getDashboardData(int)} 与 {@link #getSentimentReport()} 在单次调用内只取一个时刻
 * （{@link Clock#instant()}）和一份日志副本，避免跨午夜或并发新增日志导致分子分母来自不同快照。</p>
 *
 * <p>时钟：默认使用系统时钟，测试可通过 {@link #AnalyticsService(Clock)} 注入固定时钟。</p>
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    /** 统计时区变化属于产品口径变更，必须同步更新 docs/analytics_accuracy.md 与 API-034。 */
    public static final String STATISTICS_TIMEZONE = "Asia/Shanghai";

    /** 统计时区，固定东八区。 */
    public static final ZoneId STATISTICS_ZONE = ZoneId.of(STATISTICS_TIMEZONE);

    /** 趋势包含今天在内的自然日数量（REQ-034：today-6 至 today 共 7 天，不是 8 天）。 */
    private static final int TREND_DAY_COUNT = 7;

    private static final DateTimeFormatter TREND_DATE_FORMATTER = DateTimeFormatter.ofPattern("MM-dd");

    private static final String POSITIVE = "positive";
    private static final String NEUTRAL = "neutral";
    private static final String NEGATIVE = "negative";
    private static final String UNCLASSIFIED = "unclassified";

    private static final int IDX_POSITIVE = 0;
    private static final int IDX_NEUTRAL = 1;
    private static final int IDX_NEGATIVE = 2;
    private static final int IDX_UNCLASSIFIED = 3;

    /** 现有日志中认可的情绪标记；其余（含 null、未知字符串）一律计为 unclassified。 */
    private static final Set<String> VALID_SENTIMENTS = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(POSITIVE, NEUTRAL, NEGATIVE))
    );

    @Value("${data.interactions-file:data/interactions.json}")
    private String interactionsFilePath;

    private final ObjectMapper objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    /** 日志锁：所有读写都在锁内复制/替换列表，避免并发迭代与 Jackson 写入冲突。 */
    private final Object logsLock = new Object();

    private List<InteractionLog> logs = new ArrayList<>();

    private final Clock clock;

    /**
     * Spring 使用的默认构造：使用系统时钟（JVM 时区不影响统计时区，统计固定 Asia/Shanghai）。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md</p>
     */
    public AnalyticsService() {
        this(Clock.systemDefaultZone());
    }

    /**
     * 可测试注入时钟的构造。
     *
     * @param clock 统计时钟，{@code null} 时回退到系统时钟
     */
    public AnalyticsService(Clock clock) {
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /**
     * 覆盖交互日志文件路径，仅用于测试隔离（不读取开发者本机 data 目录）。
     *
     * @param interactionsFilePath 临时 JSON 文件路径
     */
    void setInteractionsFilePathForTesting(String interactionsFilePath) {
        this.interactionsFilePath = interactionsFilePath;
    }

    @PostConstruct
    public void init() {
        load();
    }

    private void load() {
        List<InteractionLog> loaded = new ArrayList<>();
        try {
            File file = new File(interactionsFilePath);
            if (file.exists()) {
                List<InteractionLog> parsed =
                    objectMapper.readValue(file, new TypeReference<List<InteractionLog>>() {});
                if (parsed != null) {
                    loaded.addAll(parsed);
                }
                log.info("交互日志加载完成，共 {} 条", loaded.size());
            }
        } catch (IOException e) {
            log.warn("交互日志加载失败，从空开始: {}", e.getMessage());
            loaded = new ArrayList<>();
        }
        synchronized (logsLock) {
            logs = loaded;
        }
    }

    /**
     * 把当前日志完整写入 JSON 文件。
     *
     * <p>并发口径：取副本与序列化写入必须在同一把 {@code logsLock} 内完成，使多次
     * save（flush、每 10 条自动保存、测试并发写入）严格串行；既不写出过时副本覆盖新日志，
     * 也不会两个线程交错截断同一文件。写失败只记录日志，不向外抛出。</p>
     */
    private void save() {
        synchronized (logsLock) {
            File file = new File(interactionsFilePath);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            try {
                objectMapper.writeValue(file, logs);
            } catch (IOException e) {
                log.error("交互日志保存失败: {}", e.getMessage());
            }
        }
    }

    // ===== 日志记录 =====

    /**
     * 记录一条问答交互日志。保留原有调用入口与 JSON 字段，不新增会话/用户身份。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。异常不向外抛出，落盘失败只记录日志。</p>
     *
     * @param userMessage 游客问句
     * @param aiReply    AI 回答
     * @param interest   游客兴趣标签（可为 null）
     */
    public void logInteraction(String userMessage, String aiReply, String interest) {
        InteractionLog entry = new InteractionLog();
        entry.setTimestamp(clock.millis());
        entry.setUserMessage(userMessage);
        entry.setAiReply(aiReply);
        entry.setSentiment(analyzeSentiment(userMessage));
        entry.setInterest(interest);
        entry.setSpotKeyword(extractSpotKeyword(userMessage));

        boolean shouldFlush;
        synchronized (logsLock) {
            logs.add(entry);
            // 每10条保存一次，避免频繁IO（保持原行为）
            shouldFlush = logs.size() % 10 == 0;
        }
        if (shouldFlush) {
            save();
        }
    }

    /** 强制保存当前日志副本到 JSON 文件；保留原有 flush 语义。 */
    public void flush() {
        save();
    }

    /** 返回日志列表副本，供统计在单一快照上迭代。 */
    private List<InteractionLog> snapshotLogs() {
        synchronized (logsLock) {
            return new ArrayList<>(logs);
        }
    }

    private Instant now() {
        return clock.instant();
    }

    // ===== 情感分析（写入口径，不重新计算旧日志标签） =====

    private String analyzeSentiment(String text) {
        if (text == null) return NEUTRAL;
        String lower = text.toLowerCase();
        int positiveScore = 0;
        int negativeScore = 0;

        for (String word : POSITIVE_WORDS) {
            if (lower.contains(word)) positiveScore++;
        }
        for (String word : NEGATIVE_WORDS) {
            if (lower.contains(word)) negativeScore++;
        }

        if (positiveScore > negativeScore) return POSITIVE;
        if (negativeScore > positiveScore) return NEGATIVE;
        return NEUTRAL;
    }

    private String extractSpotKeyword(String text) {
        if (text == null) return null;
        for (String spot : SPOT_KEYWORDS) {
            if (text.contains(spot)) return spot;
        }
        return null;
    }

    // ===== 聚合入口（REQ-034 / API-034） =====

    /**
     * 构建数据大屏快照。
     *
     * <p>单次调用内只取一个 {@link Clock#instant()} 和一份日志副本，保证今日次数、近7天次数、
     * 情绪样本数与趋势来自同一时间截面。</p>
     *
     * <p>需求：REQ-034；API：API-034 GET /api/admin/dashboard；文档：docs/analytics_accuracy.md。
     * 本方法不访问网络、不调用模型、不读取开发者历史数据。</p>
     *
     * @param knowledgeCount 知识库条目数，由调用方（AdminController）提供
     * @return 新的 DashboardData；无数据时问答次数为 0、positiveQuestionRate 为 null
     */
    public DashboardData getDashboardData(int knowledgeCount) {
        Instant snapshotTime = now();
        List<InteractionLog> window = filterWindow(snapshotLogs(), snapshotTime);
        LocalDate today = snapshotTime.atZone(STATISTICS_ZONE).toLocalDate();
        LocalDate periodStart = today.minusDays(TREND_DAY_COUNT - 1);
        int[] counts = countSentiments(window);

        int todayInteractions = 0;
        for (InteractionLog entry : window) {
            if (toLocalDate(entry.getTimestamp()).equals(today)) {
                todayInteractions++;
            }
        }

        DashboardData data = new DashboardData();
        // 旧字段保留 JSON 键但为 null：未采集，不伪造。
        data.setTodayVisitors(null);
        data.setWeekVisitors(null);
        data.setSatisfactionRate(null);
        data.setAvgResponseTime(null);

        data.setTodayInteractions(todayInteractions);
        data.setLast7DaysInteractions(window.size());
        data.setSentimentSampleCount(sampleSize(counts));
        data.setPositiveQuestionRate(positiveQuestionRate(counts));
        data.setPeriodStart(periodStart.toString());
        data.setPeriodEnd(today.toString());
        data.setTimezone(STATISTICS_TIMEZONE);
        data.setEstimated(true);

        data.setTotalKnowledgeItems(knowledgeCount);
        data.setHotQuestions(buildHotQuestions(window, 5));
        data.setSentimentTrend(buildSentimentTrend(window, periodStart, today));
        data.setSpotRanking(buildTopicDistribution(window));
        data.setHourlyDistribution(buildHourlyDistribution(window));
        return data;
    }

    /**
     * 构建问句情绪报告。
     *
     * <p>需求：REQ-034；API：API-034 GET /api/admin/reports/sentiment；文档：docs/analytics_accuracy.md。
     * 与 {@link #getDashboardData(int)} 使用相同窗口与日志快照规则；{@code satisfactionRate} 恒为 null。</p>
     *
     * @return 情绪趋势、正向问句占比、有效样本数、窗口起止日期、时区、estimated 标记、景点排名与规则建议
     */
    public SentimentReport getSentimentReport() {
        Instant snapshotTime = now();
        List<InteractionLog> window = filterWindow(snapshotLogs(), snapshotTime);
        LocalDate today = snapshotTime.atZone(STATISTICS_ZONE).toLocalDate();
        LocalDate periodStart = today.minusDays(TREND_DAY_COUNT - 1);
        int[] counts = countSentiments(window);

        SentimentReport report = new SentimentReport();
        report.setTrend(buildSentimentTrend(window, periodStart, today));
        report.setPositiveQuestionRate(positiveQuestionRate(counts));
        report.setSentimentSampleCount(sampleSize(counts));
        report.setPeriodStart(periodStart.toString());
        report.setPeriodEnd(today.toString());
        report.setTimezone(STATISTICS_TIMEZONE);
        report.setEstimated(true);
        report.setSatisfactionRate(null);
        report.setTopics(buildTopicDistribution(window));
        report.setSuggestions(buildSuggestions(window));
        return report;
    }

    // ===== 兼容的旧统计入口（不伪造满意度/访客；图表与方法统一近7天窗口） =====

    /**
     * 近7天问句情绪趋势。
     *
     * <p>需求：REQ-034；API：API-034；文档：docs/analytics_accuracy.md。
     * 新增 unclassified 类，未知情绪计入 total 但不计入有效情绪样本。</p>
     *
     * @return 7 个自然日，每天含 date/positive/neutral/negative/unclassified/total
     */
    public List<Map<String, Object>> getSentimentTrend() {
        Instant snapshotTime = now();
        List<InteractionLog> window = filterWindow(snapshotLogs(), snapshotTime);
        LocalDate today = snapshotTime.atZone(STATISTICS_ZONE).toLocalDate();
        return buildSentimentTrend(window, today.minusDays(TREND_DAY_COUNT - 1), today);
    }

    /**
     * 近7天景点关键词提及排名。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。只统计窗口内日志；不宣称独立游客。</p>
     *
     * @return 景点关键词与提及次数，按次数降序（同次数按关键词升序）
     */
    public List<Map<String, Object>> getTopicDistribution() {
        return buildTopicDistribution(filterWindow(snapshotLogs(), now()));
    }

    /**
     * 近7天热门问答 Top N。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。只统计窗口内日志。</p>
     *
     * @param topN 返回条数上限
     * @return 问句简短版本与出现次数
     */
    public List<Map<String, Object>> getHotQuestions(int topN) {
        return buildHotQuestions(filterWindow(snapshotLogs(), now()), topN);
    }

    /**
     * 近7天时段分布。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。只统计窗口内日志。</p>
     *
     * @return 24 个小时段（上海时区）及各自问答次数
     */
    public List<Map<String, Object>> getHourlyDistribution() {
        return buildHourlyDistribution(filterWindow(snapshotLogs(), now()));
    }

    /**
     * 近7天规则建议（不再输出满意度或伪访客口径）。
     *
     * <p>需求：REQ-034；文档：docs/analytics_accuracy.md。措辞只描述问句关键词规则估计，
     * 不称为满意度/负面反馈，不归因游客态度，不虚构平均耗时或真实访客。</p>
     *
     * @return level/title/detail 结构的建议列表
     */
    public List<Map<String, Object>> getSuggestions() {
        return buildSuggestions(filterWindow(snapshotLogs(), now()));
    }

    /**
     * 正向问句占比（兼容入口）。
     *
     * @return positive / 有效样本 × 100，保留两位；无有效样本时 null（绝不返回 95 或伪造满意度）
     * @deprecated 语义已废弃：该值只代表问句关键词规则估计，不是满意度。请使用 {@link #getSentimentReport()}。
     */
    @Deprecated
    public Double getSatisfactionRate() {
        return getSentimentReport().getPositiveQuestionRate();
    }

    /**
     * 今日问答日志条数（兼容入口）。
     *
     * @return 今日有效问答日志条数；<b>不是独立访客数</b>，项目未采集访客身份
     * @deprecated 命名已废弃：请使用 {@link #getDashboardData(int)} 的 todayInteractions。
     */
    @Deprecated
    public int getTodayVisitorCount() {
        return getDashboardData(0).getTodayInteractions();
    }

    /**
     * 近7天问答日志条数（兼容入口）。
     *
     * @return today-6 至本次统计时刻的有效问答日志条数；<b>不是独立访客数</b>
     * @deprecated 命名已废弃：请使用 {@link #getDashboardData(int)} 的 last7DaysInteractions。
     */
    @Deprecated
    public int getWeekVisitorCount() {
        return getDashboardData(0).getLast7DaysInteractions();
    }

    // ===== 内部统计实现 =====

    private static boolean isKnownSentiment(String sentiment) {
        return sentiment != null && VALID_SENTIMENTS.contains(sentiment);
    }

    private static int sentimentIndex(InteractionLog entry) {
        if (entry == null || !isKnownSentiment(entry.getSentiment())) {
            return IDX_UNCLASSIFIED;
        }
        String sentiment = entry.getSentiment();
        if (POSITIVE.equals(sentiment)) return IDX_POSITIVE;
        if (NEUTRAL.equals(sentiment)) return IDX_NEUTRAL;
        return IDX_NEGATIVE;
    }

    private static int[] countSentiments(List<InteractionLog> entries) {
        int[] counts = new int[4];
        for (InteractionLog entry : entries) {
            counts[sentimentIndex(entry)]++;
        }
        return counts;
    }

    private static int sampleSize(int[] counts) {
        return counts[IDX_POSITIVE] + counts[IDX_NEUTRAL] + counts[IDX_NEGATIVE];
    }

    /**
     * 正向问句占比：positive / 有效样本 × 100，四舍五入两位小数；有效样本为 0 返回 null。
     */
    private static Double positiveQuestionRate(int[] counts) {
        int sample = sampleSize(counts);
        if (sample <= 0) {
            return null;
        }
        return BigDecimal.valueOf(counts[IDX_POSITIVE])
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(sample), 2, RoundingMode.HALF_UP)
            .doubleValue();
    }

    /**
     * 过滤统计窗口：只保留 timestamp 为正、不晚于本次统计时刻、不早于 today-6 00:00 的日志；
     * null 条目、非正时间戳与未来日志一律忽略，且不进入图表或建议。
     */
    private List<InteractionLog> filterWindow(List<InteractionLog> snapshot, Instant snapshotTime) {
        List<InteractionLog> window = new ArrayList<>();
        if (snapshot == null) {
            return window;
        }
        LocalDate today = snapshotTime.atZone(STATISTICS_ZONE).toLocalDate();
        LocalDate periodStart = today.minusDays(TREND_DAY_COUNT - 1);
        long startMillis = periodStart.atStartOfDay(STATISTICS_ZONE).toInstant().toEpochMilli();
        long endMillis = snapshotTime.toEpochMilli();
        for (InteractionLog entry : snapshot) {
            if (entry == null) continue;
            long timestamp = entry.getTimestamp();
            if (timestamp <= 0 || timestamp > endMillis || timestamp < startMillis) continue;
            window.add(entry);
        }
        return window;
    }

    private static LocalDate toLocalDate(long millis) {
        return Instant.ofEpochMilli(millis).atZone(STATISTICS_ZONE).toLocalDate();
    }

    private static List<Map<String, Object>> buildSentimentTrend(List<InteractionLog> window,
                                                                LocalDate periodStart,
                                                                LocalDate today) {
        Map<LocalDate, int[]> dailyCounts = new HashMap<>();
        for (InteractionLog entry : window) {
            LocalDate date = toLocalDate(entry.getTimestamp());
            int[] counts = dailyCounts.get(date);
            if (counts == null) {
                counts = new int[4];
                dailyCounts.put(date, counts);
            }
            counts[sentimentIndex(entry)]++;
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        LocalDate date = periodStart;
        while (!date.isAfter(today)) {
            int[] counts = dailyCounts.get(date);
            if (counts == null) {
                counts = new int[4];
            }
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", date.format(TREND_DATE_FORMATTER));
            day.put(POSITIVE, (long) counts[IDX_POSITIVE]);
            day.put(NEUTRAL, (long) counts[IDX_NEUTRAL]);
            day.put(NEGATIVE, (long) counts[IDX_NEGATIVE]);
            day.put(UNCLASSIFIED, (long) counts[IDX_UNCLASSIFIED]);
            day.put("total", (long) (counts[IDX_POSITIVE] + counts[IDX_NEUTRAL]
                + counts[IDX_NEGATIVE] + counts[IDX_UNCLASSIFIED]));
            trend.add(day);
            date = date.plusDays(1);
        }
        return trend;
    }

    private static List<Map<String, Object>> buildTopicDistribution(List<InteractionLog> window) {
        Map<String, Long> countMap = new HashMap<>();
        for (InteractionLog entry : window) {
            String keyword = entry.getSpotKeyword();
            if (keyword != null && !keyword.isEmpty()) {
                countMap.merge(keyword, 1L, Long::sum);
            }
        }
        List<Map.Entry<String, Long>> sorted = new ArrayList<>(countMap.entrySet());
        sorted.sort((a, b) -> {
            int byValue = Long.compare(b.getValue(), a.getValue());
            return byValue != 0 ? byValue : a.getKey().compareTo(b.getKey());
        });
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Long> entry : sorted) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("spot", entry.getKey());
            item.put("count", entry.getValue());
            result.add(item);
        }
        return result;
    }

    private static List<Map<String, Object>> buildHotQuestions(List<InteractionLog> window, int topN) {
        Map<String, Long> questionCount = new HashMap<>();
        for (InteractionLog entry : window) {
            String question = entry.getUserMessage();
            if (question != null && question.length() > 2) {
                // 取前20字作为问题的简短版本（保持原行为）
                String shortQuestion = question.length() > 20 ? question.substring(0, 20) + "..." : question;
                questionCount.merge(shortQuestion, 1L, Long::sum);
            }
        }
        List<Map.Entry<String, Long>> sorted = new ArrayList<>(questionCount.entrySet());
        sorted.sort((a, b) -> {
            int byValue = Long.compare(b.getValue(), a.getValue());
            return byValue != 0 ? byValue : a.getKey().compareTo(b.getKey());
        });
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < sorted.size() && i < topN; i++) {
            Map.Entry<String, Long> entry = sorted.get(i);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("question", entry.getKey());
            item.put("count", entry.getValue());
            result.add(item);
        }
        return result;
    }

    private static List<Map<String, Object>> buildHourlyDistribution(List<InteractionLog> window) {
        int[] hours = new int[24];
        for (InteractionLog entry : window) {
            int hour = Instant.ofEpochMilli(entry.getTimestamp()).atZone(STATISTICS_ZONE).getHour();
            hours[hour]++;
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("hour", String.format("%02d:00", i));
            item.put("count", hours[i]);
            result.add(item);
        }
        return result;
    }

    /**
     * 规则建议：只使用近7天日志与问句关键词/情绪标记，措辞限定在“问句规则估计”，
     * 不称为满意度或负面反馈，不归因游客态度，不虚构平均耗时/真实访客。
     */
    private static List<Map<String, Object>> buildSuggestions(List<InteractionLog> window) {
        List<Map<String, Object>> suggestions = new ArrayList<>();
        int[] counts = countSentiments(window);
        int sample = sampleSize(counts);

        if (window.isEmpty()) {
            suggestions.add(suggestion("info", "近7天暂无问答记录",
                "近7天没有可用的问句日志，图表与建议会在产生问答后更新。"));
            return suggestions;
        }

        if (sample == 0) {
            suggestions.add(suggestion("info", "暂无有效问句情绪样本",
                "近7天有 " + window.size() + " 条问答，但情绪标记无法归入正向/中性/负向，"
                    + "未知标记只计入问答次数，不计入情绪占比。"));
        } else {
            Double rate = positiveQuestionRate(counts);
            if (rate != null) {
                suggestions.add(suggestion("info", "正向问句占比（规则估计）：" + formatRate(rate) + "%",
                    "近7天有效问句情绪样本 " + sample + " 条，其中 " + counts[IDX_POSITIVE]
                        + " 条命中正向关键词；该占比来自问句文字的关键词规则，不是真实评价。"));
            }
            if (counts[IDX_NEGATIVE] * 100L > sample * 20L) {
                suggestions.add(suggestion("warning", "问句负向关键词比例偏高",
                    "近7天 " + counts[IDX_NEGATIVE] + "/" + sample + " 条问句命中负向关键词（规则估计，约"
                        + formatPercent(counts[IDX_NEGATIVE], sample) + "%），建议检查知识库内容与回答准确性。"));
            }
        }

        if (window.size() < 5) {
            suggestions.add(suggestion("info", "近7天问答记录较少",
                "近7天共 " + window.size() + " 条问答，样本量较小，排名与占比仅供参考。"));
        }

        List<Map<String, Object>> topics = buildTopicDistribution(window);
        if (topics.isEmpty()) {
            suggestions.add(suggestion("info", "近7天未匹配到景点关键词",
                "所统计问句中没有出现景点关键词，因此暂无景点提及排名。"));
        } else {
            Map<String, Object> top = topics.get(0);
            suggestions.add(suggestion("info", "问句提及最多的景点: " + top.get("spot"),
                "近7天问句中“" + top.get("spot") + "”被提及 " + top.get("count")
                    + " 次（按关键词匹配），可考虑补充该景点讲解资料。"));
        }
        return suggestions;
    }

    private static Map<String, Object> suggestion(String level, String title, String detail) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("level", level);
        item.put("title", title);
        item.put("detail", detail);
        return item;
    }

    private static String formatRate(Double rate) {
        return BigDecimal.valueOf(rate).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String formatPercent(int numerator, int denominator) {
        return BigDecimal.valueOf((long) numerator * 100L)
            .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP)
            .toPlainString();
    }

    // ===== 关键词词典（写入口径，保持原逻辑） =====

    // 情感关键词词典
    private static final Set<String> POSITIVE_WORDS = new HashSet<>(Arrays.asList(
        "谢谢", "很棒", "好的", "喜欢", "不错", "推荐", "赞", "太好了", "感谢", "真美",
        "漂亮", "精彩", "有意思", "有趣", "很棒", "优秀", "完美", "满意", "好评",
        "开心", "帮助", "厉害", "太好了", "不错哦", "给力", "nice", "good", "棒"
    ));
    private static final Set<String> NEGATIVE_WORDS = new HashSet<>(Arrays.asList(
        "失望", "无聊", "不准确", "错误", "不好", "差", "垃圾", "骗人", "没意思",
        "不清楚", "听不懂", "不理解", "不对", "错了", "无语", "糟糕", "太差",
        "胡说", "瞎说", "假的", "骗", "烂", "bad", "不行", "差劲"
    ));

    // 景点关键词
    private static final List<String> SPOT_KEYWORDS = Arrays.asList(
        "灵山大佛", "灵山梵宫", "九龙灌浴", "五印坛城", "祥符禅寺",
        "降魔浮雕", "灵山大照壁", "五明桥", "佛足坛", "五智门",
        "菩提大道", "阿育王柱", "百子戏弥勒", "佛教文化博览馆", "曼飞龙塔", "无尽意斋"
    );
}
