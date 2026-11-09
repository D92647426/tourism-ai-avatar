package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.service.AiCompletionClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.IntFunction;
import static org.junit.jupiter.api.Assertions.*;

/** Real loopback HTTP provider: exercises wire tool_calls, not an internal model mock. */
class CampusModelHttpTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void completesRealToolRoundTripWithCatalogEvidence() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        List<JsonNode> requests = new ArrayList<>();
        server.createContext("/chat/completions", exchange -> {
            JsonNode request = mapper.readTree(exchange.getRequestBody());
            requests.add(request);
            ObjectNode message = mapper.createObjectNode().put("role", "assistant");
            if (requests.size() == 1) {
                message.putNull("content");
                message.putArray("tool_calls").addObject().put("id", "call-1").put("type", "function")
                        .putObject("function").put("name", "get_place").put("arguments", "{\"placeId\":\"pingleyuan-library\"}");
            } else {
                message.put("content", "{\"reply\":\"资料显示图书馆提供阅览和自修，入口待核实。\",\"sceneAction\":{\"type\":\"SHOW_PLACE\",\"placeIds\":[\"pingleyuan-library\"],\"taskId\":null,\"title\":\"图书馆\"}}");
            }
            ObjectNode response = mapper.createObjectNode();
            response.putArray("choices").addObject().set("message", message);
            byte[] bytes = response.toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            CampusAssistantService service = new CampusAssistantService(new CampusCatalog(),
                    new AiCompletionClient("test-only", "http://127.0.0.1:" + server.getAddress().getPort(), "test-model"), new CampusWeatherService());
            MockHttpSession session = new MockHttpSession();
            ObjectNode request = service.current(session).put("requestId", "http-round-trip").put("message", "平乐园图书馆在哪");
            ObjectNode result = service.chat(session, request);
            assertEquals("deepseek", result.path("mode").asText());
            assertEquals(2, requests.size());
            assertEquals("disabled", requests.get(0).path("thinking").path("type").asText());
            assertEquals(6, requests.get(0).path("tools").size());
            JsonNode messages = requests.get(1).path("messages");
            JsonNode tool = messages.get(messages.size() - 1);
            assertEquals("tool", tool.path("role").asText());
            assertEquals("call-1", tool.path("tool_call_id").asText());
            assertTrue(tool.path("content").asText().contains("pingleyuan-library"));
            assertFalse(result.path("references").isEmpty());
            assertEquals("SHOW_PLACE", result.path("sceneAction").path("type").asText());
        } finally { server.stop(0); }
    }

    @Test void unknownToolsIdsMalformedRepliesAndExcessiveRoundsFallBack() throws Exception {
        List<IntFunction<ObjectNode>> scenarios = new ArrayList<>();
        scenarios.add(n -> toolMessage("unknown_tool", "{}", n));
        scenarios.add(n -> toolMessage("get_place", "{\"placeId\":\"made-up\"}", n));
        scenarios.add(n -> n == 1 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n)
                : finalMessage("{\"reply\":\"文字\",\"sceneAction\":{\"type\":\"SHOW_PLACE\",\"placeIds\":[\"invented-place\"]}}"));
        scenarios.add(n -> n == 1 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n) : finalMessage("invalid JSON"));
        scenarios.add(n -> toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n));
        for (IntFunction<ObjectNode> scenario : scenarios) {
            List<JsonNode> requests = new ArrayList<>();
            ObjectNode result = runProvider(scenario, requests, false);
            assertEquals("local-fallback", result.path("mode").asText());
            assertEquals("pingleyuan-library", result.path("context").path("placeId").asText());
            assertTrue(requests.size() <= 4);
            assertFalse(result.path("references").toString().contains("evil.example"));
        }
    }

    @Test void unknownActionRetainsTextWithoutActivatingAnUntrustedScene() throws Exception {
        ObjectNode result = runProvider(n -> n == 1 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n)
                : finalMessage("{\"reply\":\"有效文字。\",\"sceneAction\":{\"type\":\"EXECUTE_JS\"},\"references\":[{\"url\":\"https://evil.example\"}]}"), new ArrayList<>(), false);
        assertEquals("deepseek", result.path("mode").asText());
        assertEquals("有效文字。", result.path("reply").asText());
        assertEquals("KEEP_SCENE", result.path("sceneAction").path("type").asText());
        assertTrue(result.has("sceneNotice"));
        assertFalse(result.path("references").toString().contains("evil.example"));
    }

    @Test void allSixToolsUseBoundedCatalogAndExplicitSimulation() throws Exception {
        List<JsonNode> requests = new ArrayList<>();
        ObjectNode result = runProvider(n -> {
            if (n > 1) return finalMessage("{\"reply\":\"目录提供地点与办事资料；天气为模拟。\",\"sceneAction\":{\"type\":\"KEEP_SCENE\",\"placeIds\":[],\"taskId\":null}}");
            ObjectNode message = toolMessage("find_places", "{\"query\":\"图书馆\"}", 1);
            com.fasterxml.jackson.databind.node.ArrayNode calls = (com.fasterxml.jackson.databind.node.ArrayNode) message.path("tool_calls");
            calls.add(toolMessage("find_tasks", "{\"query\":\"校园卡\"}", 2).path("tool_calls").get(0));
            calls.add(toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", 3).path("tool_calls").get(0));
            calls.add(toolMessage("get_weather", "{}", 4).path("tool_calls").get(0));
            calls.add(toolMessage("preview_route", "{\"destinationId\":\"pingleyuan-library\"}", 5).path("tool_calls").get(0));
            calls.add(toolMessage("get_dining_candidates", "{}", 6).path("tool_calls").get(0));
            return message;
        }, requests, true);
        assertEquals("deepseek", result.path("mode").asText());
        JsonNode messages = requests.get(1).path("messages");
        int tools = 0;
        String toolResults = "";
        for (JsonNode message : messages) if ("tool".equals(message.path("role").asText())) {
            tools++;
            toolResults += message.path("content").asText();
        }
        assertEquals(6, tools);
        assertTrue(toolResults.contains("simulated"));
        assertTrue(toolResults.contains("origin-required"));
        assertTrue(toolResults.contains("pingleyuan-card-service"));
        assertTrue(toolResults.contains("pingleyuan-north-dining"));
    }

    private ObjectNode toolMessage(String name, String arguments, int number) {
        ObjectNode message = mapper.createObjectNode().put("role", "assistant").putNull("content");
        message.putArray("tool_calls").addObject().put("id", "call-" + number).put("type", "function")
                .putObject("function").put("name", name).put("arguments", arguments);
        return message;
    }

    private ObjectNode finalMessage(String content) { return mapper.createObjectNode().put("role", "assistant").put("content", content); }

    private ObjectNode runProvider(IntFunction<ObjectNode> responseFor, List<JsonNode> requests, boolean simulated) throws Exception {
        return runProvider(responseFor, requests, (service, session) -> {
            ObjectNode input = service.current(session).put("requestId", "wire").put("message", "平乐园图书馆在哪");
            if (simulated) input.putObject("context").put("simulated", true).putObject("weather").put("temperatureC", 20).put("weatherCode", 0);
            return service.chat(session, input);
        });
    }

    @Test void modelDiningRedirectReplacesCardChoicesAndDestinationThroughActualChoice() throws Exception {
        runProvider(n -> n == 2 ? toolMessage("get_dining_candidates", "{}", n)
                : n == 3 ? finalMessage("{\"reply\":\"可以看看这两家餐厅。\",\"sceneAction\":{\"type\":\"SHOW_DINING\",\"placeIds\":[\"pingleyuan-north-dining\",\"pingleyuan-tiantian-dining\"],\"taskId\":null}}")
                : toolMessage("unknown_tool", "{}", n), new ArrayList<>(), (service, session) -> {
            chat(service, session, "平乐园补卡");
            ObjectNode dining = chat(service, session, "肚子饿了");
            assertEquals("deepseek", dining.path("mode").asText());
            assertFalse(dining.path("context").hasNonNull("taskId"));
            assertFalse(dining.path("context").hasNonNull("placeId"));
            assertEquals(4, dining.path("choices").size());
            assertEquals("followup", dining.path("choices").path(2).path("kind").asText());
            assertEquals("custom", dining.path("choices").path(3).path("kind").asText());
            assertFalse(dining.path("context").hasNonNull("position"));
            ObjectNode chosen = chat(service, session, dining.path("choices").path(0).path("message").asText());
            assertEquals("SHOW_PLACE", chosen.path("sceneAction").path("type").asText());
            assertEquals("pingleyuan-north-dining", chosen.path("context").path("placeId").asText());
            chat(service, session, "我在四教");
            ObjectNode route = chat(service, session, "带我过去");
            assertEquals("pingleyuan-north-dining", route.path("sceneAction").path("placeIds").path(0).asText());
            return route;
        });
    }

    private ObjectNode chat(CampusAssistantService service, MockHttpSession session, String message) {
        return service.chat(session, service.current(session).put("requestId", java.util.UUID.randomUUID().toString()).put("message", message));
    }

    @Test void modelNewPlaceAndUnknownPlaceTaskReplaceOnlyBusinessContext() throws Exception {
        runProvider(n -> n == 2 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n)
                : n == 3 ? finalMessage("{\"reply\":\"这里是图书馆。\",\"sceneAction\":{\"type\":\"SHOW_PLACE\",\"placeIds\":[\"pingleyuan-library\"],\"taskId\":null}}")
                : n == 4 ? toolMessage("find_tasks", "{\"query\":\"体育签到\"}", n)
                : n == 5 ? finalMessage("{\"reply\":\"请先确认体育事项。\",\"sceneAction\":{\"type\":\"SHOW_SERVICE_TASK\",\"placeIds\":[],\"taskId\":\"sports-sign-in\"}}")
                : toolMessage("unknown_tool", "{}", n), new ArrayList<>(), (service, session) -> {
            chat(service, session, "平乐园补卡");
            ObjectNode library = chat(service, session, "想找个地方坐坐");
            assertEquals("deepseek", library.path("mode").asText());
            assertEquals("pingleyuan-library", library.path("context").path("placeId").asText());
            assertFalse(library.path("context").hasNonNull("taskId"));
            assertEquals("想在图书馆安静学习", library.path("choices").path(0).path("message").asText());
            ObjectNode task = chat(service, session, "我有件体育相关的事");
            assertEquals("deepseek", task.path("mode").asText());
            assertEquals("sports-sign-in", task.path("context").path("taskId").asText());
            assertFalse(task.path("context").hasNonNull("placeId"));
            assertTrue(task.path("choices").toString().contains("校园跑"));
            assertFalse(task.path("context").hasNonNull("position"));
            return task;
        });
    }

    @Test void modelUtilityAndSameBusinessPhotoPreserveTheOngoingTask() throws Exception {
        for (String type : Arrays.asList("KEEP_SCENE", "RETURN_STAGE", "SHOW_WEATHER", "SHOW_PLACE")) {
            String places = "SHOW_PLACE".equals(type) ? "[\"pingleyuan-card-service\"]" : "[]";
            runProvider(n -> n == 2 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-card-service\"}", n)
                    : n == 3 ? finalMessage("{\"reply\":\"继续为你提供校园信息。\",\"sceneAction\":{\"type\":\""+type+"\",\"placeIds\":"+places+",\"taskId\":null}}")
                    : toolMessage("unknown_tool", "{}", n), new ArrayList<>(), (service, session) -> {
                chat(service, session, "平乐园补卡");
                ObjectNode enhanced = chat(service, session, "还要注意什么");
                assertEquals("deepseek", enhanced.path("mode").asText());
                assertEquals("campus-card", enhanced.path("context").path("taskId").asText());
                assertEquals("pingleyuan-card-service", enhanced.path("context").path("placeId").asText());
                return enhanced;
            });
        }
    }

    @Test void modelPhotoOfLibraryAreaPreservesItsServiceDestination() throws Exception {
        runProvider(n -> n == 2 ? toolMessage("get_place", "{\"placeId\":\"pingleyuan-library\"}", n)
                : n == 3 ? finalMessage("{\"reply\":\"这里是图书馆外观。\",\"sceneAction\":{\"type\":\"SHOW_PLACE\",\"placeIds\":[\"pingleyuan-library\"],\"taskId\":null}}")
                : toolMessage("unknown_tool", "{}", n), new ArrayList<>(), (service, session) -> {
            chat(service, session, "平乐园想用公共电脑查资料");
            ObjectNode photo = chat(service, session, "看看这个地点的实景");
            assertEquals("deepseek", photo.path("mode").asText());
            assertEquals("pingleyuan-library", photo.path("sceneAction").path("placeIds").path(0).asText());
            assertEquals("library-computer", photo.path("context").path("taskId").asText());
            assertEquals("pingleyuan-library-computer-area", photo.path("context").path("placeId").asText());
            return photo;
        });
    }

    private ObjectNode runProvider(IntFunction<ObjectNode> responseFor, List<JsonNode> requests,
                                   java.util.function.BiFunction<CampusAssistantService, MockHttpSession, ObjectNode> conversation) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            requests.add(mapper.readTree(exchange.getRequestBody()));
            ObjectNode response = mapper.createObjectNode();
            response.putArray("choices").addObject().set("message", responseFor.apply(requests.size()));
            byte[] bytes = response.toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            CampusAssistantService service = new CampusAssistantService(new CampusCatalog(), new AiCompletionClient("test-only",
                    "http://127.0.0.1:" + server.getAddress().getPort(), "test"), new CampusWeatherService());
            MockHttpSession session = new MockHttpSession();
            return conversation.apply(service, session);
        } finally { server.stop(0); }
    }
}
