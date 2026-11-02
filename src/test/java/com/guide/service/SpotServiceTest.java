package com.guide.service;

import com.guide.model.Spot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * REQ-035 第 4 条：SpotService 景点资料、中文标签、亮点分隔符与未核验声明的回归测试。
 *
 * <p>直接构造 SpotService 并调用 loadSpots()，不启动 Spring 上下文、不访问网络；
 * 预期依据见 {@code docs/knowledge_integrity.md} 第 4 条。</p>
 */
class SpotServiceTest {

    /** 每个景点块必须出现的未核验声明（REQ-035 第 4 条）。 */
    private static final String SAMPLE_NOTICE = "以下为本项目未核验的静态课程示例资料";

    /** 统一的示例字段标签（REQ-035 第 4 条）。 */
    private static final String LABEL_OPENING_HOURS = "开放时间（示例字段，请以景区公告为准）：";
    private static final String LABEL_TICKET = "门票（示例字段，请以景区公告为准）：";
    private static final String LABEL_TRANSPORTATION = "交通（示例字段，请以景区公告为准）：";

    private SpotService spotService;
    private String context;

    @BeforeEach
    void setUp() {
        spotService = new SpotService();
        spotService.loadSpots();
        context = spotService.buildSpotContext();
    }

    @Test
    void loadsAllSixteenSpots() {
        assertEquals(16, spotService.getAllSpots().size(), "spots.json 应加载 16 个景点");
    }

    @Test
    void mapsReviewedSpotIdsToNames() {
        // 按 spots.json 实际 id 对应：6 九龙灌浴、11 灵山大佛、13 灵山梵宫
        assertEquals(6, findSpot("九龙灌浴").getId());
        assertEquals(11, findSpot("灵山大佛").getId());
        assertEquals(13, findSpot("灵山梵宫").getId());
        assertEquals("灵山大佛", findSpotById(11).getName());
        assertEquals("灵山梵宫", findSpotById(13).getName());
        assertEquals("九龙灌浴", findSpotById(6).getName());
    }

    @Test
    void reviewedSpotBlocksContainAllFieldsAndLabels() {
        for (int id : new int[] {11, 13, 6}) {
            Spot spot = findSpotById(id);
            String block = blockOf(spot);
            String marker = "【" + spot.getName() + "】";

            assertTrue(block.startsWith(marker + "\n"),
                    "景点块应以【景点名】开头且名称后不加冒号（REQ-035）: " + marker);
            assertTrue(block.contains("简介：" + spot.getBrief()), "缺少简介字段: " + spot.getName());
            assertTrue(block.contains("分类：" + spot.getCategory()), "缺少分类字段: " + spot.getName());
            assertTrue(block.contains("历史：" + spot.getHistory()), "缺少历史字段: " + spot.getName());
            assertTrue(block.contains("地址：" + spot.getAddress()), "缺少地址字段: " + spot.getName());
            assertTrue(block.contains(LABEL_OPENING_HOURS + spot.getOpeningHours()),
                    "缺少开放时间示例字段: " + spot.getName());
            assertTrue(block.contains(LABEL_TICKET + spot.getTicket()),
                    "缺少门票示例字段: " + spot.getName());
            assertTrue(block.contains(LABEL_TRANSPORTATION + spot.getTransportation()),
                    "缺少交通示例字段: " + spot.getName());
            assertTrue(block.contains("亮点：" + String.join("、", spot.getHighlights())),
                    "亮点应以「、」连接并按数据原文保留: " + spot.getName());
            assertTrue(block.contains("未核验") && block.contains("景区公告"),
                    "景点块应声明未核验并提示景区公告: " + spot.getName());
        }
    }

    @Test
    void everySpotBlockKeepsItsOwnFields() {
        for (Spot spot : spotService.getAllSpots()) {
            String block = blockOf(spot);
            assertTrue(block.contains("简介：" + spot.getBrief()), "字段丢失: " + spot.getName());
            assertTrue(block.contains("分类：" + spot.getCategory()), "字段丢失: " + spot.getName());
            assertTrue(block.contains("历史：" + spot.getHistory()), "字段丢失: " + spot.getName());
            assertTrue(block.contains("地址：" + spot.getAddress()), "字段丢失: " + spot.getName());
            assertTrue(block.contains(LABEL_OPENING_HOURS + spot.getOpeningHours()),
                    "字段丢失: " + spot.getName());
            assertTrue(block.contains(LABEL_TICKET + spot.getTicket()), "字段丢失: " + spot.getName());
            assertTrue(block.contains(LABEL_TRANSPORTATION + spot.getTransportation()),
                    "字段丢失: " + spot.getName());
            assertTrue(block.contains("亮点：" + String.join("、", spot.getHighlights())),
                    "字段丢失: " + spot.getName());
        }
    }

    @Test
    void contextHasNoReplacementCharacter() {
        assertFalse(context.contains("\uFFFD"), "景点上下文不得出现替换字符 U+FFFD");
        for (Spot spot : spotService.getAllSpots()) {
            assertFalse(blockOf(spot).contains("\uFFFD"), "景点块含 U+FFFD: " + spot.getName());
        }
    }

    @Test
    void everySpotBlockDeclaresUnverifiedSampleNotice() {
        assertEquals(16, countOccurrences(context, SAMPLE_NOTICE),
                "16 个景点块应各出现一次未核验静态课程示例声明");
        for (Spot spot : spotService.getAllSpots()) {
            String block = blockOf(spot);
            assertTrue(block.contains("未核验"), "缺少未核验声明: " + spot.getName());
            assertTrue(block.contains("景区公告"), "缺少景区公告提示: " + spot.getName());
        }
    }

    @Test
    void lookupAndSearchRegression() {
        assertFalse(spotService.getSpotById(999).isPresent(), "不存在的 id 应返回空 Optional");

        List<Spot> hits = spotService.searchSpots("灵山");
        assertTrue(containsSpot(hits, "灵山大佛"), "searchSpots 应命中灵山大佛");
        assertTrue(containsSpot(hits, "灵山梵宫"), "searchSpots 应命中灵山梵宫");

        List<Spot> all = spotService.searchSpots(" ");
        assertEquals(16, all.size(), "空关键词应返回全部 16 个景点");
    }

    // ===== 测试辅助 =====

    private Spot findSpotById(int id) {
        for (Spot spot : spotService.getAllSpots()) {
            if (spot.getId() == id) return spot;
        }
        throw new AssertionError("缺少景点 id=" + id);
    }

    private Spot findSpot(String name) {
        for (Spot spot : spotService.getAllSpots()) {
            if (spot.getName().equals(name)) return spot;
        }
        throw new AssertionError("缺少景点 name=" + name);
    }

    private boolean containsSpot(List<Spot> spots, String name) {
        for (Spot spot : spots) {
            if (spot.getName().equals(name)) return true;
        }
        return false;
    }

    /** 取出以【景点名】开头、以空行结束的单个景点块。 */
    private String blockOf(Spot spot) {
        String marker = "【" + spot.getName() + "】";
        int start = context.indexOf(marker);
        assertTrue(start >= 0, "景点上下文缺少景点块: " + marker);
        int end = context.indexOf("\n\n", start);
        return end < 0 ? context.substring(start) : context.substring(start, end);
    }

    private static int countOccurrences(String text, String needle) {
        int count = 0;
        int index = 0;
        while ((index = text.indexOf(needle, index)) >= 0) {
            count++;
            index += needle.length();
        }
        return count;
    }
}
