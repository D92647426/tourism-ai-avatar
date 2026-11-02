package com.guide.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.guide.dto.UserView;
import com.guide.model.*;
import com.guide.service.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 管理后台 API 控制器。
 *
 * <p>安全说明（REQ-030 / GitHub #5）：{@code /api/admin/**} 由 Spring Security
 * 统一保护，只有 ADMIN 角色可访问；匿名返回 401、普通游客返回 403。
 * 页面是否显示管理入口与真实权限无关。
 *
 * <p>文档：[API 说明](../../../../../../docs/api_reference.md#L1)。
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

    /**
     * 更新数字人展示配置（REQ-038 / API-038）。
     *
     * <p>请求体是 JSON 对象的部分更新：缺省字段保持原值，null、未知字段、类型错误或非法值整次拒绝，
     * 不会部分改写已有配置。成功返回 200 与服务端标准化后的完整配置（例如颜色统一为小写）。
     *
     * <p>错误映射只在本方法内处理，不引入全局异常处理器，避免改变其他接口的错误行为：
     * <ul>
     *   <li>{@link IllegalArgumentException} → 400，{@code code=INVALID_CONFIG}，{@code message} 为中文原因；</li>
     *   <li>{@link IOException} / {@link UncheckedIOException} → 500，{@code code=CONFIG_SAVE_FAILED}，
     *       提示“数据未保存”，不返回文件路径或凭据信息。</li>
     * </ul>
     *
     * @param patch 待修改字段的 JSON 对象
     * @return 200 + 标准化后的配置；400 校验失败；500 落盘失败
     */
    @PutMapping("/digital-human-config")
    public ResponseEntity<?> updateConfig(@RequestBody JsonNode patch) {
        try {
            return ResponseEntity.ok(configService.updateConfig(patch));
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("code", "INVALID_CONFIG");
            error.put("message", e.getMessage() == null || e.getMessage().trim().isEmpty()
                    ? "配置内容不合法" : e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (IOException | UncheckedIOException e) {
            Map<String, String> error = new HashMap<>();
            error.put("code", "CONFIG_SAVE_FAILED");
            error.put("message", "配置保存失败，数据未保存，请稍后重试");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
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
    public ResponseEntity<List<UserView>> getUsers() {
        List<UserView> users = userService.getAllUsers().stream()
                .map(UserView::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }
}
