package com.guide.service;

import com.guide.model.ChatResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

import java.net.SocketTimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * REQ-033：{@link ChatService} 抽取 {@link AiCompletionClient} 后的回归测试。
 *
 * <p>任务：确保旧 {@code POST /api/chat} 的响应字段、空 Key 离线降级语义和异常降级行为不变，
 * 并验证供应商差异（成功、超时异常）只影响生成方式而不泄露供应商消息。
 * 测试使用 Mockito 假服务，不访问网络、不读取本机 Key 或 data/users。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033 API-033）</a>
 * @see <a href="../../../../../docs/api_reference.md">docs/api_reference.md（POST /api/chat）</a>
 */
class ChatServiceTest {

    private SpotService spotService;
    private KnowledgeService knowledgeService;
    private AnalyticsService analyticsService;
    private AiCompletionClient aiCompletionClient;
    private ChatService chatService;

    @BeforeEach
    void setUp() {
        spotService = mock(SpotService.class);
        knowledgeService = mock(KnowledgeService.class);
        analyticsService = mock(AnalyticsService.class);
        aiCompletionClient = mock(AiCompletionClient.class);
        chatService = new ChatService(spotService, knowledgeService, analyticsService, aiCompletionClient);
        when(spotService.buildSpotContext()).thenReturn("灵山大佛、九龙灌浴");
        when(knowledgeService.retrieveRelevantContext(anyString())).thenReturn("");
    }

    @Test
    void offlineChatKeepsLegacyFieldsAndFallbackSemantics() {
        when(aiCompletionClient.isEnabled()).thenReturn(false);

        ChatResponse response = chatService.chat("你好", "历史人文");

        assertNotNull(response.getReply());
        assertFalse(response.getReply().isEmpty());
        assertTrue(response.isFallback());
        assertEquals("历史人文", response.getInterest());
        assertNotNull(response.getRecommendedRoutes());
        assertFalse(response.getRecommendedRoutes().isEmpty());
        verify(aiCompletionClient, never()).complete(anyString(), anyString(), anyDouble(), anyInt());
        verify(analyticsService).logInteraction(eq("你好"), eq(response.getReply()), eq("历史人文"));
    }

    @Test
    void offlineChatWithoutInterestDoesNotAddRoutes() {
        when(aiCompletionClient.isEnabled()).thenReturn(false);

        ChatResponse response = chatService.chat("灵山有什么好玩的", null);

        assertTrue(response.isFallback());
        assertNotNull(response.getReply());
        assertFalse(response.getReply().isEmpty());
        assertNull(response.getInterest());
        assertNull(response.getRecommendedRoutes());
    }

    @Test
    void onlineChatUsesModelReplyAndClearsFallback() {
        when(aiCompletionClient.isEnabled()).thenReturn(true);
        when(aiCompletionClient.complete(anyString(), eq("大佛有多高"), anyDouble(), anyInt()))
                .thenReturn("灵山大佛通高88米。");

        ChatResponse response = chatService.chat("大佛有多高", null);

        assertFalse(response.isFallback());
        assertEquals("灵山大佛通高88米。", response.getReply());
        verify(aiCompletionClient).complete(anyString(), eq("大佛有多高"), eq(0.7), eq(800));
    }

    @Test
    void transportTimeoutFallsBackToLocalWithoutLeakingDetails() {
        when(aiCompletionClient.isEnabled()).thenReturn(true);
        when(aiCompletionClient.complete(anyString(), anyString(), anyDouble(), anyInt()))
                .thenThrow(new ResourceAccessException(
                        "I/O error", new SocketTimeoutException("Read timed out")));

        ChatResponse response = chatService.chat("大佛有多高", null);

        assertTrue(response.isFallback());
        assertNotNull(response.getReply());
        assertFalse(response.getReply().isEmpty());
        assertFalse(response.getReply().contains("Read timed out"));
        assertFalse(response.getReply().contains("I/O error"));
        verify(analyticsService).logInteraction(eq("大佛有多高"), eq(response.getReply()), isNull());
    }

    @Test
    void legacySingleArgumentOverloadReturnsReplyText() {
        when(aiCompletionClient.isEnabled()).thenReturn(false);

        String reply = chatService.chat("你好");

        assertNotNull(reply);
        assertFalse(reply.isEmpty());
        assertTrue(reply.contains("灵灵"));
    }
}
