package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Campus demo Task 1. Loads the verified facts described in docs/bjut_campus_research.md.
 * Query results are detached copies, so callers cannot change shared catalog data.
 */
@Component
public class CampusCatalog {
    private final ObjectNode catalog;
    private final Map<String, ObjectNode> campuses = new LinkedHashMap<>();
    private final Map<String, ObjectNode> places = new LinkedHashMap<>();
    private final Map<String, ObjectNode> tasks = new LinkedHashMap<>();

    /** Loads the bundled catalog. Missing or unreadable resources fail startup. */
    public CampusCatalog() {
        this(CampusCatalog.class.getResourceAsStream("/campus/catalog.json"));
    }

    CampusCatalog(InputStream input) {
        if (input == null) {
            throw new IllegalStateException("Campus catalog resource is missing");
        }
        try (InputStream resource = input) {
            JsonNode root = new ObjectMapper().readTree(resource);
            if (!(root instanceof ObjectNode)) {
                throw new IllegalArgumentException("Campus catalog must be an object");
            }
            catalog = (ObjectNode) root;
            validateAndIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot read campus catalog", exception);
        }
    }

    /** Returns a detached snapshot of the complete campus facts. */
    public ObjectNode snapshot() {
        return catalog.deepCopy();
    }

    /** Returns a detached campus record, or null for an unknown ID. */
    public ObjectNode campus(String id) {
        ObjectNode campus = campuses.get(id);
        return campus == null ? null : campus.deepCopy();
    }

    /** Returns a detached place record, or null for an unknown ID. */
    public ObjectNode place(String id) {
        ObjectNode place = places.get(id);
        return place == null ? null : place.deepCopy();
    }

    /** Returns a detached service task with campus and audience variants, or null. */
    public ObjectNode task(String id) {
        ObjectNode task = tasks.get(id);
        return task == null ? null : task.deepCopy();
    }

    /** Rejects malformed facts before any query can observe a partially loaded directory. */
    private void validateAndIndex() {
        requireText(catalog, "version");
        Set<String> ids = new HashSet<>();
        index("campuses", campuses, ids);
        index("places", places, ids);
        index("tasks", tasks, ids);
        Map<String, ObjectNode> assets = new LinkedHashMap<>();
        index("assets", assets, ids);

        for (ObjectNode campus : campuses.values()) {
            requireTexts(campus, "name", "address", "verifiedAt");
            requireTextArray(campus, "aliases");
            validateSourceUrl(campus);
        }
        for (ObjectNode place : places.values()) {
            requireTexts(place, "name", "category", "summary", "address", "verifiedAt", "coordinateStatus");
            requireTextArray(place, "aliases");
            requireTextArray(place, "assetIds");
            requireReference(place, "campusId", campuses, "campus");
            validateSourceUrl(place);
            JsonNode coordinates = place.get("coordinates");
            String status = place.path("coordinateStatus").asText();
            if (coordinates == null || ("unverified".equals(status) && !coordinates.isNull())
                    || ("verified".equals(status) && !coordinates.isObject())
                    || !("unverified".equals(status) || "verified".equals(status))) {
                throw new IllegalArgumentException("Invalid coordinates or coordinateStatus for " + place.path("id").asText());
            }
        }
        for (ObjectNode task : tasks.values()) {
            requireText(task, "name");
            requireTextArray(task, "aliases");
            ArrayNode variants = requireArray(task, "variants");
            if (variants.isEmpty()) {
                throw new IllegalArgumentException("Task variants must not be empty");
            }
            for (JsonNode node : variants) {
                ObjectNode variant = requireObject(node, "variant");
                registerId(variant, ids);
                requireReference(variant, "campusId", campuses, "campus");
                requireTextArray(variant, "unknownFields");
                if (requireTextArray(variant, "audiences").isEmpty()
                        || requireTextArray(variant, "steps").isEmpty()) {
                    throw new IllegalArgumentException("Variant audiences and steps must not be empty");
                }
                validateSourceUrl(variant);
                JsonNode placeId = variant.get("placeId");
                if (placeId == null) {
                    throw new IllegalArgumentException("Variant placeId must be present, with null for unknown locations");
                }
                if (!placeId.isNull()) {
                    ObjectNode place = requireReference(variant, "placeId", places, "place");
                    if (!place.path("campusId").equals(variant.path("campusId"))) {
                        throw new IllegalArgumentException("Cross-campus task destination for " + variant.path("id").asText());
                    }
                }
            }
        }
        validateAssets(assets);
    }

    private void validateAssets(Map<String, ObjectNode> assets) {
        for (ObjectNode asset : assets.values()) {
            requireTexts(asset, "alt", "license");
            validateSourceUrl(asset);
            String path = requireText(asset, "path");
            if (!path.startsWith("/media/campus/") || path.contains("..") || path.contains("\\")
                    || path.contains("?") || path.contains("#")) {
                throw new IllegalArgumentException("Invalid local asset path for " + asset.path("id").asText());
            }
            JsonNode placeId = asset.get("placeId");
            if (placeId == null) {
                throw new IllegalArgumentException("Asset placeId must be present, with null for independent characters");
            }
            if (!placeId.isNull()) {
                ObjectNode place = requireReference(asset, "placeId", places, "place");
                if (!containsText(place.path("assetIds"), asset.path("id").asText())) {
                    throw new IllegalArgumentException("Asset association missing from place " + placeId.asText());
                }
            }
        }
        for (ObjectNode place : places.values()) {
            Set<String> linkedIds = new HashSet<>();
            for (JsonNode assetId : place.path("assetIds")) {
                ObjectNode asset = assets.get(assetId.asText());
                if (asset == null) {
                    throw new IllegalArgumentException("Unknown asset: " + assetId.asText());
                }
                if (!asset.path("placeId").equals(place.path("id")) || !linkedIds.add(assetId.asText())) {
                    throw new IllegalArgumentException("Asset association does not match place " + place.path("id").asText());
                }
            }
        }
    }

    private boolean containsText(JsonNode array, String text) {
        for (JsonNode item : array) {
            if (text.equals(item.asText())) {
                return true;
            }
        }
        return false;
    }

    private void index(String name, Map<String, ObjectNode> target, Set<String> ids) {
        for (JsonNode node : requireArray(catalog, name)) {
            ObjectNode record = requireObject(node, name);
            target.put(registerId(record, ids), record);
        }
    }

    private String registerId(ObjectNode record, Set<String> ids) {
        String id = requireText(record, "id");
        if (!ids.add(id)) {
            throw new IllegalArgumentException("Duplicate id: " + id);
        }
        return id;
    }

    private ObjectNode requireObject(JsonNode node, String field) {
        if (!(node instanceof ObjectNode)) {
            throw new IllegalArgumentException(field + " must contain objects");
        }
        return (ObjectNode) node;
    }

    private ArrayNode requireArray(ObjectNode record, String field) {
        JsonNode value = record.get(field);
        if (!(value instanceof ArrayNode)) {
            throw new IllegalArgumentException(field + " must be an array");
        }
        return (ArrayNode) value;
    }

    private ArrayNode requireTextArray(ObjectNode record, String field) {
        ArrayNode array = requireArray(record, field);
        for (JsonNode item : array) {
            if (!item.isTextual() || item.asText().trim().isEmpty()) {
                throw new IllegalArgumentException(field + " must contain nonblank strings");
            }
        }
        return array;
    }

    private void requireTexts(ObjectNode record, String... fields) {
        for (String field : fields) {
            requireText(record, field);
        }
    }

    private String requireText(ObjectNode record, String field) {
        JsonNode value = record.get(field);
        if (value == null || !value.isTextual() || value.asText().trim().isEmpty()) {
            throw new IllegalArgumentException(field + " must be a nonblank string");
        }
        return value.asText();
    }

    private ObjectNode requireReference(ObjectNode record, String field,
                                        Map<String, ObjectNode> target, String type) {
        String id = requireText(record, field);
        ObjectNode referenced = target.get(id);
        if (referenced == null) {
            throw new IllegalArgumentException("Unknown " + type + ": " + id);
        }
        return referenced;
    }

    private void validateSourceUrl(ObjectNode record) {
        validateHttpUrl(requireText(record, "sourceUrl"), "sourceUrl");
        if (!record.has("sourceRefs")) {
            return;
        }
        for (JsonNode node : requireArray(record, "sourceRefs")) {
            ObjectNode reference = requireObject(node, "sourceRefs");
            requireText(reference, "title");
            validateHttpUrl(requireText(reference, "url"), "sourceRefs.url");
        }
    }

    private void validateHttpUrl(String sourceUrl, String field) {
        URI uri;
        try {
            uri = URI.create(sourceUrl);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid " + field + ": " + sourceUrl, exception);
        }
        if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Invalid " + field + ": " + sourceUrl);
        }
    }

    /**
     * Finds names and aliases within the requested campus. Null or blank query lists places,
     * and null or blank campus ID searches all campuses. Unknown campus IDs return no matches.
     */
    public List<ObjectNode> searchPlaces(String query, String campusId) {
        String normalizedQuery = normalize(query);
        String campusFilter = campusId == null ? "" : campusId.trim();
        List<ObjectNode> results = new ArrayList<>();
        for (ObjectNode place : places.values()) {
            if (!campusFilter.isEmpty() && !campusFilter.equals(place.path("campusId").asText())) {
                continue;
            }
            if (normalizedQuery.isEmpty() || matchScore(place, normalizedQuery) > 0) {
                results.add(place.deepCopy());
            }
        }
        results.sort(Comparator.comparingInt((ObjectNode place) -> matchScore(place, normalizedQuery)).reversed());
        return results;
    }

    private int matchScore(ObjectNode place, String query) {
        int score = textMatchScore(place.path("name").asText(), query);
        for (JsonNode alias : place.path("aliases")) {
            score = Math.max(score, textMatchScore(alias.asText(), query));
        }
        return score;
    }

    private int textMatchScore(String candidate, String query) {
        String normalizedCandidate = normalize(candidate);
        if (query.isEmpty() || normalizedCandidate.isEmpty()) {
            return 0;
        }
        if (query.equals(normalizedCandidate)) {
            return query.length() + 1;
        }
        if (query.contains(normalizedCandidate)) {
            return normalizedCandidate.length();
        }
        return normalizedCandidate.contains(query) ? query.length() : 0;
    }

    private String normalize(String text) {
        return text == null ? "" : Normalizer.normalize(text, Normalizer.Form.NFKC)
                .replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}
