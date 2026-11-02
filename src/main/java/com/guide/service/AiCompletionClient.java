package com.guide.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * REQ-033：供应商模型调用的唯一公共边界。
 *
 * <p>任务：把原本散落在 {@link ChatService} 中的 OpenAI 兼容
 * {@code /chat/completions} 调用抽出来，供已有聊天与新增“讲解搭档”两个真实业务调用复用。
 * 它只负责“发一次请求并严格解析回复”，是否降级、提示语和来源标注由各业务服务决定。</p>
 *
 * <p>输入：{@code systemText}/{@code userText} 两段纯文本、{@code temperature} 与
 * {@code maxTokens}。{@code systemText} 由业务服务固定任务边界；{@code userText} 只承载
 * 未核验数据，调用方必须自行保证其不可提升为系统指令。</p>
 *
 * <p>输出：模型回复的去首尾空白纯文本，保证非空。若 HTTP 传输失败、响应不是合法 JSON、
 * {@code choices/message/content} 缺失或内容不是非空文本，则抛出运行时异常；本类不做自动重试，
 * 也不把供应商原始响应写入日志。</p>
 *
 * <p>配置：沿用 {@code ai.api-key}、{@code ai.base-url}、{@code ai.model}。
 * 连接上限 {@value #CONNECT_TIMEOUT_MILLIS} 毫秒、读取上限 {@value #READ_TIMEOUT_MILLIS} 毫秒；
 * 这是连接/读取时限，不声称是严格的整体模型计算截止时间。</p>
 *
 * <p>修改位置：供应商请求/响应格式与超时在本类；是否降级、输出长度和来源标注在
 * {@link ChatService} 与 {@link ExplorationCoachService}。</p>
 *
 * @see <a href="../../../../../docs/exploration_coach_design.md">docs/exploration_coach_design.md（REQ-033）</a>
 */
@Service
public class AiCompletionClient {

    private static final Logger log = LoggerFactory.getLogger(AiCompletionClient.class);

    /** 连接建立上限，单位毫秒；REQ-033 要求 3 秒。 */
    public static final int CONNECT_TIMEOUT_MILLIS = 3000;

    /** 读取响应上限，单位毫秒；REQ-033 要求 15 秒。 */
    public static final int READ_TIMEOUT_MILLIS = 15000;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String baseUrl;
    private final String model;

    /**
     * Spring 生产构造器：读取 {@code ai.*} 配置，并用带超时的默认 {@link RestTemplate} 创建客户端。
     *
     * <p>输入无（容器注入配置）；输出已配置好的客户端；不会发起网络请求。
     * 修改配置字段时同步更新 {@code docs/config_reference.md}。</p>
     *
     * @param apiKey  供应商标识（{@code ai.api-key}），空值表示未配置
     * @param baseUrl 供应商 API 基址（{@code ai.base-url}）
     * @param model   模型名（{@code ai.model}）
     */
    @Autowired
    public AiCompletionClient(@Value("${ai.api-key:}") String apiKey,
                              @Value("${ai.base-url:https://api.deepseek.com/v1}") String baseUrl,
                              @Value("${ai.model:deepseek-chat}") String model) {
        this(buildDefaultRestTemplate(), apiKey, baseUrl, model);
    }

    /**
     * 可注入 {@link RestTemplate} 的构造器，供测试绑定 {@code MockRestServiceServer} 使用。
     *
     * <p>输入为显式的外部依赖与配置；输出客户端实例；不访问网络。生产代码请使用
     * {@link #AiCompletionClient(String, String, String)}，以保证超时配置生效。</p>
     *
     * @param restTemplate 调用供应商用的 {@link RestTemplate}，测试时可注入假服务器
     * @param apiKey       供应商标识，允许 {@code null}/空（表示未配置）
     * @param baseUrl      供应商 API 基址，允许 {@code null}
     * @param model        模型名，允许 {@code null}
     */
    public AiCompletionClient(RestTemplate restTemplate, String apiKey, String baseUrl, String model) {
        if (restTemplate == null) {
            throw new IllegalArgumentException("restTemplate 不能为空");
        }
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.model = model == null ? "" : model.trim();
    }

    /**
     * 创建生产用 {@link RestTemplate}，显式设置连接/读取超时（不自动重试）。
     *
     * <p>输入无；输出新建的 {@link RestTemplate}；不发起请求。测试通过反射检查这个
     * 实例的请求工厂字段，验证 REQ-033 的 3 秒/15 秒传输时限。修改超时值请同步修改
     * 本方法使用的常量。</p>
     *
     * @return 带连接/读取时限的模板，供 {@link #AiCompletionClient(String, String, String)} 使用
     */
    static RestTemplate buildDefaultRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        requestFactory.setReadTimeout(READ_TIMEOUT_MILLIS);
        return new RestTemplate(requestFactory);
    }

    /**
     * 是否已配置模型凭据；为 {@code false} 时业务服务必须直接使用本地提示，禁止发起调用。
     *
     * <p>输入无；输出布尔值。空字符串或空白 Key 视为未启用；仅检查凭据，不发起网络请求。</p>
     *
     * @return 已配置非空 {@code ai.api-key} 时为 {@code true}
     */
    public boolean isEnabled() {
        return !apiKey.isEmpty();
    }

    /**
     * 调用一次 OpenAI 兼容的 {@code chat/completions} 接口并返回严格校验后的纯文本回复。
     *
     * <p>输入：固定的系统边界文本与用户数据文本（两者都必须非空；{@code userText} 由业务服务
     * 标注为未核验数据）、温度与最大 token 数。输出：去首尾空白、保证非空的回复文本。
     * 异常：未配置凭据抛 {@link IllegalStateException}；参数非法抛 {@link IllegalArgumentException}；
     * 网络/HTTP 错误抛 Spring 的 {@code RestClientException} 子类；响应结构不合法或内容为空抛
     * {@link IllegalStateException}。调用方必须自行降级。</p>
     *
     * <p>安全：不自动重试；日志不输出 Key、用户文本或供应商完整响应，只记录异常类型名。
     * 修改请求格式/严格校验在本方法；修改超时请修改 {@link #buildDefaultRestTemplate()}。</p>
     *
     * @param systemText  系统任务边界文本，不能包含用户数据
     * @param userText    用户侧未核验数据文本
     * @param temperature 采样温度，原样传给供应商
     * @param maxTokens   最大生成 token 数，原样传给供应商
     * @return 非空纯文本模型回复（已去除首尾空白）
     */
    public String complete(String systemText, String userText, double temperature, int maxTokens) {
        return completeWithHistory(systemText, userText, java.util.Collections.emptyList(), temperature, maxTokens);
    }

    /** REQ-039: same bounded transport and strict parsing with server-validated prior turns.
     * Inputs: system/current user and bounded history; output/errors as complete(). See docs/conversation_context.md. */
    public String completeWithHistory(String systemText, String userText, java.util.List<ChatService.Turn> history,
                                      double temperature, int maxTokens) {
        if (!isEnabled()) {
            throw new IllegalStateException("未配置 ai.api-key，不能调用模型");
        }
        if (systemText == null || systemText.trim().isEmpty()) {
            throw new IllegalArgumentException("systemText 不能为空");
        }
        if (userText == null) {
            throw new IllegalArgumentException("userText 不能为空");
        }

        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", model);
        requestBody.put("temperature", temperature);
        requestBody.put("max_tokens", maxTokens);

        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(messageNode("system", systemText));
        for (ChatService.Turn turn : history) messages.add(messageNode(turn.role, turn.content));
        messages.add(messageNode("user", userText));
        requestBody.set("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);
        try {
            // 用 byte[] 接收并按 UTF-8 解码，避免供应商未声明 charset 时被默认字符集解码成乱码。
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    baseUrl + "/chat/completions", HttpMethod.POST, entity, byte[].class);
            return extractReply(response.getBody());
        } catch (RuntimeException e) {
            // 只记录异常类型，避免把供应商响应（可能含用户内容）写进日志。
            log.warn("模型调用失败，由业务服务决定是否降级: {}", e.getClass().getSimpleName());
            throw e;
        }
    }

    private ObjectNode messageNode(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        node.put("content", content);
        return node;
    }

    /**
     * 严格解析供应商响应：choices 必须是非空数组，message 必须是对象，content 必须是非空文本。
     *
     * @param responseBody 供应商原始响应字节，按 UTF-8 解码
     */
    private String extractReply(byte[] responseBody) {
        if (responseBody == null || responseBody.length == 0) {
            throw new IllegalStateException("模型响应为空");
        }
        String responseText = new String(responseBody, StandardCharsets.UTF_8);
        if (responseText.trim().isEmpty()) {
            throw new IllegalStateException("模型响应为空");
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(responseText);
        } catch (IOException e) {
            throw new IllegalStateException("模型响应不是合法 JSON", e);
        }
        if (root == null || !root.isObject()) {
            throw new IllegalStateException("模型响应不是 JSON 对象");
        }
        JsonNode choices = root.get("choices");
        if (choices == null || !choices.isArray() || choices.size() == 0) {
            throw new IllegalStateException("模型响应缺少 choices");
        }
        JsonNode firstChoice = choices.get(0);
        if (firstChoice == null || !firstChoice.isObject()) {
            throw new IllegalStateException("模型响应 choices 结构不合法");
        }
        JsonNode message = firstChoice.get("message");
        if (message == null || !message.isObject()) {
            throw new IllegalStateException("模型响应缺少 message");
        }
        JsonNode content = message.get("content");
        if (content == null || !content.isTextual()) {
            throw new IllegalStateException("模型响应 content 不是文本");
        }
        String text = content.asText().trim();
        if (text.isEmpty()) {
            throw new IllegalStateException("模型响应 content 为空");
        }
        return text;
    }
}
