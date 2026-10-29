package com.guide.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.KnowledgeItem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** REQ-037: test knowledge retrieval separately from scenic fallback, using isolated data.
 * See docs/natural_retrieval.md; no model or history files are accessed.
 */
class NaturalRetrievalTest {
    @TempDir Path temp;

    @ParameterizedTest
    @CsvSource({
        "灵山大佛有什么故事？,4", "大佛有什么故事？,4", "我想了解梵 宫怎么逛？,5",
        "东方卢浮宫讲什么？,5", "九龙灌浴在演什么？,6", "九龙喷泉有什么故事？,6",
        "白塔值得看吗？,15", "小布达拉宫是什么？,7", "赵朴初纪念馆介绍,14",
        "佛陀成道故事,13", "灵山胜境门票与交通指南,9", "祥符寺的历史是什么？,3"
    })
    void naturalQuestionRetrievesKnowledgeInsteadOfRelyingOnSpotFallback(String question, int id) {
        String context = defaults().retrieveRelevantContext(question);
        assertTrue(context.contains("资料 K" + id + "】"), context);
        assertTrue(context.contains("未核验") || context.contains("待补充"), context);
    }

    @Test void emptyUnrelatedAndAmbiguousQuestionsDoNotInventReferences() {
        KnowledgeService service = defaults();
        for (String question : new String[] {null, " \n\t", "如何编写Java排序算法", "它有什么故事？", "那个寺庙呢"}) {
            assertEquals("", service.retrieveRelevantContext(question), String.valueOf(question));
        }
    }

    @Test void multipleNamedSpotsEachGetAPrimaryReference() {
        String context = defaults().retrieveRelevantContext("大佛和梵宫有什么不同？");
        assertTrue(context.contains("资料 K4】"), context);
        assertTrue(context.contains("资料 K5】"), context);
        assertTrue(context.indexOf("资料 K4】") < context.indexOf("资料 K5】"), context);
    }

    @Test void foreignBuddhaNameDoesNotBecomeTheLocalBuddha() {
        String context = defaults().retrieveRelevantContext("乐山大佛有什么故事？");
        assertFalse(context.contains("资料 K4】"), context);
    }

    @Test void tiedScoresAreIndependentOfInputListOrder() throws Exception {
        KnowledgeItem a = item(31, "石雕观察甲", "石雕艺术");
        KnowledgeItem b = item(2, "石雕观察乙", "石雕艺术");
        KnowledgeItem c = item(9, "石雕观察丙", "石雕艺术");
        String forward = custom(Arrays.asList(a, b, c)).retrieveRelevantContext("石雕艺术有什么特点？");
        String reverse = custom(Arrays.asList(c, b, a)).retrieveRelevantContext("石雕艺术有什么特点？");
        assertEquals(forward, reverse);
        assertTrue(forward.indexOf("资料 K2】") < forward.indexOf("资料 K9】"), forward);
    }

    @Test void customIdReuseDoesNotCreateAnEntityAssociation() throws Exception {
        assertEquals("", custom(Arrays.asList(item(4, "海边露营", "海边")))
                .retrieveRelevantContext("大佛有什么故事？"));
    }

    @Test void longTitlesAndBodiesCannotOverflowContextBudget() throws Exception {
        String title = repeat("长标题", 1000), content = "未核验的课程示例。" + repeat("长正文", 1000);
        KnowledgeItem a = item(1, title, "预算回归"); a.setContent(content);
        String context = custom(Arrays.asList(a)).retrieveRelevantContext("预算回归");
        assertTrue(context.length() <= 1200, "length=" + context.length());
        assertTrue(context.contains("资料 K1】"));
        assertTrue(context.contains("未核验"));
    }

    @Test void incidentalMentionsOfManySpotsDoNotAddUpToAPrimaryMatch() throws Exception {
        KnowledgeItem unrelated = item(40, "随手记录", "随手");
        unrelated.setContent("灵山大照壁、五明桥、佛足坛、五智门、菩提大道。仅为路过清单。");
        assertEquals("", custom(Arrays.asList(unrelated))
                .retrieveRelevantContext("大照壁、五明桥、佛足坛、五智门、菩提大道有什么故事？"));
    }

    @Test void repeatedKeywordsDoNotOutrankAnEqualCandidateWithSmallerId() throws Exception {
        KnowledgeItem a = item(30, "观察甲", "石雕艺术,石雕艺术,石雕艺术");
        KnowledgeItem b = item(2, "观察乙", "石雕艺术");
        String context = custom(Arrays.asList(a, b)).retrieveRelevantContext("石雕艺术有什么特点？");
        assertTrue(context.indexOf("资料 K2】") < context.indexOf("资料 K30】"), context);
    }

    @Test void curatedDictionaryRecognizesEveryExistingScenicName() {
        SpotService spots = new SpotService(); spots.loadSpots();
        for (com.guide.model.Spot spot : spots.getAllSpots()) {
            KnowledgeRetrieval result = defaults().retrieve(spot.getName());
            assertEquals(Arrays.asList(spot.getName()), result.getEntityNames());
        }
    }

    @Test void referencesMatchIncludedContextAndDoNotExceedThreeCandidates() throws Exception {
        KnowledgeRetrieval result = custom(Arrays.asList(item(5, "记录五", "预算核对"), item(1, "记录一", "预算核对"),
                item(7, "记录七", "预算核对"), item(3, "记录三", "预算核对"))).retrieve("预算核对");
        assertEquals(3, result.getReferences().size());
        for (com.guide.model.KnowledgeReference ref : result.getReferences()) {
            assertTrue(result.getContext().contains("资料 K" + ref.getId() + "】"));
        }
        assertFalse(result.getContext().contains("资料 K7】"));
        assertThrows(UnsupportedOperationException.class, () -> result.getReferences().clear());
    }

    private KnowledgeService defaults() { return load(temp.resolve("defaults.json")); }
    private KnowledgeService custom(List<KnowledgeItem> items) throws Exception {
        Path path = temp.resolve("custom.json");
        new ObjectMapper().writeValue(path.toFile(), items);
        return load(path);
    }
    private KnowledgeService load(Path path) {
        KnowledgeService service = new KnowledgeService();
        ReflectionTestUtils.setField(service, "knowledgeFilePath", path.toString());
        service.init(); return service;
    }
    private static KnowledgeItem item(int id, String title, String keywords) {
        KnowledgeItem item = new KnowledgeItem(); item.setId(id); item.setTitle(title);
        item.setContent("未核验的课程示例，保持文字提示。"); item.setCategory("其他");
        item.setKeywords(keywords); item.setCreateTime("2024-01-01"); return item;
    }
    private static String repeat(String text, int count) {
        StringBuilder out = new StringBuilder(); for (int i = 0; i < count; i++) out.append(text); return out.toString();
    }
}
