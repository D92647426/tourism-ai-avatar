package com.guide.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.DigitalHumanConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 数字人展示配置服务（REQ-038 / GitHub #8）。
 *
 * <p>职责：单文件 JSON 持久化数字人展示配置，并保证“内存快照”和“磁盘文件”一致：
 * <ul>
 *   <li>读取（{@link #getConfig()}）返回防御性副本，外部修改返回值不会影响内存快照；</li>
 *   <li>更新（{@link #updateConfig(JsonNode)}）支持 JSON 对象的部分更新，只覆盖请求中出现的字段；</li>
 *   <li>校验候选配置通过后才落盘，落盘采用“同目录临时文件 + 原子替换”，失败时内存与旧文件都不变；</li>
 *   <li>启动加载时缺文件可写默认值，坏文件或非法旧值降级为默认快照并记录警告，绝不覆盖已有文件。</li>
 * </ul>
 *
 * <p>锁策略：{@link #init()}、{@link #getConfig()}、{@link #updateConfig(JsonNode)} 共用同一个对象锁，
 * 保证读快照、校验、落盘、发布内存快照是一个不可分割的操作。
 *
 * <p>文档：[需求说明](../../../../../../docs/display_config.md#L1)、
 * [API 说明](../../../../../../docs/api_reference.md#L1)、
 * [配置说明](../../../../../../docs/config_reference.md#L1)、
 * [测试说明](../../../../../../docs/test_reference.md#L1)。
 */
@Service
public class ConfigService {

    private static final Logger log = LoggerFactory.getLogger(ConfigService.class);

    /** 主题色只接受 #RRGGBB 六位十六进制（大小写皆可，保存时统一为小写）。 */
    private static final Pattern PRIMARY_COLOR_PATTERN = Pattern.compile("^#[0-9a-fA-F]{6}$");

    /** 导游名称 trim 后的最大长度（字符）。 */
    private static final int NAME_MAX_LENGTH = 40;

    /** 欢迎语 trim 后的最大长度（字符）。 */
    private static final int WELCOME_MESSAGE_MAX_LENGTH = 500;

    /** 声音类型 trim 后的最大长度（字符）。 */
    private static final int VOICE_TYPE_MAX_LENGTH = 200;

    /** Live2D 模型名 trim 后的最大长度（字符）。 */
    private static final int MODEL_NAME_MAX_LENGTH = 100;

    /**
     * 服务私有 ObjectMapper：缩进输出，并启用严格的尾随 token 校验（REQ-038）。
     *
     * <p>启用 {@link DeserializationFeature#FAIL_ON_TRAILING_TOKENS} 后，配置文件在第一段 JSON 之后还出现
     * 垃圾字符或第二个 JSON 对象时会解析失败，由 {@link #load()} 按“坏文件整份默认且保留原文件”处理；
     * 不修改 Spring 全局 ObjectMapper，避免影响其他接口的解析行为。
     */
    private final ObjectMapper objectMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private final File file;

    /** 当前生效的内存快照；只有落盘成功后才替换，初始为模型默认值。 */
    private DigitalHumanConfig config = new DigitalHumanConfig();

    /**
     * @param configFilePath 配置文件路径，来自 {@code data.config-file}，允许相对路径或无父目录
     */
    public ConfigService(@Value("${data.config-file:data/config.json}") String configFilePath) {
        // 统一转绝对路径：既保证父目录非空，也保证临时文件与目标文件位于同一目录（原子替换前提）。
        this.file = new File(configFilePath).getAbsoluteFile();
    }

    /**
     * 启动时加载配置（REQ-038）。
     *
     * <p>加载规则：
     * <ul>
     *   <li>文件不存在：写出一份默认配置；写入失败只记录 WARN，内存仍使用默认值（不谎称已保存）；</li>
     *   <li>文件存在：按 {@link DigitalHumanConfig} 默认值补齐缺失字段，再逐字段校验/规范化；
     *       坏 JSON、null 或非法旧值整份降级为默认值并记录 WARN，<b>不覆盖</b>原文件；</li>
     *   <li>文件存在但不可读（例如路径是目录）：同样降级为默认值，不尝试写回。</li>
     * </ul>
     */
    @PostConstruct
    public synchronized void init() {
        load();
    }

    /**
     * 读取当前生效的配置快照（REQ-038）。
     *
     * @return 配置的防御性副本，调用方修改返回值不会影响服务内部状态
     */
    public synchronized DigitalHumanConfig getConfig() {
        return copy(config);
    }

    /**
     * 部分更新数字人展示配置（REQ-038 / API-038）。
     *
     * <p>处理顺序固定为：校验请求体 → 复制当前内存快照 → 逐字段应用并校验 → 原子落盘 → 发布新内存快照 →
     * 返回副本。任何一步失败都不会部分改写配置：
     * <ul>
     *   <li>请求体为 null、非 JSON 对象，或含 null / 未知字段 / 类型错误 / 非法值时抛
     *       {@link IllegalArgumentException}，内存与文件都不变；</li>
     *   <li>空对象（{@code {}}）直接返回当前配置副本，不重写文件；</li>
     *   <li>落盘失败抛 {@link IOException}，新快照不发布，内存继续使用旧配置；临时文件总会被清理。</li>
     * </ul>
     *
     * @param patch 只包含待修改字段的 JSON 对象；缺省字段保持当前值
     * @return 更新并成功持久化后的配置副本
     * @throws IllegalArgumentException 请求体不是 JSON 对象，或字段为 null / 未知 / 类型错误 / 非法值
     * @throws IOException              原子落盘失败（旧内存配置与旧文件保持不变）
     */
    public synchronized DigitalHumanConfig updateConfig(JsonNode patch) throws IOException {
        if (patch == null || !patch.isObject()) {
            throw new IllegalArgumentException("请求体必须是 JSON 对象");
        }
        if (patch.size() == 0) {
            return copy(config);
        }

        DigitalHumanConfig candidate = copy(config);
        applyPatch(candidate, patch, true);
        try {
            save(candidate);
        } catch (IOException e) {
            log.warn("数字人配置原子写入失败，内存配置保持不变: {}", e.getMessage());
            throw e;
        }
        config = candidate;
        log.info("数字人配置已更新: name={}", candidate.getName());
        return copy(config);
    }

    /**
     * 加载磁盘配置；失败时降级为默认快照并保留原文件（REQ-038）。
     */
    private void load() {
        Path target = file.toPath();
        if (!Files.exists(target)) {
            config = new DigitalHumanConfig();
            try {
                save(config);
                log.info("数字人配置文件不存在，已写入默认配置");
            } catch (IOException e) {
                log.warn("数字人默认配置写入失败，本次以内存默认值运行（未持久化）: {}", e.getMessage());
            }
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(file);
            if (root == null || !root.isObject()) {
                throw new IllegalArgumentException("配置文件必须包含 JSON 对象");
            }
            DigitalHumanConfig loaded = new DigitalHumanConfig();
            // 加载时对历史文件宽松：未知字段忽略并记录警告，不因附加字段丢弃整份用户配置。
            applyPatch(loaded, root, false);
            config = loaded;
            log.info("数字人配置加载完成: {}", loaded.getName());
        } catch (IOException | IllegalArgumentException e) {
            config = new DigitalHumanConfig();
            log.warn("数字人配置读取失败或内容不合法，已降级为默认配置并保留原文件: {}", e.getMessage());
        }
    }

    /**
     * 把 JSON 对象中出现的字段应用到候选配置，并在最后执行整体校验/规范化。
     *
     * @param candidate          候选配置（调用方负责先复制当前快照）
     * @param patch              JSON 对象
     * @param rejectUnknownField 为 true 时未知字段直接拒绝（更新请求）；为 false 时忽略并告警（加载历史文件）
     */
    private void applyPatch(DigitalHumanConfig candidate, JsonNode patch, boolean rejectUnknownField) {
        Iterator<String> fieldNames = patch.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            JsonNode value = patch.get(field);
            switch (field) {
                case "name":
                    candidate.setName(readText(field, value));
                    break;
                case "welcomeMessage":
                    candidate.setWelcomeMessage(readText(field, value));
                    break;
                case "voiceType":
                    candidate.setVoiceType(readText(field, value));
                    break;
                case "modelName":
                    candidate.setModelName(readText(field, value));
                    break;
                case "primaryColor":
                    candidate.setPrimaryColor(readText(field, value));
                    break;
                case "volume":
                    candidate.setVolume(readNumber(field, value));
                    break;
                case "speechRate":
                    candidate.setSpeechRate(readNumber(field, value));
                    break;
                default:
                    if (rejectUnknownField) {
                        throw new IllegalArgumentException("不支持的配置字段: " + field);
                    }
                    log.warn("忽略配置文件中的未知字段: {}", field);
            }
        }
        normalizeAndValidate(candidate);
    }

    /**
     * 按 REQ-038 规则校验并规范化整份候选配置（trim、颜色小写、数值区间）。
     */
    private void normalizeAndValidate(DigitalHumanConfig candidate) {
        candidate.setName(normalizeText("name", candidate.getName(), NAME_MAX_LENGTH, false));
        candidate.setWelcomeMessage(normalizeText("welcomeMessage", candidate.getWelcomeMessage(),
                WELCOME_MESSAGE_MAX_LENGTH, true));
        candidate.setVoiceType(normalizeText("voiceType", candidate.getVoiceType(),
                VOICE_TYPE_MAX_LENGTH, false));
        candidate.setModelName(normalizeText("modelName", candidate.getModelName(),
                MODEL_NAME_MAX_LENGTH, false));
        candidate.setPrimaryColor(normalizeColor(candidate.getPrimaryColor()));
        candidate.setVolume(normalizeVolume(candidate.getVolume()));
        candidate.setSpeechRate(normalizeSpeechRate(candidate.getSpeechRate()));
    }

    /**
     * 读取文本字段的原始值，只接受 JSON 字符串；null 和数字/布尔/对象等类型都拒绝。
     */
    private static String readText(String field, JsonNode value) {
        if (value == null || value.isNull()) {
            throw new IllegalArgumentException("配置字段 " + field + " 不能为 null");
        }
        if (!value.isTextual()) {
            throw new IllegalArgumentException("配置字段 " + field + " 必须是字符串");
        }
        return value.textValue();
    }

    /**
     * 读取数值字段的原始值，只接受 JSON 数字；null 和字符串/布尔等类型都拒绝。
     */
    private static double readNumber(String field, JsonNode value) {
        if (value == null || value.isNull()) {
            throw new IllegalArgumentException("配置字段 " + field + " 不能为 null");
        }
        if (!value.isNumber()) {
            throw new IllegalArgumentException("配置字段 " + field + " 必须是数字");
        }
        return value.doubleValue();
    }

    /**
     * trim 后校验长度与控制字符；欢迎语额外允许 {@code '\n'} 与 {@code '\t'}。
     */
    private static String normalizeText(String field, String value, int maxLength, boolean allowLineBreaks) {
        if (value == null) {
            throw new IllegalArgumentException("配置字段 " + field + " 不能为 null");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("配置字段 " + field + " 不能为空");
        }
        if (trimmed.length() > maxLength) {
            throw new IllegalArgumentException("配置字段 " + field + " 长度不能超过 " + maxLength + " 个字符");
        }
        for (int i = 0; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (ch == '\n' || ch == '\t') {
                if (allowLineBreaks) {
                    continue;
                }
                throw new IllegalArgumentException("配置字段 " + field + " 不能包含换行或制表符");
            }
            if (Character.isISOControl(ch)) {
                throw new IllegalArgumentException("配置字段 " + field + " 不能包含控制字符");
            }
        }
        return trimmed;
    }

    /**
     * 主题色只接受 #RRGGBB，存储时统一小写，防止 CSS 注入。
     */
    private static String normalizeColor(String value) {
        if (value == null) {
            throw new IllegalArgumentException("配置字段 primaryColor 不能为 null");
        }
        if (!PRIMARY_COLOR_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException("配置字段 primaryColor 必须是 #RRGGBB 格式的十六进制颜色");
        }
        return value.toLowerCase(Locale.ROOT);
    }

    /**
     * 音量必须是有限数且位于 [0, 1]；0 是合法值，不能被隐式改成 1。
     */
    private static double normalizeVolume(double value) {
        if (!Double.isFinite(value) || value < 0.0 || value > 1.0) {
            throw new IllegalArgumentException("配置字段 volume 必须是 0 到 1 之间的有限数字");
        }
        return value;
    }

    /**
     * 语速必须是有限数且位于 [0.5, 2]。
     */
    private static double normalizeSpeechRate(double value) {
        if (!Double.isFinite(value) || value < 0.5 || value > 2.0) {
            throw new IllegalArgumentException("配置字段 speechRate 必须是 0.5 到 2 之间的有限数字");
        }
        return value;
    }

    /**
     * 原子持久化配置快照：同目录临时文件 + ATOMIC_MOVE 替换；平台不支持原子移动时退化为普通替换移动。
     *
     * <p>任何 {@link IOException} 都向上抛出，由控制层转换为 500，且调用方不会发布新内存快照。
     * 临时文件在 finally 中清理，避免落盘失败留下垃圾文件。
     *
     * @param snapshot 待持久化的配置快照
     * @throws IOException 目录创建、序列化或移动失败
     */
    private void save(DigitalHumanConfig snapshot) throws IOException {
        Path target = file.toPath();
        Path directory = target.getParent();
        if (directory == null) {
            directory = new File(".").getAbsoluteFile().toPath();
        }
        if (!Files.exists(directory)) {
            Files.createDirectories(directory);
        }
        Path temp = Files.createTempFile(directory, "config-", ".json.tmp");
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), snapshot);
            try {
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            try {
                Files.deleteIfExists(temp);
            } catch (IOException cleanupFailure) {
                log.warn("临时配置文件清理失败: {}", cleanupFailure.getMessage());
            }
        }
    }

    /**
     * 复制配置对象，保证外部拿到的永远是独立副本（REQ-038 副本语义）。
     */
    private static DigitalHumanConfig copy(DigitalHumanConfig source) {
        DigitalHumanConfig target = new DigitalHumanConfig();
        target.setName(source.getName());
        target.setWelcomeMessage(source.getWelcomeMessage());
        target.setVoiceType(source.getVoiceType());
        target.setModelName(source.getModelName());
        target.setPrimaryColor(source.getPrimaryColor());
        target.setVolume(source.getVolume());
        target.setSpeechRate(source.getSpeechRate());
        return target;
    }
}
