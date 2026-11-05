package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.controller.ChatController;
import com.guide.controller.ThemeGuideController;
import com.guide.model.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** TEST-052. Packaged methods, request-only context, rollback and mocked model contract. */
class ThemeGuideTest {
    private static final String THEME = "scene-details";
    private final ObjectMapper mapper = new ObjectMapper();

    private Spot spot(int id, String name) {
        Spot spot = new Spot();
        spot.setId(id);
        spot.setName(name);
        spot.setBrief("当前简介原文，后半段仍待补充且未经核验，请确认现场条件。");
        return spot;
    }

    private SpotService spots() {
        SpotService spots = mock(SpotService.class);
        List<Spot> values = Arrays.asList(spot(101, "灵山大佛"), spot(205, "九龙灌浴"),
                spot(309, "灵山梵宫"), spot(777, "五明桥"));
        when(spots.getAllSpots()).thenReturn(values);
        when(spots.getSpotById(anyInt())).thenAnswer(call -> values.stream()
                .filter(spot -> spot.getId() == (int) call.getArgument(0)).findFirst());
        when(spots.buildSpotContext()).thenReturn("未核验的景点目录");
        return spots;
    }

    private KnowledgeService knowledge() {
        KnowledgeService knowledge = mock(KnowledgeService.class);
        when(knowledge.retrieve(anyString())).thenReturn(new KnowledgeRetrieval("待补充的候选资料",
                Arrays.asList(new KnowledgeReference(88, "候选")), Collections.emptyList()));
        return knowledge;
    }

    private ChatService local(SpotService spots) {
        return new ChatService(spots, knowledge(), mock(AnalyticsService.class), mock(AiCompletionClient.class));
    }

    private ChatRequest request(Integer spot, String theme, boolean lecture) {
        ChatRequest request = new ChatRequest();
        request.setMessage("请继续这条主题讲解");
        request.setSpotId(spot);
        request.setThemeId(theme);
        request.setThemeLecture(lecture);
        return request;
    }

    @Test void directoryUsesCurrentIdsAndRequiresEveryStop() throws Exception {
        SpotService spots = spots();
        ThemeGuideService themes = new ThemeGuideService(spots);
        JsonNode theme = mapper.valueToTree(themes.list().get(0));
        assertEquals(THEME, theme.path("id").asText());
        assertEquals("从整体到细节，怎样看懂眼前的景观？", theme.path("title").asText());
        assertTrue(theme.path("notice").asText().contains("未核验"));
        assertEquals(3, theme.path("stops").size());
        int[] ids = {101, 205, 309};
        for (int index = 0; index < ids.length; index++) {
            JsonNode stop = theme.path("stops").get(index);
            assertEquals(ids[index], stop.path("spotId").asInt());
            for (String field : Arrays.asList("name", "focus", "question", "bridge", "recap")) {
                assertFalse(stop.path(field).asText().isEmpty(), field);
            }
        }
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new ThemeGuideController(themes)).build();
        mvc.perform(get("/api/themes")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].stops[1].spotId").value(205));
        when(spots.getAllSpots()).thenReturn(Arrays.asList(spot(101, "灵山大佛"), spot(205, "九龙灌浴")));
        assertTrue(themes.list().isEmpty());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> themes.resolve(THEME, spot(101, "灵山大佛"), true)).getRawStatusCode());
    }

    @Test void incompleteBundledMethodsFailLoading() throws Exception {
        for (String field : Arrays.asList("name", "focus", "question", "method", "briefMethod", "bridge", "recap")) {
            JsonNode template;
            try (java.io.InputStream input = getClass().getResourceAsStream("/theme-guide.json")) {
                template = mapper.readTree(input);
            }
            ((com.fasterxml.jackson.databind.node.ObjectNode) template.path("stops").get(0)).remove(field);
            byte[] incomplete = mapper.writeValueAsBytes(template);
            assertThrows(IllegalStateException.class, () -> new ThemeGuideService(spots(),
                    new ByteArrayInputStream(incomplete)), field);
        }
    }

    @Test void actualDirectoryLoadsAndInvalidIdsDisableTheme() {
        SpotService actual = new SpotService();
        actual.loadSpots();
        for (ThemeGuideService.Stop stop : new ThemeGuideService(actual).list().get(0).getStops()) {
            assertEquals(stop.getName(), actual.getSpotById(stop.getSpotId()).get().getName());
        }
        for (int invalid : new int[]{0, -1, 101}) {
            SpotService spots = spots();
            spots.getAllSpots().get(1).setId(invalid);
            assertTrue(new ThemeGuideService(spots).list().isEmpty());
        }
    }

    @Test void allStopsAndModesRetainFullBriefAndGroundedMethod() {
        SpotService spots = spots();
        ChatService chat = local(spots);
        ThemeGuideService themes = new ThemeGuideService(spots);
        for (ThemeGuideService.Stop stop : themes.list().get(0).getStops()) {
            Spot current = spots.getSpotById(stop.getSpotId()).get();
            List<String> replies = new ArrayList<>();
            for (NarrationMode mode : NarrationMode.values()) {
                ChatResponse response = chat.chat("请讲解", null, Collections.emptyList(), current, mode, THEME, true);
                assertTrue(response.isFallback());
                assertEquals(THEME, response.getThemeId());
                assertTrue(response.isThemeLecture());
                assertEquals(mode.getValue(), response.getNarrationMode());
                assertTrue(response.getReply().contains(current.getBrief()));
                assertTrue(response.getReply().contains(stop.getFocus()));
                assertTrue(response.getReply().contains(stop.getBridge()));
                assertTrue(response.getReply().contains("未核验的静态课程示例"));
                assertEquals(mode == NarrationMode.FAMILY, response.getReply().contains("可以和孩子一起"));
                replies.add(response.getReply());
            }
            assertTrue(replies.get(2).length() < replies.get(0).length());
        }
        spots.getSpotById(101).get().setBrief(null);
        assertTrue(chat.chat("讲解", null, Collections.emptyList(), spots.getSpotById(101).get(),
                NarrationMode.BRIEF, THEME, true).getReply().contains("暂未收录"));
    }

    @Test void explicitLectureAndFreeQuestionStayRequestScopedAndInvalidRequestsRollBack() {
        SpotService spots = spots();
        ConversationService conversations = new ConversationService(local(spots), spots);
        MockHttpSession session = new MockHttpSession();
        ChatRequest first = request(101, THEME, true);
        first.setNarrationMode("family");
        ChatResponse initial = conversations.chat(session, first);
        assertTrue(initial.isThemeLecture());
        String id = initial.getConversationId();
        for (ChatRequest bad : Arrays.asList(request(205, "unknown", true), request(777, THEME, true),
                request(205, null, true), request(205, "", true))) {
            bad.setNarrationMode("brief");
            assertEquals(400, assertThrows(ResponseStatusException.class,
                    () -> conversations.chat(session, bad)).getRawStatusCode());
            assertEquals(id, conversations.current(session).getConversationId());
            assertEquals(101, conversations.current(session).getSpotId());
            assertEquals("family", conversations.current(session).getNarrationMode());
        }
        ChatRequest free = request(null, THEME, false);
        free.setMessage("这里的门票");
        ChatResponse reply = conversations.chat(session, free);
        assertEquals(THEME, reply.getThemeId());
        assertFalse(reply.isThemeLecture());
        assertFalse(reply.getReply().contains("主题观察"));
        ChatRequest ordinary = new ChatRequest();
        ordinary.setMessage("你好");
        assertNull(conversations.chat(session, ordinary).getThemeId());
        assertNull(conversations.chat(session, request(777, THEME, false)).getThemeId());
        MockHttpSession fresh = new MockHttpSession();
        assertThrows(ResponseStatusException.class, () -> conversations.chat(fresh, request(777, THEME, true)));
        assertNull(conversations.current(fresh).getConversationId());
    }

    @Test void emptyThemeReplyDoesNotCommitCandidateAndRetainsPreviousHistory() {
        SpotService spots = spots();
        ChatService chat = mock(ChatService.class);
        when(chat.chat(anyString(), any(), anyList(), any(), any())).thenReturn(new ChatResponse("旧回答", true));
        when(chat.chat(anyString(), any(), anyList(), any(), any(), any(), anyBoolean()))
                .thenReturn(new ChatResponse("", true));
        ConversationService conversations = new ConversationService(chat, spots);
        MockHttpSession session = new MockHttpSession();
        ChatRequest ordinary = new ChatRequest();
        ordinary.setMessage("旧问题");
        ordinary.setSpotId(101);
        ordinary.setNarrationMode("family");
        ChatResponse previous = conversations.chat(session, ordinary);
        ChatRequest failed = request(205, THEME, true);
        failed.setNarrationMode("brief");
        assertEquals(502, assertThrows(ResponseStatusException.class,
                () -> conversations.chat(session, failed)).getRawStatusCode());
        assertEquals(previous.getConversationId(), conversations.current(session).getConversationId());
        assertEquals(101, conversations.current(session).getSpotId());
        assertEquals("family", conversations.current(session).getNarrationMode());
        ordinary.setMessage("继续");
        conversations.chat(session, ordinary);
        verify(chat).chat(eq("继续"), isNull(), argThat(history -> history.size() == 2
                && "旧问题".equals(history.get(0).content) && "旧回答".equals(history.get(1).content)),
                any(Spot.class), eq(NarrationMode.FAMILY));
    }

    @Test void strictJsonRejectsMalformedTypesAndKeepsOldMockPath() throws Exception {
        ChatService chat = mock(ChatService.class);
        when(chat.chat(anyString(), any(), anyList(), any(), any())).thenReturn(new ChatResponse("普通回答", true));
        ConversationService conversations = new ConversationService(chat, spots());
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new ChatController(conversations)).build();
        mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"你好\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.themeLecture").value(false));
        verify(chat).chat(eq("你好"), isNull(), anyList(), isNull(), eq(NarrationMode.STANDARD));
        for (String malformed : Arrays.asList("\"themeLecture\":\"true\"", "\"themeLecture\":1", "\"themeLecture\":null",
                "\"themeLecture\":{}", "\"themeId\":42", "\"themeId\":true", "\"themeId\":[]")) {
            mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"message\":\"你好\"," + malformed + "}"))
                    .andExpect(status().isBadRequest());
        }
        MockMvc real = MockMvcBuilders.standaloneSetup(new ChatController(new ConversationService(local(spots()), spots()))).build();
        real.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"你好\",\"themeId\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.themeLecture").value(false));
        real.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"你好\",\"themeId\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test void actualModelRequestKeepsRawQuestionHistoryModeAndValidatedTheme() {
        SpotService spots = spots();
        KnowledgeService knowledge = knowledge();
        RestTemplate rest = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(rest);
        server.expect(requestTo("https://model.example/v1/chat/completions")).andExpect(request -> {
            JsonNode messages = mapper.readTree(((MockClientHttpRequest) request).getBodyAsString()).path("messages");
            String system = messages.get(0).path("content").asText();
            assertTrue(system.contains("从整体到细节，怎样看懂眼前的景观？"));
            assertTrue(system.contains("整体/姿态"));
            assertTrue(system.contains(spots.getSpotById(101).get().getBrief()));
            assertTrue(system.contains("待补充的候选资料") && system.contains("未核验"));
            assertTrue(system.contains(NarrationMode.BRIEF.getInstruction()));
            assertEquals("上一问", messages.get(1).path("content").asText());
            assertEquals("上一答", messages.get(2).path("content").asText());
            assertEquals("原样当前问题", messages.get(3).path("content").asText());
        }).andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"模型主题回答\"}}]}", MediaType.APPLICATION_JSON));
        ChatService chat = new ChatService(spots, knowledge, mock(AnalyticsService.class),
                new AiCompletionClient(rest, "mock-key", "https://model.example/v1", "test"));
        ChatResponse reply = chat.chat("原样当前问题", null, Arrays.asList(new ChatService.Turn("user", "上一问"),
                new ChatService.Turn("assistant", "上一答")), spots.getSpotById(101).get(), NarrationMode.BRIEF, THEME, true);
        assertEquals("模型主题回答", reply.getReply());
        assertFalse(reply.isFallback());
        assertTrue(reply.isThemeLecture());
        assertEquals(THEME, reply.getThemeId());
        assertEquals(88, reply.getKnowledgeReferences().get(0).getId());
        verify(knowledge, times(1)).retrieve("原样当前问题");
        server.verify();
    }

    @Test void modelFailureUsesThemeLectureButFreeQuestionsKeepNormalFallback() {
        SpotService spots = spots();
        KnowledgeService knowledge = knowledge();
        AiCompletionClient ai = mock(AiCompletionClient.class);
        when(ai.isEnabled()).thenReturn(true);
        when(ai.completeWithHistory(anyString(), anyString(), anyList(), anyDouble(), anyInt()))
                .thenThrow(new IllegalStateException("mock offline"));
        ChatService chat = new ChatService(spots, knowledge, mock(AnalyticsService.class), ai, new ThemeGuideService(spots));
        Spot current = spots.getSpotById(101).get();
        ChatResponse lecture = chat.chat("当前问题", null, Collections.emptyList(), current, NarrationMode.FAMILY, THEME, true);
        assertTrue(lecture.isFallback() && lecture.isThemeLecture());
        assertTrue(lecture.getReply().contains("主题观察"));
        ChatResponse free = chat.chat("当前问题", null, Collections.emptyList(), current, NarrationMode.FAMILY, THEME, false);
        assertFalse(free.isThemeLecture());
        assertFalse(free.getReply().contains("主题观察"));
        verify(ai, times(2)).completeWithHistory(contains("整体/姿态"), eq("当前问题"), anyList(), anyDouble(), anyInt());
        verify(knowledge, times(2)).retrieve("当前问题");
        assertEquals(88, lecture.getKnowledgeReferences().get(0).getId());
    }
}
