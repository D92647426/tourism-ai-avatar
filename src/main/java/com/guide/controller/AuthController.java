package com.guide.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.guide.dto.AuthResult;
import com.guide.model.User;
import com.guide.security.PasswordPolicy;
import com.guide.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证接口：CSRF token、注册、登录、当前身份与兴趣更新。
 *
 * <p>安全约定（REQ-030 / GitHub #5）：
 * <ul>
 *   <li>登录成功后在服务端 HttpSession 建立认证上下文，并更换 session id；</li>
 *   <li>注册永远创建游客，客户端传入的 {@code role} 字段被忽略；</li>
 *   <li>响应统一使用安全 DTO，不返回 {@code password}/{@code passwordHash}；</li>
 *   <li>兴趣更新以服务端登录身份为准，忽略客户端传入的 {@code userId}。</li>
 * </ul>
 *
 * <p>文档：[API 说明](../../../../../docs/api_reference.md)。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AuthenticationManager authenticationManager;

    public AuthController(UserService userService, AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.authenticationManager = authenticationManager;
    }

    /**
     * 浏览器取 CSRF token：返回 header 名、参数名与 token 值，同时写入 XSRF-TOKEN Cookie。
     *
     * @param csrfToken 框架注入的 CSRF token
     * @return token 信息
     */
    @GetMapping("/csrf")
    public ResponseEntity<Map<String, Object>> csrf(CsrfToken csrfToken) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("headerName", csrfToken.getHeaderName());
        body.put("parameterName", csrfToken.getParameterName());
        body.put("token", csrfToken.getToken());
        return ResponseEntity.ok(body);
    }

    /**
     * 注册普通游客账号；成功后直接建立服务端会话，方便继续选择兴趣。
     *
     * @param request  注册请求（只读取 username/password）
     * @param httpRequest HTTP 请求，用于建立会话
     * @return 安全 DTO
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResult> register(@RequestBody RegisterRequest request,
                                               HttpServletRequest httpRequest) {
        String username = request.username == null ? "" : request.username.trim();
        String password = request.password;
        if (username.length() < 2 || username.length() > 20) {
            return ResponseEntity.badRequest().body(AuthResult.error("用户名需为 2-20 个字符"));
        }
        String policyError = PasswordPolicy.validateGuestPassword(password);
        if (policyError != null) {
            return ResponseEntity.badRequest().body(AuthResult.error(policyError));
        }
        User user = userService.register(username, password);
        if (user == null) {
            return ResponseEntity.badRequest().body(AuthResult.error("用户名已存在"));
        }
        establishSession(httpRequest, user);
        return ResponseEntity.ok(AuthResult.ok(user));
    }

    /**
     * 用户名密码登录；成功后建立服务端会话并返回角色。
     *
     * @param request     登录请求
     * @param httpRequest HTTP 请求，用于会话固定防护
     * @return 安全 DTO；凭据错误时 401
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResult> login(@RequestBody LoginRequest request,
                                            HttpServletRequest httpRequest) {
        String username = request.username == null ? "" : request.username.trim();
        String password = request.password;
        if (username.isEmpty() || password == null || password.isEmpty()) {
            return ResponseEntity.status(401).body(AuthResult.error("用户名或密码错误"));
        }
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(AuthResult.error("用户名或密码错误"));
        }
        User user = userService.findByUsername(username);
        if (user == null) {
            return ResponseEntity.status(401).body(AuthResult.error("用户名或密码错误"));
        }
        establishSession(httpRequest, user);
        return ResponseEntity.ok(AuthResult.ok(user));
    }

    /**
     * 返回当前服务端会话身份；未登录由安全框架返回 401。
     *
     * @param authentication 当前认证信息
     * @return 安全 DTO
     */
    @GetMapping("/me")
    public ResponseEntity<AuthResult> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(AuthResult.error("未登录或会话已过期"));
        }
        User user = userService.findByUsername(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).body(AuthResult.error("会话对应的用户不存在，请重新登录"));
        }
        return ResponseEntity.ok(AuthResult.ok(user));
    }

    /**
     * 更新当前登录用户的兴趣偏好；请求体中的 userId 一律忽略。
     *
     * @param request        兴趣请求
     * @param authentication 当前认证信息
     * @return 安全 DTO
     */
    @PostMapping("/interest")
    public ResponseEntity<AuthResult> updateInterest(@RequestBody InterestRequest request,
                                                     Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(AuthResult.error("未登录或会话已过期"));
        }
        User user = userService.findByUsername(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).body(AuthResult.error("会话对应的用户不存在，请重新登录"));
        }
        String interest = request.interest == null ? "" : request.interest.trim();
        if (interest.isEmpty()) {
            return ResponseEntity.badRequest().body(AuthResult.error("兴趣偏好不能为空"));
        }
        User updated = userService.updateInterest(user.getId(), interest);
        return ResponseEntity.ok(AuthResult.ok(updated));
    }

    /**
     * 在服务端建立认证会话，并更换 session id 防止会话固定攻击。
     *
     * @param request HTTP 请求
     * @param user    已认证用户
     */
    private void establishSession(HttpServletRequest request, User user) {
        HttpSession existing = request.getSession(false);
        if (existing != null) {
            request.changeSessionId();
        } else {
            request.getSession(true);
        }
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(user.getUsername(), null,
                        Collections.singletonList(
                                new SimpleGrantedAuthority("ROLE_" + user.getRole())));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }

    /** 注册请求体：只接受用户名与密码，忽略 role 等其它字段。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegisterRequest {
        public String username;
        public String password;
    }

    /** 登录请求体。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LoginRequest {
        public String username;
        public String password;
    }

    /** 兴趣请求体：只接受兴趣字段，userId 被忽略。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InterestRequest {
        public String interest;
    }
}
