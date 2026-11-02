# 当前架构：老师提供的 Java 项目

## 结构

浏览器中的 HTML/CSS/JavaScript 和 Live2D → Spring Security 过滤链（会话、角色、CSRF）→ Spring Boot 控制器 → 聊天、知识、景点、配置、用户、统计服务 → JSON 文件。

模型调用由 AiCompletionClient 统一连接 DeepSeek 兼容接口，供 ChatService 与 ExplorationCoachService 使用，未配置 Key 时使用本地匹配回答。Android 使用 WebView 与同一网页配合，并桥接系统语音识别与播报。

## 位置与边界

| 模块 | 实现 | 位置 |
|---|---|---|
| 应用入口 | Spring Boot 启动，默认 8080 | [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1) |
| 聊天 | 单次问题与资料拼接，兴趣对应预设路线 | [ChatService.java:L41](../src/main/java/com/guide/service/ChatService.java#L41) |
| 知识 | JSON 读写，字符串匹配检索 | [KnowledgeService.java:L186](../src/main/java/com/guide/service/KnowledgeService.java#L186) |
| 数字人 | PIXI + Haru 示例模型，口型和状态 | [main.js:L105](../src/main/resources/static/js/main.js#L105) |
| 网页 | 随 Java 应用提供静态页面 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| Android | WebView 与语音桥接 | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |

## 认证、授权与会话（REQ-030 / GitHub #5）

| 关注点 | 实现 | 位置 |
|---|---|---|
| 过滤链与授权规则 | `/api/admin/**` 要求 ROLE_ADMIN；`/api/auth/me`、`/api/auth/interest` 要求登录；其余公开 | [SecurityConfig.java:L137](../src/main/java/com/guide/config/SecurityConfig.java#L137) |
| 登录与注册 | 服务端校验后建立 HttpSession；登录时更换 session id | [AuthController.java:L44](../src/main/java/com/guide/controller/AuthController.java#L44) |
| 密码存储 | BCrypt；新注册只存 `passwordHash` | [UserService.java:L217](../src/main/java/com/guide/service/UserService.java#L217) |
| 旧数据迁移 | 先备份明文文件，再 BCrypt 化并原子写回，失败终止启动 | [UserService.java:L154](../src/main/java/com/guide/service/UserService.java#L154) |
| 管理员初始化 | 仅 `APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`，默认不创建 | [AdminBootstrapRunner.java:L20](../src/main/java/com/guide/config/AdminBootstrapRunner.java#L20) |
| CSRF | Cookie 双提交（`XSRF-TOKEN` + `X-XSRF-TOKEN`） | [SecurityConfig.java:L110](../src/main/java/com/guide/config/SecurityConfig.java#L110) |
| 401/403 JSON | 匿名 401，游客/CSRF 失败 403 | [RestAuthenticationEntryPoint.java:L23](../src/main/java/com/guide/security/RestAuthenticationEntryPoint.java#L23) |
| 前端会话封装 | `AuthGuard.apiFetch/me/logout` | [security.js:L131](../src/main/resources/static/js/security.js#L131) |
| 管理页身份校验 | 进入时调 `/api/auth/me`，未登录/游客显示不同提示 | [admin.js:L150](../src/main/resources/static/js/admin.js#L150) |

数据仍使用 JSON 文件，没有数据库或向量模型；用户列表等响应通过安全 DTO 隔离密码字段。Android 原生代码未改动，网页认证在 Android WebView 中的 Cookie/CSRF 行为尚未验证。创意玩法和精修角色尚未落地，Android 构建尚未验收。
| 数字人 | PIXI + Haru 示例模型，口型和状态 | [main.js:L108](../src/main/resources/static/js/main.js#L108) |
| 网页 | 随 Java 应用提供静态页面 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| Android | WebView 与语音桥接 | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |

当前使用 JSON 文件，没有数据库或向量模型。账号与后台权限仍是演示实现。观察式导览已新增首版，精修角色尚未落地，Android 构建尚未验收。

REQ-031 在浏览器中集中维护聊天请求生命周期，单请求、取消、30秒总超时与迟到回调隔离；详见 [chat_reliability.md:L1](./chat_reliability.md#L1)。后端服务与数据格式保持原有契约。

REQ-032 在浏览器中新增纯规则与页面适配边界，包校验、记录、关键词对照、草稿和导出无需后端新接口；本机存储按用户和内容版本隔离。见 [exploration_guide.md:L1](./exploration_guide.md#L1)。

REQ-033 新增任务上下文搭档接口。客户端输入严格校验，参考资料/来源固定回填，模型异常或空Key使用本地规则；该路径不写交互日志。共用客户端限制连接/读取阻塞并严格解析模型结果，浏览器独立20秒等待和上下文失效控制。见 [exploration_coach_design.md:L1](./exploration_coach_design.md#L1)。
