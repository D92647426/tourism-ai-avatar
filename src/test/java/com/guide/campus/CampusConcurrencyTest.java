package com.guide.campus;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.service.AiCompletionClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class CampusConcurrencyTest {
    @Test void cancelRevokesBlockedCompletionAndDoesNotWriteHistoryOrContext() throws Exception {
        try (BlockedProvider provider = new BlockedProvider()) {
            CampusAssistantService service = provider.service(5000);
            MockHttpSession session = new MockHttpSession();
            ObjectNode request = request(service, session, "blocked");
            Future<ObjectNode> pending = provider.submit(() -> service.chat(session, request));
            assertTrue(provider.entered.await(3, TimeUnit.SECONDS));
            assertThrows(ResponseStatusException.class, () -> service.chat(session, request));
            ObjectNode canceled = service.cancel(session, request);
            assertTrue(canceled.path("canceled").asBoolean());
            provider.release.countDown();
            assertInstanceOf(ResponseStatusException.class, assertThrows(ExecutionException.class,
                    () -> pending.get(3, TimeUnit.SECONDS)).getCause());
            assertTrue(service.current(session).path("campusId").isNull());
            assertEquals(1, service.current(session).path("contextRevision").asInt());
            assertEquals(1, provider.requests.get());
            assertThrows(ResponseStatusException.class, () -> service.chat(session, request));
        }
    }

    @Test void newConversationAllowsNewTurnWhileOldNetworkCallIsBlocked() throws Exception {
        try (BlockedProvider provider = new BlockedProvider()) {
            CampusAssistantService service = provider.service(5000);
            MockHttpSession session = new MockHttpSession();
            Future<ObjectNode> pending = provider.submit(() -> service.chat(session, request(service, session, "old")));
            assertTrue(provider.entered.await(3, TimeUnit.SECONDS));
            ObjectNode reset = service.start(session);
            ObjectNode next = reset.deepCopy().put("requestId", "new").put("message", "我想补卡");
            ObjectNode turn = service.chat(session, next);
            assertEquals(reset.path("conversationId"), turn.path("conversationId"));
            provider.release.countDown();
            assertInstanceOf(ResponseStatusException.class, assertThrows(ExecutionException.class,
                    () -> pending.get(3, TimeUnit.SECONDS)).getCause());
            assertEquals(turn.path("contextRevision"), service.current(session).path("contextRevision"));
        }
    }

    @Test void cancelingDifferentRequestDoesNotInvalidateActiveRequest() throws Exception {
        try (BlockedProvider provider = new BlockedProvider()) {
            CampusAssistantService service = provider.service(5000);
            MockHttpSession session = new MockHttpSession();
            ObjectNode input = request(service, session, "active");
            Future<ObjectNode> pending = provider.submit(() -> service.chat(session, input));
            assertTrue(provider.entered.await(3, TimeUnit.SECONDS));
            service.cancel(session, input.deepCopy().put("requestId", "different"));
            provider.release.countDown();
            assertEquals("local-fallback", pending.get(3, TimeUnit.SECONDS).path("mode").asText());
            assertEquals(1, service.current(session).path("contextRevision").asInt());
        }
    }

    @Test void totalDeadlineFallsBackBeforeProviderReturns() throws Exception {
        try (BlockedProvider provider = new BlockedProvider()) {
            CampusAssistantService service = provider.service(150);
            MockHttpSession session = new MockHttpSession();
            long start = System.nanoTime();
            ObjectNode result = service.chat(session, request(service, session, "timeout"));
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 2500);
            assertEquals("local-fallback", result.path("mode").asText());
            assertTrue(result.path("reply").asText().contains("1—3"));
            assertEquals(1, service.current(session).path("contextRevision").asInt());
        }
    }

    private static ObjectNode request(CampusAssistantService service, MockHttpSession session, String id) {
        return service.current(session).put("requestId", id).put("message", "我在平乐园，校园卡丢了");
    }

    private static class BlockedProvider implements AutoCloseable {
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        final AtomicInteger requests = new AtomicInteger();
        final ExecutorService executor = Executors.newSingleThreadExecutor();
        final HttpServer server;
        BlockedProvider() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/chat/completions", exchange -> {
                requests.incrementAndGet();
                entered.countDown();
                try { release.await(5, TimeUnit.SECONDS); } catch (InterruptedException failure) { Thread.currentThread().interrupt(); }
                byte[] bytes = "{\"choices\":[{\"message\":{\"content\":\"not trusted without tools\"}}]}".getBytes(StandardCharsets.UTF_8);
                try {
                    exchange.sendResponseHeaders(200, bytes.length);
                    exchange.getResponseBody().write(bytes);
                } finally { exchange.close(); }
            });
            server.start();
        }
        CampusAssistantService service(long deadline) {
            return new CampusAssistantService(new CampusCatalog(), new AiCompletionClient("test-only",
                    "http://127.0.0.1:" + server.getAddress().getPort(), "test"), new CampusWeatherService(), deadline);
        }
        Future<ObjectNode> submit(Callable<ObjectNode> task) { return executor.submit(task); }
        public void close() {
            release.countDown();
            executor.shutdownNow();
            server.stop(0);
        }
    }
}
