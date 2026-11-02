package com.guide.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** TEST-046: narration stays session-scoped, grounded and part of the actual model request. */
class NarrationModeTest {
    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }
    private ChatRequest request(String mode) {
        ChatRequest r=new ChatRequest();r.setMessage("介绍一下这里");r.setNarrationMode(mode);return r;
    }
    private Spot spot() {
        Spot s=new Spot();s.setId(11);s.setName("灵山大佛");s.setBrief("测试资料：外形高大，细节需要现场观察。");
        s.setHistory("未核验的测试历史，不应补写。");s.setOpeningHours("测试开放时间，需公告确认");
        s.setTicket("测试票价，需官方确认");s.setTransportation("测试交通，需官方确认");
        s.setAddress("完整卡片地址");s.setHighlights(Arrays.asList("测试亮点"));return s;
    }
    private ChatService local(Spot spot) {
        SpotService spots=mock(SpotService.class);when(spots.getAllSpots()).thenReturn(Arrays.asList(spot));
        KnowledgeService knowledge=mock(KnowledgeService.class);
        when(knowledge.retrieve(anyString())).thenReturn(new KnowledgeRetrieval("",Collections.emptyList(),Collections.emptyList()));
        return new ChatService(spots,knowledge,mock(AnalyticsService.class),mock(AiCompletionClient.class));
    }

    @Test void persistsOnlyForThisConversationAndKeepsChoiceAcrossSpotSwitches() {
        ChatService chat=mock(ChatService.class);SpotService spots=mock(SpotService.class);
        when(chat.chat(anyString(),any(),anyList(),any(),any())).thenAnswer(c->new ChatResponse("回答",true));
        when(spots.getSpotById(11)).thenReturn(Optional.of(spot()));
        ConversationService service=new ConversationService(chat,spots);
        MockHttpSession session=new MockHttpSession();
        assertEquals("standard",service.current(session).getNarrationMode());
        ChatResponse first=service.chat(session,request("family"));
        assertEquals("family",first.getNarrationMode());
        assertEquals("family",service.current(session).getNarrationMode());
        ChatRequest follow=request(null);follow.setConversationId(first.getConversationId());follow.setSpotId(11);
        assertEquals("family",service.chat(session,follow).getNarrationMode());
        verify(chat).chat(eq(follow.getMessage()),isNull(),anyList(),any(Spot.class),eq(NarrationMode.FAMILY));
        assertEquals("brief",service.chat(session,request("brief")).getNarrationMode());
        assertEquals(11,service.current(session).getSpotId());
        assertEquals("standard",service.chat(new MockHttpSession(),request(null)).getNarrationMode());
        assertEquals("standard",service.start(session).getNarrationMode());
    }

    @Test void invalidAndFailedRequestsDoNotCommitModeAndExpiryOrIdentityChangesResetIt() {
        ChatService chat=mock(ChatService.class);SpotService spots=mock(SpotService.class);
        when(chat.chat(anyString(),any(),anyList(),any(),any())).thenAnswer(c->new ChatResponse("回答",true));
        ConversationServiceTest.MutableClock clock=new ConversationServiceTest.MutableClock();
        ConversationService service=new ConversationService(chat,spots,clock);MockHttpSession session=new MockHttpSession();
        service.chat(session,request("family"));
        for(String bad:Arrays.asList("", "FAMILY", "family ", "<script>")) {
            assertEquals(400,assertThrows(ResponseStatusException.class,()->service.chat(session,request(bad))).getRawStatusCode());
        }
        when(chat.chat(anyString(),any(),anyList(),any(),eq(NarrationMode.BRIEF))).thenReturn(new ChatResponse("",true));
        assertEquals(502,assertThrows(ResponseStatusException.class,()->service.chat(session,request("brief"))).getRawStatusCode());
        assertEquals("family",service.current(session).getNarrationMode());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("bob",null,Collections.emptyList()));
        assertEquals("standard",service.current(session).getNarrationMode());
        assertEquals("standard",service.chat(session,request(null)).getNarrationMode());
        service.chat(session,request("family"));clock.now+=21*60*1000L;
        assertEquals("standard",service.current(session).getNarrationMode());
        assertEquals("standard",service.chat(session,request(null)).getNarrationMode());
    }

    @Test void localModesUseExistingFieldsAndKeepUncertaintyWithoutExtraColumns() {
        Spot s=spot();ChatService chat=local(s);
        String standard=chat.chat("介绍一下这里",null,Collections.emptyList(),s).getReply();
        String family=chat.chat("介绍一下这里",null,Collections.emptyList(),s,NarrationMode.FAMILY).getReply();
        String brief=chat.chat("介绍一下这里",null,Collections.emptyList(),s,NarrationMode.BRIEF).getReply();
        assertTrue(family.contains(s.getBrief())&&family.contains("可以和孩子一起看看"));
        assertTrue(brief.contains(s.getBrief())&&!brief.contains("可以和孩子一起看看"));
        assertFalse(brief.contains(s.getAddress()));assertTrue(brief.length()<standard.length());
        assertTrue(family.contains("未核验")&&brief.contains("未核验"));
        String hours=chat.chat("这里几点开放",null,Collections.emptyList(),s,NarrationMode.FAMILY).getReply();
        assertTrue(hours.contains(s.getOpeningHours()));assertFalse(hours.contains("一起看看"));
        assertTrue(chat.chat("这里门票多少钱",null,Collections.emptyList(),s,NarrationMode.BRIEF).getReply().contains(s.getTicket()));
        assertTrue(chat.chat("这里怎么去",null,Collections.emptyList(),s,NarrationMode.BRIEF).getReply().contains(s.getTransportation()));
        assertTrue(chat.chat("它有什么故事",null,Collections.emptyList(),s,NarrationMode.BRIEF).getReply().contains(s.getHistory()));
        assertTrue(chat.chat("票价多少",null,Collections.emptyList(),s,NarrationMode.FAMILY).getReply().contains(s.getTicket()));
        assertTrue(chat.chat("历史呢",null,Collections.emptyList(),s,NarrationMode.FAMILY).getReply().contains(s.getHistory()));
        s.setBrief(null);
        assertTrue(chat.chat("介绍这里",null,Collections.emptyList(),s,NarrationMode.FAMILY).getReply().contains("暂未收录"));
    }

    @Test void modelFailureKeepsSelectedLocalNarration() {
        Spot s=spot();SpotService spots=mock(SpotService.class);KnowledgeService knowledge=mock(KnowledgeService.class);
        when(spots.getAllSpots()).thenReturn(Arrays.asList(s));
        when(knowledge.retrieve(anyString())).thenReturn(new KnowledgeRetrieval("",Collections.emptyList(),Collections.emptyList()));
        AiCompletionClient ai=mock(AiCompletionClient.class);when(ai.isEnabled()).thenReturn(true);
        when(ai.completeWithHistory(anyString(),anyString(),anyList(),anyDouble(),anyInt())).thenThrow(new IllegalStateException("mock offline"));
        ChatResponse reply=new ChatService(spots,knowledge,mock(AnalyticsService.class),ai)
                .chat("介绍这里",null,Collections.emptyList(),s,NarrationMode.FAMILY);
        assertTrue(reply.isFallback());assertEquals("family",reply.getNarrationMode());
        assertTrue(reply.getReply().contains("可以和孩子一起看看"));
        verify(knowledge,times(1)).retrieve(anyString());
    }

    @Test void actualModelSystemContainsModeAndHistoryStillPrecedesQuestion() {
        for(NarrationMode mode:Arrays.asList(NarrationMode.FAMILY,NarrationMode.BRIEF)) {
            SpotService spots=mock(SpotService.class);when(spots.buildSpotContext()).thenReturn("测试景点资料");
            KnowledgeService knowledge=mock(KnowledgeService.class);
            when(knowledge.retrieve(anyString())).thenReturn(new KnowledgeRetrieval("待补充资料",Collections.emptyList(),Collections.emptyList()));
            RestTemplate rest=new RestTemplate();MockRestServiceServer server=MockRestServiceServer.createServer(rest);
            ChatService chat=new ChatService(spots,knowledge,mock(AnalyticsService.class),new AiCompletionClient(rest,"mock-key","https://model.example/v1","test"));
            server.expect(requestTo("https://model.example/v1/chat/completions")).andExpect(r->{
                com.fasterxml.jackson.databind.JsonNode messages=new ObjectMapper().readTree(((MockClientHttpRequest)r).getBodyAsString()).path("messages");
                String system=messages.get(0).path("content").asText();
                assertTrue(system.contains("【本次讲解方式】"+mode.getLabel()));
                assertTrue(system.contains(mode.getInstruction())&&system.contains("未核验")&&system.contains("待补充资料"));
                assertEquals("上一问",messages.get(1).path("content").asText());
                assertEquals("当前问题",messages.get(3).path("content").asText());
            }).andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"模型测试回答\"}}]}",MediaType.APPLICATION_JSON));
            ChatResponse reply=chat.chat("当前问题",null,Arrays.asList(new ChatService.Turn("user","上一问"),new ChatService.Turn("assistant","上一答")),spot(),mode);
            assertFalse(reply.isFallback());assertEquals(mode.getValue(),reply.getNarrationMode());server.verify();
        }
    }

    @Test void shortFollowupsUseCurrentFieldsButOtherPlacesNeverInheritThem() {
        Spot s=spot();ChatService chat=local(s);
        for(NarrationMode mode:Arrays.asList(NarrationMode.FAMILY,NarrationMode.BRIEF)) {
            assertTrue(chat.chat("免费吗",null,Collections.emptyList(),s,mode).getReply().contains(s.getTicket()));
            assertTrue(chat.chat("有什么特点？",null,Collections.emptyList(),s,mode).getReply().contains(s.getBrief()));
            for(String question:Arrays.asList("鼋头渚门票多少钱","乐山大佛这里门票多少钱","故宫门票多少钱")) {
                String reply=chat.chat(question,null,Collections.emptyList(),s,mode).getReply();
                assertFalse(reply.contains(s.getTicket()),question);assertFalse(reply.contains("一票制"),question);
            }
        }
    }
}
