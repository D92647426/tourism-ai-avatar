# 当前程序索引

| 功能 | 位置 |
|---|---|
| Maven 构建 | [pom.xml:L1](../pom.xml#L1) |
| Java 入口 | [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1) |
| 对话服务 | [ChatService.java:L1](../src/main/java/com/guide/service/ChatService.java#L1) |
| 知识服务 | [KnowledgeService.java:L1](../src/main/java/com/guide/service/KnowledgeService.java#L1) |
| 用户服务（BCrypt、迁移、管理员初始化、回滚） | [UserService.java:L48](../src/main/java/com/guide/service/UserService.java#L48) |
| 用户实体（角色、密码字段） | [User.java:L21](../src/main/java/com/guide/model/User.java#L21) |
| 密码策略 | [PasswordPolicy.java:L15](../src/main/java/com/guide/security/PasswordPolicy.java#L15) |
| 安全过滤链 | [SecurityConfig.java:L42](../src/main/java/com/guide/config/SecurityConfig.java#L42) |
| 管理员启动初始化 | [AdminBootstrapRunner.java:L20](../src/main/java/com/guide/config/AdminBootstrapRunner.java#L20) |
| 认证/会话接口 | [AuthController.java:L44](../src/main/java/com/guide/controller/AuthController.java#L44) |
| 公开数字人配置 | [PublicConfigController.java:L21](../src/main/java/com/guide/controller/PublicConfigController.java#L21) |
| 匿名 401 JSON | [RestAuthenticationEntryPoint.java:L23](../src/main/java/com/guide/security/RestAuthenticationEntryPoint.java#L23) |
| 403/CSRF JSON | [RestAccessDeniedHandler.java:L26](../src/main/java/com/guide/security/RestAccessDeniedHandler.java#L26) |
| 安全用户 DTO | [UserView.java:L13](../src/main/java/com/guide/dto/UserView.java#L13) |
| 认证结果 DTO | [AuthResult.java:L13](../src/main/java/com/guide/dto/AuthResult.java#L13) |
| 景点服务 | [SpotService.java:L1](../src/main/java/com/guide/service/SpotService.java#L1) |
| 统计服务 | [AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1) |
| 游客网页 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| 网页交互 | [main.js:L1](../src/main/resources/static/js/main.js#L1) |
| 前端会话/CSRF/退出封装 | [security.js:L131](../src/main/resources/static/js/security.js#L131) |
| 游客登录页 | [login.html:L1](../src/main/resources/static/login.html#L1) |
| 游客登录脚本 | [login.js:L1](../src/main/resources/static/js/login.js#L1) |
| 管理页（登录/无权限覆盖层） | [admin.html:L13](../src/main/resources/static/admin.html#L13) |
| 管理页脚本（身份校验、CSRF、退出、重载 tab） | [admin.js:L150](../src/main/resources/static/js/admin.js#L150) |
| Live2D | [live2d-helper.js:L1](../src/main/resources/static/js/live2d-helper.js#L1) |
| Android | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |
| 启动接口检查 | [smoke_teacher_project.py:L60](../scripts/smoke_teacher_project.py#L60) |
| 权限/CSRF 集成测试 | [SecurityIntegrationTest.java:L54](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L54) |
| 用户迁移测试 | [UserServiceMigrationTest.java:L33](../src/test/java/com/guide/service/UserServiceMigrationTest.java#L33) |
| 用户数据一致性测试 | [UserServiceConsistencyTest.java:L38](../src/test/java/com/guide/service/UserServiceConsistencyTest.java#L38) |
| Cookie/真实 HTTP 认证测试 | [CookieAttributeTest.java:L41](../src/test/java/com/guide/security/CookieAttributeTest.java#L41) |
| 前端行为测试（Node vm） | [security.test.js](../tests/frontend/security.test.js) 等 |
| GitHub 自动检查 | [checks.yml:L1](../.github/workflows/checks.yml#L1) |

## 展示配置（REQ-038）

| 文件/接口 | 职责 |
|---|---|
| [display-config.js:L1](../src/main/resources/static/js/display-config.js#L1) | 公开只读获取、逐字段默认、5秒总时限、纯文本与可读主题 |
| [main.js:L1](../src/main/resources/static/js/main.js#L1) | 将聊天开始状态传给展示模块，防迟到欢迎语覆盖 |
| [admin.js:L479](../src/main/resources/static/js/admin.js#L479) | 已加载快照才允许保存、单次提交、返回确认、失败保留输入 |
| [ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128) | 配置快照、校验部分更新、持久化与容错读取 |
| [ConfigServiceTest.java:L1](../src/test/java/com/guide/service/ConfigServiceTest.java#L1) | 21项配置持久化与校验回归 |
| [display-config.test.js:L1](../tests/frontend/display-config.test.js#L1) | 14项真实页面脚本验收 |
