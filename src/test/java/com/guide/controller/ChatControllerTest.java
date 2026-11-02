package com.guide.controller;

import com.guide.model.ChatResponse;
import com.guide.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REQ-033：旧 {@code POST /api/chat} 的 HTTP 回归测试。
 *
 * <p>任务：确认抽取 {@code AiCompletionClient} 后旧接口的请求/响应字段名、离线
 * {@code fallback} 语义没有变化，避免前端既有调用被破坏。测试使用 Mockito 假服务，
 * 不启动 Spring 上下文、不访问网络、不读取本机 Key 或 data/users。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033）</a>
 * @see <a href="../../../../../docs/api_reference.md">docs/api_reference.md（POST /api/chat）</a>
 */
class ChatControllerTest {

    private ChatService chatService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        chatService = mock(ChatService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new ChatController(new com.guide.service.ConversationService(chatService, mock(com.guide.service.SpotService.class)))).build();
    }

    @Test
    void legacyChatResponseFieldsRemainUnchanged() throws Exception {
        ChatResponse response = new ChatResponse("灵山大佛通高88米。", false);
        response.setInterest("历史人文");
        response.setRecommendedRoutes(Arrays.asList("推荐路线一", "推荐路线二"));
        when(chatService.chat(eq("大佛有多高"), eq("历史人文"), any(), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"大佛有多高\",\"interest\":\"历史人文\"}"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.reply").value("灵山大佛通高88米。"))
                .andExpect(jsonPath("$.fallback").value(false))
                .andExpect(jsonPath("$.interest").value("历史人文"))
                .andExpect(jsonPath("$.recommendedRoutes[0]").value("推荐路线一"));

        verify(chatService).chat(eq("大佛有多高"), eq("历史人文"), any(), any(), any());
    }

    @Test
    void offlineChatKeepsFallbackSemantics() throws Exception {
        ChatResponse response = new ChatResponse("你好呀，我是灵灵。", true);
        when(chatService.chat(eq("你好"), any(), any(), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"你好\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value("你好呀，我是灵灵。"))
                .andExpect(jsonPath("$.fallback").value(true));

        verify(chatService).chat(eq("你好"), any(), any(), any(), any());
    }
}
