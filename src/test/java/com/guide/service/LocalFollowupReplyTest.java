package com.guide.service;

import com.guide.model.ChatResponse;
import com.guide.model.KnowledgeReference;
import com.guide.model.NarrationMode;
import com.guide.model.Spot;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** TEST-050: exact local follow-ups retain field qualifiers, mode and retrieval boundaries. */
class LocalFollowupReplyTest {
    private static final List<String> PROMPTS = Arrays.asList(
            "请把核心看点压缩为三句，方便我边走边听。",
            "请用一个生活中的比喻解释最有代表性的看点，并区分比喻与史实。",
            "请给出一个可在现场留意的细节，并说明怎样观察；资料不足时请说明。");

    private Spot spot() {
        Spot spot = new Spot();
        spot.setId(11); spot.setName("灵山大佛");
        spot.setBrief("仅为未核验测试资料。部分含义待补充，请以现场说明为准。");
        spot.setCategory("测试类别");
        return spot;
    }

    private String question(Spot spot, int index) {
        return "关于【" + spot.getName() + "】，" + PROMPTS.get(index);
    }

    private KnowledgeService knowledge(List<String> entities) {
        KnowledgeService knowledge = mock(KnowledgeService.class);
        when(knowledge.retrieve(anyString())).thenReturn(new KnowledgeRetrieval("待核验候选",
                Arrays.asList(new KnowledgeReference(4, "候选标题")), entities));
        return knowledge;
    }

    private ChatService chat(Spot spot, KnowledgeService knowledge, AiCompletionClient ai) {
        SpotService spots = mock(SpotService.class);
        when(spots.getAllSpots()).thenReturn(Arrays.asList(spot));
        when(spots.buildSpotContext()).thenReturn("测试资料");
        return new ChatService(spots, knowledge, mock(AnalyticsService.class), ai);
    }

    @Test void allTemplatesDifferInEveryModeAndKeepCompleteFieldQualifiers() {
        Spot spot = spot();
        for (NarrationMode mode : NarrationMode.values()) {
            HashSet<String> replies = new HashSet<>();
            for (int i = 0; i < PROMPTS.size(); i++) {
                String reply = LocalFollowupReply.build(spot, question(spot, i), mode);
                assertNotNull(reply); assertTrue(reply.contains(spot.getBrief()));
                assertEquals(mode == NarrationMode.FAMILY, reply.contains("和孩子轮流"));
                replies.add(reply);
            }
            assertEquals(3, replies.size());
        }
        assertTrue(LocalFollowupReply.build(spot, question(spot, 0), NarrationMode.STANDARD).contains(spot.getCategory()));
        assertTrue(LocalFollowupReply.build(spot, question(spot, 1), NarrationMode.STANDARD).contains("不作为景点史实"));
        assertTrue(LocalFollowupReply.build(spot, question(spot, 2), NarrationMode.STANDARD).contains("实际能看到"));
    }

    @Test void missingFieldsAreExplicitAndDoNotInventPlaceSpecificDetails() {
        Spot spot = spot(); spot.setBrief(null); spot.setCategory(" ");
        for (int i = 0; i < PROMPTS.size(); i++) {
            String reply = LocalFollowupReply.build(spot, question(spot, i), NarrationMode.BRIEF);
            assertTrue(reply.contains("目前没有收录")); assertFalse(reply.contains("null"));
        }
        assertTrue(LocalFollowupReply.build(spot, question(spot, 0), NarrationMode.BRIEF).contains("没有收录景点类别"));
    }

    @Test void onlyCompleteStationBoundTemplatesMatchIncludingCustomNames() {
        Spot spot = spot(); spot.setName("自定义图画园");
        assertNotNull(LocalFollowupReply.build(spot, question(spot, 2), NarrationMode.BRIEF));
        assertNull(LocalFollowupReply.build(spot, "关于【灵山大佛】，" + PROMPTS.get(2), NarrationMode.BRIEF));
        assertNull(LocalFollowupReply.build(spot, "不要" + question(spot, 2), NarrationMode.BRIEF));
        assertNull(LocalFollowupReply.build(spot, question(spot, 2) + "另外问门票", NarrationMode.BRIEF));
        assertNull(LocalFollowupReply.build(null, "看细节", NarrationMode.BRIEF));
        assertNull(LocalFollowupReply.build(spot, null, NarrationMode.BRIEF));
    }

    @Test void resolvedAndCurrentSpotPathsUseLocalRepliesAndOneCandidateSnapshot() {
        Spot spot = spot();
        for (List<String> entities : Arrays.asList(Collections.<String>emptyList(), Arrays.asList(spot.getName()))) {
            for (NarrationMode mode : NarrationMode.values()) {
                KnowledgeService knowledge = knowledge(entities);
                ChatService chat = chat(spot, knowledge, mock(AiCompletionClient.class));
                for (int i = 0; i < PROMPTS.size(); i++) {
                    ChatResponse reply = chat.chat(question(spot, i), null, Collections.emptyList(), spot, mode);
                    assertTrue(reply.isFallback()); assertEquals(mode.getValue(), reply.getNarrationMode());
                    assertTrue(reply.getReply().contains("本地追问讲解"));
                    assertTrue(reply.getReply().contains("静态课程示例"));
                    assertEquals("local-knowledge:4", reply.getKnowledgeReferences().get(0).getSource());
                }
                verify(knowledge, times(3)).retrieve(anyString());
            }
        }
    }

    @Test void excludedAndMultipleEntitiesCannotBypassScopeRules() {
        Spot spot = spot();
        KnowledgeService multiple = knowledge(Arrays.asList("灵山大佛", "灵山梵宫"));
        assertFalse(chat(spot, multiple, mock(AiCompletionClient.class))
                .chat(question(spot, 0), null, Collections.emptyList(), spot, NarrationMode.BRIEF)
                .getReply().contains("本地追问讲解"));
        Spot outside = spot(); outside.setName("乐山大佛");
        KnowledgeService empty = knowledge(Collections.emptyList());
        String excluded = chat(spot, empty, mock(AiCompletionClient.class))
                .chat(question(outside, 0), null, Collections.emptyList(), spot, NarrationMode.FAMILY).getReply();
        assertFalse(excluded.contains(spot.getBrief())); assertFalse(excluded.contains("本地追问讲解"));
        ChatResponse general = chat(spot, empty, mock(AiCompletionClient.class))
                .chat(question(spot, 0), null, Collections.emptyList(), null, NarrationMode.BRIEF);
        assertFalse(general.getReply().contains("本地追问讲解"));
    }

    @Test void enabledModelStillReceivesOriginalQuestionAndHistory() {
        Spot spot = spot(); KnowledgeService knowledge = knowledge(Collections.emptyList());
        AiCompletionClient ai = mock(AiCompletionClient.class); when(ai.isEnabled()).thenReturn(true);
        when(ai.completeWithHistory(anyString(), anyString(), anyList(), anyDouble(), anyInt())).thenReturn("在线回答");
        List<ChatService.Turn> history = Arrays.asList(new ChatService.Turn("user", "上一问"));
        ChatResponse reply = chat(spot, knowledge, ai).chat(question(spot, 1), null, history, spot, NarrationMode.FAMILY);
        assertFalse(reply.isFallback()); assertEquals("在线回答", reply.getReply());
        verify(ai).completeWithHistory(anyString(), eq(question(spot, 1)), eq(history), anyDouble(), anyInt());
        verify(knowledge).retrieve(question(spot, 1));
    }

    @Test void modelFailureUsesTheSameLocalReplyAndCandidates() {
        Spot spot = spot(); KnowledgeService knowledge = knowledge(Collections.emptyList());
        AiCompletionClient ai = mock(AiCompletionClient.class); when(ai.isEnabled()).thenReturn(true);
        when(ai.completeWithHistory(anyString(), anyString(), anyList(), anyDouble(), anyInt())).thenThrow(new IllegalStateException("offline"));
        ChatResponse reply = chat(spot, knowledge, ai).chat(question(spot, 2), null, Collections.emptyList(), spot, NarrationMode.BRIEF);
        assertTrue(reply.isFallback()); assertTrue(reply.getReply().contains("现场观察建议"));
        assertEquals(1, reply.getKnowledgeReferences().size()); verify(knowledge).retrieve(question(spot, 2));
    }

    @Test void frontendTemplatesRemainCompatibleWithExactLocalMatching() throws Exception {
        String frontend = new String(Files.readAllBytes(Paths.get("src/main/resources/static/js/chat-followups.js")), StandardCharsets.UTF_8);
        for (String prompt : PROMPTS) assertTrue(frontend.contains("prompt: '" + prompt + "'"));
        assertTrue(frontend.contains("label: '抓重点'")); assertFalse(frontend.contains("30 秒"));
    }
}
