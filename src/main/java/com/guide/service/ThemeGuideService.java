package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.NarrationMode;
import com.guide.model.Spot;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

/**
 * REQ-052. Load bundled observation methods and bind the directory to current spot names.
 * Inputs are trusted theme-guide.json and the current SpotService directory. Invalid packaged
 * fields fail loading. Invalid request context raises HTTP400 before a conversation is published.
 * Change methods in theme-guide.json and API policy with docs/api_reference.md (API-052).
 */
@Service
public class ThemeGuideService {
    private final SpotService spotService;
    private final JsonNode template;

    @Autowired
    public ThemeGuideService(SpotService spotService) {
        this(spotService, openResource());
    }

    ThemeGuideService(SpotService spotService, InputStream resource) {
        this.spotService = spotService;
        try (InputStream input = resource) {
            template = new ObjectMapper().readTree(input);
            for (String field : new String[]{"id", "title", "question", "notice"}) required(template, field);
            JsonNode stops = template.path("stops");
            if (!stops.isArray() || stops.size() != 3) throw new IllegalArgumentException("three theme stops required");
            for (JsonNode stop : stops) {
                for (String field : new String[]{"name", "focus", "question", "method", "briefMethod", "bridge", "recap"}) required(stop, field);
            }
        } catch (IOException | IllegalArgumentException invalid) {
            throw new IllegalStateException("Invalid bundled theme-guide.json", invalid);
        }
    }

    private static InputStream openResource() {
        try {
            return new ClassPathResource("theme-guide.json").getInputStream();
        } catch (IOException missing) {
            throw new IllegalStateException("Missing bundled theme-guide.json", missing);
        }
    }

    private static String required(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isTextual() || value.asText().trim().isEmpty()) {
            throw new IllegalArgumentException("Missing theme field " + field);
        }
        return value.asText();
    }

    /** REQ-052. Return a current immutable directory, empty when any required named spot is missing. */
    public List<Theme> list() {
        List<Stop> stops = new ArrayList<>();
        Set<Integer> ids = new HashSet<>();
        List<Spot> currentSpots = spotService.getAllSpots();
        for (JsonNode definition : template.path("stops")) {
            Spot match = null;
            for (Spot spot : currentSpots) {
                if (definition.path("name").asText().equals(spot.getName())) {
                    match = spot;
                    break;
                }
            }
            if (match == null || match.getId() <= 0 || !ids.add(match.getId())) return Collections.emptyList();
            stops.add(new Stop(match.getId(), definition));
        }
        return Collections.singletonList(new Theme(template, stops));
    }

    /**
     * REQ-052. Validate one request's theme against its resolved current spot.
     * Null/empty IDs mean ordinary chat. Unknown IDs or explicit lectures outside the theme
     * raise HTTP400. A free question outside a valid theme returns null context.
     */
    public Context resolve(String themeId, Spot currentSpot, boolean lecture) {
        if (themeId == null || themeId.isEmpty()) {
            if (lecture) throw badRequest("themeLecture requires a themeId");
            return null;
        }
        List<Theme> themes = list();
        if (themes.isEmpty() || !themes.get(0).getId().equals(themeId)) throw badRequest("unknown themeId");
        Theme theme = themes.get(0);
        if (currentSpot != null) {
            for (Stop stop : theme.getStops()) {
                if (stop.getSpotId() == currentSpot.getId()) return new Context(theme, stop, currentSpot.getBrief());
            }
        }
        if (lecture) throw badRequest("themeLecture requires a current spot in this theme");
        return null;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    /** REQ-052. Preserve the complete current brief and qualifiers while adapting method length. */
    public String lecture(Context context, NarrationMode mode) {
        String observation = mode == NarrationMode.BRIEF ? context.stop.briefMethod : context.stop.method;
        String reply = "【" + context.stop.name + "】主题观察 · " + context.stop.focus
                + "\n\n当前简介（未核验的静态课程示例）\n" + context.brief
                + "\n\n观察方法\n" + observation;
        if (mode == NarrationMode.FAMILY) reply += "\n\n可以和孩子一起看看，自愿说一说\n" + context.stop.question;
        return reply + "\n\n承接\n" + context.stop.bridge + "\n\n" + context.theme.notice;
    }

    /** Public API-052 theme directory value. Methods remain private to validated server context. */
    public static final class Theme {
        private final String id;
        private final String title;
        private final String question;
        private final String notice;
        private final List<Stop> stops;
        private Theme(JsonNode definition, List<Stop> stops) {
            id = definition.path("id").asText();
            title = definition.path("title").asText();
            question = definition.path("question").asText();
            notice = definition.path("notice").asText();
            this.stops = Collections.unmodifiableList(new ArrayList<>(stops));
        }
        public String getId() { return id; }
        public String getTitle() { return title; }
        public String getQuestion() { return question; }
        public String getNotice() { return notice; }
        public List<Stop> getStops() { return stops; }
    }

    public static final class Stop {
        private final int spotId;
        private final String name;
        private final String focus;
        private final String question;
        private final String method;
        private final String briefMethod;
        private final String bridge;
        private final String recap;
        private Stop(int spotId, JsonNode definition) {
            this.spotId = spotId;
            name = definition.path("name").asText();
            focus = definition.path("focus").asText();
            question = definition.path("question").asText();
            method = definition.path("method").asText();
            briefMethod = definition.path("briefMethod").asText();
            bridge = definition.path("bridge").asText();
            recap = definition.path("recap").asText();
        }
        public int getSpotId() { return spotId; }
        public String getName() { return name; }
        public String getFocus() { return focus; }
        public String getQuestion() { return question; }
        public String getBridge() { return bridge; }
        public String getRecap() { return recap; }
    }

    /** Validated per-request value. It is never saved to the conversation state or snapshot. */
    public static final class Context {
        private final Theme theme;
        private final Stop stop;
        private final String brief;
        private Context(Theme theme, Stop stop, String brief) {
            this.theme = theme;
            this.stop = stop;
            this.brief = brief == null || brief.trim().isEmpty() ? "当前简介暂未收录。" : brief;
        }
        public String getThemeId() { return theme.id; }

        /** Keep theme advice separate from unverified current facts in the actual model prompt. */
        public String systemContext(boolean lecture) {
            return "\n\n【本次主题】" + theme.title + "\n主题问题\n" + theme.question
                    + "\n本站观察焦点\n" + stop.focus + "\n观察建议\n" + stop.method
                    + "\n本站观察问题\n" + stop.question + "\n承接\n" + stop.bridge
                    + "\n当前景点简介（未核验的静态课程示例）\n" + brief + "\n" + theme.notice
                    + "\n观察建议仅作方法提示，不得据此补写景区事实或历史寓意。"
                    + (lecture ? "\n本次明确请求本站主题讲解。保留当前简介的限定条件，结合观察方法与承接作答。"
                    : "\n本次为主题内自由问题，先回答原问题，可结合观察建议，保持资料边界。");
        }
    }
}
