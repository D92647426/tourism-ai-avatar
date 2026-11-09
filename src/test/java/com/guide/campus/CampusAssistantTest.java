package com.guide.campus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.service.AiCompletionClient;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import static org.junit.jupiter.api.Assertions.*;

class CampusAssistantTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final MockHttpSession session = new MockHttpSession();
    private final CampusAssistantService service = new CampusAssistantService(new CampusCatalog(),
            new AiCompletionClient("", "http://127.0.0.1", "test"), new CampusWeatherService());

    private ObjectNode ask(String message) {
        ObjectNode request = service.current(session);
        request.put("requestId", java.util.UUID.randomUUID().toString());
        request.put("message", message);
        return service.chat(session, request);
    }

    @Test void lostCardIntentSurvivesCampusClarification() {
        ObjectNode clarification = ask("我的校园卡丢了，去哪补");
        assertTrue(clarification.path("reply").asText().contains("校区"));
        ObjectNode answer = ask("我在平乐园");
        assertTrue(answer.path("reply").asText().contains("1—3"));
        assertEquals("campus-card", answer.path("sceneAction").path("taskId").asText());
        assertEquals("pingleyuan-card-service", answer.path("context").path("placeId").asText());
        assertTrue(answer.path("context").path("position").isMissingNode());
    }

    @Test void routeKeepsCardDestinationWhenUserSuppliesStartingPlace() {
        ask("我的校园卡丢了，去哪补");
        ask("我在平乐园");
        assertTrue(ask("带我过去").path("reply").asText().contains("起点"));
        ObjectNode route = ask("我在四教");
        assertEquals("SHOW_ROUTE", route.path("sceneAction").path("type").asText());
        assertEquals("pingleyuan-card-service", route.path("context").path("placeId").asText());
        assertEquals("pingleyuan-fourth-teaching", route.path("context").path("position").path("placeId").asText());
        assertTrue(route.path("context").path("position").path("timestamp").isIntegralNumber());
        assertTrue(route.path("reply").asText().contains("坐标"));
        ObjectNode library = ask("图书馆在哪");
        assertEquals("pingleyuan-library", library.path("context").path("placeId").asText());
        assertEquals("pingleyuan-fourth-teaching", library.path("context").path("position").path("placeId").asText());
    }

    @Test void libraryPurposeAndVisitorRulesStayInConversation() {
        ask("我在平乐园，图书馆能做什么");
        ObjectNode answer = ask("我是访客，想用公共电脑查资料");
        assertEquals("library-computer", answer.path("sceneAction").path("taskId").asText());
        assertTrue(answer.path("reply").asText().contains("提前申请"));
        assertTrue(answer.path("reply").asText().contains("北区一层西侧"));
        assertEquals(2, answer.path("references").size());
        ObjectNode followup = ask("还要注意什么");
        assertEquals("visitor", followup.path("context").path("audience").asText());
        assertEquals("library-computer", followup.path("sceneAction").path("taskId").asText());
    }

    @Test void diningAndSportsUseOnlyVerifiedDirectoryFacts() {
        ObjectNode dining = ask("我在平乐园，午饭吃什么");
        assertEquals("SHOW_DINING", dining.path("sceneAction").path("type").asText());
        assertTrue(dining.path("sceneAction").path("placeIds").size() >= 2);
        assertTrue(dining.path("reply").asText().contains("评分"));
        assertTrue(dining.path("choices").size() >= 4 && dining.path("choices").size() <= 6);
        ObjectNode sports = ask("我要体育签到");
        assertEquals("sports-sign-in", sports.path("sceneAction").path("taskId").asText());
        assertTrue(sports.path("sceneAction").path("placeIds").isEmpty());
        assertTrue(sports.path("choices").toString().contains("校园跑"));
        ObjectNode gym = ask("健身房在哪");
        assertTrue(gym.path("reply").asText().contains("未核验"));
        assertFalse(gym.path("sceneAction").path("placeIds").toString().contains("swimming-207"));
    }

    @Test void requestOwnershipRetriesAndNewConversationAreVersioned() {
        ObjectNode request = service.current(session).put("requestId", "first").put("message", "我在平乐园，校园卡丢了");
        ObjectNode first = service.chat(session, request);
        assertEquals(first, service.chat(session, request));
        assertEquals(1, service.current(session).path("contextRevision").asInt());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(session, request.deepCopy().put("message", "不同的消息")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(session, request.deepCopy().put("requestId", "stale")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(new MockHttpSession(), request));
        ObjectNode reset = service.start(session);
        assertNotEquals(first.path("conversationId"), reset.path("conversationId"));
        assertEquals(0, reset.path("contextRevision").asInt());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.chat(session, request));
        ObjectNode canceled = reset.deepCopy().put("requestId", "cancel-before-chat");
        service.cancel(session, canceled);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(session, canceled.put("message", "图书馆")));
    }

    @Test void firstLibraryQuestionSurvivesCampusAnswerWithoutInventingArrival() {
        ask("图书馆能做什么");
        ObjectNode answer = ask("我在平乐园");
        assertEquals("SHOW_PLACE", answer.path("sceneAction").path("type").asText());
        assertTrue(answer.path("reply").asText().contains("研讨"));
        service.start(session);
        ObjectNode direct = ask("我在平乐园，图书馆在哪");
        assertFalse(direct.path("context").has("position"));
        assertEquals("pingleyuan-library", direct.path("context").path("placeId").asText());
    }

    @Test void rejectsUnknownIdsOversizedMessagesAndInvalidLocationWithoutMutatingState() {
        ObjectNode input = service.current(session).put("requestId", "invalid").put("message", "你好");
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(session, input.deepCopy().put("placeId", "made-up")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.chat(session, input.deepCopy().put("message", new String(new char[2001]).replace('\0', 'a'))));
        ObjectNode gps = input.deepCopy();
        gps.putObject("context").putObject("position").put("latitude", 999).put("longitude", 116)
                .put("source", "gps").put("timestamp", System.currentTimeMillis()).put("accuracy", 10);
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.chat(session, gps));
        assertEquals(0, service.current(session).path("contextRevision").asInt());
    }

    @Test void photoPreviewPreservesPurposeAndNeverClaimsArrival() {
        ask("平乐园图书馆公共电脑在哪");
        ObjectNode photo = ask("看看这个地点的实景");
        assertEquals("SHOW_PLACE", photo.path("sceneAction").path("type").asText());
        assertEquals("pingleyuan-library", photo.path("sceneAction").path("placeIds").path(0).asText());
        assertTrue(photo.path("reply").asText().contains("外观"));
        assertFalse(photo.path("context").has("position"));
        assertEquals("library-computer", ask("还要注意什么").path("sceneAction").path("taskId").asText());
    }

    @Test void changingTaskWithUnknownDestinationDoesNotReuseOldDestination() {
        ask("平乐园补卡");
        ObjectNode sports = ask("体育签到在哪");
        assertTrue(sports.path("context").path("placeId").isNull());
        assertFalse(ask("带我过去").path("reply").asText().contains("1—3"));
    }

    @Test void singleDiningCandidateStillOffersFourUsableChoices() {
        ObjectNode dining = ask("通州午饭吃什么");
        assertTrue(dining.path("choices").size() >= 4);
        assertTrue(dining.path("choices").size() <= 6);
    }
}
