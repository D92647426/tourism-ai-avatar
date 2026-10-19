package com.guide.controller;

import com.guide.model.ChatRequest;
import com.guide.model.ChatResponse;
import com.guide.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 聊天 API 控制器
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        ChatResponse response = chatService.chat(request.getMessage(), request.getInterest());
        return ResponseEntity.ok(response);
    }
}
