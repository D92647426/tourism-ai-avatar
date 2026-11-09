package com.guide.campus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** REQ-054/055: deterministic catalog-backed answers, including offline campus disambiguation. */
final class CampusLocalAnswers {
    private final CampusCatalog catalog;
    private final ObjectMapper mapper = new ObjectMapper();
    CampusLocalAnswers(CampusCatalog catalog) { this.catalog = catalog; }

    ObjectNode answer(ObjectNode request, ObjectNode context) {
        String message = request.path("message").asText();
        for (JsonNode campus : catalog.snapshot().path("campuses")) {
            for (JsonNode alias : campus.path("aliases")) {
                if (message.contains(alias.asText())) {
                    if (!campus.path("id").equals(context.path("campusId"))) context.putNull("placeId");
                    context.put("campusId", campus.path("id").asText());
                }
            }
        }
        if (context.hasNonNull("campusId") && context.has("pendingMessage")) {
            message = context.path("pendingMessage").asText() + "；" + message;
            context.remove("pendingMessage");
        }
        String taskId = matchedTask(message);
        if (!taskId.isEmpty()) {
            if (!taskId.equals(context.path("taskId").asText())) context.putNull("placeId");
            context.put("taskId", taskId);
        }
        if (message.contains("访客") || message.contains("校外")) context.put("audience", "visitor");
        else if (message.contains("校友")) context.put("audience", "alumni");
        else if (message.contains("我是老师") || message.contains("教职工")) context.put("audience", "staff");
        else if (message.contains("我是学生")) context.put("audience", "student");
        ObjectNode turn = base();
        if (context.path("campusId").asText("").isEmpty()) {
            context.put("pendingMessage", message);
            reply(turn, "你在哪个校区？确认校区后，我会继续帮你办理刚才的事项。");
            ArrayNode choices = (ArrayNode) turn.path("choices");
            for (JsonNode campus : catalog.snapshot().path("campuses")) {
                choice(choices, campus.path("name").asText(), "我在" + campus.path("name").asText(), choices.size() < 4 ? "ask" : "followup");
            }
            choice(choices, "自定义", "", "custom");
            return turn;
        }
        ObjectNode mentioned = mentionedPlace(message, context.path("campusId").asText());
        boolean arrival = confirmedArrival(request.path("message").asText(), mentioned);
        if (arrival && mentioned != null) {
            context.putObject("position").put("placeId", mentioned.path("id").asText())
                    .put("timestamp", System.currentTimeMillis()).put("source", "confirmed");
        }
        if ((!taskId.isEmpty() || mentioned != null) && !arrival) context.remove("routePending");
        if (message.contains("实景") || message.contains("照片") || message.contains("外观")) {
            ObjectNode preview = mentioned == null ? catalog.place(context.path("placeId").asText()) : mentioned;
            if (preview != null && preview.path("assetIds").isEmpty() && preview.path("id").asText().startsWith("pingleyuan-library-")) {
                preview = catalog.place("pingleyuan-library");
            }
            if (preview != null) {
                ((ObjectNode) turn.path("sceneAction")).put("type", "SHOW_PLACE").put("title", "地点预览");
                ((ArrayNode) turn.path("sceneAction").path("placeIds")).add(preview.path("id").asText());
                reply(turn, preview.path("assetIds").isEmpty() ? "这个地点尚无核验实景照片，可以先查看地点资料。"
                        : "这里展示" + preview.path("name").asText() + "的外观实景，仅作地点预览，室内分区与入口仍需核实。");
                reference(turn, preview.path("name").asText(), preview.path("sourceUrl").asText());
                finishChoices(turn);
                return turn;
            }
        }
        if (message.contains("健身房")) {
            context.remove("taskId");
            reply(turn, "健身房具体位置和入口尚未核验。体育馆公开介绍可供咨询，但不能把体育馆视为已核验的健身房入口。");
            finishChoices(turn);
            return turn;
        }
        if (message.matches(".*(吃什么|吃饭|午饭|晚饭|早饭|食堂|餐饮).*")) {
            return dining(context, turn);
        }
        if (message.contains("带我过去") || message.contains("怎么走") || message.contains("导航")) {
            context.put("routePending", true);
        }
        if (context.path("routePending").asBoolean()) {
            String target = context.path("placeId").asText("");
            ObjectNode destination = catalog.place(target);
            if (destination != null) {
                if (!context.path("position").hasNonNull("placeId")) {
                    reply(turn, "目的地仍是" + destination.path("name").asText() + "。请告诉我你当前的起点，例如：我在四教。");
                } else {
                    reply(turn, "从" + catalog.place(context.path("position").path("placeId").asText()).path("name").asText()
                            + "前往" + destination.path("name").asText() + "：" + destination.path("address").asText()
                            + "。这是地点与地址预览，坐标尚未核验，暂不提供距离和逐步路线。");
                    ((ObjectNode) turn.path("sceneAction")).put("type", "SHOW_ROUTE");
                    ((ArrayNode) turn.path("sceneAction").path("placeIds")).add(target);
                    context.remove("routePending");
                }
                finishChoices(turn);
                return turn;
            }
        }
        if (mentioned != null && !arrival && taskId.isEmpty()) {
            context.put("placeId", mentioned.path("id").asText());
            context.remove("taskId");
            reply(turn, mentioned.path("summary").asText() + " " + mentioned.path("address").asText());
            ((ObjectNode) turn.path("sceneAction")).put("type", "SHOW_PLACE");
            ((ArrayNode) turn.path("sceneAction").path("placeIds")).add(mentioned.path("id").asText());
            reference(turn, mentioned.path("name").asText(), mentioned.path("sourceUrl").asText());
            if ("library".equals(mentioned.path("category").asText())) {
                reply(turn, turn.path("reply").asText() + " 你想安静学习、小组研讨、找书借还，还是用公共电脑查资料？");
                ArrayNode choices = (ArrayNode) turn.path("choices");
                choice(choices, "安静学习", "想在图书馆安静学习", "ask");
                choice(choices, "小组研讨", "想预约小组研讨", "ask");
                choice(choices, "找书借还", "想找书借还", "ask");
                choice(choices, "公共电脑", "想用公共电脑查资料", "ask");
            }
            finishChoices(turn);
            return turn;
        }
        return serviceTask(context, turn);
    }

    private ObjectNode serviceTask(ObjectNode context, ObjectNode turn) {
        JsonNode task = catalog.task(context.path("taskId").asText());
        if (task != null) {
            reply(turn, "该事项在当前校区或人群下的具体办理规则尚未核实，请先向对应服务部门确认。");
            context.putNull("placeId");
            for (JsonNode variant : task.path("variants")) {
                if (!variant.path("campusId").equals(context.path("campusId"))) continue;
                boolean eligible = false;
                for (JsonNode audience : variant.path("audiences")) {
                    if (audience.asText().equals(context.path("audience").asText("student"))) eligible = true;
                }
                if (!eligible) continue;
                StringBuilder text = new StringBuilder();
                for (JsonNode step : variant.path("steps")) text.append(step.asText()).append("\n");
                reply(turn, text.toString().trim());
                ObjectNode action = (ObjectNode) turn.path("sceneAction");
                action.put("type", "SHOW_SERVICE_TASK").put("taskId", task.path("id").asText());
                String placeId = variant.path("placeId").asText("");
                if (!placeId.isEmpty()) {
                    context.put("placeId", placeId);
                    ((ArrayNode) action.path("placeIds")).add(placeId);
                }
                reference(turn, task.path("name").asText(), variant.path("sourceUrl").asText());
                for (JsonNode source : variant.path("sourceRefs")) {
                    reference(turn, source.path("title").asText(), source.path("url").asText());
                }
                if ("sports-sign-in".equals(task.path("id").asText())) {
                    ArrayNode choices = (ArrayNode) turn.path("choices");
                    choice(choices, "体测", "我想确认体测事项", "ask");
                    choice(choices, "课程考勤", "我想确认体育课签到", "ask");
                    choice(choices, "校园跑", "我想确认校园跑", "ask");
                }
                break;
            }
        }
        finishChoices(turn);
        return turn;
    }

    private ObjectNode dining(ObjectNode context, ObjectNode turn) {
        context.remove("taskId");
        context.put("intent", "dining");
        ObjectNode action = (ObjectNode) turn.path("sceneAction");
        action.put("type", "SHOW_DINING").put("title", "校内餐饮目录");
        ArrayNode choices = (ArrayNode) turn.path("choices");
        StringBuilder names = new StringBuilder();
        for (ObjectNode place : catalog.searchPlaces("", context.path("campusId").asText())) {
            if (!"dining".equals(place.path("category").asText())) continue;
            ((ArrayNode) action.path("placeIds")).add(place.path("id").asText());
            if (names.length() > 0) names.append("、");
            names.append(place.path("name").asText());
            reference(turn, place.path("name").asText(), place.path("sourceUrl").asText());
            if (choices.size() < 4) choice(choices, place.path("name").asText(), "看看" + place.path("name").asText(), "ask");
        }
        reply(turn, names.length() == 0 ? "这个校区的餐饮地点尚未核实，可以先查看校区资料。"
                : "可以先看看校内目录：" + names + "。营业时段、价格和实时供应尚待核实；这里没有采集真实评分，暂不作评分排行。");
        finishChoices(turn);
        return turn;
    }

    private boolean confirmedArrival(String message, ObjectNode place) {
        if (place == null) return false;
        for (JsonNode alias : place.path("aliases")) {
            if (message.matches("(?s).*(?:我在|我到了|我已经进入|我现在在)\\s*"
                    + java.util.regex.Pattern.quote(alias.asText()) + ".*")) return true;
        }
        return false;
    }

    private String matchedTask(String message) {
        if (message.contains("校园卡") || message.contains("补卡") || message.contains("一卡通")) return "campus-card";
        String best = "";
        int length = 0;
        for (JsonNode task : catalog.snapshot().path("tasks")) {
            for (JsonNode alias : task.path("aliases")) {
                if (alias.asText().length() > length && message.contains(alias.asText())) {
                    best = task.path("id").asText();
                    length = alias.asText().length();
                }
            }
        }
        return best;
    }

    static void reference(ObjectNode turn, String title, String url) {
        ArrayNode references = (ArrayNode) turn.path("references");
        for (JsonNode existing : references) if (url.equals(existing.path("url").asText())) return;
        references.addObject().put("title", title).put("url", url);
    }

    private void finishChoices(ObjectNode turn) {
        ArrayNode choices = (ArrayNode) turn.path("choices");
        if (choices.isEmpty()) {
            choice(choices, "带我过去", "带我过去", "ask");
            choice(choices, "查看地点实景", "看看这个地点的实景", "ask");
        }
        if (choices.size() == 1) choice(choices, "营业与价格", "餐饮营业时段和价格核实了吗", "ask");
        choice(choices, "继续追问", "还要注意什么", "followup");
        choice(choices, "自定义", "", "custom");
    }

    private ObjectNode mentionedPlace(String message, String campusId) {
        ObjectNode best = null;
        int length = 0;
        for (ObjectNode place : catalog.searchPlaces("", campusId)) {
            for (JsonNode alias : place.path("aliases")) {
                if (alias.asText().length() > length && message.contains(alias.asText())) {
                    best = place;
                    length = alias.asText().length();
                }
            }
        }
        return best;
    }

    private ObjectNode base() {
        ObjectNode turn = mapper.createObjectNode();
        turn.put("mode", "local");
        reply(turn, "可以告诉我你想去哪里或办理什么事。");
        turn.putArray("choices");
        turn.putArray("references");
        ObjectNode action = turn.putObject("sceneAction");
        action.put("type", "KEEP_SCENE").putNull("taskId").put("title", "校园助手");
        action.putArray("placeIds");
        return turn;
    }

    static void reply(ObjectNode turn, String text) { turn.put("reply", text).put("speech", text); }
    static void choice(ArrayNode choices, String label, String message, String kind) {
        choices.addObject().put("id", "choice-" + choices.size()).put("label", label).put("message", message).put("kind", kind);
    }
}
