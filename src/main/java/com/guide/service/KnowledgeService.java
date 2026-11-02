package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.KnowledgeItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 知识库管理服务 — 读写 data/knowledge.json（REQ-035，GitHub #9）。
 *
 * <p>默认知识库不再是 Java 硬编码数据，而是 classpath 根部的打包资源
 * {@code knowledge.json}；该资源应与仓库 {@code data/knowledge.json} 内容一致
 * （防漂移检查见 scripts/check_data_integrity.py）。初始化规则见
 * docs/knowledge_integrity.md 第 3 条：</p>
 *
 * <ul>
 *   <li>外部知识文件不存在：使用打包默认库，并写入该路径（父目录不存在时创建，
 *       含无父目录的相对文件名）。</li>
 *   <li>外部知识文件存在且结构合法（包括合法空数组）：直接使用，不保存、不覆盖。</li>
 *   <li>外部文件读取/解析失败，或顶层 null、非数组、条目 null、ID 非法/重复、
 *       必填字段空白：降级为打包默认库，只记录 warn，绝不写出/覆盖坏文件。</li>
 *   <li>打包资源自身缺失、解析失败或结构非法：抛 {@link IllegalStateException}
 *       快速失败，不使用 Java 硬编码数据兜底。</li>
 * </ul>
 *
 * <p>结构校验只保证数据形状（非 null、正整数且唯一 ID、必填字符串非空白），
 * 不代表事实已核验；资料正文中的「课程示例资料，未完成事实核验」或「待补充」
 * 边界提示由数据文件自身承载。修改位置：本类；对应文档：docs/knowledge_integrity.md。</p>
 */
@Service
public class KnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeService.class);

    /** 打包默认知识库在 classpath 中的位置（REQ-035）。 */
    private static final String PACKAGED_KNOWLEDGE_RESOURCE = "knowledge.json";

    @Value("${data.knowledge-file:data/knowledge.json}")
    private String knowledgeFilePath;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private List<KnowledgeItem> items = new ArrayList<>();
    private final KnowledgeRetriever retriever = new KnowledgeRetriever();

    /**
     * 应用启动初始化入口（REQ-035）。行为矩阵见类注释与
     * docs/knowledge_integrity.md 第 3 条；异常语义由 {@link #load()} 决定。
     */
    @PostConstruct
    public void init() {
        load();
    }

    /**
     * 按「外部合法优先 / 缺文件写默认 / 坏文件降级且不覆盖 / 打包资源失败快速失败」
     * 加载知识库（REQ-035，docs/knowledge_integrity.md 第 3 条）。
     *
     * @throws IllegalStateException 打包默认资源缺失、解析失败或结构非法
     */
    private void load() {
        File external = new File(knowledgeFilePath);
        if (!external.exists()) {
            items = loadPackagedDefaultLibrary();
            save();
            log.info("外部知识库文件不存在，使用打包默认知识库 {} 条并尝试写入: {}",
                    items.size(), external.getAbsolutePath());
            return;
        }
        List<KnowledgeItem> externalItems = readExternalLibrary(external);
        if (externalItems != null) {
            items = externalItems;
            log.info("知识库加载完成，共 {} 条（来源：{}）", items.size(), external.getAbsolutePath());
            return;
        }
        log.warn("外部知识库文件无效，已降级为打包默认知识库且不覆盖原文件: {}", external.getAbsolutePath());
        items = loadPackagedDefaultLibrary();
    }

    /**
     * 读取并做最小结构校验外部知识文件（REQ-035）。任何读取、解析或结构问题都返回
     * {@code null}，由调用方降级到打包默认库；本方法绝不写入或修改外部文件
     * （docs/knowledge_integrity.md 第 3 条）。
     *
     * @param file 已确认存在的外部知识文件
     * @return 合法条目列表；文件不可用时返回 {@code null}
     */
    private List<KnowledgeItem> readExternalLibrary(File file) {
        try {
            JsonNode root = objectMapper.readTree(file);
            return parseLibrary(root, file.getAbsolutePath());
        } catch (IOException | RuntimeException e) {
            log.warn("外部知识库读取/解析/结构校验失败: {} ({})", file.getAbsolutePath(), e.getMessage());
            return null;
        }
    }

    /**
     * 将 JSON 树解析为知识条目并执行最小结构校验（REQ-035）。
     *
     * @param root   已解析的 JSON 树，必须是数组
     * @param source 数据来源描述，用于异常信息
     * @return 通过结构校验的条目列表（可为空列表，代表合法空库）
     * @throws IOException              顶层不是数组、条目不是对象或字段类型不匹配
     * @throws IllegalArgumentException 结构校验失败（null 条目、ID 非法/重复、必填字段空白）
     */
    private List<KnowledgeItem> parseLibrary(JsonNode root, String source) throws IOException {
        if (root == null || !root.isArray()) {
            throw new IOException("知识库顶层不是 JSON 数组: " + source);
        }
        List<KnowledgeItem> parsed = new ArrayList<>();
        for (JsonNode node : root) {
            if (node == null || !node.isObject()) {
                throw new IOException("知识库存在非对象条目: " + source);
            }
            JsonNode id = node.get("id");
            if (id == null || !id.isIntegralNumber() || !id.canConvertToInt() || id.intValue() <= 0) {
                throw new IOException("知识条目的 ID 必须为正整数: " + source);
            }
            for (String field : new String[] {"title", "category", "content", "keywords", "createTime"}) {
                JsonNode value = node.get(field);
                if (value == null || !value.isTextual()) {
                    throw new IOException("知识条目字段必须为字符串: " + field + " (" + source + ")");
                }
            }
            parsed.add(objectMapper.treeToValue(node, KnowledgeItem.class));
        }
        validateStructure(parsed, source);
        return parsed;
    }

    /**
     * 加载打包默认知识库 {@code classpath:knowledge.json}（REQ-035）。
     *
     * @return 打包默认条目列表
     * @throws IllegalStateException 资源缺失、解析失败或结构非法（快速失败，不用硬编码兜底，
     *                               见 docs/knowledge_integrity.md 第 3 条）
     */
    private List<KnowledgeItem> loadPackagedDefaultLibrary() {
        ClassPathResource resource = new ClassPathResource(PACKAGED_KNOWLEDGE_RESOURCE);
        if (!resource.exists()) {
            throw new IllegalStateException("打包默认知识库缺失: classpath:" + PACKAGED_KNOWLEDGE_RESOURCE);
        }
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            return parseLibrary(root, "classpath:" + PACKAGED_KNOWLEDGE_RESOURCE);
        } catch (IOException | IllegalArgumentException e) {
            throw new IllegalStateException("打包默认知识库不可用: classpath:" + PACKAGED_KNOWLEDGE_RESOURCE, e);
        }
    }

    /**
     * 最小结构校验（REQ-035，docs/knowledge_integrity.md 第 3/6 条）：列表非 null、
     * 条目非 null、ID 为正整数且唯一、title/category/content/keywords/createTime
     * 均非空白。只校验结构，不能证明事实正确。
     *
     * @param library 待校验条目列表
     * @param source  数据来源描述，用于异常信息
     * @throws IllegalArgumentException 任一条目不满足结构要求
     */
    private void validateStructure(List<KnowledgeItem> library, String source) {
        if (library == null) {
            throw new IllegalArgumentException("知识库列表为 null: " + source);
        }
        Set<Integer> seenIds = new HashSet<>();
        for (KnowledgeItem item : library) {
            if (item == null) {
                throw new IllegalArgumentException("知识库存在 null 条目: " + source);
            }
            if (item.getId() <= 0) {
                throw new IllegalArgumentException("知识条目的 ID 必须为正整数: " + source + ", id=" + item.getId());
            }
            if (!seenIds.add(item.getId())) {
                throw new IllegalArgumentException("知识条目的 ID 重复: " + source + ", id=" + item.getId());
            }
            requireNonBlank(item.getTitle(), "title", source);
            requireNonBlank(item.getCategory(), "category", source);
            requireNonBlank(item.getContent(), "content", source);
            requireNonBlank(item.getKeywords(), "keywords", source);
            requireNonBlank(item.getCreateTime(), "createTime", source);
        }
    }

    /**
     * 校验单个必填字符串字段非空白（REQ-035 最小结构校验）。
     *
     * @throws IllegalArgumentException 字段为 null 或全为空白字符
     */
    private void requireNonBlank(String value, String field, String source) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("知识条目必填字段为空: " + field + " (" + source + ")");
        }
    }

    /**
     * 保存当前知识库到 {@code data.knowledge-file}（REQ-035）。
     *
     * <p>支持不含父目录的相对文件名（通过绝对路径的父目录判断）；父目录不存在时尝试
     * 创建。目录创建或写入失败只记录 warn，不抛出异常，避免本地磁盘问题阻断启动与 API。</p>
     */
    private void save() {
        File file = new File(knowledgeFilePath);
        File parent = file.getAbsoluteFile().getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.exists()) {
            log.warn("知识库父目录创建失败: {}", parent.getAbsolutePath());
        }
        try {
            objectMapper.writeValue(file, items);
        } catch (IOException e) {
            log.warn("知识库保存失败: {} ({})", file.getAbsolutePath(), e.getMessage());
        }
    }

    // ===== 公共方法 =====

    public List<KnowledgeItem> getAll() {
        return items;
    }

    public List<KnowledgeItem> getByCategory(String category) {
        return items.stream()
                .filter(i -> i.getCategory().equals(category))
                .collect(Collectors.toList());
    }

    public Optional<KnowledgeItem> getById(int id) {
        return items.stream().filter(i -> i.getId() == id).findFirst();
    }

    public KnowledgeItem add(KnowledgeItem item) {
        // 自动分配ID
        int maxId = items.stream().mapToInt(KnowledgeItem::getId).max().orElse(0);
        item.setId(maxId + 1);
        if (item.getCreateTime() == null || item.getCreateTime().isEmpty()) {
            item.setCreateTime(java.time.LocalDate.now().toString());
        }
        items.add(item);
        save();
        return item;
    }

    public Optional<KnowledgeItem> update(int id, KnowledgeItem updated) {
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).getId() == id) {
                updated.setId(id);
                if (updated.getCreateTime() == null) {
                    updated.setCreateTime(items.get(i).getCreateTime());
                }
                items.set(i, updated);
                save();
                return Optional.of(updated);
            }
        }
        return Optional.empty();
    }

    public boolean delete(int id) {
        boolean removed = items.removeIf(i -> i.getId() == id);
        if (removed) save();
        return removed;
    }

    public List<KnowledgeItem> search(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) return items;
        String kw = keyword.trim();
        return items.stream()
                .filter(i -> i.getTitle().contains(kw) ||
                             i.getContent().contains(kw) ||
                             i.getKeywords().contains(kw) ||
                             i.getCategory().contains(kw))
                .collect(Collectors.toList());
    }

    /**
     * REQ-037: retrieve an immutable snapshot for one model/fallback exchange.
     * Ranking/budget policy is in KnowledgeRetriever; see docs/natural_retrieval.md.
     * Does not change admin search(), read history or mutate stored knowledge.
     */
    public KnowledgeRetrieval retrieve(String userMessage) {
        return retriever.retrieve(userMessage, new ArrayList<>(items));
    }

    /** REQ-037: compatible string-context entry point; empty means no supplied evidence. */
    public String retrieveRelevantContext(String userMessage) { return retrieve(userMessage).getContext(); }

    public int getCount() {
        return items.size();
    }
}
