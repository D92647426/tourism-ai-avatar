package com.guide.service;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.model.ChatResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * REQ-035 第 5 条：ChatService 系统提示资料边界与本地离线回答边界回归测试。
 *
 * <p>把模型密钥设为空串，走 100% 本地离线分支，不访问网络；知识与统计文件都指向
 * JUnit 临时目录，不读写仓库中的 data/。预期依据见 {@code docs/knowledge_integrity.md} 第 5 条。</p>
 */
class ChatKnowledgeBoundaryTest {

    /** 本地离线回答的统一示例边界（REQ-035 第 5 条）。 */
    private static final String SAMPLE_BOUNDARY =
            "（以上为未核验的静态课程示例资料，门票、开放时间、交通等请以景区公告为准）";

    /** 知识库兜底回答的课程示例边界前缀（REQ-035 第 5 条）。 */
    private static final String KNOWLEDGE_BOUNDARY =
            "根据我的课程示例资料库（未完成事实核验，不能作为实时出行依据）：";

    @TempDir
    Path tempDir;

    private SpotService spotService;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        spotService = new SpotService();
        spotService.loadSpots();

        KnowledgeService knowledgeService = new KnowledgeService();
        // 指向临时目录中不存在的文件：init() 使用打包默认知识库（16 条），且不污染仓库 data/knowledge.json
        ReflectionTestUtils.setField(knowledgeService, "knowledgeFilePath",
                tempDir.resolve("missing-knowledge.json").toString());
        knowledgeService.init();

        AnalyticsService analyticsService = new AnalyticsService();
        ReflectionTestUtils.setField(analyticsService, "interactionsFilePath",
                tempDir.resolve("interactions.json").toString());

        chatService = new ChatService(spotService, knowledgeService, analyticsService, new AiCompletionClient("", "", ""));
        // 空密钥 → 只走本地离线回答，绝不发起网络请求
    }

    @Test
    void spotReplyIsOfflineAndCarriesSampleBoundary() {
        ChatResponse response = chatService.chat("灵山大佛", null);

        assertTrue(response.isFallback(), "空密钥时应使用本地降级回答");
        assertNotNull(response.getReply());
        assertTrue(response.getReply().contains("灵山大佛"), "回答应包含所问景点名");
        assertTrue(response.getReply().contains("未核验"), "景点回答应含未核验边界");
        assertTrue(response.getReply().contains("景区公告"), "景点回答应提示景区公告");
        assertFalse(response.getReply().contains("50元/位"), "不得保留餐饮价格 50元/位");
        assertFalse(response.getReply().contains("35元/位"), "不得保留餐饮价格 35元/位");
    }

    @Test
    void ticketReplyDropsCateringPricesAndAddsBoundary() {
        ChatResponse response = chatService.chat("门票多少钱", null);

        assertTrue(response.isFallback(), "空密钥时应使用本地降级回答");
        String reply = response.getReply();
        assertTrue(reply.contains("一票制"), "应保留通用门票说明");
        assertTrue(reply.contains(SAMPLE_BOUNDARY), "门票回答应含示例边界");
        assertFalse(reply.contains("50元/位"), "不得保留硬编码餐饮价格");
        assertFalse(reply.contains("35元/位"), "不得保留硬编码餐饮价格");
        assertFalse(reply.contains("素斋自助"), "不得保留食堂自助餐价格描述");
    }

    @Test
    void transportReplyKeepsGuidanceAndAddsBoundary() {
        ChatResponse response = chatService.chat("怎么去灵山", null);

        assertTrue(response.isFallback(), "空密钥时应使用本地降级回答");
        String reply = response.getReply();
        assertTrue(reply.contains("88路"), "应保留现有交通文案");
        assertTrue(reply.contains("景区公告"), "交通回答应提示景区公告");
        assertTrue(reply.contains(SAMPLE_BOUNDARY), "交通回答应含示例边界");
        assertFalse(reply.contains("50元/位"), "交通回答不应出现餐饮价格");
    }

    @Test
    void knowledgeFallbackCarriesCourseSampleBoundary() {
        for (String question : new String[] {"待补充", "原始正文缺失"}) {
            ChatResponse response = chatService.chat(question, null);

            assertTrue(response.isFallback(), "空密钥时应使用本地降级回答: " + question);
            assertNotNull(response.getReply(), "本地知识兜底不得返回 null: " + question);
            assertTrue(response.getReply().contains("课程示例资料库"),
                    "知识兜底应声明课程示例资料库边界: " + question);
            assertTrue(response.getReply().contains("未完成事实核验"),
                    "知识兜底应声明未完成事实核验: " + question);
        }
    }

    @Test
    void greetingWorksOffline() {
        ChatResponse response = chatService.chat("hello", null);

        assertTrue(response.isFallback(), "空密钥时应使用本地降级回答");
        assertNotNull(response.getReply());
        assertFalse(response.getReply().trim().isEmpty(), "本地离线回答不应为空");
        assertTrue(response.getReply().contains("灵灵"), "问候回答应保留数字人导游人设");
    }

    @Test
    void systemMessageCarriesIntegrityRules() throws Exception {
        String content = invokeBuildSystemMessage(spotService.buildSpotContext(), "", "历史人文");

        assertTrue(content.contains("不得用未核验资料补写事实"), "系统提示缺少「不得用未核验资料补写事实」规则");
        assertTrue(content.contains("待补充"), "系统提示缺少「待补充不代表已知」规则");
        assertTrue(content.contains("景区公告"), "系统提示缺少「变动信息需景区公告确认」规则");

        // 保留原有人设、回答原则框架与兴趣分支
        assertTrue(content.contains("灵灵"), "系统提示应保留数字人人设");
        assertTrue(content.contains("回答原则："), "系统提示应保留回答原则框架");
        assertTrue(content.contains("【游客兴趣偏好】"), "系统提示应保留兴趣分支");
        assertTrue(content.contains("历史人文"), "系统提示应保留兴趣内容");
    }

    // ===== 测试辅助 =====

    private String invokeBuildSystemMessage(String spotContext, String knowledgeContext, String interest)
            throws Exception {
        Method method = ChatService.class.getDeclaredMethod(
                "buildSystemMessage", String.class, String.class, String.class);
        method.setAccessible(true);
        ObjectNode node = (ObjectNode) method.invoke(chatService, spotContext, knowledgeContext, interest);
        return node.path("content").asText();
    }
}
