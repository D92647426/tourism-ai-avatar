# 当前程序索引

| 功能 | 位置 |
|---|---|
| Maven 构建 | [pom.xml:L1](../pom.xml#L1) |
| Java 入口 | [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1) |
| 对话服务 | [ChatService.java:L1](../src/main/java/com/guide/service/ChatService.java#L1) |
| 知识服务 | [KnowledgeService.java:L1](../src/main/java/com/guide/service/KnowledgeService.java#L1) |
| 用户服务 | [UserService.java:L1](../src/main/java/com/guide/service/UserService.java#L1) |
| 景点服务 | [SpotService.java:L1](../src/main/java/com/guide/service/SpotService.java#L1) |
| 统计服务 | [AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1) |
| 游客网页 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| 网页交互 | [main.js:L1](../src/main/resources/static/js/main.js#L1) |
| Live2D | [live2d-helper.js:L1](../src/main/resources/static/js/live2d-helper.js#L1) |
| Android | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |
| 启动接口检查 | [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) |
| GitHub 自动检查 | [checks.yml:L1](../.github/workflows/checks.yml#L1) |

## 观察式导览（REQ-032）

[exploration-core.js:L1](../src/main/resources/static/js/exploration-core.js#L1) 提供纯规则；[exploration.js:L51](../src/main/resources/static/js/exploration.js#L51) 处理页面和本机存储；[exploration_guide.md:L1](./exploration_guide.md#L1) 记录包字段、演示和修改入口。

## 聊天请求控制（REQ-031）

新增 [chat-request.js:L21](../src/main/resources/static/js/chat-request.js#L21) 的 create 工厂，返回 send、retry、cancel、isPending、getState；网络与计时器可注入。页面适配与行为说明见 [chat_reliability.md:L1](./chat_reliability.md#L1)。
