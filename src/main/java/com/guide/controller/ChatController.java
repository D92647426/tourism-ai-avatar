package com.guide.controller;

import com.guide.model.ChatRequest;
import com.guide.model.ChatResponse;
import com.guide.service.ConversationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpSession;

/**
 * 聊天 API 控制器
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    private final ConversationService conversationService;

    public ChatController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, HttpSession session) {
        ChatResponse response = conversationService.chat(session, request);
        return ResponseEntity.ok(response);
    }

    /** REQ-039: deliberately drop the current context, protected by existing CSRF rules. */
    @PostMapping("/chat/new")
    public ResponseEntity<ConversationService.Snapshot> start(HttpSession session) {
        return ResponseEntity.ok(conversationService.start(session));
    }
}
