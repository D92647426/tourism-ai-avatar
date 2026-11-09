package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Arrays;

/** REQ-055/056: finite client context boundary. Client location is declared, never proof of arrival. */
final class CampusRequestValidation {
    private final CampusCatalog catalog;
    private final ObjectMapper mapper = new ObjectMapper();
    CampusRequestValidation(CampusCatalog catalog) { this.catalog = catalog; }

    String identifier(ObjectNode input, String field) {
        if (input == null || !input.path(field).isTextual()
                || !input.path(field).asText().matches("[A-Za-z0-9_-]{1,100}")) throw invalid(field);
        return input.path(field).asText();
    }

    ObjectNode chat(ObjectNode input) {
        if (input == null || input.toString().length() > 16000) throw invalid("request");
        ObjectNode safe = mapper.createObjectNode();
        safe.put("requestId", identifier(input, "requestId"));
        safe.put("conversationId", identifier(input, "conversationId"));
        JsonNode revision = input.path("contextRevision");
        if (!revision.isIntegralNumber() || !revision.canConvertToLong() || revision.asLong() < 0) throw invalid("contextRevision");
        safe.set("contextRevision", revision);
        JsonNode message = input.path("message");
        if (!message.isTextual() || message.asText().trim().isEmpty() || message.asText().length() > 2000) throw invalid("message");
        safe.put("message", message.asText().trim());
        for (String field : Arrays.asList("campusId", "placeId", "audience", "origin")) {
            if (!input.hasNonNull(field)) continue;
            if (!input.path(field).isTextual()) throw invalid(field);
            safe.set(field, input.path(field));
        }
        if (safe.has("campusId") && catalog.campus(safe.path("campusId").asText()) == null) throw invalid("campusId");
        if (safe.has("placeId") && catalog.place(safe.path("placeId").asText()) == null) throw invalid("placeId");
        if (safe.has("placeId") && safe.has("campusId") && !catalog.place(safe.path("placeId").asText())
                .path("campusId").equals(safe.path("campusId"))) throw invalid("placeId/campusId");
        if (safe.has("audience") && !Arrays.asList("student", "staff", "visitor", "alumni").contains(safe.path("audience").asText())) throw invalid("audience");
        if (safe.has("origin") && !Arrays.asList("user", "choice", "proactive_accept").contains(safe.path("origin").asText())) throw invalid("origin");
        if (input.hasNonNull("context")) {
            if (!input.path("context").isObject() || input.path("context").toString().length() > 4000) throw invalid("context");
            safe.set("context", boundedContext((ObjectNode) input.path("context")));
        }
        return safe;
    }

    void mergeContext(ObjectNode request, ObjectNode context) {
        if (request.hasNonNull("campusId") && !request.path("campusId").equals(context.path("campusId"))) {
            context.putNull("placeId");
            context.remove("routePending");
        }
        for (String field : Arrays.asList("campusId", "placeId", "audience")) {
            if (request.hasNonNull(field)) context.set(field, request.path(field));
        }
        if (context.hasNonNull("placeId") && context.hasNonNull("campusId")
                && !catalog.place(context.path("placeId").asText()).path("campusId").equals(context.path("campusId"))) {
            throw invalid("placeId/campusId");
        }
        JsonNode supplied = request.path("context");
        for (String field : Arrays.asList("position", "simulated", "hour", "weather", "time")) {
            if (supplied.has(field)) context.set(field, supplied.path(field).deepCopy());
        }
    }

    private ObjectNode boundedContext(ObjectNode input) {
        ObjectNode safe = mapper.createObjectNode();
        if (input.has("simulated")) {
            if (!input.path("simulated").isBoolean()) throw invalid("simulated");
            safe.set("simulated", input.path("simulated"));
        }
        if (input.has("hour")) {
            if (!input.path("hour").isIntegralNumber() || input.path("hour").asInt() < 0 || input.path("hour").asInt() > 23) throw invalid("hour");
            safe.set("hour", input.path("hour"));
        }
        if (input.has("time")) {
            if (!input.path("time").isTextual() || input.path("time").asText().length() > 40) throw invalid("time");
            safe.set("time", input.path("time"));
        }
        if (input.hasNonNull("position")) safe.set("position", position(input.path("position"), safe.path("simulated").asBoolean()));
        if (safe.path("simulated").asBoolean() && input.path("weather").isObject()) {
            ObjectNode weather = mapper.createObjectNode().put("status", "simulated").put("label", "模拟天气");
            if (input.path("weather").path("temperatureC").isNumber()) weather.set("temperatureC", input.path("weather").path("temperatureC"));
            if (input.path("weather").path("weatherCode").isIntegralNumber()) weather.set("weatherCode", input.path("weather").path("weatherCode"));
            safe.set("weather", weather);
        }
        return safe;
    }

    private ObjectNode position(JsonNode value, boolean simulated) {
        if (!value.isObject()) throw invalid("position");
        String source = value.path("source").asText();
        if (!Arrays.asList("gps", "geolocation", "confirmed", "simulated", "demo").contains(source)) throw invalid("position.source");
        if (("simulated".equals(source) || "demo".equals(source)) && !simulated) throw invalid("position.source");
        JsonNode timestamp = value.path("timestamp");
        if (!timestamp.isIntegralNumber() || !timestamp.canConvertToLong() || timestamp.asLong() <= 0) throw invalid("position.timestamp");
        ObjectNode result = mapper.createObjectNode().put("source", source);
        result.set("timestamp", timestamp);
        if (value.hasNonNull("placeId")) {
            if (catalog.place(value.path("placeId").asText()) == null) throw invalid("position.placeId");
            result.set("placeId", value.path("placeId"));
        }
        if (value.hasNonNull("latitude") || value.hasNonNull("longitude")) {
            for (String axis : Arrays.asList("latitude", "longitude")) {
                JsonNode number = value.path(axis);
                if (!number.isNumber() || !Double.isFinite(number.asDouble())
                        || Math.abs(number.asDouble()) > (axis.equals("latitude") ? 90 : 180)) throw invalid("position." + axis);
                result.set(axis, number);
            }
            if (!value.path("accuracy").isNumber() || !Double.isFinite(value.path("accuracy").asDouble())
                    || value.path("accuracy").asDouble() < 0) throw invalid("position.accuracy");
            result.set("accuracy", value.path("accuracy"));
        }
        if (!result.has("placeId") && !result.has("latitude")) throw invalid("position");
        return result;
    }

    static ResponseStatusException invalid(String field) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_" + field);
    }
}
