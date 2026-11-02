package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.model.ChatResponse;
import com.guide.model.Spot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * AI对话服务 — 支持知识库检索、个性化推荐、交互日志
 *
 * <p>REQ-035（GitHub #9）：系统提示明确不得用未核验资料补写事实、待补充不代表已知、
 * 变动信息需景区公告确认；本地景点/知识/票价/交通回答明确课程示例边界；见
 * {@code docs/knowledge_integrity.md} 第 5 条。</p>
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    /** 本地离线回答的样本边界提示（REQ-035 第 5 条）：不把未核验资料当作实时事实。 */
    private static final String SAMPLE_BOUNDARY =
            "（以上为未核验的静态课程示例资料，门票、开放时间、交通等请以景区公告为准）";

    /** 知识库兜底回答的课程示例边界前缀（REQ-035 第 5 条）。 */
    private static final String KNOWLEDGE_BOUNDARY_PREFIX =
            "根据我的课程示例资料库（未完成事实核验，不能作为实时出行依据）：";

    /** One validated role/content pair; only ConversationService may create the bounded history. */
    public static class Turn {
        final String role;
        final String content;
        public Turn(String role, String content) {
            if (!("user".equals(role) || "assistant".equals(role))) throw new IllegalArgumentException("role");
            this.role = role; this.content = content;
        }
    }

    private final SpotService spotService;
    private final KnowledgeService knowledgeService;
    private final AnalyticsService analyticsService;
    private final AiCompletionClient aiCompletionClient;
    private final ObjectMapper objectMapper;

    public ChatService(SpotService spotService, KnowledgeService knowledgeService,
                       AnalyticsService analyticsService, AiCompletionClient aiCompletionClient) {
        this.spotService = spotService;
        this.knowledgeService = knowledgeService;
        this.analyticsService = analyticsService;
        this.aiCompletionClient = aiCompletionClient;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * 处理对话并返回完整响应
     */
    public ChatResponse chat(String userMessage, String interest) {
        return chat(userMessage, interest, Collections.emptyList(), null);
    }
    public ChatResponse chat(String userMessage, String interest, List<Turn> history, Spot currentSpot) {
        userMessage = userMessage == null ? "" : userMessage;
        KnowledgeRetrieval knowledge = knowledgeService.retrieve(userMessage);
        boolean fallback = false;
        String reply;

        if (!userMessage.trim().isEmpty() && aiCompletionClient.isEnabled()) {
            try {
                reply = callAiApi(userMessage, interest, knowledge, history, currentSpot);
            } catch (Exception e) {
                log.warn("AI API调用失败，降级到本地匹配: {}", e.getClass().getSimpleName());
                fallback = true;
                reply = localFallback(userMessage, interest, knowledge, currentSpot);
            }
        } else {
            fallback = true;
            reply = localFallback(userMessage, interest, knowledge, currentSpot);
        }

        // 记录交互日志
        try {
            analyticsService.logInteraction(userMessage, reply, interest);
        } catch (Exception e) {
            log.warn("交互日志记录失败: {}", e.getClass().getSimpleName());
        }

        ChatResponse response = new ChatResponse(reply, fallback);
        response.setInterest(interest);
        response.setKnowledgeReferences(knowledge.getReferences());
        // 只有游客选择了兴趣标签时才附带推荐路线
        if (interest != null && !interest.isEmpty()) {
            response.setRecommendedRoutes(generateRoutes(interest));
        }
        return response;
    }

    /**
     * 兼容旧接口
     */
    public String chat(String userMessage) {
        return chat(userMessage, null).getReply();
    }

    // ===== AI API 调用 =====

    private String callAiApi(String userMessage, String interest, KnowledgeRetrieval knowledge, List<Turn> history, Spot currentSpot) throws Exception {
        String spotContext = spotService.buildSpotContext();
        String knowledgeContext = knowledge.getContext();

        String system = buildSystemMessage(spotContext, knowledgeContext, interest).path("content").asText();
        if (currentSpot != null) system += "\n【当前景点】" + currentSpot.getName();
        return history.isEmpty() && currentSpot == null ? aiCompletionClient.complete(system,userMessage,0.7,800)
                : aiCompletionClient.completeWithHistory(system,userMessage,history,0.7,800);
    }

    /**
     * 构造发往模型 API 的系统提示。
     *
     * <p>REQ-035 第 5 条：在保留原有人设、回答原则和兴趣分支的前提下，补充三条资料边界规则：
     * 不得用未核验资料补写事实、待补充不代表已知、门票/开放时间/演出/交通/天气等变动信息需
     * 以景区公告确认；见 {@code docs/knowledge_integrity.md} 第 5 条。</p>
     *
     * @param spotContext      景点资料上下文
     * @param knowledgeContext 知识库检索上下文
     * @param interest         游客兴趣标签，可为 null
     * @return role=system 的消息节点
     */
    private ObjectNode buildSystemMessage(String spotContext, String knowledgeContext, String interest) {
        ObjectNode systemMsg = objectMapper.createObjectNode();
        systemMsg.put("role", "system");

        StringBuilder content = new StringBuilder();
        content.append("你是一位热情、生动、有温度的灵山胜境AI数字人导游，名叫'灵灵'。\n\n");
        content.append("你的性格：亲切自然，像朋友聊天一样回答游客的问题，不念稿子、不公式化，偶尔可以来点小幽默。\n\n");
        content.append("你的数据库中包含以下灵山胜境景点资料：\n").append(spotContext).append("\n");

        if (knowledgeContext != null && !knowledgeContext.isEmpty()) {
            content.append("知识库参考资料：\n").append(knowledgeContext).append("\n");
        }

        content.append("回答原则：\n");
        content.append("1. 像真人导游一样自然地聊天，不要用固定模板套答案\n");
        content.append("2. 先直接回答游客问的问题，不要上来就推荐路线\n");
        content.append("3. 游客问具体景点时，用数据库信息生动介绍，可以穿插历史典故和游览小贴士\n");
        content.append("4. 回答简洁，控制在200-300字，避免长篇大论\n");
        content.append("5. 遇到与景区完全无关的问题（如代码、股票等），幽默地引导回景区话题\n");
        content.append("6. 不要在每句话后面都加路线推荐，只有游客表现出'不知道去哪''推荐一下'等需求时才推荐\n");
        content.append("7. 允许聊一些轻松话题（天气、美食、当地文化等），不用每句话都严肃地介绍景点\n");
        content.append("8. 只能使用上面提供的景点资料和知识库参考作答；不得用未核验资料补写事实，资料里没有的内容不要编造或猜测\n");
        content.append("9. 知识条目中标注「待补充」或「原始正文缺失」表示内容尚未核实，不代表已知事实，不要据此补写故事\n");
        content.append("10. 门票、开放时间、演出场次、交通班次、天气路况等会变动的信息，必须提示游客以景区公告为准，不要给实时承诺\n");
        content.append("11. 资料 K编号仅指本次本地候选条目，不是官方来源或已核验证据。引用时使用已有编号，未找到知识资料时明确说明，不编造编号或出处\n");

        // 个性化推荐倾向
        if (interest != null && !interest.isEmpty()) {
            content.append("\n【游客兴趣偏好】这位游客对「").append(interest).append("」感兴趣。");
            switch (interest) {
                case "历史人文":
                    content.append("请重点推荐灵山大佛、祥符禅寺等历史古迹，深度讲解佛教历史典故和文化背景，")
                           .append("可以分享玄奘与小灵山佛缘、祥符禅寺千年兴衰等故事。");
                    break;
                case "自然风光":
                    content.append("请重点推荐菩提大道、九龙灌浴等景观，")
                           .append("介绍最佳观赏季节和拍照时机，推荐轻松的户外游览路线。");
                    break;
                case "亲子出游":
                    content.append("请重点推荐九龙灌浴、百子戏弥勒等趣味性强、互动性好的景点，")
                           .append("推荐适合家庭的活动，九龙灌浴表演小朋友最喜欢。");
                    break;
                case "摄影打卡":
                    content.append("请重点推荐灵山大佛、灵山梵宫、五印坛城等出片景点，")
                           .append("介绍最佳机位和拍摄时间（如大佛全景、梵宫琉璃光影）。");
                    break;
            }
        }

        content.append("\n\n记住：你是灵灵，一个有人情味的数字导游。做游客的朋友，而不是一台播报路线的机器。");

        systemMsg.put("content", content.toString());
        return systemMsg;
    }

    // ===== 本地降级回复 =====

    /**
     * 无模型密钥或 API 调用失败时的本地离线回答。
     *
     * REQ-037: reuse exactly the supplied retrieval snapshot; aliases resolve scenic
     * names, multiple entities share candidate context, missing knowledge stays explicit.
     * Legacy greeting/route/ticket/traffic rules remain after entity handling.
     * Policy: docs/natural_retrieval.md; evidence boundary: docs/knowledge_integrity.md.
     */
    private String localFallback(String userMessage, String interest, KnowledgeRetrieval knowledge, Spot currentSpot) {
        String msg = userMessage.toLowerCase(Locale.ROOT);
        String knowledgeContext = knowledge.getContext();
        List<String> entities = knowledge.getEntityNames();
        if (entities.size() > 1) {
            return "你提到了多个景点：" + String.join("、", entities) + "。\n\n"
                    + (knowledgeContext.isEmpty() ? "没有匹配的知识条目，请补充景点名称或具体想了解的问题。" :
                    KNOWLEDGE_BOUNDARY_PREFIX + "\n\n" + knowledgeContext)
                    + "\n可以指定其中一个景点，告诉我你想了解什么。";
        }
        if (entities.size() == 1) {
            for (Spot spot : spotService.getAllSpots()) if (spot.getName().equals(entities.get(0))) {
                return spotReplyForQuestion(spot, msg, interest) + "\n" + SAMPLE_BOUNDARY + "\n\n" + (knowledgeContext.isEmpty()
                        ? "目前没有匹配的知识条目，以上是景点卡片中的参考信息。你想进一步了解哪方面？"
                        : knowledgeContext);
            }
        }

        if (currentSpot != null && containsAny(msg, "它", "这里", "这个景点", "故事", "开放", "几点")) return spotReplyForQuestion(currentSpot, msg, interest) + "\n" + SAMPLE_BOUNDARY;

        // 扩展的本地关键词匹配
        if (containsAny(msg, "拈花湾", "三圣殿", "慈恩塔", "灵山精舍",
                "鼋头渚", "太湖", "三国", "水浒", "惠山",
                "梅园", "蠡园", "南禅寺", "清名桥")) {
            return "您问的这个地方非常值得一游！不过它暂时不在我当前的16个导览卡片中。\n\n" +
                   "配置AI API Key后，我可以用更智能的方式为您介绍灵山胜境及无锡周边所有景点。\n\n" +
                   "目前我的数据库中包含以下16个核心景点：\n" +
                   "灵山大照壁、五明桥、佛足坛、五智门、菩提大道、\n" +
                   "九龙灌浴、降魔浮雕、阿育王柱、百子戏弥勒、\n" +
                   "祥符禅寺、灵山大佛、佛教文化博览馆、灵山梵宫、\n" +
                   "五印坛城、曼飞龙塔、无尽意斋\n\n" +
                   "点击左下角卡片可以查看详细介绍哦~";
        }

        if (containsAny(msg, "推荐", "好玩", "值得", "必去", "最")) {
            return buildRecommendReply(interest);
        }

        if (containsAny(msg, "免费", "收费", "门票", "价格")) {
            // REQ-035 第 5 条：删除硬编码餐饮价格（原「梵宫素斋自助50元/位」「素面套餐35元/位」），
            // 只保留通用门票说明与示例边界，不新增任何实时票价承诺。
            return "灵山胜境景区实行一票制：\n\n" +
                   "· 灵山胜境大门票（含灵山大佛、梵宫、九龙灌浴等16个景点）\n" +
                   "· 景区内部分体验项目费用自理\n\n" +
                   "建议提前在线购票，票价与优惠请以景区公告和官方购票渠道为准。\n\n" +
                   SAMPLE_BOUNDARY + "\n\n" +
                   "请问您需要了解哪个具体景点的信息？";
        }

        if (containsAny(msg, "怎么去", "交通", "地铁", "公交", "到达")) {
            // REQ-035 第 5 条：保留现有交通文案，仅补充示例边界，不新增交通班次或时间承诺。
            return "前往灵山胜境景区非常方便：\n\n" +
                   "公交：88路、89路至灵山胜境站直达\n" +
                   "自驾：沪宁高速无锡马山镇出口下\n" +
                   "高铁：无锡站/无锡东站下车，转88路公交\n" +
                   "机场：苏南硕放机场，驾车约40分钟\n\n" +
                   SAMPLE_BOUNDARY + "\n\n" +
                   "请问您要去哪个具体景点？我可以为您详细指引~";
        }

        if (containsAny(msg, "你好", "嗨", "hello", "hi", "您好", "在吗")) {
            return "阿弥陀佛！我是您的AI导游灵灵，很高兴为您服务！\n\n" +
                   "我可以为您：\n" +
                   "· 介绍灵山胜境16个景点\n" +
                   "· 推荐游览路线\n" +
                   "· 解答交通、门票等问题\n\n" +
                   "请问有什么可以帮您的？愿您在此感悟灵山，吉祥平安！";
        }

        // 如果知识库有匹配，作为参考回答（REQ-035 第 5 条：标明课程示例边界，不作为实时出行依据）
        if (knowledgeContext != null && !knowledgeContext.isEmpty()) {
            return KNOWLEDGE_BOUNDARY_PREFIX + "\n\n" + knowledgeContext +
                   "\n请问还有什么需要了解的吗？";
        }

        return "当前本地资料没有找到匹配的知识条目。请补充景点名称，"
                + "例如灵山大佛、灵山梵宫或九龙灌浴，再告诉我想了解的问题。"
                + "也可以告诉我“它”指的是哪处景点，我再继续介绍。";
    }

    /**
     * 组装单个景点的本地离线回答。
     *
     * <p>REQ-035 第 5 条：保留原有字段与兴趣分支，在回答末尾追加未核验静态课程示例边界；
     * 见 {@code docs/knowledge_integrity.md} 第 5 条。</p>
     */
    /** REQ-039: answer the referenced place's requested fact before using its general card. */
    private String spotReplyForQuestion(Spot spot, String question, String interest) {
        if (containsAny(question, "故事", "历史")) {
            return "【" + spot.getName() + "】的故事：\n\n"
                    + (spot.getHistory() == null || spot.getHistory().trim().isEmpty()
                    ? "目前还没有收录这个景点的历史故事。" : spot.getHistory());
        }
        if (containsAny(question, "开放", "几点")) {
            return "【" + spot.getName() + "】的开放时间："
                    + (spot.getOpeningHours() == null || spot.getOpeningHours().trim().isEmpty()
                    ? "目前还没有收录开放时间。" : spot.getOpeningHours());
        }
        return buildSpotReply(spot, interest);
    }

    private String buildSpotReply(Spot spot, String interest) {
        StringBuilder sb = new StringBuilder();
        sb.append("您好！关于【").append(spot.getName()).append("】：\n\n");
        sb.append(spot.getBrief()).append("\n\n");
        sb.append("地址：").append(spot.getAddress()).append("\n");
        sb.append("开放时间：").append(spot.getOpeningHours()).append("\n");
        sb.append("门票：").append(spot.getTicket()).append("\n");
        sb.append("交通：").append(spot.getTransportation()).append("\n\n");
        sb.append("亮点：").append(String.join("、", spot.getHighlights())).append("\n\n");

        if (interest != null) {
            switch (interest) {
                case "历史人文":
                    sb.append("💡 历史小贴士：").append(spot.getHistory().substring(0, Math.min(150, spot.getHistory().length()))).append("...\n\n");
                    break;
                case "摄影打卡":
                    sb.append("📷 拍照建议：").append(spot.getName()).append("的最佳拍摄时间是清晨或黄昏哦~\n\n");
                    break;
            }
        }

        sb.append(SAMPLE_BOUNDARY).append("\n\n");

        sb.append("请问还有什么需要了解的吗？");
        return sb.toString();
    }

    /**
     * 组装景点推荐回答。
     *
     * <p>REQ-035 第 5 条：推荐排名、路线文案与兴趣分支保持不变，仅在回答末尾追加简短的
     * 未核验静态课程示例边界；见 {@code docs/knowledge_integrity.md} 第 5 条。</p>
     */
    private String buildRecommendReply(String interest) {
        if (interest == null) {
            return "为您推荐灵山胜境最受欢迎的景点：\n\n" +
                   "Top 1：灵山大佛 —— 88米青铜巨佛，抱佛脚祈福\n" +
                   "Top 2：灵山梵宫 —— 东方卢浮宫，琉璃壁画震撼\n" +
                   "Top 3：九龙灌浴 —— 花开见佛，圣水赐福\n" +
                   "Top 4：五印坛城 —— 藏传佛教文化，小布达拉宫\n\n" +
                   "您对哪个景点感兴趣呢？我可以为您详细介绍~\n\n" + SAMPLE_BOUNDARY;
        }

        switch (interest) {
            case "历史人文":
                return "🏛️ 为您推荐历史文化路线：\n\n" +
                       "第一站：祥符禅寺 — 千年古寺，玄奘弟子开山\n" +
                       "第二站：灵山大佛 — 88米青铜大佛，五方五佛之东方佛\n" +
                       "第三站：降魔浮雕 — 佛陀成道故事，石雕艺术珍品\n" +
                       "第四站：无尽意斋 — 赵朴初先生纪念馆\n\n" +
                       "这条路线带你穿越千年，感悟灵山深厚的佛教文化底蕴！\n\n" + SAMPLE_BOUNDARY;
            case "自然风光":
                return "🌿 为您推荐自然风光路线：\n\n" +
                       "第一站：菩提大道 — 千年银杏，秋日金黄\n" +
                       "第二站：九龙灌浴 — 动态水景，花开见佛\n" +
                       "第三站：灵山大佛 — 登顶俯瞰太湖三万顷碧波\n" +
                       "第四站：五印坛城 — 香水海岛屿，藏式建筑倒影\n\n" +
                       "这条路线带你亲近自然，感受灵山山水之美！\n\n" + SAMPLE_BOUNDARY;
            case "亲子出游":
                return "👶 为您推荐亲子游路线：\n\n" +
                       "第一站：九龙灌浴 — 动态喷泉表演，小朋友最爱！\n" +
                       "第二站：百子戏弥勒 — 百童雕塑，拍照打卡\n" +
                       "第三站：灵山大佛 — 登塔抱佛脚，全家祈福\n\n" +
                       "这条路线轻松有趣，适合全家一起游玩祈福！\n\n" + SAMPLE_BOUNDARY;
            case "摄影打卡":
                return "📷 为您推荐摄影打卡路线：\n\n" +
                       "第一站：灵山大佛 — 全景拍摄（建议上午光线下）\n" +
                       "第二站：灵山梵宫 — 琉璃壁画和穹顶（室内光影绝佳）\n" +
                       "第三站：五印坛城 — 藏式建筑+水中倒影\n" +
                       "第四站：曼飞龙塔 — 南传佛教白塔\n\n" +
                       "建议清晨或黄昏拍摄，光影最美！\n\n" + SAMPLE_BOUNDARY;
            default:
                return buildRecommendReply(null);
        }
    }

    /**
     * 根据兴趣生成推荐路线
     */
    private List<String> generateRoutes(String interest) {
        switch (interest) {
            case "历史人文":
                return Arrays.asList(
                    "祥符禅寺 → 灵山大佛 → 降魔浮雕 → 无尽意斋（历史文化深度游）",
                    "灵山大佛 → 祥符禅寺 → 无尽意斋（半日精华游）"
                );
            case "自然风光":
                return Arrays.asList(
                    "菩提大道 → 九龙灌浴 → 灵山大佛 → 五印坛城（自然风光游）",
                    "菩提大道 → 曼飞龙塔（半日轻松游）"
                );
            case "亲子出游":
                return Arrays.asList(
                    "九龙灌浴 → 百子戏弥勒 → 灵山大佛 → 灵山梵宫（亲子欢乐游）"
                );
            case "摄影打卡":
                return Arrays.asList(
                    "灵山大佛 → 灵山梵宫 → 五印坛城 → 曼飞龙塔（摄影打卡游）"
                );
            default:
                return Arrays.asList("大照壁 → 五明桥 → 佛足坛 → 九龙灌浴 → 祥符禅寺 → 灵山大佛 → 梵宫 → 五印坛城（经典朝圣路线）");
        }
    }

    private boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) {
            if (text.contains(kw)) return true;
        }
        return false;
    }
}
