//景点服务

package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.guide.model.Spot;
import javax.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 景点服务 — 读取打包的 spots.json，并提供景点查询与资料上下文。
 *
 * <p>REQ-035（GitHub #9）：修正景点上下文的【名称】、分类：、历史：、地址：、门票：、亮点：
 * 标签与「、」分隔符，关闭 ClassPathResource 的输入流，并在每个景点块统一声明资料为
 * 未核验的静态课程示例；见 {@code docs/knowledge_integrity.md} 第 4 条。</p>
 */
@Service
public class SpotService {

    /** 景点资料统一声明（REQ-035 第 4 条）：不把课程示例当作已核验或实时信息。 */
    private static final String SAMPLE_NOTICE =
            "（以下为本项目未核验的静态课程示例资料，开放时间、票价、交通等可能变动，请以景区公告为准）";

    /** 开放时间按示例字段标注（REQ-035 第 4 条）。 */
    private static final String LABEL_OPENING_HOURS = "开放时间（示例字段，请以景区公告为准）：";

    /** 门票按示例字段标注（REQ-035 第 4 条）。 */
    private static final String LABEL_TICKET = "门票（示例字段，请以景区公告为准）：";

    /** 交通按示例字段标注（REQ-035 第 4 条）。 */
    private static final String LABEL_TRANSPORTATION = "交通（示例字段，请以景区公告为准）：";

    /** 亮点分隔符：可读中文顿号（REQ-035 第 4 条，修复原有替换字符）。 */
    private static final String HIGHLIGHT_SEPARATOR = "、";

    private List<Spot> spots = new ArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();    //Jackson 库提供的类，专门干 JSON 的活（Java 对象 ↔ JSON 互转）

    /**
     * 从 classpath 加载 spots.json。
     *
     * <p>REQ-035 第 4 条：使用 try-with-resources 确保 ClassPathResource 的输入流被关闭，
     * 避免资源泄漏；见 {@code docs/knowledge_integrity.md}。</p>
     */
    @PostConstruct
    public void loadSpots() {
        try (InputStream is = new ClassPathResource("spots.json").getInputStream()) {   //去 classpath 下找到 spots.json，打开，返回一个字节流；try-with-resources 负责关闭
            spots = objectMapper.readValue(is, new TypeReference<List<Spot>>() {});  //JSON → List<Spot>
        } catch (Exception e) {
            throw new RuntimeException("加载景点数据失败", e);
        }
    }

    public List<Spot> getAllSpots() {
        return spots;
    }

    public Optional<Spot> getSpotById(int id) {
        return spots.stream().filter(s -> s.getId() == id).findFirst();
    }

    public List<Spot> searchSpots(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) return spots;
        return spots.stream()
                .filter(s -> s.getName().contains(keyword) ||
                             s.getBrief().contains(keyword) ||
                             s.getCategory().contains(keyword))
                .collect(Collectors.toList());
    }

    /**
     * 构造供系统提示使用的景点资料上下文。
     *
     * <p>REQ-035 第 4 条：每个景点块以【景点名】开头，随后统一声明为未核验的静态课程示例，
     * 再输出简介/分类/历史/地址/开放时间/门票/交通/亮点全部字段；开放时间、门票、交通按
     * 示例字段标注，不推断实时状态；亮点用「、」连接。保留全部资料字段，不新增景区事实；
     * 见 {@code docs/knowledge_integrity.md} 第 4 条。</p>
     *
     * @return 全部景点的资料上下文文本
     */
    public String buildSpotContext() {
        StringBuilder sb = new StringBuilder();
        for (Spot s : spots) {
            sb.append("【").append(s.getName()).append("】\n");
            sb.append(SAMPLE_NOTICE).append("\n");
            sb.append("简介：").append(s.getBrief()).append("\n");
            sb.append("分类：").append(s.getCategory()).append("\n");
            sb.append("历史：").append(s.getHistory()).append("\n");
            sb.append("地址：").append(s.getAddress()).append("\n");
            sb.append(LABEL_OPENING_HOURS).append(s.getOpeningHours()).append("\n");
            sb.append(LABEL_TICKET).append(s.getTicket()).append("\n");
            sb.append(LABEL_TRANSPORTATION).append(s.getTransportation()).append("\n");
            sb.append("亮点：").append(joinHighlights(s.getHighlights())).append("\n\n");
        }
        return sb.toString();
    }

    /**
     * 用「、」连接景点亮点，空列表返回空串。
     */
    private String joinHighlights(List<String> highlights) {
        if (highlights == null) return "";
        return String.join(HIGHLIGHT_SEPARATOR, highlights);
    }
}
