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

    private ObjectNode ask(String message, ObjectNode context) {
        ObjectNode request = service.current(session).put("requestId", java.util.UUID.randomUUID().toString()).put("message", message);
        request.set("context", context);
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

    @Test void leavingLibraryAreaClearsPhysicalEvidenceAndKeepsTheTopic() {
        ask("平乐园图书馆");
        ObjectNode inside = ask("我在多媒体阅览区");
        assertEquals("pingleyuan-library-computer-area", inside.path("context").path("position").path("placeId").asText());
        ObjectNode outside = ask("我已经出馆了");
        assertTrue(outside.path("context").path("position").isNull());
        assertEquals(inside.path("context").path("placeId"), outside.path("context").path("placeId"));
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

    @Test void explicitNavigationResolvesNewDestinationAndTaskBeforeRouting() {
        ask("平乐园补卡");
        ask("我在四教");
        ObjectNode library = ask("图书馆怎么走");
        assertEquals("SHOW_ROUTE", library.path("sceneAction").path("type").asText());
        assertEquals("pingleyuan-library", library.path("context").path("placeId").asText());
        assertFalse(library.path("context").hasNonNull("taskId"));
        ObjectNode card = ask("补卡怎么走");
        assertEquals("SHOW_ROUTE", card.path("sceneAction").path("type").asText());
        assertEquals("pingleyuan-card-service", card.path("context").path("placeId").asText());
        assertEquals("campus-card", card.path("context").path("taskId").asText());
        assertEquals("pingleyuan-fourth-teaching", card.path("context").path("position").path("placeId").asText());
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
        assertTrue(gym.path("reply").asText().contains("待核验"));
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

    @Test void unknownGymAfterCardClearsDestinationButKeepsConfirmedPosition() {
        ObjectNode location = mapper.createObjectNode();
        location.putObject("position").put("placeId", "pingleyuan-fourth-teaching")
                .put("source", "confirmed").put("timestamp", System.currentTimeMillis());
        ask("平乐园补卡", location);
        ObjectNode gym = ask("健身房在哪");
        assertTrue(gym.path("context").path("placeId").isNull());
        assertFalse(gym.path("context").has("routePending"));
        assertEquals("pingleyuan-fourth-teaching", gym.path("context").path("position").path("placeId").asText());
        ObjectNode route = ask("带我过去");
        assertNotEquals("SHOW_ROUTE", route.path("sceneAction").path("type").asText());
        assertFalse(route.path("reply").asText().contains("一卡通"));
        assertTrue(route.path("sceneAction").path("placeIds").isEmpty());
    }

    @Test void tongzhouDiningActualChoiceOpensPlaceWhileGenericQuestionListsDining() {
        ObjectNode dining = ask("通州午饭吃什么");
        String actualChoice = dining.path("choices").path(0).path("message").asText();
        assertEquals("看看学生食堂", actualChoice);
        ObjectNode selected = ask(actualChoice);
        assertEquals("SHOW_PLACE", selected.path("sceneAction").path("type").asText());
        assertEquals("tongzhou-student-dining", selected.path("context").path("placeId").asText());
        assertEquals("SHOW_DINING", ask("有什么食堂").path("sceneAction").path("type").asText());
        ObjectNode location = ask("学生食堂在哪");
        assertEquals("SHOW_PLACE", location.path("sceneAction").path("type").asText());
        assertEquals("tongzhou-student-dining", location.path("sceneAction").path("placeIds").path(0).asText());
    }

    @Test void diningRecommendationPreservesIntentWhenNewConversationIncludesCurrentDiningPlace() {
        ObjectNode dining = ask("通州，我在学生食堂，午饭吃什么");
        assertEquals("SHOW_DINING", dining.path("sceneAction").path("type").asText());
        assertEquals("tongzhou-student-dining", dining.path("context").path("position").path("placeId").asText());
        assertTrue(dining.path("reply").asText().contains("学生食堂"));
    }

    @Test void diningRecommendationPreservesIntentAtKnownCampusWithCurrentDiningPlace() {
        ask("我在通州");
        ObjectNode dining = ask("我在学生食堂，午饭吃什么");
        assertEquals("SHOW_DINING", dining.path("sceneAction").path("type").asText());
        assertEquals("tongzhou-student-dining", dining.path("context").path("position").path("placeId").asText());
        assertTrue(dining.path("reply").asText().contains("学生食堂"));
    }

    @Test void explicitLibraryInteriorUsesCatalogAliasAndConfirmsOnlyPhysicalPlace() {
        ask("平乐园补卡");
        for (String message : new String[]{"我在图书馆", "我到了图书馆", "我已经进入图书馆",
                "我已经在图书馆内", "平乐园，我现在在图书馆内", "我已经在逸夫馆内"}) {
            ObjectNode arrived = ask(message);
            assertEquals("pingleyuan-library", arrived.path("context").path("position").path("placeId").asText(), message);
            assertEquals("confirmed", arrived.path("context").path("position").path("source").asText(), message);
            assertEquals("pingleyuan-card-service", arrived.path("context").path("placeId").asText(), message);
            assertFalse(arrived.path("context").path("position").has("latitude"), message);
        }
    }

    @Test void outsideAndHypotheticalLibraryStatementsNeverConfirmInterior() {
        for (String message : new String[]{"我在图书馆外", "我在图书馆门口", "我在图书馆附近",
                "我想去图书馆", "如果我在图书馆", "假如我已经在图书馆内"}) {
            service.start(session);
            ask("我在平乐园");
            assertFalse(ask(message).path("context").hasNonNull("position"), message);
        }
    }

    @Test void explicitLibraryDepartureClearsPhysicalEvidenceAndPreservesDestination() {
        for (String message : new String[]{"我在图书馆外", "我现在在图书馆门口", "我在图书馆附近",
                "我已经离开图书馆", "我已经出馆了", "我不在图书馆里了"}) {
            service.start(session);
            ask("平乐园补卡");
            ask("我在图书馆");
            ObjectNode departed = ask(message);
            assertTrue(departed.path("context").path("position").isNull(), message);
            assertEquals("pingleyuan-card-service", departed.path("context").path("placeId").asText(), message);
            assertEquals("campus-card", departed.path("context").path("taskId").asText(), message);
            assertTrue(ask("带我过去").path("reply").asText().contains("起点"), message);
        }
    }

    @Test void libraryQuestionsAndHypotheticalDepartureDoNotRefreshOrClearPhysicalEvidence() {
        ask("平乐园补卡");
        ObjectNode arrived = ask("我在图书馆");
        for (String message : new String[]{"我想去图书馆", "如果我在图书馆", "如果我离开图书馆", "图书馆外有什么"}) {
            assertEquals(arrived.path("context").path("position"), ask(message).path("context").path("position"), message);
        }
    }

    @Test void futureLibraryEntryDoesNotEstablishOrRefreshPhysicalEvidence() {
        ask("我在平乐园");
        assertFalse(ask("等我进入图书馆再静音").path("context").hasNonNull("position"));
        ObjectNode evidence = mapper.createObjectNode();
        evidence.putObject("position").put("placeId", "pingleyuan-library")
                .put("source", "confirmed").put("timestamp", 1794211200000L);
        ask("平乐园补卡", evidence);
        ObjectNode physical = (ObjectNode) service.current(session).path("position");
        for (String message : new String[]{"等我进入图书馆再静音", "等我到了图书馆再导航",
                "我准备进入图书馆", "等我离开图书馆再开声音", "等我出馆了"}) {
            assertEquals(physical, ask(message).path("context").path("position"), message);
        }
    }

    @Test void libraryOutsideWithDeClearsInteriorAndPreservesDestination() {
        ask("我在平乐园");
        assertFalse(ask("我在图书馆的外面").path("context").hasNonNull("position"));
        ask("平乐园补卡");
        ask("我在图书馆");
        ObjectNode outside = ask("我在图书馆的外面");
        assertTrue(outside.path("context").path("position").isNull());
        assertEquals("pingleyuan-card-service", outside.path("context").path("placeId").asText());
        assertTrue(ask("带我过去").path("reply").asText().contains("起点"));
    }

    @Test void libraryDoorwayWithDeClearsInteriorAndPreservesDestination() {
        ask("我在平乐园");
        assertFalse(ask("我在图书馆的门口").path("context").hasNonNull("position"));
        ask("平乐园补卡");
        ask("我在图书馆");
        ObjectNode doorway = ask("我在图书馆的门口");
        assertTrue(doorway.path("context").path("position").isNull());
        assertEquals("pingleyuan-card-service", doorway.path("context").path("placeId").asText());
        assertTrue(ask("带我过去").path("reply").asText().contains("起点"));
    }

    private void startSimulatedCardVisit() {
        ObjectNode context = mapper.createObjectNode().put("simulated", true).put("hour", 12).put("time", "2026-11-09T12:00:00+08:00");
        context.putObject("weather").put("temperatureC", 20).put("weatherCode", 0);
        context.putObject("position").put("placeId", "pingleyuan-fourth-teaching")
                .put("source", "simulated").put("timestamp", System.currentTimeMillis());
        ask("平乐园补卡", context);
    }

    @Test void exitingSimulationWithoutGpsClearsEnvironmentAndAsksForRouteOrigin() {
        startSimulatedCardVisit();
        ObjectNode omitted = ask("还要注意什么");
        assertTrue(omitted.path("context").path("simulated").asBoolean());
        assertEquals("simulated", omitted.path("context").path("position").path("source").asText());
        ObjectNode exit = ask("带我过去", mapper.createObjectNode().put("simulated", false));
        assertFalse(exit.path("context").path("simulated").asBoolean());
        assertFalse(exit.path("context").hasNonNull("position"));
        assertFalse(exit.path("context").has("time"));
        assertFalse(exit.path("context").has("hour"));
        assertFalse(exit.path("context").has("weather"));
        assertTrue(exit.path("reply").asText().contains("起点"));
        assertEquals("KEEP_SCENE", exit.path("sceneAction").path("type").asText());
    }

    @Test void deniedLocationAfterSimulationRemainsUnknownAndExplicitNullClearsRealPosition() {
        startSimulatedCardVisit();
        ObjectNode denied = mapper.createObjectNode().put("simulated", false).putNull("position");
        ObjectNode exit = ask("带我过去", denied);
        assertFalse(exit.path("context").hasNonNull("position"));
        assertTrue(exit.path("reply").asText().contains("起点"));
        assertFalse(ask("带我过去").path("context").hasNonNull("position"));
        ask("我在四教");
        ObjectNode cleared = ask("带我过去", mapper.createObjectNode().putNull("position"));
        assertFalse(cleared.path("context").hasNonNull("position"));
        assertTrue(cleared.path("reply").asText().contains("起点"));
    }

    @Test void leavingSimulationMergesFreshRealPositionAndTimeInSameTurn() {
        startSimulatedCardVisit();
        ObjectNode fresh = mapper.createObjectNode().put("simulated", false).put("hour", 16).put("time", "2026-11-09T16:00:00+08:00");
        fresh.putObject("position").put("placeId", "pingleyuan-library").put("source", "geolocation")
                .put("timestamp", System.currentTimeMillis()).put("latitude", 39.875).put("longitude", 116.481).put("accuracy", 8);
        ObjectNode answer = ask("带我过去", fresh);
        assertEquals("SHOW_ROUTE", answer.path("sceneAction").path("type").asText());
        assertEquals("pingleyuan-library", answer.path("context").path("position").path("placeId").asText());
        assertEquals("geolocation", answer.path("context").path("position").path("source").asText());
        assertEquals(16, answer.path("context").path("hour").asInt());
        assertEquals("2026-11-09T16:00:00+08:00", answer.path("context").path("time").asText());
        assertFalse(answer.path("context").has("weather"));
        assertEquals("pingleyuan-card-service", answer.path("context").path("placeId").asText());
    }

    @Test void simulationFlagRequiresBooleanButPositionAcceptsExplicitNull() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> ask("平乐园补卡", mapper.createObjectNode().putNull("simulated")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> ask("平乐园补卡", mapper.createObjectNode().put("simulated", "false")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> ask("平乐园补卡", mapper.createObjectNode().put("position", false)));
        ObjectNode valid = ask("平乐园补卡", mapper.createObjectNode().put("simulated", false).putNull("position"));
        assertFalse(valid.path("context").path("simulated").asBoolean());
        assertFalse(valid.path("context").hasNonNull("position"));
    }
}
