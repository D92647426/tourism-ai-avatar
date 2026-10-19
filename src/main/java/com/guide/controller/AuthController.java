package com.guide.controller;

import com.guide.model.User;
import com.guide.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 用户认证控制器
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        Map<String, Object> result = new HashMap<>();

        if (username == null || username.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "用户名和密码不能为空");
            return ResponseEntity.badRequest().body(result);
        }

        if (username.length() < 2 || username.length() > 20) {
            result.put("success", false);
            result.put("message", "用户名需 2-20 个字符");
            return ResponseEntity.badRequest().body(result);
        }

        if (password.length() < 4) {
            result.put("success", false);
            result.put("message", "密码至少 4 位");
            return ResponseEntity.badRequest().body(result);
        }

        User user = userService.register(username.trim(), password);
        if (user == null) {
            result.put("success", false);
            result.put("message", "用户名已存在");
            return ResponseEntity.badRequest().body(result);
        }

        result.put("success", true);
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        Map<String, Object> result = new HashMap<>();
        User user = userService.login(username, password);

        if (user == null) {
            result.put("success", false);
            result.put("message", "用户名或密码错误");
            return ResponseEntity.status(401).body(result);
        }

        result.put("success", true);
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("interest", user.getInterest() != null ? user.getInterest() : "");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/interest")
    public ResponseEntity<Map<String, Object>> setInterest(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String interest = body.get("interest");

        Map<String, Object> result = new HashMap<>();
        User user = userService.updateInterest(userId, interest);

        if (user == null) {
            result.put("success", false);
            result.put("message", "用户不存在");
            return ResponseEntity.badRequest().body(result);
        }

        result.put("success", true);
        return ResponseEntity.ok(result);
    }
}
