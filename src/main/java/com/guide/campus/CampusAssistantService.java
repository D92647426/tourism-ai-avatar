package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.service.AiCompletionClient;
import org.springframework.stereotype.Service;
import javax.servlet.http.HttpSession;
import java.time.Instant;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.Map;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** REQ-055: session-owned campus turns. See docs/superpowers/specs/2026-11-09-campus-assistant-design.md. */
@Service
public class CampusAssistantService {
    private static final String ATTRIBUTE = CampusAssistantService.class.getName();
    private final ObjectMapper mapper = new ObjectMapper();
    private final CampusLocalAnswers local;
    private final CampusRequestValidation validation;
    private final CampusModelOrchestrator model;

    @org.springframework.beans.factory.annotation.Autowired
    public CampusAssistantService(CampusCatalog catalog, AiCompletionClient client, CampusWeatherService weather) {
        this(catalog, client, weather, CampusModelOrchestrator.DEADLINE_MILLIS);
    }

    CampusAssistantService(CampusCatalog catalog, AiCompletionClient client, CampusWeatherService weather, long deadlineMillis) {
        this.local = new CampusLocalAnswers(catalog);
        this.validation = new CampusRequestValidation(catalog);
        this.model = new CampusModelOrchestrator(client, catalog, weather, deadlineMillis);
    }

    public ObjectNode current(HttpSession session) {
        synchronized (session) { return snapshot(state(session)); }
    }

    /** Start a new conversation, making every outstanding old completion ineligible to commit. */
    public ObjectNode start(HttpSession session) {
        synchronized (session) {
            State next = new State();
            session.setAttribute(ATTRIBUTE, next);
            return snapshot(next);
        }
    }

    /** Cancellation is a tombstone, including when it arrives before chat. It never rolls back a committed turn. */
    public ObjectNode cancel(HttpSession session, ObjectNode request) {
        String requestId = validation.identifier(request, "requestId");
        synchronized (session) {
            State state = state(session);
            ownConversation(state, request);
            Attempt attempt = state.attempts.get(requestId);
            if (attempt == null) {
                attempt = new Attempt("");
                state.remember(requestId, attempt);
            }
            if (attempt.result == null && !attempt.canceled) {
                attempt.canceled = true;
                if (state.active == attempt) {
                    state.active = null;
                    state.revision++;
                } else if (state.active == null) state.revision++;
            }
            ObjectNode result = snapshot(state);
            result.put("canceled", attempt.canceled);
            return result;
        }
    }

    public ObjectNode chat(HttpSession session, ObjectNode request) {
        ObjectNode input = validation.chat(request);
        String requestId = input.path("requestId").asText();
        State state;
        Attempt attempt;
        ObjectNode context;
        ArrayNode history;
        synchronized (session) {
            state = state(session);
            ownConversation(state, input);
            Attempt previous = state.attempts.get(requestId);
            if (previous != null) {
                if (previous.canceled) throw conflict("REQUEST_CANCELED");
                if (!previous.fingerprint.equals(input.toString())) throw conflict("REQUEST_ID_REUSED");
                if (previous.result != null) return previous.result.deepCopy();
                throw conflict("REQUEST_IN_PROGRESS");
            }
            if (state.revision != input.path("contextRevision").asLong()) throw conflict("STALE_CONTEXT");
            if (state.active != null) throw conflict("REQUEST_IN_PROGRESS");
            attempt = new Attempt(input.toString());
            state.remember(requestId, attempt);
            state.active = attempt;
            context = state.context.deepCopy();
            history = state.history.deepCopy();
        }
        ObjectNode turn;
        try {
            validation.mergeContext(input, context);
            turn = local.answer(input, context);
            turn = model.answer(turn, context, history, input.path("message").asText(), () -> {
                synchronized (session) {
                    return session.getAttribute(ATTRIBUTE) == state && state.active == attempt && !attempt.canceled;
                }
            });
            JsonNode action = turn.path("sceneAction");
            if (action.path("placeIds").size() == 1) context.put("placeId", action.path("placeIds").path(0).asText());
            if (action.hasNonNull("taskId")) context.put("taskId", action.path("taskId").asText());
        } catch (RuntimeException failure) {
            synchronized (session) {
                if (state.active == attempt) state.active = null;
                attempt.canceled = true;
            }
            throw failure;
        }
        synchronized (session) {
            if (session.getAttribute(ATTRIBUTE) != state || state.active != attempt || attempt.canceled
                    || state.revision != input.path("contextRevision").asLong()) throw conflict("STALE_COMPLETION");
            state.context = context;
            state.revision++;
            turn.put("conversationId", state.id);
            turn.put("turnId", UUID.randomUUID().toString());
            turn.put("contextRevision", state.revision);
            turn.set("context", snapshot(state));
            state.history.addObject().put("role", "user").put("content", input.path("message").asText());
            state.history.addObject().put("role", "assistant").put("content", turn.path("reply").asText());
            while (state.history.size() > 12) state.history.remove(0);
            state.active = null;
            attempt.result = turn.deepCopy();
            return turn.deepCopy();
        }
    }

    private void ownConversation(State state, ObjectNode request) {
        if (!state.id.equals(validation.identifier(request, "conversationId"))) throw conflict("CONVERSATION_CHANGED");
    }

    static ResponseStatusException conflict(String code) {
        return new ResponseStatusException(HttpStatus.CONFLICT, code);
    }

    private State state(HttpSession session) {
        State state = (State) session.getAttribute(ATTRIBUTE);
        if (state == null) { state = new State(); session.setAttribute(ATTRIBUTE, state); }
        return state;
    }

    private ObjectNode snapshot(State state) {
        ObjectNode result = state.context.deepCopy();
        result.put("conversationId", state.id);
        result.put("contextRevision", state.revision);
        result.put("serverTime", Instant.now().toString());
        result.put("timezone", "Asia/Shanghai");
        return result;
    }

    private class State {
        final String id = UUID.randomUUID().toString();
        long revision;
        ObjectNode context = mapper.createObjectNode().putNull("campusId").putNull("placeId");
        ArrayNode history = mapper.createArrayNode();
        Attempt active;
        final Map<String, Attempt> attempts = new LinkedHashMap<>();
        void remember(String id, Attempt attempt) {
            attempts.put(id, attempt);
            while (attempts.size() > 32) attempts.remove(attempts.keySet().iterator().next());
        }
    }

    private static class Attempt {
        final String fingerprint;
        boolean canceled;
        ObjectNode result;
        Attempt(String fingerprint) { this.fingerprint = fingerprint; }
    }
}
