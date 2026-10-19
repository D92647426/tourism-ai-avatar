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

@Service
public class SpotService {

    private List<Spot> spots = new ArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();    //Jackson 库提供的类，专门干 JSON 的活（Java 对象 ↔ JSON 互转）

    @PostConstruct
    public void loadSpots() {
        try {
            InputStream is = new ClassPathResource("spots.json").getInputStream();   //去 classpath 下找到 spots.json，打开，返回一个字节流，赋给 is。
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

    public String buildSpotContext() {
        StringBuilder sb = new StringBuilder();
        for (Spot s : spots) {
            sb.append("�?").append(s.getName()).append("】\n");
            sb.append("简介：").append(s.getBrief()).append("\n");
            sb.append("分类�?").append(s.getCategory()).append("\n");
            sb.append("历史�?").append(s.getHistory()).append("\n");
            sb.append("地址�?").append(s.getAddress()).append("\n");
            sb.append("开放时间：").append(s.getOpeningHours()).append("\n");
            sb.append("门票�?").append(s.getTicket()).append("\n");
            sb.append("交通：").append(s.getTransportation()).append("\n");
            sb.append("亮点�?").append(String.join("�?", s.getHighlights())).append("\n\n");
        }
        return sb.toString();
    }
}
