package com.guide.service;

import com.guide.model.Spot;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** TEST-039: offline mode must answer the requested fact from the validated current spot. */
class ChatFallbackContextTest {
    @Test void pronounFollowupsUseCurrentSpotHistoryAndHours() {
        Spot spot = new Spot(); spot.setId(11); spot.setName("灵山大佛");
        spot.setHistory("经历史料记载的景点故事"); spot.setOpeningHours("08:30-17:00");
        SpotService spots = mock(SpotService.class);
        KnowledgeService knowledge = mock(KnowledgeService.class);
        when(spots.getAllSpots()).thenReturn(Collections.singletonList(spot));
        when(knowledge.retrieveRelevantContext(anyString())).thenReturn("");
        ChatService service = new ChatService(spots, knowledge, mock(AnalyticsService.class), mock(AiCompletionClient.class));

        String story = service.chat("它有什么故事", null, Collections.emptyList(), spot).getReply();
        String hours = service.chat("它什么时候开放", null, Collections.emptyList(), spot).getReply();
        assertTrue(story.contains("灵山大佛") && story.contains("经历史料记载的景点故事"));
        assertTrue(hours.contains("灵山大佛") && hours.contains("08:30-17:00"));
    }
}
