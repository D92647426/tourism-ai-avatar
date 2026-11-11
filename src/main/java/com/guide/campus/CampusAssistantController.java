package com.guide.campus;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.servlet.http.HttpSession;

/** REQ-055: same-origin campus API. Existing SecurityConfig protects every POST with CSRF. */
@RestController
@RequestMapping("/api/campus")
public class CampusAssistantController {
    private final CampusCatalog catalog;
    private final CampusAssistantService service;
    public CampusAssistantController(CampusCatalog catalog, CampusAssistantService service) {
        this.catalog = catalog;
        this.service = service;
    }

    @GetMapping("/catalog")
    public ObjectNode catalog() { return catalog.snapshot(); }

    @GetMapping("/context")
    public ObjectNode context(HttpSession session) { return service.current(session); }

    @PostMapping("/chat")
    public ObjectNode chat(@RequestBody ObjectNode request, HttpSession session) { return service.chat(session, request); }

    @PostMapping("/new")
    public ObjectNode start(HttpSession session) { return service.start(session); }

    @PostMapping("/cancel")
    public ObjectNode cancel(@RequestBody ObjectNode request, HttpSession session) { return service.cancel(session, request); }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ObjectNode> invalid(ResponseStatusException error) {
        ObjectNode body = new ObjectMapper().createObjectNode();
        body.put("code", error.getReason());
        body.put("message", error.getStatus().value() == 409 ? "本轮已取消、会话已变化或请求仍在处理中，请同步当前对话状态。" : "请求字段无效，请检查输入。");
        return ResponseEntity.status(error.getStatus()).body(body);
    }
}
