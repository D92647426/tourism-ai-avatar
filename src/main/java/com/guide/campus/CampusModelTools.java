package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** REQ-055: read-only allowlisted tools. No arbitrary URLs, coordinates, filesystem or generated facts. */
final class CampusModelTools {
    private final CampusCatalog catalog;
    private final CampusWeatherService weather;
    private final ObjectMapper mapper = new ObjectMapper();
    CampusModelTools(CampusCatalog catalog, CampusWeatherService weather) {
        this.catalog = catalog;
        this.weather = weather;
    }

    ArrayNode definitions() {
        ArrayNode tools = mapper.createArrayNode();
        definition(tools, "find_places", "查询核验校园地点名称与别名", "query");
        definition(tools, "find_tasks", "查询办事事项，按本次校区及人群筛选", "query");
        definition(tools, "get_place", "获取核验地点详情；不能当作用户已到达", "placeId");
        definition(tools, "get_weather", "读取当前声明位置或北京市区参考天气");
        definition(tools, "preview_route", "地址示意预览；不生成未核验坐标、距离或逐步路线", "destinationId");
        definition(tools, "get_dining_candidates", "只返回校内目录；无实时价格、营业时段或评分");
        return tools;
    }

    private void definition(ArrayNode tools, String name, String description, String... fields) {
        ObjectNode function = tools.addObject().put("type", "function").putObject("function");
        function.put("name", name).put("description", description);
        ObjectNode parameters = function.putObject("parameters").put("type", "object").put("additionalProperties", false);
        ObjectNode properties = parameters.putObject("properties");
        ArrayNode required = parameters.putArray("required");
        for (String field : fields) {
            properties.putObject(field).put("type", "string");
            required.add(field);
        }
    }

    JsonNode execute(String name, JsonNode args, ObjectNode context) {
        if (!args.isObject() || args.toString().length() > 2000) throw new IllegalArgumentException("Invalid tool arguments");
        String campus = context.path("campusId").asText("");
        switch (name) {
            case "find_places":
                return mapper.valueToTree(catalog.searchPlaces(text(args, "query"), campus));
            case "get_place":
                return place(text(args, "placeId"), campus);
            case "find_tasks":
                return tasks(text(args, "query"), campus, context.path("audience").asText("student"));
            case "get_dining_candidates":
                ArrayNode candidates = mapper.createArrayNode();
                for (ObjectNode place : catalog.searchPlaces("", campus)) {
                    if ("dining".equals(place.path("category").asText())) candidates.add(place);
                }
                return candidates;
            case "preview_route":
                ObjectNode route = mapper.createObjectNode();
                route.set("destination", place(text(args, "destinationId"), campus));
                String origin = context.path("position").path("placeId").asText("");
                if (catalog.place(origin) != null) route.set("origin", catalog.place(origin));
                route.put("status", origin.isEmpty() ? "origin-required" : "address-preview");
                route.put("notice", "当前提供地址预览。建筑入口坐标、距离、耗时与逐步路线待核验。物理位置由设备采样或用户确认。");
                return route;
            case "get_weather":
                if (context.path("simulated").asBoolean() && context.path("weather").isObject()) return context.path("weather").deepCopy();
                JsonNode position = context.path("position");
                return weather.current(position.has("latitude") ? position.path("latitude").asDouble() : null,
                        position.has("longitude") ? position.path("longitude").asDouble() : null);
            default: throw new IllegalArgumentException("Unknown tool");
        }
    }

    private JsonNode place(String id, String campus) {
        ObjectNode place = catalog.place(id);
        if (place == null || (!campus.isEmpty() && !campus.equals(place.path("campusId").asText()))) {
            throw new IllegalArgumentException("Unknown or out-of-campus place");
        }
        return place;
    }

    private ArrayNode tasks(String query, String campus, String audience) {
        ArrayNode result = mapper.createArrayNode();
        for (JsonNode task : catalog.snapshot().path("tasks")) {
            boolean matches = query.isEmpty() || task.path("name").asText().contains(query) || query.contains(task.path("name").asText());
            for (JsonNode alias : task.path("aliases")) {
                if (query.contains(alias.asText()) || alias.asText().contains(query)) matches = true;
            }
            if (!matches) continue;
            ObjectNode selected = task.deepCopy();
            ArrayNode variants = selected.putArray("variants");
            for (JsonNode variant : task.path("variants")) {
                if (!campus.isEmpty() && !campus.equals(variant.path("campusId").asText())) continue;
                for (JsonNode item : variant.path("audiences")) {
                    if (audience.equals(item.asText())) { variants.add(variant); break; }
                }
            }
            if (!variants.isEmpty()) result.add(selected);
        }
        return result;
    }

    private String text(JsonNode args, String field) {
        if (!args.path(field).isTextual() || args.path(field).asText().length() > 200) throw new IllegalArgumentException("Invalid tool field");
        return args.path(field).asText();
    }
}
