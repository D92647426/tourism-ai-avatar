package com.guide.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 已登录但无权限（或 CSRF 校验失败）时返回 JSON 403。
 *
 * <p>游客访问管理接口、缺少/错误 CSRF token 都会进入这里；两种情况都是 403，
 * 但错误提示与匿名访问的 401 可以区分（REQ-030 / GitHub #5）。
 *
 * <p>错误行为见 [API 说明](../../../../../docs/api_reference.md)。
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        String message;
        if (accessDeniedException instanceof CsrfException) {
            message = "CSRF 校验失败，请刷新页面后重试";
        } else {
            message = "无权限访问该接口";
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(response.getWriter(), body);
    }
}
