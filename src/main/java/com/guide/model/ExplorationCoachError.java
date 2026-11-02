package com.guide.model;

/**
 * REQ-033 讲解搭档的 400 统一错误体。
 *
 * <p>任务：对字段非法和畸形 JSON 返回同一个错误码；输入为中文原因字符串；
 * 输出 JSON {@code {code:"INVALID_CONTEXT",message:"中文原因"}}。错误消息不回显完整
 * 个人观察。修改位置：请求校验在 {@code ExplorationCoachService}；HTTP 映射在
 * {@code ExplorationCoachController}。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 */
public class ExplorationCoachError {

    /** 唯一错误码；字段非法与畸形 JSON 共用。 */
    public static final String CODE_INVALID_CONTEXT = "INVALID_CONTEXT";

    private String code;
    private String message;

    public ExplorationCoachError() {
    }

    /**
     * @param code    错误码，固定 {@link #CODE_INVALID_CONTEXT}
     * @param message 中文原因，不回显完整观察
     */
    public ExplorationCoachError(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
