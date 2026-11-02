package com.guide.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * REQ-033 测试夹具：构造结构合法的讲解搭档请求，供服务与控制器测试复用。
 *
 * <p>任务：避免各测试重复拼装 JSON，并保证默认夹具满足所有字段规则。
 * 输入无；输出全新的可变 {@link ObjectNode}（每次调用都是独立实例）。
 * 测试不应访问网络或读取本机配置。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 */
public final class ExplorationCoachFixtures {

    /** 与 {@link #validRequest()} 中的观察一致，便于断言观察未进入系统消息。 */
    public static final String OBSERVATION = "我数到登云道有很多级台阶，但没数清具体数字。";

    /** 与 {@link #validRequest()} 中的资料一致，便于断言引用不被模型覆盖。 */
    public static final String REFERENCE = "灵山大佛通高88米，登云道共有216级台阶。";

    /** 与 {@link #validRequest()} 中的来源链接一致。 */
    public static final String SOURCE_URL = "https://www.lingshan.com/guide";

    /** 与 {@link #validRequest()} 中的来源标题一致。 */
    public static final String SOURCE_TITLE = "灵山胜境官方导览";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ExplorationCoachFixtures() {
    }

    /**
     * @return 结构合法、字段长度均在限制内的请求
     */
    public static ObjectNode validRequest() {
        ObjectNode request = MAPPER.createObjectNode();
        request.put("packId", "lingshan-demo");
        request.put("packVersion", "1.0.0");

        ObjectNode task = request.putObject("task");
        task.put("id", "spot-001");
        task.put("spotName", "灵山大佛");
        task.put("title", "数一数大佛前的台阶");
        task.put("prompt", "观察大佛脚下的台阶，说说你看到了什么？");
        task.put("reference", REFERENCE);

        ObjectNode source = task.putObject("source");
        source.put("title", SOURCE_TITLE);
        source.put("url", SOURCE_URL);
        source.put("status", "inherited-unverified");

        ArrayNode cues = task.putArray("cues");
        ObjectNode steps = cues.addObject();
        steps.put("label", "台阶数量");
        ArrayNode stepTerms = steps.putArray("terms");
        stepTerms.add("216");
        stepTerms.add("台阶");

        ObjectNode height = cues.addObject();
        height.put("label", "大佛高度");
        ArrayNode heightTerms = height.putArray("terms");
        heightTerms.add("88米");
        heightTerms.add("高度");

        request.put("observation", OBSERVATION);
        request.put("mode", "onsite");
        return request;
    }

    /**
     * 生成重复字符的字符串，便于测试长度边界。
     *
     * @param ch    重复字符
     * @param count 重复次数，必须非负
     * @return 长度为 {@code count} 的字符串
     */
    public static String repeat(char ch, int count) {
        StringBuilder text = new StringBuilder(count);
        for (int i = 0; i < count; i++) {
            text.append(ch);
        }
        return text.toString();
    }
}
