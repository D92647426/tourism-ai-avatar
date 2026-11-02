package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.ChatResponse;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.StreamUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** REQ-037 / API-037: exercise final replies and a loopback-only model boundary.
 * No paid model, user history, or repository data writes. See docs/natural_retrieval.md.
 */
class NaturalChatTest {
    @TempDir Path temp;
    private final ObjectMapper mapper = new ObjectMapper();

    @ParameterizedTest
    @CsvSource({
        "灵山大佛有什么故事？,4", "大佛有什么故事？,4", "我想了解梵 宫怎么逛？,5",
        "东方卢浮宫讲什么？,5", "九龙灌浴在演什么？,6", "九龙喷泉有什么故事？,6",
        "白塔值得看吗？,15", "小布达拉宫是什么？,7", "赵朴初纪念馆介绍,14",
        "佛陀成道故事,13", "灵山胜境门票与交通指南,9", "祥符寺的历史是什么？,3"
    })
    void finalOfflineReplyReturnsTheRelevantCandidateForEveryMatrixQuestion(String question, int expectedId) {
        ChatResponse response = chat(defaults()).chat(question, null);
        assertTrue(response.isFallback());
        assertFalse(response.getReply().trim().isEmpty());
        JsonNode refs = mapper.valueToTree(response).path("knowledgeReferences");
        boolean found = false;
        for (JsonNode ref : refs) if (ref.path("id").asInt() == expectedId) found = true;
        assertTrue(found, response.getReply());
    }

    @Test void foreignNameDoesNotReturnTheLocalScenicCard() {
        ChatResponse response = chat(defaults()).chat("乐山大佛有什么故事？", null);
        assertFalse(response.getReply().contains("您好！关于【灵山大佛】"));
        for (JsonNode ref : mapper.valueToTree(response).path("knowledgeReferences")) {
            assertNotEquals(4, ref.path("id").asInt());
        }
    }

    @Test void aliasFinalReplyContainsActualKnowledgeReference() throws Exception {
        ChatResponse response = chat(defaults()).chat("大佛有什么故事？", null);
        JsonNode json = mapper.valueToTree(response);
        assertTrue(response.isFallback());
        assertTrue(response.getReply().contains("灵山大佛"));
        assertTrue(response.getReply().contains("资料 K4】"));
        assertEquals(1, json.path("knowledgeReferences").size());
        assertEquals(4, json.path("knowledgeReferences").get(0).path("id").asInt());
        assertEquals("local-knowledge:4", json.path("knowledgeReferences").get(0).path("source").asText());
        assertTrue(response.getReply().contains("未核验"));
    }

    @Test void ambiguousAndUnrelatedInputAskForANameWithoutReferences() {
        for (String question : new String[] {"它有什么故事？", "那个寺庙呢", "如何编写Java排序算法", "  "}) {
            ChatResponse response = chat(defaults()).chat(question, null);
            assertTrue(response.getReply().contains("请补充景点名称"), response.getReply());
            assertTrue(mapper.valueToTree(response).path("knowledgeReferences").isArray());
            assertEquals(0, mapper.valueToTree(response).path("knowledgeReferences").size());
        }
    }

    @Test void multipleEntitiesAreNotReducedToFirstScenicListEntry() {
        ChatResponse response = chat(defaults()).chat("大佛和梵宫有什么不同？", null);
        assertTrue(response.getReply().contains("资料 K4】"), response.getReply());
        assertTrue(response.getReply().contains("资料 K5】"), response.getReply());
    }

    @Test void scenicFallbackCanWorkWhileKnowledgeLookupExplicitlyHasNoEvidence() throws Exception {
        Files.write(temp.resolve("empty.json"), "[]".getBytes(StandardCharsets.UTF_8));
        ChatResponse response = chat(load(new KnowledgeService(), "empty.json")).chat("大佛有什么故事？", null);
        assertTrue(response.getReply().contains("灵山大佛"));
        assertTrue(response.getReply().contains("没有匹配的知识条目"));
        assertEquals(0, mapper.valueToTree(response).path("knowledgeReferences").size());
    }

    @Test void localModelRequestReceivesBoundedReferencesAndFailedModelDoesNotRetrieveTwice() throws Exception {
        for (int httpStatus : new int[] {200, 503}) {
            AtomicInteger lookups = new AtomicInteger();
            AtomicReference<KnowledgeRetrieval> snapshot = new AtomicReference<>();
            KnowledgeService knowledge = new KnowledgeService() {
                @Override public KnowledgeRetrieval retrieve(String question) {
                    lookups.incrementAndGet();
                    KnowledgeRetrieval result = super.retrieve(question); snapshot.set(result); return result;
                }
            };
            load(knowledge, "mock-" + httpStatus + ".json");
            AtomicReference<String> captured = new AtomicReference<>();
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/chat/completions", exchange -> {
                captured.set(StreamUtils.copyToString(exchange.getRequestBody(), StandardCharsets.UTF_8));
                byte[] body = "{\"choices\":[{\"message\":{\"content\":\"本机模型mock回答\"}}]}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                exchange.sendResponseHeaders(httpStatus, body.length);
                try (java.io.OutputStream out = exchange.getResponseBody()) { out.write(body); }
                exchange.close();
            });
            server.start();
            try {
                ChatService service = chat(knowledge);
                ReflectionTestUtils.setField(service, "aiCompletionClient", new AiCompletionClient("local-mock-only", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1", "local-mock"));
                ChatResponse response = service.chat("大佛有什么故事？", null);
                assertNotNull(captured.get());
                assertTrue(mapper.readTree(captured.get()).path("messages").get(0).path("content").asText().contains("资料 K4】"));
                assertTrue(mapper.readTree(captured.get()).path("messages").get(0).path("content").asText().contains(snapshot.get().getContext()));
                assertTrue(snapshot.get().getContext().length() <= 1200);
                assertEquals(httpStatus != 200, response.isFallback());
                assertEquals(1, lookups.get(), "One retrieval snapshot even after model failure");
                assertEquals(1, mapper.valueToTree(response).path("knowledgeReferences").size());
                assertEquals(4, mapper.valueToTree(response).path("knowledgeReferences").get(0).path("id").asInt());
            } finally { server.stop(0); }
        }
    }

    private KnowledgeService defaults() { return load(new KnowledgeService(), "knowledge.json"); }
    private KnowledgeService load(KnowledgeService knowledge, String name) {
        ReflectionTestUtils.setField(knowledge, "knowledgeFilePath", temp.resolve(name).toString());
        knowledge.init(); return knowledge;
    }
    private ChatService chat(KnowledgeService knowledge) {
        SpotService spots = new SpotService(); spots.loadSpots();
        AnalyticsService analytics = new AnalyticsService();
        ReflectionTestUtils.setField(analytics, "interactionsFilePath", temp.resolve("interactions.json").toString());
        ChatService chat = new ChatService(spots, knowledge, analytics, new AiCompletionClient("", "", ""));
        return chat;
    }
}
