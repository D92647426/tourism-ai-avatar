package com.guide.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.guide.model.ExplorationCoachError;
import com.guide.model.ExplorationCoachResponse;
import com.guide.service.ExplorationCoachService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REQ-033 讲解搭档接口（API-033）。
 *
 * <p>任务：新增 {@code POST /api/exploration/coach}，接收页面保存发现后提交的观察任务上下文，
 * 返回讲解建议、后续观察问题和真实生成方式。输入：JSON 请求体（由
 * {@link ExplorationCoachService} 严格手动校验；本控制器不把请求反序列化为可变 DTO，
 * 避免数字被隐式转换成字符串）。输出：200 {@link ExplorationCoachResponse}；字段非法、
 * 请求不是 JSON 对象、空请求体或畸形 JSON 统一 400
 * {@link ExplorationCoachError}（{@code INVALID_CONTEXT} + 中文原因）。</p>
 *
 * <p>本接口不评分、不确认到访、不访问来源 URL，也不写入 analytics 或用户数据。
 * 修改位置：HTTP 映射与错误码映射在本类；校验与生成逻辑在
 * {@link ExplorationCoachService}。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 */
@RestController
@RequestMapping("/api")
public class ExplorationCoachController {

    private final ExplorationCoachService explorationCoachService;

    /**
     * @param explorationCoachService 讲解搭档业务服务
     */
    public ExplorationCoachController(ExplorationCoachService explorationCoachService) {
        this.explorationCoachService = explorationCoachService;
    }

    /**
     * 处理讲解搭档请求。
     *
     * <p>输入：可空的 {@link JsonNode} 请求体（空请求体传入 {@code null}）。输出：200 响应。
     * 异常：校验失败抛 {@link ExplorationCoachService.InvalidContextException}，由本类映射为
     * 400；请求体缺失或畸形 JSON 由 {@link HttpMessageNotReadableException} 映射为同一错误码。</p>
     *
     * @param request 已解析的 JSON 树，允许 {@code null}
     * @return 200 讲解搭档响应
     */
    @PostMapping("/exploration/coach")
    public ResponseEntity<ExplorationCoachResponse> coach(@RequestBody(required = false) JsonNode request) {
        return ResponseEntity.ok(explorationCoachService.coach(request));
    }

    /**
     * 把字段/结构校验异常映射为 400 {@code INVALID_CONTEXT}。
     *
     * @param exception 服务抛出的中文原因异常，不回显完整个人观察
     * @return 400 统一错误体
     */
    @ExceptionHandler(ExplorationCoachService.InvalidContextException.class)
    public ResponseEntity<ExplorationCoachError> handleInvalidContext(
            ExplorationCoachService.InvalidContextException exception) {
        return badRequest(exception.getMessage());
    }

    /**
     * 把畸形 JSON 或缺失请求体映射为 400 {@code INVALID_CONTEXT}。
     *
     * @param exception Spring 的请求体解析异常
     * @return 400 统一错误体，message 不包含原始请求内容
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ExplorationCoachError> handleUnreadableBody(
            HttpMessageNotReadableException exception) {
        return badRequest("请求体必须是合法的 JSON 对象");
    }

    private ResponseEntity<ExplorationCoachError> badRequest(String message) {
        return ResponseEntity.badRequest()
                .body(new ExplorationCoachError(ExplorationCoachError.CODE_INVALID_CONTEXT, message));
    }
}
