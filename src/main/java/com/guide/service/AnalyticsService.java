package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.InteractionLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 分析统计服务 — 交互日志记录、情感分析、数据报告
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    @Value("${data.interactions-file:data/interactions.json}")
    private String interactionsFilePath;

    private final ObjectMapper objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private List<InteractionLog> logs = new ArrayList<>();

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

    @PostConstruct
    public void init() {
        load();
    }

    private void load() {
        try {
            File file = new File(interactionsFilePath);
            if (file.exists()) {
                logs = objectMapper.readValue(file, new TypeReference<List<InteractionLog>>() {});
                log.info("交互日志加载完成，共 {} 条", logs.size());
            }
        } catch (IOException e) {
            log.warn("交互日志加载失败，从空开始: {}", e.getMessage());
            logs = new ArrayList<>();
        }
    }

    private void save() {
        try {
            File file = new File(interactionsFilePath);
            if (!file.getParentFile().exists()) {
                file.getParentFile().mkdirs();
            }
            objectMapper.writeValue(file, logs);
        } catch (IOException e) {
            log.error("交互日志保存失败: {}", e.getMessage());
        }
    }

    // ===== 日志记录 =====

    public void logInteraction(String userMessage, String aiReply, String interest) {
        InteractionLog entry = new InteractionLog();
        entry.setTimestamp(System.currentTimeMillis());
        entry.setUserMessage(userMessage);
        entry.setAiReply(aiReply);
        entry.setSentiment(analyzeSentiment(userMessage));
        entry.setInterest(interest);
        entry.setSpotKeyword(extractSpotKeyword(userMessage));
        logs.add(entry);

        // 每10条保存一次，避免频繁IO
        if (logs.size() % 10 == 0) {
            save();
        }
    }

    /** 强制保存 */
    public void flush() {
        save();
    }

    // ===== 情感分析 =====

    private String analyzeSentiment(String text) {
        if (text == null) return "neutral";
        String lower = text.toLowerCase();
        int positiveScore = 0;
        int negativeScore = 0;

        for (String word : POSITIVE_WORDS) {
            if (lower.contains(word)) positiveScore++;
        }
        for (String word : NEGATIVE_WORDS) {
            if (lower.contains(word)) negativeScore++;
        }

        if (positiveScore > negativeScore) return "positive";
        if (negativeScore > positiveScore) return "negative";
        return "neutral";
    }

    private String extractSpotKeyword(String text) {
        if (text == null) return null;
        for (String spot : SPOT_KEYWORDS) {
            if (text.contains(spot)) return spot;
        }
        return null;
    }

    // ===== 报告数据 =====

    /** 情感趋势（近7天） */
    public List<Map<String, Object>> getSentimentTrend() {
        List<Map<String, Object>> trend = new ArrayList<>();
        ZoneId zone = ZoneId.of("Asia/Shanghai");
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM-dd");

        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now(zone).minusDays(i);
            List<InteractionLog> dayLogs = logs.stream()
                .filter(l -> toLocalDate(l.getTimestamp(), zone).equals(date))
                .collect(Collectors.toList());

            long positive = dayLogs.stream().filter(l -> "positive".equals(l.getSentiment())).count();
            long neutral = dayLogs.stream().filter(l -> "neutral".equals(l.getSentiment())).count();
            long negative = dayLogs.stream().filter(l -> "negative".equals(l.getSentiment())).count();

            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", date.format(fmt));
            day.put("positive", positive);
            day.put("neutral", neutral);
            day.put("negative", negative);
            day.put("total", dayLogs.size());
            trend.add(day);
        }
        return trend;
    }

    /** 游客关注点分析（景点关注度排名） */
    public List<Map<String, Object>> getTopicDistribution() {
        Map<String, Long> countMap = new HashMap<>();
        for (InteractionLog log : logs) {
            String keyword = log.getSpotKeyword();
            if (keyword != null) {
                countMap.merge(keyword, 1L, Long::sum);
            }
        }
        return countMap.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("spot", e.getKey());
                m.put("count", e.getValue());
                return m;
            })
            .collect(Collectors.toList());
    }

    /** 热门问答 Top N */
    public List<Map<String, Object>> getHotQuestions(int topN) {
        Map<String, Long> questionCount = new HashMap<>();
        for (InteractionLog log : logs) {
            String q = log.getUserMessage();
            if (q != null && q.length() > 2) {
                // 取前15字作为问题的简短版本
                String shortQ = q.length() > 20 ? q.substring(0, 20) + "..." : q;
                questionCount.merge(shortQ, 1L, Long::sum);
            }
        }
        return questionCount.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(topN)
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("question", e.getKey());
                m.put("count", e.getValue());
                return m;
            })
            .collect(Collectors.toList());
    }

    /** 满意度百分比 */
    public double getSatisfactionRate() {
        if (logs.isEmpty()) return 95.0; // 默认
        long total = logs.size();
        long positive = logs.stream().filter(l -> "positive".equals(l.getSentiment())).count();
        return Math.round(positive * 10000.0 / total) / 100.0;
    }

    /** 今日服务人次 */
    public int getTodayVisitorCount() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        return (int) logs.stream()
            .filter(l -> toLocalDate(l.getTimestamp(), ZoneId.of("Asia/Shanghai")).equals(today))
            .count();
    }

    /** 本周服务人次 */
    public int getWeekVisitorCount() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        LocalDate weekAgo = today.minusDays(7);
        return (int) logs.stream()
            .filter(l -> {
                LocalDate d = toLocalDate(l.getTimestamp(), ZoneId.of("Asia/Shanghai"));
                return !d.isBefore(weekAgo) && !d.isAfter(today);
            })
            .count();
    }

    /** 时段分布 */
    public List<Map<String, Object>> getHourlyDistribution() {
        ZoneId zone = ZoneId.of("Asia/Shanghai");
        int[] hours = new int[24];
        for (InteractionLog log : logs) {
            int h = Instant.ofEpochMilli(log.getTimestamp()).atZone(zone).getHour();
            hours[h]++;
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("hour", String.format("%02d:00", i));
            m.put("count", hours[i]);
            result.add(m);
        }
        return result;
    }

    /** 生成服务建议 */
    public List<Map<String, Object>> getSuggestions() {
        List<Map<String, Object>> suggestions = new ArrayList<>();
        double satisfaction = getSatisfactionRate();
        List<Map<String, Object>> topics = getTopicDistribution();

        // 基于数据生成建议
        if (satisfaction < 80) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("level", "warning");
            s.put("title", "游客满意度偏低");
            s.put("detail", "当前满意度为 " + satisfaction + "%，建议优化知识库内容和AI回答质量，检查常见问题的解答准确性。");
            suggestions.add(s);
        }

        if (topics.isEmpty() || topics.stream().noneMatch(m -> (long) m.get("count") > 5)) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("level", "info");
            s.put("title", "交互数据较少");
            s.put("detail", "目前收集的游客交互数据还不多，建议加大推广力度，引导更多游客使用AI导览服务。");
            suggestions.add(s);
        }

        if (!topics.isEmpty()) {
            Map<String, Object> top = topics.get(0);
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("level", "info");
            s.put("title", "最受关注景点: " + top.get("spot"));
            s.put("detail", "游客最关注的景点是" + top.get("spot") + "（" + top.get("count") +
                    "次），建议进一步丰富该景点的讲解资料，提升游客体验。");
            suggestions.add(s);
        }

        // 检查是否有大量负面反馈
        long negativeCount = logs.stream().filter(l -> "negative".equals(l.getSentiment())).count();
        if (negativeCount > logs.size() * 0.2 && logs.size() > 10) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("level", "danger");
            s.put("title", "负面反馈比例偏高");
            s.put("detail", "超过20%的交互为负面情感，建议排查AI回答质量或知识库内容是否存在问题。");
            suggestions.add(s);
        }

        return suggestions;
    }

    private LocalDate toLocalDate(long millis, ZoneId zone) {
        return Instant.ofEpochMilli(millis).atZone(zone).toLocalDate();
    }
}
