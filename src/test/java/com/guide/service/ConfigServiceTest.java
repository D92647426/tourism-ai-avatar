package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.guide.model.DigitalHumanConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 数字人展示配置服务测试（REQ-038 / GitHub #8）。
 *
 * <p>目标契约：{@code ConfigService(String configFilePath)} + {@code init()} +
 * {@code getConfig()}（返回防御性副本）+ {@code updateConfig(JsonNode patch)}（部分更新，
 * 非法值抛 {@link IllegalArgumentException}，落盘失败抛 {@link IOException} 且不改内存/旧文件）。
 *
 * <p>全部使用 {@link TempDir} 独立目录，不读取也不改写仓库里的真实 data/config.json。
 *
 * <p>文档：[测试说明](../../../../../../docs/test_reference.md#L1)、
 * [需求说明](../../../../../../docs/display_config.md#L1)。
 */
class ConfigServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String DEFAULT_NAME = "灵灵";
    private static final String DEFAULT_WELCOME =
            "阿弥陀佛！我是您的AI导游灵灵，欢迎来到灵山胜境，愿您在此感悟灵山，吉祥平安！";
    private static final String DEFAULT_COLOR = "#c8963e";

    @TempDir
    Path tempDir;

    private Path configFile() {
        return tempDir.resolve("config.json");
    }

    private ConfigService newService() {
        return new ConfigService(configFile().toString());
    }

    private ConfigService initializedService() {
        ConfigService service = newService();
        service.init();
        return service;
    }

    private static JsonNode json(String raw) throws IOException {
        return MAPPER.readTree(raw);
    }

    private static ObjectNode textPatch(String field, String value) {
        ObjectNode patch = MAPPER.createObjectNode();
        patch.put(field, value);
        return patch;
    }

    private static ObjectNode numberPatch(String field, double value) {
        ObjectNode patch = MAPPER.createObjectNode();
        patch.put(field, value);
        return patch;
    }

    private static String repeat(char ch, int count) {
        char[] chars = new char[count];
        Arrays.fill(chars, ch);
        return new String(chars);
    }

    private static void writeRaw(Path file, String content) throws IOException {
        Files.createDirectories(file.getParent());
        Files.write(file, content.getBytes(StandardCharsets.UTF_8));
    }

    /** 校验配置与 DigitalHumanConfig 默认值一致。 */
    private static void assertDefaults(DigitalHumanConfig config) {
        assertEquals(DEFAULT_NAME, config.getName());
        assertEquals(DEFAULT_WELCOME, config.getWelcomeMessage());
        assertEquals("female", config.getVoiceType());
        assertEquals("haru", config.getModelName());
        assertEquals(DEFAULT_COLOR, config.getPrimaryColor());
        assertEquals(1.0, config.getVolume(), 0.0);
        assertEquals(1.0, config.getSpeechRate(), 0.0);
    }

    @Test
    void fullValidUpdatePersistsAndSurvivesRestart() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig updated = service.updateConfig(json("{\"name\":\"新名称\","
                + "\"welcomeMessage\":\"欢迎光临灵山\",\"voiceType\":\"male\",\"modelName\":\"模型A\","
                + "\"primaryColor\":\"#ABCDEF\",\"volume\":0,\"speechRate\":1.5}"));

        assertEquals("新名称", updated.getName());
        assertEquals("欢迎光临灵山", updated.getWelcomeMessage());
        assertEquals("male", updated.getVoiceType());
        assertEquals("模型A", updated.getModelName());
        assertEquals("#abcdef", updated.getPrimaryColor());
        assertEquals(0.0, updated.getVolume(), 0.0, "音量0必须保留，不能被隐式改成1");
        assertEquals(1.5, updated.getSpeechRate(), 0.0);

        ConfigService restarted = newService();
        restarted.init();
        DigitalHumanConfig reloaded = restarted.getConfig();
        assertEquals("新名称", reloaded.getName());
        assertEquals("#abcdef", reloaded.getPrimaryColor());
        assertEquals(0.0, reloaded.getVolume(), 0.0, "重启后音量0不能被改写");
        assertEquals(1.5, reloaded.getSpeechRate(), 0.0);
    }

    @Test
    void partialUpdateKeepsUntouchedFields() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig updated = service.updateConfig(textPatch("name", "只改名字"));

        assertEquals("只改名字", updated.getName());
        assertEquals(DEFAULT_WELCOME, updated.getWelcomeMessage());
        assertEquals("female", updated.getVoiceType());
        assertEquals("haru", updated.getModelName());
        assertEquals(DEFAULT_COLOR, updated.getPrimaryColor());
        assertEquals(1.0, updated.getVolume(), 0.0);
        assertEquals(1.0, updated.getSpeechRate(), 0.0);
    }

    @Test
    void emptyPatchReturnsCurrentAndDoesNotRewriteFile() throws IOException {
        ConfigService service = initializedService();
        byte[] before = Files.readAllBytes(configFile());
        DigitalHumanConfig beforeConfig = service.getConfig();

        DigitalHumanConfig result = service.updateConfig(json("{}"));

        assertEquals(beforeConfig.getName(), result.getName());
        assertEquals(beforeConfig.getWelcomeMessage(), result.getWelcomeMessage());
        assertEquals(beforeConfig.getPrimaryColor(), result.getPrimaryColor());
        assertEquals(beforeConfig.getVolume(), result.getVolume(), 0.0);
        assertEquals(beforeConfig.getSpeechRate(), result.getSpeechRate(), 0.0);
        assertArrayEquals(before, Files.readAllBytes(configFile()), "空补丁不能重写配置文件");
    }

    @Test
    void nullUnknownAndWrongTypeFieldsAreRejected() throws IOException {
        ConfigService service = initializedService();
        String[] invalidPayloads = {
                "{\"name\":null}",
                "{\"unknownField\":1}",
                "{\"name\":123}",
                "{\"volume\":\"0.5\"}",
                "{\"speechRate\":true}"
        };
        for (String payload : invalidPayloads) {
            assertThrows(IllegalArgumentException.class, () -> service.updateConfig(json(payload)),
                    "非法配置必须拒绝: " + payload);
        }
    }

    @Test
    void nameLengthTrimAndControlCharsAreValidated() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig ok = service.updateConfig(textPatch("name", repeat('a', 40)));
        assertEquals(40, ok.getName().length(), "40 字符名称必须合法");

        String[] invalidNames = {
                "",
                "   ",
                repeat('a', 41),
                "a\u0001b"
        };
        for (String name : invalidNames) {
            assertThrows(IllegalArgumentException.class, () -> service.updateConfig(textPatch("name", name)),
                    "非法名称必须拒绝");
        }
    }

    @Test
    void welcomeMessageLengthAndWhitespaceAreValidated() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig ok = service.updateConfig(textPatch("welcomeMessage", repeat('w', 500)));
        assertEquals(500, ok.getWelcomeMessage().length(), "500 字符欢迎语必须合法");

        DigitalHumanConfig multiline = service.updateConfig(textPatch("welcomeMessage", "第一行\n第二行\t结束"));
        assertEquals("第一行\n第二行\t结束", multiline.getWelcomeMessage(), "欢迎语允许换行和制表符");

        String[] invalidWelcomes = {
                "",
                "   ",
                repeat('w', 501),
                "含控制字符\u0007的欢迎语"
        };
        for (String welcome : invalidWelcomes) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.updateConfig(textPatch("welcomeMessage", welcome)),
                    "非法欢迎语必须拒绝");
        }
    }

    @Test
    void primaryColorValidationNormalizesUppercase() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig ok = service.updateConfig(textPatch("primaryColor", "#AABBCC"));
        assertEquals("#aabbcc", ok.getPrimaryColor(), "十六进制颜色必须统一保存为小写");

        String[] invalidColors = {
                "#abc", "red", "rgb(1,2,3)", "url(x)", "#1234567", "#", "#GGGGGG", " #aabbcc"
        };
        for (String color : invalidColors) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.updateConfig(textPatch("primaryColor", color)),
                    "非法颜色必须拒绝: " + color);
        }
    }

    @Test
    void volumeBoundariesAreEnforced() throws IOException {
        ConfigService service = initializedService();

        assertEquals(0.0, service.updateConfig(numberPatch("volume", 0.0)).getVolume(), 0.0);
        assertEquals(0.0, service.getConfig().getVolume(), 0.0, "音量0必须保持0");
        assertEquals(1.0, service.updateConfig(numberPatch("volume", 1.0)).getVolume(), 0.0);

        double[] invalidVolumes = {-0.01, 1.01, 5.0};
        for (double volume : invalidVolumes) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.updateConfig(numberPatch("volume", volume)),
                    "非法音量必须拒绝: " + volume);
        }
    }

    @Test
    void speechRateBoundariesAreEnforced() throws IOException {
        ConfigService service = initializedService();

        assertEquals(0.5, service.updateConfig(numberPatch("speechRate", 0.5)).getSpeechRate(), 0.0);
        assertEquals(2.0, service.updateConfig(numberPatch("speechRate", 2.0)).getSpeechRate(), 0.0);

        double[] invalidRates = {0.49, 2.01, 0.0, 3.0};
        for (double rate : invalidRates) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.updateConfig(numberPatch("speechRate", rate)),
                    "非法语速必须拒绝: " + rate);
        }
    }

    @Test
    void nonFiniteNumbersAreRejected() throws IOException {
        ConfigService service = initializedService();

        assertThrows(IllegalArgumentException.class,
                () -> service.updateConfig(numberPatch("volume", Double.NaN)),
                "NaN 不是有限数，必须拒绝");
        assertThrows(IllegalArgumentException.class,
                () -> service.updateConfig(numberPatch("volume", Double.POSITIVE_INFINITY)),
                "正无穷不是有限数，必须拒绝");
        assertThrows(IllegalArgumentException.class,
                () -> service.updateConfig(numberPatch("speechRate", Double.NEGATIVE_INFINITY)),
                "负无穷不是有限数，必须拒绝");
    }

    @Test
    void invalidUpdateLeavesMemoryAndFileUnchanged() throws IOException {
        ConfigService service = initializedService();
        DigitalHumanConfig before = service.getConfig();
        byte[] original = Files.readAllBytes(configFile());

        String[] invalidPayloads = {
                "{\"primaryColor\":\"red\"}",
                "{\"volume\":-0.1}",
                "{\"unknownField\":1}"
        };
        for (String payload : invalidPayloads) {
            assertThrows(IllegalArgumentException.class, () -> service.updateConfig(json(payload)));
        }

        DigitalHumanConfig after = service.getConfig();
        assertEquals(before.getName(), after.getName());
        assertEquals(before.getWelcomeMessage(), after.getWelcomeMessage());
        assertEquals(before.getPrimaryColor(), after.getPrimaryColor());
        assertEquals(before.getVolume(), after.getVolume(), 0.0);
        assertEquals(before.getSpeechRate(), after.getSpeechRate(), 0.0);
        assertArrayEquals(original, Files.readAllBytes(configFile()), "非法更新不能改写配置文件");
    }

    @Test
    void getConfigReturnsDefensiveCopy() throws IOException {
        ConfigService service = initializedService();

        DigitalHumanConfig first = service.getConfig();
        first.setName("被外部篡改");
        first.setVolume(0.0);
        first.setPrimaryColor("#000000");

        DigitalHumanConfig current = service.getConfig();
        assertEquals(DEFAULT_NAME, current.getName(), "外部修改返回值不能影响内存配置");
        assertEquals(1.0, current.getVolume(), 0.0);
        assertEquals(DEFAULT_COLOR, current.getPrimaryColor());

        DigitalHumanConfig updateResult = service.updateConfig(textPatch("name", "正式名称"));
        updateResult.setName("再次篡改");
        assertEquals("正式名称", service.getConfig().getName(), "更新返回值也不能直接开放内存");
    }

    @Test
    void missingFileWritesDefaultsAndIsReadable() throws IOException {
        assertFalse(Files.exists(configFile()));

        ConfigService service = initializedService();

        assertTrue(Files.exists(configFile()), "缺文件时启动应写出默认配置");
        assertDefaults(service.getConfig());

        ConfigService restarted = newService();
        restarted.init();
        assertDefaults(restarted.getConfig());
    }

    @Test
    void existingFileWithMissingFieldsFallsBackToDefaults() throws IOException {
        writeRaw(configFile(), "{\"name\":\"仅名称\"}");

        ConfigService service = initializedService();
        DigitalHumanConfig config = service.getConfig();

        assertEquals("仅名称", config.getName());
        assertEquals(DEFAULT_WELCOME, config.getWelcomeMessage());
        assertEquals("female", config.getVoiceType());
        assertEquals("haru", config.getModelName());
        assertEquals(DEFAULT_COLOR, config.getPrimaryColor());
        assertEquals(1.0, config.getVolume(), 0.0);
        assertEquals(1.0, config.getSpeechRate(), 0.0);
    }

    @Test
    void corruptJsonFallsBackToDefaultsAndPreservesOriginalFile() throws IOException {
        writeRaw(configFile(), "{ 这不是合法 JSON");
        byte[] original = Files.readAllBytes(configFile());

        ConfigService service = initializedService();

        assertDefaults(service.getConfig());
        assertArrayEquals(original, Files.readAllBytes(configFile()), "坏文件不能在启动时被覆盖");
    }

    @Test
    void invalidPersistedValuesFallBackToDefaultsAndPreserveFile() throws IOException {
        writeRaw(configFile(), "{\"name\":\"坏配置\",\"welcomeMessage\":\"欢迎\","
                + "\"voiceType\":\"female\",\"modelName\":\"haru\",\"primaryColor\":\"#c8963e\","
                + "\"volume\":5,\"speechRate\":1.0}");
        byte[] original = Files.readAllBytes(configFile());

        ConfigService service = initializedService();

        assertDefaults(service.getConfig());
        assertArrayEquals(original, Files.readAllBytes(configFile()), "非法旧配置不能在启动时被覆盖");
    }

    @Test
    void saveFailureThrowsIOExceptionKeepsMemoryAndCleansTempFiles() throws Exception {
        Path target = tempDir.resolve("config-as-directory");
        Files.createDirectory(target);

        ConfigService service = new ConfigService(target.toString());
        service.init();
        assertDefaults(service.getConfig());

        assertThrows(IOException.class,
                () -> service.updateConfig(textPatch("name", "新名称")),
                "落盘失败必须抛 IOException");

        assertEquals(DEFAULT_NAME, service.getConfig().getName(), "落盘失败必须保持旧内存配置");

        try (Stream<Path> stream = Files.list(tempDir)) {
            List<String> names = stream.map(path -> path.getFileName().toString())
                    .collect(Collectors.toList());
            assertEquals(1, names.size(), "落盘失败不能留下临时文件: " + names);
            assertEquals("config-as-directory", names.get(0));
        }
    }

    @Test
    void initCreatesMissingParentDirectories() throws IOException {
        Path nested = tempDir.resolve("a").resolve("b").resolve("config.json");
        assertFalse(Files.exists(nested.getParent()));

        ConfigService service = new ConfigService(nested.toString());
        service.init();

        assertTrue(Files.exists(nested), "缺父目录时启动应创建目录并写出默认配置");
        assertDefaults(service.getConfig());

        ConfigService restarted = new ConfigService(nested.toString());
        restarted.init();
        assertDefaults(restarted.getConfig());
    }

    @Test
    void trailingGarbageAfterJsonIsTreatedAsCorruptFile() throws IOException {
        writeRaw(configFile(), "{\"name\":\"不应读取\"} trailing-garbage");
        byte[] original = Files.readAllBytes(configFile());

        ConfigService service = initializedService();

        assertDefaults(service.getConfig());
        assertArrayEquals(original, Files.readAllBytes(configFile()), "含尾随垃圾的文件不能在启动时被覆盖");
    }

    @Test
    void secondJsonObjectAfterFirstIsTreatedAsCorruptFile() throws IOException {
        writeRaw(configFile(), "{\"name\":\"第一个对象\"}\n{\"name\":\"第二个对象\"}");
        byte[] original = Files.readAllBytes(configFile());

        ConfigService service = initializedService();

        assertDefaults(service.getConfig());
        assertArrayEquals(original, Files.readAllBytes(configFile()), "含多个 JSON 对象的文件不能在启动时被覆盖");
    }
}
