package com.guide.config;

import com.guide.security.RestAccessDeniedHandler;
import com.guide.security.RestAuthenticationEntryPoint;
import com.guide.service.UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.savedrequest.NullRequestCache;

/**
 * Spring Security 配置（REQ-030 / GitHub #5）。
 *
 * <p>关键边界：
 * <ul>
 *   <li>{@code /api/admin/**} 必须 ADMIN，匿名 401、游客 403；</li>
 *   <li>用户身份来自服务端 HttpSession，不使用自制 Token 或前端 userId；</li>
 *   <li>所有基于 Cookie 的状态变更走框架 CSRF（Cookie 双提交），
 *       匿名写管理接口在携带合法 CSRF 时返回 401，游客返回 403；</li>
 *   <li>登录与退出通过 {@link HttpSecurity#logout()} 使服务端会话失效；</li>
 *   <li>首页、静态资源、景点、公开数字人配置与离线问答保持可访问。</li>
 * </ul>
 *
 * <p>文档：[架构说明](../../../../../docs/architecture.md)、
 * [API 说明](../../../../../docs/api_reference.md)、
 * [配置说明](../../../../../docs/config_reference.md)。
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    public SecurityConfig(RestAuthenticationEntryPoint authenticationEntryPoint,
                          RestAccessDeniedHandler accessDeniedHandler) {
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
    }

    /**
     * 密码编码器：全项目统一使用 BCrypt，不保存明文。
     *
     * @return BCrypt 编码器
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 从服务端用户记录装载身份和角色；管理员身份只来自用户记录，不信任客户端。
     *
     * @param userService 用户服务
     * @return Spring Security 用户详情服务
     */
    @Bean
    public UserDetailsService userDetailsService(final UserService userService) {
        return username -> {
            com.guide.model.User user = userService.findByUsername(username);
            if (user == null || user.getPasswordHash() == null || user.getPasswordHash().isEmpty()) {
                throw new UsernameNotFoundException("用户名或密码错误");
            }
            return org.springframework.security.core.userdetails.User
                    .withUsername(user.getUsername())
                    .password(user.getPasswordHash())
                    .authorities("ROLE_" + user.getRole())
                    .build();
        };
    }

    /**
     * 登录认证管理器，使用上面的用户详情服务与 BCrypt 校验。
     *
     * @param userDetailsService 用户详情服务
     * @param passwordEncoder    密码编码器
     * @return 认证管理器
     */
    @Bean
    public AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
                                                       PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    /**
     * 安全过滤链：管理接口 ADMIN、登录用户接口 authenticated、其余公开。
     *
     * @param http Spring Security 构建器
     * @return 过滤链
     * @throws Exception 配置失败
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CSRF：Cookie 双提交，前端从 GET /api/auth/csrf 取 token 后放入 X-XSRF-TOKEN。
        http.csrf().csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse());

        http.httpBasic().disable();
        http.formLogin().disable();
        http.requestCache().requestCache(new NullRequestCache());

        // 退出登录：使服务端会话失效并清理 Cookie（POST，受 CSRF 保护）。
        http.logout()
                .logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID", "XSRF-TOKEN")
                .logoutSuccessHandler((request, response, authentication) -> {
                    response.setStatus(200);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"success\":true,\"message\":\"已退出登录\"}");
                });

        // 会话固定攻击防护：登录时更换 session id。
        http.sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                .sessionFixation().changeSessionId();

        http.exceptionHandling()
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler);

        http.authorizeRequests()
                .antMatchers("/api/admin/**").hasRole("ADMIN")
                .antMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                .antMatchers(HttpMethod.POST, "/api/auth/interest").authenticated()
                .antMatchers(HttpMethod.POST, "/api/speech/synthesize").authenticated()
                .anyRequest().permitAll();

        return http.build();
    }
}
