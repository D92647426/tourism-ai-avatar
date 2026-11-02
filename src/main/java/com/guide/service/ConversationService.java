package com.guide.service;

import com.guide.model.ChatRequest;
import com.guide.model.ChatResponse;
import com.guide.model.Spot;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpSession;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * REQ-039: keep one bounded conversation per HTTP Session and authenticated identity.
 * Inputs, responses and error statuses: docs/conversation_context.md#L9.
 * Change limits here and recheck TEST-039: docs/conversation_context.md#L21.
 */
@Service
public class ConversationService {
    private static final String ATTRIBUTE = ConversationService.class.getName() + ".active";
    private static final long IDLE_MILLIS = 20 * 60 * 1000L;
    private static final int MAX_TURNS = 12;
    private final ChatService chatService;
    private final SpotService spotService;
    private final Clock clock;

    @Autowired
    public ConversationService(ChatService chatService, SpotService spotService) {
        this(chatService, spotService, Clock.systemUTC());
    }

    ConversationService(ChatService chatService, SpotService spotService, Clock clock) {
        this.chatService = chatService;
        this.spotService = spotService;
        this.clock = clock;
    }

    /**
     * REQ-039: replace the conversation for this HTTP Session.
     * Input: current session. Output: new ID and empty spot. No normal API error;
     * Spring Security rejects missing CSRF before this method. See API-039 in docs/api_reference.md.
     */
    public Snapshot start(HttpSession session) {
        synchronized (session) {
            State state = new State(owner(), clock.millis());
            session.setAttribute(ATTRIBUTE, state);
            return state.snapshot();
        }
    }

    /** REQ-040: read this session's unexpired ID/spot without history or side effects.
     * Input: HTTP Session. Output: current snapshot or null fields; no normal API errors.
     * See API-040 in docs/api_reference.md; change identity/expiry policy alongside chat(). */
    public Snapshot current(HttpSession session) {
        synchronized (session) {
            State state = (State) session.getAttribute(ATTRIBUTE);
            return state != null && state.owner.equals(owner()) && clock.millis() - state.lastActive <= IDLE_MILLIS
                    ? state.snapshot() : new Snapshot(null, null);
        }
    }

    /**
     * REQ-039: validate request/session/spot and append only a successful model or fallback reply.
     * Input: session and message with optional ID/spot. Output: reply with bound ID/spot.
     * Errors: 400 malformed message/spot, 403 foreign or replaced ID, 410 idle expiry,
     * 502 empty guide reply. See API-039 in docs/api_reference.md and TEST-039 in docs/test_reference.md.
     */
    public ChatResponse chat(HttpSession session, ChatRequest request) {
        if (request == null || request.getMessage() == null || request.getMessage().trim().isEmpty()
                || request.getMessage().length() > 600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message must contain 1-600 characters");
        }
        Spot selected = null;
        if (request.getSpotId() != null) {
            selected = spotService.getSpotById(request.getSpotId()).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown spotId"));
        }
        synchronized (session) {
            long now = clock.millis();
            String owner = owner();
            State stored = (State) session.getAttribute(ATTRIBUTE);
            if (stored != null && !stored.owner.equals(owner)) stored = null;
            if (stored != null && request.getConversationId() != null
                    && !stored.id.equals(request.getConversationId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "conversation does not belong to this session");
            }
            if (stored == null && request.getConversationId() != null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "conversation does not belong to this session");
            }
            if (stored != null && now - stored.lastActive > IDLE_MILLIS) {
                if (request.getConversationId() != null) {
                    throw new ResponseStatusException(HttpStatus.GONE, "conversation expired; start a new one");
                }
                stored = null;
            }
            State candidate = stored == null ? new State(owner, now) : new State(stored);
            if (selected != null && !Integer.valueOf(selected.getId()).equals(candidate.spotId)) {
                candidate.turns.clear(); // A new place must never inherit the old place's pronouns.
                candidate.spotId = selected.getId();
            } else if (selected == null) {
                for (Spot spot : spotService.getAllSpots()) {
                    if (request.getMessage().contains(spot.getName())
                            && !Integer.valueOf(spot.getId()).equals(candidate.spotId)) {
                        candidate.turns.clear();
                        candidate.spotId = spot.getId();
                        break;
                    }
                }
            }
            Spot context = candidate.spotId == null ? null : spotService.getSpotById(candidate.spotId).orElse(null);
            ChatResponse response = chatService.chat(request.getMessage(), request.getInterest(),
                    new ArrayList<>(candidate.turns), context);
            if (response == null || response.getReply() == null || response.getReply().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "empty guide response");
            }
            candidate.turns.add(new ChatService.Turn("user", request.getMessage()));
            String reply = response.getReply();
            candidate.turns.add(new ChatService.Turn("assistant", reply.substring(0, Math.min(1000, reply.length()))));
            while (candidate.turns.size() > MAX_TURNS) candidate.turns.subList(0, 2).clear();
            candidate.lastActive = now;
            session.setAttribute(ATTRIBUTE, candidate);
            response.setConversationId(candidate.id);
            response.setSpotId(candidate.spotId);
            return response;
        }
    }

    private String owner() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())
                ? "user:" + auth.getName() : "guest";
    }

    private static class State {
        final String id;
        final String owner;
        final List<ChatService.Turn> turns;
        Integer spotId;
        long lastActive;
        State(String owner, long time) {
            this.id = UUID.randomUUID().toString(); this.owner = owner;
            this.turns = new ArrayList<>(); this.lastActive = time;
        }
        State(State other) {
            this.id = other.id; this.owner = other.owner;
            this.turns = new ArrayList<>(other.turns); this.spotId = other.spotId;
            this.lastActive = other.lastActive;
        }
        Snapshot snapshot() { return new Snapshot(id, spotId); }
    }

    public static class Snapshot {
        private final String conversationId;
        private final Integer spotId;
        Snapshot(String conversationId, Integer spotId) {
            this.conversationId = conversationId; this.spotId = spotId;
        }
        public String getConversationId() { return conversationId; }
        public Integer getSpotId() { return spotId; }
    }
}
