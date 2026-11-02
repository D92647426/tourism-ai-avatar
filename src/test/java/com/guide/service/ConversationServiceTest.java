package com.guide.service;

import com.guide.model.ChatRequest;
import com.guide.model.ChatResponse;
import com.guide.model.Spot;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** REQ-039: session ownership, bounded turns, current spot and failed-turn isolation. */
class ConversationServiceTest {
    private final ChatService chat = mock(ChatService.class);
    private final SpotService spots = mock(SpotService.class);
    private final MutableClock clock = new MutableClock();
    private final ConversationService service = new ConversationService(chat, spots, clock);

    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

    private ChatRequest request(String message, Integer spotId, String conversationId) {
        ChatRequest request = new ChatRequest(); request.setMessage(message);
        request.setSpotId(spotId); request.setConversationId(conversationId); return request;
    }
    private void as(String name) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(name, null, Collections.emptyList()));
    }
    private Spot spot(int id, String name) {
        Spot spot = new Spot(); spot.setId(id); spot.setName(name); return spot;
    }
    private void answer() {
        when(chat.chat(anyString(), any(), anyList(), any())).thenAnswer(call ->
                new ChatResponse("回答：" + call.getArgument(0), true));
    }

    @Test void twoSessionsAndPrincipalChangesCannotReadEachOthersHistory() {
        Spot buddha = spot(11, "灵山大佛"); when(spots.getAllSpots()).thenReturn(Arrays.asList(buddha));
        when(spots.getSpotById(11)).thenReturn(Optional.of(buddha)); answer();
        MockHttpSession alice = new MockHttpSession(), bob = new MockHttpSession();
        as("alice"); ChatResponse first = service.chat(alice, request("灵山大佛是什么", null, null));
        assertEquals(11, first.getSpotId());
        as("bob");
        ResponseStatusException stolen = assertThrows(ResponseStatusException.class,
                () -> service.chat(bob, request("它有什么故事", null, first.getConversationId())));
        assertEquals(403, stolen.getRawStatusCode());
        service.chat(bob, request("普通提问", null, null));
        as("alice"); service.chat(alice, request("它什么时候开放", null, first.getConversationId()));
        verify(chat).chat(eq("它什么时候开放"), isNull(), argThat((List<ChatService.Turn> h) -> h.size() == 2), eq(buddha));
        as("bob"); // Reusing the same cookie after switching identity must reset its old history.
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> service.chat(alice, request("旧会话", null, first.getConversationId()))).getRawStatusCode());
    }

    @Test void explicitSpotSwitchResetsHistoryAndNewConversationInvalidatesOldId() {
        Spot a = spot(11, "灵山大佛"), b = spot(12, "灵山梵宫");
        when(spots.getAllSpots()).thenReturn(Arrays.asList(a,b));
        when(spots.getSpotById(11)).thenReturn(Optional.of(a));
        when(spots.getSpotById(12)).thenReturn(Optional.of(b)); answer();
        MockHttpSession session = new MockHttpSession(); as("alice");
        String id = service.chat(session, request("第一个",11,null)).getConversationId();
        assertEquals(12, service.chat(session, request("第二个",12,id)).getSpotId());
        verify(chat).chat(eq("第二个"), isNull(), argThat((List<ChatService.Turn> h) -> h.isEmpty()), eq(b));
        String next = service.start(session).getConversationId(); assertNotEquals(id,next);
        assertEquals(403,assertThrows(ResponseStatusException.class,
                () -> service.chat(session,request("旧的",null,id))).getRawStatusCode());
    }

    @Test void failedAnswerDoesNotPublishTurnAndIdleHistoryExpires() {
        when(spots.getAllSpots()).thenReturn(Collections.emptyList()); answer();
        MockHttpSession session = new MockHttpSession(); as("alice");
        String id = service.chat(session,request("一",null,null)).getConversationId();
        when(chat.chat(eq("失败"),any(),anyList(),any())).thenThrow(new IllegalStateException("model down"));
        assertThrows(IllegalStateException.class, () -> service.chat(session,request("失败",null,id)));
        service.chat(session,request("二",null,id));
        verify(chat).chat(eq("二"),isNull(),argThat((List<ChatService.Turn> h) -> h.size()==2),isNull());
        clock.now += 21 * 60 * 1000L;
        assertEquals(410,assertThrows(ResponseStatusException.class,
                () -> service.chat(session,request("旧请求",null,id))).getRawStatusCode());
        assertNotEquals(id,service.chat(session,request("新的",null,null)).getConversationId());
    }

    @Test void historyRetainsOnlySixCompletedExchangesAndRejectsUnknownSpot() {
        when(spots.getAllSpots()).thenReturn(Collections.emptyList());
        when(spots.getSpotById(999)).thenReturn(Optional.empty()); answer();
        MockHttpSession session = new MockHttpSession(); as("alice");
        for (int i = 1; i <= 20; i++) service.chat(session,request("问题" + i,null,null));
        verify(chat).chat(eq("问题20"),isNull(),
                argThat((List<ChatService.Turn> h) -> h.size() == 12
                        && h.get(0).content.equals("问题14")),isNull());
        assertEquals(400,assertThrows(ResponseStatusException.class,
                () -> service.chat(session,request("转到未知景点",999,null))).getRawStatusCode());
        assertEquals(400,assertThrows(ResponseStatusException.class,
                () -> service.chat(session,request("   ",null,null))).getRawStatusCode());
    }

    @Test void snapshotRestoresOnlyCurrentOwnersUnexpiredSpot() {
        answer(); as("alice");
        Spot place=spot(11,"灵山大佛");
        when(spots.getSpotById(11)).thenReturn(Optional.of(place));
        MockHttpSession session=new MockHttpSession();
        String id=service.chat(session,request("介绍",11,null)).getConversationId();
        assertEquals(id,service.current(session).getConversationId());
        assertEquals(11,service.current(session).getSpotId());
        assertNull(service.current(new MockHttpSession()).getConversationId());
        as("bob");assertNull(service.current(session).getConversationId());
        as("alice");clock.now += 20 * 60 * 1000L + 1;
        assertNull(service.current(session).getConversationId());
    }

    @Test void aliasesSwitchContextAndCreativeDraftsFitTheSameChatContract() {
        Spot a=spot(11,"灵山大佛"), b=spot(13,"灵山梵宫");
        when(spots.getAllSpots()).thenReturn(Arrays.asList(a,b));
        when(spots.getSpotById(11)).thenReturn(Optional.of(a));
        when(spots.getSpotById(13)).thenReturn(Optional.of(b)); answer();
        MockHttpSession session=new MockHttpSession();
        String id=service.chat(session,request("介绍",11,null)).getConversationId();
        assertEquals(13,service.chat(session,request("梵宫有什么故事",null,id)).getSpotId());
        assertEquals(13,service.chat(session,request("它什么时候开放",null,id)).getSpotId());
        assertNotNull(service.chat(session,request("观察发现".repeat(400),null,id)).getReply());
        assertEquals(400,assertThrows(ResponseStatusException.class,
                () -> service.chat(session,request("字".repeat(5001),null,id))).getRawStatusCode());
    }

    static class MutableClock extends Clock {
        long now = 1_000_000L;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(now); }
        public long millis() { return now; }
    }
}
