# 当前程序索引

## 讲解搭档（REQ-033）

| 边界 | 位置 |
|---|---|
| 共享模型调用、严格响应解析和超时 | [AiCompletionClient.java:L1](../src/main/java/com/guide/service/AiCompletionClient.java#L1) |
| 任务校验、本地提示、模型建议与来源回填 | [ExplorationCoachService.java:L1](../src/main/java/com/guide/service/ExplorationCoachService.java#L1) |
| HTTP与400错误映射 | [ExplorationCoachController.java:L1](../src/main/java/com/guide/controller/ExplorationCoachController.java#L1) |
| 请求快照、20秒等待、引用一致性校验 | [coach-request.js:L1](../src/main/resources/static/js/coach-request.js#L1) |
| 编辑/切站/切包时清理反馈 | [exploration.js:L1](../src/main/resources/static/js/exploration.js#L1) |

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

## Issue #11：会话导览

[会话设计、接口与验收](conversation_context.md#L3)；核心实现为 [ConversationService.java](../src/main/java/com/guide/service/ConversationService.java#L25) 与 [ChatService.java](../src/main/java/com/guide/service/ChatService.java#L110)。

## 景点上下文入口

[main.js 入口绑定](../src/main/resources/static/js/main.js#L107)、[上下文渲染](../src/main/resources/static/js/main.js#L205)，需求与测试见 [REQ-040](spot_chat_entry.md#L3)。
## 观察式导览（REQ-032）

[exploration-core.js:L1](../src/main/resources/static/js/exploration-core.js#L1) 提供纯规则；[exploration.js:L51](../src/main/resources/static/js/exploration.js#L51) 处理页面和本机存储；[exploration_guide.md:L1](./exploration_guide.md#L1) 记录包字段、演示和修改入口。

## 聊天请求控制（REQ-031）

新增 [chat-request.js:L21](../src/main/resources/static/js/chat-request.js#L21) 的 create 工厂，返回 send、retry、cancel、isPending、getState；网络与计时器可注入。页面适配与行为说明见 [chat_reliability.md:L1](./chat_reliability.md#L1)。

## 语音生命周期（REQ-036）

- [speech-lifecycle.js:L80](../src/main/resources/static/js/speech-lifecycle.js#L80)：任务/声线/事件/超时与旧ID隔离。
- [main.js:L336](../src/main/resources/static/js/main.js#L336)：状态文字、口型渲染与语音输入/页面收尾。
- [MainActivity.kt:L255](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L255)：协议2版本/带ID播报桥；[回调分派:L347](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L347)。
## 展示配置（REQ-038）

| 文件/接口 | 职责 |
|---|---|
| [display-config.js:L1](../src/main/resources/static/js/display-config.js#L1) | 公开只读获取、逐字段默认、5秒总时限、纯文本与可读主题 |
| [main.js:L1](../src/main/resources/static/js/main.js#L1) | 将聊天开始状态传给展示模块，防迟到欢迎语覆盖 |
| [admin.js:L479](../src/main/resources/static/js/admin.js#L479) | 已加载快照才允许保存、单次提交、返回确认、失败保留输入 |
| [ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128) | 配置快照、校验部分更新、持久化与容错读取 |
| [ConfigServiceTest.java:L1](../src/test/java/com/guide/service/ConfigServiceTest.java#L1) | 21项配置持久化与校验回归 |
| [display-config.test.js:L1](../tests/frontend/display-config.test.js#L1) | 14项真实页面脚本验收 |
