package com.guide.controller;

import com.guide.model.*;
import com.guide.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 管理后台 API 控制器
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final KnowledgeService knowledgeService;
    private final ConfigService configService;
    private final AnalyticsService analyticsService;
    private final UserService userService;

    public AdminController(KnowledgeService knowledgeService,
                           ConfigService configService,
                           AnalyticsService analyticsService,
                           UserService userService) {
        this.knowledgeService = knowledgeService;
        this.configService = configService;
        this.analyticsService = analyticsService;
        this.userService = userService;
    }

    // ========== 知识库管理 ==========

    @GetMapping("/knowledge")
    public ResponseEntity<List<KnowledgeItem>> getKnowledge(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        if (keyword != null && !keyword.trim().isEmpty()) {
            return ResponseEntity.ok(knowledgeService.search(keyword));
        }
        if (category != null && !category.trim().isEmpty()) {
            return ResponseEntity.ok(knowledgeService.getByCategory(category));
        }
        return ResponseEntity.ok(knowledgeService.getAll());
    }

    @GetMapping("/knowledge/{id}")
    public ResponseEntity<?> getKnowledgeById(@PathVariable int id) {
        Optional<KnowledgeItem> item = knowledgeService.getById(id);
        return item.map(ResponseEntity::ok)
                   .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/knowledge")
    public ResponseEntity<KnowledgeItem> addKnowledge(@RequestBody KnowledgeItem item) {
        return ResponseEntity.ok(knowledgeService.add(item));
    }

    @PutMapping("/knowledge/{id}")
    public ResponseEntity<?> updateKnowledge(@PathVariable int id, @RequestBody KnowledgeItem item) {
        Optional<KnowledgeItem> updated = knowledgeService.update(id, item);
        return updated.map(ResponseEntity::ok)
                      .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/knowledge/{id}")
    public ResponseEntity<?> deleteKnowledge(@PathVariable int id) {
        boolean deleted = knowledgeService.delete(id);
        if (deleted) {
            Map<String, String> result = new HashMap<>();
            result.put("message", "删除成功");
            return ResponseEntity.ok().body(result);
        }
        return ResponseEntity.notFound().build();
    }

    // ========== 数字人形象管理 ==========

    @GetMapping("/digital-human-config")
    public ResponseEntity<DigitalHumanConfig> getConfig() {
        return ResponseEntity.ok(configService.getConfig());
    }

    @PutMapping("/digital-human-config")
    public ResponseEntity<DigitalHumanConfig> updateConfig(@RequestBody DigitalHumanConfig newConfig) {
        return ResponseEntity.ok(configService.updateConfig(newConfig));
    }

    // ========== 数据大屏 ==========

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardData> getDashboard() {
        DashboardData data = new DashboardData();
        data.setTodayVisitors(analyticsService.getTodayVisitorCount());
        data.setWeekVisitors(analyticsService.getWeekVisitorCount());
        data.setSatisfactionRate(analyticsService.getSatisfactionRate());
        data.setTotalKnowledgeItems(knowledgeService.getCount());
        data.setHotQuestions(analyticsService.getHotQuestions(5));
        data.setSentimentTrend(analyticsService.getSentimentTrend());
        data.setSpotRanking(analyticsService.getTopicDistribution());
        data.setHourlyDistribution(analyticsService.getHourlyDistribution());
        data.setAvgResponseTime(0);

        analyticsService.flush();
        return ResponseEntity.ok(data);
    }

    // ========== 感受度报告 ==========

    @GetMapping("/reports/sentiment")
    public ResponseEntity<?> getSentimentReport() {
        Map<String, Object> result = new HashMap<>();
        result.put("trend", analyticsService.getSentimentTrend());
        result.put("satisfactionRate", analyticsService.getSatisfactionRate());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reports/topics")
    public ResponseEntity<?> getTopicsReport() {
        Map<String, Object> result = new HashMap<>();
        result.put("topics", analyticsService.getTopicDistribution());
        result.put("hotQuestions", analyticsService.getHotQuestions(10));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reports/suggestions")
    public ResponseEntity<?> getSuggestions() {
        Map<String, Object> result = new HashMap<>();
        result.put("suggestions", analyticsService.getSuggestions());
        result.put("generatedTime", System.currentTimeMillis());
        return ResponseEntity.ok(result);
    }

    // ========== 用户管理 ==========

    @GetMapping("/users")
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }
}
