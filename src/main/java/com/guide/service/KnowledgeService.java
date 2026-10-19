package com.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.guide.model.KnowledgeItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 知识库管理服务 — 读写 data/knowledge.json
 */
@Service
public class KnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeService.class);

    @Value("${data.knowledge-file:data/knowledge.json}")
    private String knowledgeFilePath;

    private final ObjectMapper objectMapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private List<KnowledgeItem> items = new ArrayList<>();

    @PostConstruct
    public void init() {
        objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        load();
    }

    private void load() {
        try {
            File file = new File(knowledgeFilePath);
            if (file.exists()) {
                items = objectMapper.readValue(file, new TypeReference<List<KnowledgeItem>>() {});
                log.info("知识库加载完成，共 {} 条", items.size());
            } else {
                initDefaultData();
                save();
                log.info("初始化默认知识库数据");
            }
        } catch (IOException e) {
            log.warn("知识库文件读取失败，使用默认数据: {}", e.getMessage());
            initDefaultData();
        }
    }

    private void save() {
        try {
            File file = new File(knowledgeFilePath);
            if (!file.getParentFile().exists()) {
                file.getParentFile().mkdirs();
            }
            objectMapper.writeValue(file, items);
        } catch (IOException e) {
            log.error("知识库保存失败: {}", e.getMessage());
        }
    }

    private void initDefaultData() {
        items = new ArrayList<>();
        // 历史人文类
        items.add(createItem(1, "灵山胜境的历史渊源", "文史资料",
            "灵山胜境坐落于江苏省无锡市太湖西北部的马山镇，占地面积约30万平方米，是国家5A级旅游景区。" +
            "景区的历史可追溯至1300多年前的唐代贞观年间。唐贞观年间，玄奘法师西行取经归来途经马山，" +
            "见此地山形酷似印度灵鹫山，遂命名为小灵山，并嘱咐大弟子窥基法师在此住持道场，兴建小灵山庵，奠定了此地的佛教根基。",
            "灵山历史,历史渊源,来历,起源,唐代,玄奘",
            "2024-01-01"));
        items.add(createItem(2, "祥符禅寺的千年兴衰", "文史资料",
            "小灵山庵历经数百年发展，至北宋大中祥符年间，宋真宗赐额祥符禅寺，成为江南名刹。" +
            "此后千年间历经多次兴废：南宋时曾遭兵燹，元代重建；明代达到鼎盛；清末民初毁于战火，" +
            "仅存千年银杏、六角古井和残垣断壁。这棵千年银杏至今仍枝繁叶茂，是灵山胜境最古老的生命见证。",
            "祥符禅寺,千年兴衰,历史,古刹,银杏,古井",
            "2024-01-01"));
        items.add(createItem(3, "五方五佛的理念", "文史资料",
            "中国佛教协会会长赵朴初提出五方五佛之论：香港天坛大佛（南）、四川乐山大佛（西）、" +
            "山西云冈大佛（北）、河南龙门大佛（中）、无锡灵山大佛（东）。" +
            "灵山大佛填补了东方大佛的空缺，五大佛像共同构成了中国佛教的完整格局。",
            "五方五佛,赵朴初,天坛大佛,乐山大佛,云冈大佛,龙门大佛",
            "2024-01-01"));

        // 景点讲解类
        items.add(createItem(4, "灵山大佛详解", "景点讲解",
            "灵山大佛高88米（主体79米+莲花瓣9米），含台基总高101.5米，耗铜量达725吨，是世界最高露天青铜释迦牟尼立像。" +
            "佛像面朝太湖，背靠灵山，右手施无畏印代表除众生苦，左手施与愿印代表予众生乐。" +
            "攀登216级台阶（象征108烦恼与108愿望）可至佛脚平台抱佛脚祈福。大佛于1997年11月15日落成开光。",
            "灵山大佛,88米,青铜,216台阶,抱佛脚,五方五佛",
            "2024-01-01"));
        items.add(createItem(5, "灵山梵宫——佛教艺术的卢浮宫", "景点讲解",
            "灵山梵宫建筑面积达72000㎡，被誉为东方卢浮宫。汇集东阳木雕、敦煌壁画、扬州漆器、景泰蓝须弥灯等传统工艺。" +
            "中庭28米高星空穹顶镶嵌数万颗LED灯。核心藏品《华藏世界》琉璃画宽8米高10米，" +
            "由160块彩色琉璃拼接而成，是世界最大琉璃艺术品之一。梵宫是世界佛教论坛永久会址。",
            "灵山梵宫,卢浮宫,东阳木雕,琉璃,华藏世界,世界佛教论坛",
            "2024-01-01"));

        // 常见问题类
        items.add(createItem(6, "灵山胜境游览最佳时间", "常见问题",
            "春秋季节（3-5月、9-11月）是游览灵山胜境的最佳时节，气候宜人，温度适中。" +
            "春季有樱花、桃花盛开，秋季有银杏金黄。建议上午9点前入园避开人流高峰，下午可观赏太湖日落。" +
            "九龙灌浴每日4-5场表演，《灵山吉祥颂》演出每日10:35、11:30、14:00、16:00（以景区公告为准），时长20分钟。",
            "最佳时间,什么时候,季节,演出时间,九龙灌浴,吉祥颂",
            "2024-01-01"));
        items.add(createItem(7, "灵山胜境门票与交通指南", "常见问题",
            "灵山胜境景区实行一票制，建议提前在线购票。交通方式：公交88路、89路至灵山胜境站；" +
            "自驾经沪宁高速至无锡马山镇。景区提供导游讲解服务300元起。" +
            "建议穿着舒适运动鞋，景区步行较多。注意景区为佛教场所，请保持安静，尊重宗教信仰，部分区域禁止拍照。",
            "门票,交通,怎么去,公交,自驾,停车,导游,注意事项",
            "2024-01-01"));
        items.add(createItem(8, "灵山祈福文化体验", "常见问题",
            "灵山胜境的祈福体验丰富多彩：在佛手广场触摸天下第一掌（大佛右手复制品，高11.7米），寓意沾福气保平安；" +
            "登216级台阶抱佛脚祈福；在九龙灌浴接取圣水；在五印坛城转动108个转经筒，寓意转经一圈福慧双增。" +
            "百子戏弥勒雕塑前拍照，寓意多子多福、家庭和睦。",
            "祈福,抱佛脚,天下第一掌,圣水,转经筒,百子戏弥勒",
            "2024-01-01"));
    }

    private KnowledgeItem createItem(int id, String title, String category, String content, String keywords, String time) {
        KnowledgeItem item = new KnowledgeItem();
        item.setId(id);
        item.setTitle(title);
        item.setCategory(category);
        item.setContent(content);
        item.setKeywords(keywords);
        item.setCreateTime(time);
        return item;
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
     * 检索与用户消息相关的知识条目，用于增强 AI 回答
     */
    public String retrieveRelevantContext(String userMessage) {
        if (userMessage == null || userMessage.trim().isEmpty()) return "";
        List<KnowledgeItem> relevant = search(userMessage);
        if (relevant.size() > 3) {
            relevant = relevant.subList(0, 3); // 最多取3条
        }
        if (relevant.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("【知识库参考资料】\n");
        for (KnowledgeItem item : relevant) {
            sb.append("- [").append(item.getTitle()).append("] ");
            sb.append(item.getContent().substring(0, Math.min(200, item.getContent().length())));
            sb.append("\n");
        }
        return sb.toString();
    }

    public int getCount() {
        return items.size();
    }
}
