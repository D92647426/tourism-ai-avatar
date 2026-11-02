package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.KnowledgeItem;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * KnowledgeService 的初始化矩阵、默认库对齐、检索截断与 CRUD 回归测试
 * （REQ-035，docs/knowledge_integrity.md 第 3/7 条）。
 *
 * <p>不启动 Spring 上下文：直接实例化服务，用 ReflectionTestUtils 注入外置文件路径后
 * 调用 init()，覆盖缺文件、合法自定义库、合法空数组、坏文件降级与不覆盖、
 * 无父目录相对路径等场景。</p>
 */
class KnowledgeServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** REQ-035 约定的正文边界提示（id 4-16）。 */
    private static final String EXAMPLE_BOUNDARY_PREFIX = "课程示例资料，未完成事实核验，不作为实时出行依据。";

    /** REQ-035 约定的待补充正文（id 1-3）。 */
    private static final String PENDING_CONTENT = "待补充：原始正文缺失，尚未完成可靠来源核验。";

    private static final String KNOWLEDGE_FILE_PATH_FIELD = "knowledgeFilePath";

    @TempDir
    Path tempDir;

    /** 记录写到工作目录（CWD）的临时文件，测试结束后清理，避免污染仓库。 */
    private final List<File> workingDirectoryFiles = new ArrayList<>();

    @AfterEach
    void cleanWorkingDirectoryFiles() {
        for (File file : workingDirectoryFiles) {
            try {
                Files.deleteIfExists(file.toPath());
            } catch (IOException ignored) {
                // 清理失败不掩盖测试断言失败
            }
        }
        workingDirectoryFiles.clear();
    }

    // ===== 1. 打包默认库与 data/knowledge.json 对齐 =====

    @Test
    void packagedDefaultsMatchRepositoryDataAndCarryBoundaryNotices() throws Exception {
        // 外置文件不存在 → items 为打包默认库（同时会写出默认库到临时路径）
        KnowledgeService service = initService(tempDir.resolve("data").resolve("knowledge.json").toString());

        assertEquals(16, service.getCount(), "打包默认库应为 16 条");
        assertEquals(16, service.getAll().size());

        File repositoryData = new File("data/knowledge.json");
        assertTrue(repositoryData.isFile(), "仓库数据文件应存在: " + repositoryData.getAbsolutePath());
        List<KnowledgeItem> repositoryItems = readItems(repositoryData);
        assertEquals(16, repositoryItems.size(), "data/knowledge.json 应为 16 条");

        // 打包资源与 data/knowledge.json 语义完全一致（忽略缩进格式差异）
        ClassPathResource packagedResource = new ClassPathResource("knowledge.json");
        assertTrue(packagedResource.exists(), "打包默认库 classpath:knowledge.json 应存在");
        try (InputStream in = packagedResource.getInputStream()) {
            JsonNode packagedJson = MAPPER.readTree(in);
            JsonNode repositoryJson = MAPPER.readTree(repositoryData);
            assertEquals(repositoryJson, packagedJson, "打包默认库必须与 data/knowledge.json 内容一致");
        }

        // 逐条比较 id/title/category/keywords/createTime/content，并确认 id 为 1..16
        for (int i = 0; i < repositoryItems.size(); i++) {
            KnowledgeItem expected = repositoryItems.get(i);
            KnowledgeItem actual = service.getAll().get(i);
            assertEquals(i + 1, actual.getId(), "打包默认库 id 应为 " + (i + 1));
            assertEquals(expected.getId(), actual.getId());
            assertEquals(expected.getTitle(), actual.getTitle());
            assertEquals(expected.getCategory(), actual.getCategory());
            assertEquals(expected.getKeywords(), actual.getKeywords());
            assertEquals(expected.getCreateTime(), actual.getCreateTime());
            assertEquals(expected.getContent(), actual.getContent());
        }

        // id 1-3 正文精确等于待补充提示
        for (int id = 1; id <= 3; id++) {
            final int expectedId = id;
            KnowledgeItem item = service.getById(expectedId)
                    .orElseThrow(() -> new AssertionError("缺少 id " + expectedId));
            assertEquals(PENDING_CONTENT, item.getContent(), "id " + expectedId + " 正文应为待补充提示");
        }

        // id 4-16 正文以课程示例资料边界提示开头
        for (int id = 4; id <= 16; id++) {
            final int expectedId = id;
            KnowledgeItem item = service.getById(expectedId)
                    .orElseThrow(() -> new AssertionError("缺少 id " + expectedId));
            assertTrue(item.getContent().startsWith(EXAMPLE_BOUNDARY_PREFIX),
                    "id " + expectedId + " 正文应以边界提示开头");
        }
    }

    // ===== 2. 缺文件：创建默认库、父目录与文件 =====

    @Test
    void missingExternalFileCreatesDefaultLibraryAndParentDirectories() throws Exception {
        Path external = tempDir.resolve("nested").resolve("data").resolve("knowledge.json");
        assertFalse(Files.exists(external.getParent()), "前置条件：父目录不存在");

        KnowledgeService service = initService(external.toString());

        assertEquals(16, service.getCount(), "缺文件时应使用打包默认 16 条");
        assertTrue(Files.isDirectory(external.getParent()), "父目录应被创建");
        assertTrue(Files.isRegularFile(external), "默认知识库应被写出");
        assertEquals(16, readItems(external.toFile()).size(), "写出的默认库应为 16 条");

        // 新实例应能直接读取刚写出的外部文件
        KnowledgeService reloaded = initService(external.toString());
        assertEquals(16, reloaded.getCount());
        assertEquals(PENDING_CONTENT, reloaded.getById(1).get().getContent());
    }

    // ===== 3. 无父目录的相对文件名 =====

    @Test
    void relativeFileNameWithoutParentDirectoryIsSaved() throws Exception {
        String fileName = "knowledge-req035-test-" + UUID.randomUUID() + ".json";
        File file = new File(fileName);
        workingDirectoryFiles.add(file);
        assertFalse(file.exists(), "前置条件：CWD 下临时文件不存在");
        try {
            KnowledgeService service = initService(fileName);

            assertEquals(16, service.getCount());
            assertTrue(file.isFile(), "无父目录的相对路径也应写出默认知识库");
            assertEquals(16, readItems(file).size());
        } finally {
            Files.deleteIfExists(file.toPath());
        }
    }

    // ===== 4. 合法自定义库优先且不被覆盖 =====

    @Test
    void validCustomLibraryIsUsedAndNotOverwritten() throws Exception {
        Path external = tempDir.resolve("custom-knowledge.json");
        KnowledgeItem custom = item(7, "寒山寺夜泊", "文史资料",
                "自定义正文（课程示例资料，未完成事实核验，不作为实时出行依据）。",
                "寒山寺,夜泊,自定义", "2024-05-01");
        MAPPER.writeValue(external.toFile(), Collections.singletonList(custom));
        byte[] before = Files.readAllBytes(external);

        KnowledgeService service = initService(external.toString());

        assertEquals(1, service.getCount(), "合法自定义库应优先");
        KnowledgeItem loaded = service.getById(7)
                .orElseThrow(() -> new AssertionError("缺少自定义 id 7"));
        assertEquals("寒山寺夜泊", loaded.getTitle());
        assertEquals("自定义正文（课程示例资料，未完成事实核验，不作为实时出行依据）。", loaded.getContent());
        assertArrayEquals(before, Files.readAllBytes(external), "合法外部文件不应被重写");
    }

    // ===== 5. 合法空数组保持为空 =====

    @Test
    void validEmptyArrayStaysEmptyAndIsNotOverwritten() throws Exception {
        Path external = tempDir.resolve("empty-knowledge.json");
        Files.write(external, "[]".getBytes(StandardCharsets.UTF_8));
        byte[] before = Files.readAllBytes(external);

        KnowledgeService service = initService(external.toString());

        assertEquals(0, service.getCount(), "合法空数组应保持为空，不静默恢复默认数据");
        assertEquals("[]", new String(Files.readAllBytes(external), StandardCharsets.UTF_8),
                "空数组文件内容应保持 \"[]\"");
        assertArrayEquals(before, Files.readAllBytes(external), "合法空数组文件不应被重写");
    }

    // ===== 6. 坏样本降级且坏文件字节不变 =====

    @Test
    void badExternalLibrariesFallBackAndAreNeverOverwritten() throws Exception {
        String malformed = "[{\"id\": 1, \"title\": \"坏 JSON\",]";
        assertFallsBackWithoutOverwriting(malformed, "malformed-json");
        assertThrows(IOException.class,
                () -> MAPPER.readTree(tempDir.resolve("malformed-json.json").toFile()),
                "坏 JSON 文件应保持不可解析");

        // 重复 ID
        String duplicateId = "[" + itemJson(1, "重复一", "文史资料", "正文一", "k1", "2024-01-01") + ","
                + itemJson(1, "重复二", "文史资料", "正文二", "k2", "2024-01-01") + "]";
        assertFallsBackWithoutOverwriting(duplicateId, "duplicate-id");
        JsonNode duplicateJson = MAPPER.readTree(tempDir.resolve("duplicate-id.json").toFile());
        assertEquals(2, duplicateJson.size(), "重复 ID 文件不应被覆盖");
        assertEquals(duplicateJson.get(0).get("id").asInt(), duplicateJson.get(1).get("id").asInt(),
                "重复 ID 应原样保留");

        // 缺 content 字段
        String missingContent = "[{\"id\":1,\"title\":\"缺正文\",\"category\":\"文史资料\","
                + "\"keywords\":\"k\",\"createTime\":\"2024-01-01\"}]";
        assertFallsBackWithoutOverwriting(missingContent, "missing-content");
        JsonNode missingContentJson = MAPPER.readTree(tempDir.resolve("missing-content.json").toFile());
        assertFalse(missingContentJson.get(0).has("content"), "缺 content 字段的文件不应被覆盖");

        // content 为空字符串
        String blankContent = "[" + itemJson(1, "空正文", "文史资料", "", "k", "2024-01-01") + "]";
        assertFallsBackWithoutOverwriting(blankContent, "blank-content");
        assertEquals("", MAPPER.readTree(tempDir.resolve("blank-content.json").toFile())
                .get(0).get("content").asText(), "空字符串 content 应原样保留");

        // 顶层 null
        assertFallsBackWithoutOverwriting("null", "top-level-null");
        assertTrue(MAPPER.readTree(tempDir.resolve("top-level-null.json").toFile()).isNull(),
                "顶层 null 文件不应被覆盖");

        // 顶层非数组
        String nonArray = "{\"knowledge\": []}";
        assertFallsBackWithoutOverwriting(nonArray, "non-array");
        assertTrue(MAPPER.readTree(tempDir.resolve("non-array.json").toFile()).isObject(),
                "顶层非数组文件不应被覆盖");
        String valid = itemJson(1, "标题", "文史资料", "正文", "k", "2024-01-01");
        for (String id : new String[] {"1.5", "\"1\"", "true", "2147483648", "0", "-1"}) {
            assertFallsBackWithoutOverwriting("[" + valid.replace("\"id\":1,", "\"id\":" + id + ",") + "]",
                    "invalid-id-" + id.replaceAll("[^a-zA-Z0-9]", "x"));
        }
        assertFallsBackWithoutOverwriting("[" + valid.replace("\"content\":\"正文\"", "\"content\":123") + "]",
                "numeric-content");
        assertFallsBackWithoutOverwriting("[] trailing-garbage", "trailing-garbage");
    }

    // ===== 7. 检索与 CRUD 回归 =====

    @Test
    void searchFindsPendingSupplementItems() {
        KnowledgeService service = initService(tempDir.resolve("data").resolve("knowledge.json").toString());

        List<KnowledgeItem> hits = service.search("待补充");

        assertEquals(3, hits.size(), "「待补充」应命中 id 1-3");
        assertEquals(Arrays.asList(1, 2, 3), hits.stream().map(KnowledgeItem::getId).collect(Collectors.toList()));
    }

    @Test
    void retrieveRelevantContextTruncatesTo200CharsKeepingBoundaryNotice() {
        KnowledgeService service = initService(tempDir.resolve("data").resolve("knowledge.json").toString());

        String uniqueKeyword = "REQ035唯一截断检索关键字";
        StringBuilder filler = new StringBuilder();
        for (int i = 0; i < 40; i++) {
            filler.append("资料续写片段").append(i).append("，");
        }
        String tailMarker = "END-MARKER-TAIL-REQ035";
        String longContent = EXAMPLE_BOUNDARY_PREFIX + uniqueKeyword + filler + tailMarker;
        assertTrue(longContent.length() > 240, "前置条件：构造正文长度应超过 240 字符");
        KnowledgeItem custom = item(0, "REQ-035 截断回归条目", "常见问题", longContent, uniqueKeyword, null);
        service.add(custom);

        String context = service.retrieveRelevantContext(uniqueKeyword);

        assertTrue(context.contains("【知识库参考资料】"));
        String expectedTruncated = longContent.substring(0, 200);
        assertEquals(200, expectedTruncated.length());
        assertTrue(expectedTruncated.startsWith(EXAMPLE_BOUNDARY_PREFIX), "200 字符内应保留边界提示");
        assertTrue(context.contains("- [REQ-035 截断回归条目] " + expectedTruncated),
                "检索上下文应只包含正文前 200 字符");
        assertFalse(context.contains(tailMarker), "超过 200 字符的正文不应出现");
    }

    @Test
    void addUpdateDeleteRegression() {
        KnowledgeService service = initService(tempDir.resolve("data").resolve("knowledge.json").toString());
        assertEquals(16, service.getCount());

        KnowledgeItem updated = item(0, "REQ-035 更新条目", "常见问题",
                "更新后的正文（课程示例资料，未完成事实核验）。", "更新,回归", null);
        Optional<KnowledgeItem> updateResult = service.update(4, updated);
        assertTrue(updateResult.isPresent());
        assertEquals(4, updateResult.get().getId());
        assertEquals("REQ-035 更新条目", service.getById(4).get().getTitle());
        assertEquals("2024-01-01", service.getById(4).get().getCreateTime(), "未提供 createTime 时应保留原值");

        assertTrue(service.delete(5));
        assertFalse(service.getById(5).isPresent());
        assertEquals(15, service.getCount());

        KnowledgeItem added = item(0, "REQ-035 新增条目", "常见问题",
                "新增正文（课程示例资料，未完成事实核验）。", "新增,回归", null);
        KnowledgeItem saved = service.add(added);
        assertEquals(17, saved.getId(), "新增条目 ID 应为当前最大 ID + 1");
        assertNotNull(saved.getCreateTime(), "新增条目应自动补 createTime");
        assertEquals(16, service.getCount());
        assertEquals("REQ-035 新增条目", service.getById(17).get().getTitle());
    }

    // ===== 辅助方法 =====

    private KnowledgeService initService(String knowledgeFilePath) {
        KnowledgeService service = new KnowledgeService();
        ReflectionTestUtils.setField(service, KNOWLEDGE_FILE_PATH_FIELD, knowledgeFilePath);
        service.init();
        return service;
    }

    /**
     * 断言坏样本初始化后降级到打包默认 16 条，且外部坏文件字节不变。
     */
    private KnowledgeService assertFallsBackWithoutOverwriting(String json, String name) throws Exception {
        Path external = tempDir.resolve(name + ".json");
        Files.write(external, json.getBytes(StandardCharsets.UTF_8));
        byte[] before = Files.readAllBytes(external);

        KnowledgeService service = initService(external.toString());

        assertEquals(16, service.getCount(), name + " 应降级到打包默认 16 条");
        assertEquals(PENDING_CONTENT, service.getById(1).get().getContent(), name + " 应使用打包默认数据");
        assertArrayEquals(before, Files.readAllBytes(external), name + " 坏文件不能被覆盖或改写");
        return service;
    }

    private List<KnowledgeItem> readItems(File file) throws IOException {
        return MAPPER.readValue(file, new TypeReference<List<KnowledgeItem>>() {});
    }

    private static KnowledgeItem item(int id, String title, String category, String content,
                                      String keywords, String createTime) {
        KnowledgeItem item = new KnowledgeItem();
        item.setId(id);
        item.setTitle(title);
        item.setCategory(category);
        item.setContent(content);
        item.setKeywords(keywords);
        item.setCreateTime(createTime);
        return item;
    }

    private static String itemJson(int id, String title, String category, String content,
                                   String keywords, String createTime) {
        return "{\"id\":" + id
                + ",\"title\":\"" + title
                + "\",\"category\":\"" + category
                + "\",\"content\":\"" + content
                + "\",\"keywords\":\"" + keywords
                + "\",\"createTime\":\"" + createTime + "\"}";
    }
}
