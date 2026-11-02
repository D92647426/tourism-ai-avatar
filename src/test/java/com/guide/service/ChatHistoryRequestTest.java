package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.ChatResponse;
import com.guide.model.Spot;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** REQ-039: inspect actual outbound model JSON without calling a paid or live model. */
class ChatHistoryRequestTest {
    @Test void sendsSystemContextThenBoundedHistoryThenCurrentQuestion() {
        SpotService spots = mock(SpotService.class);
        KnowledgeService knowledge = mock(KnowledgeService.class);
        AnalyticsService analytics = mock(AnalyticsService.class);
        when(spots.buildSpotContext()).thenReturn("景点目录");
        when(knowledge.retrieveRelevantContext(anyString())).thenReturn("参考资料");
        RestTemplate client = new RestTemplate();
        AiCompletionClient ai = new AiCompletionClient(client, "test-key-only", "https://model.example/v1", "test-model");
        ChatService service = new ChatService(spots, knowledge, analytics, ai);
        MockRestServiceServer server = MockRestServiceServer.createServer(client);
        server.expect(requestTo("https://model.example/v1/chat/completions"))
                .andExpect(request -> {
                    JsonNode body = new ObjectMapper().readTree(((MockClientHttpRequest) request).getBodyAsString());
                    JsonNode messages = body.path("messages");
                    assertEquals(4, messages.size());
                    assertTrue(messages.get(0).path("content").asText().contains("【当前景点】灵山大佛"));
                    assertEquals("user", messages.get(1).path("role").asText());
                    assertEquals("灵山大佛是什么", messages.get(1).path("content").asText());
                    assertEquals("assistant", messages.get(2).path("role").asText());
                    assertEquals("先前的回答", messages.get(2).path("content").asText());
                    assertEquals("它有什么故事", messages.get(3).path("content").asText());
                })
                .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"灵山的故事\"}}]}", MediaType.APPLICATION_JSON));
        Spot buddha = new Spot(); buddha.setId(11); buddha.setName("灵山大佛");
        ChatResponse reply = service.chat("它有什么故事", null,
                Arrays.asList(new ChatService.Turn("user", "灵山大佛是什么"),
                        new ChatService.Turn("assistant", "先前的回答")), buddha);
        assertEquals("灵山的故事", reply.getReply());
        assertFalse(reply.isFallback());
        server.verify();
    }
}
