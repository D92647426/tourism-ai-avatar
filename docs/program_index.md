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

## 语音生命周期（REQ-036）

- [speech-lifecycle.js:L80](../src/main/resources/static/js/speech-lifecycle.js#L80)：任务/声线/事件/超时与旧ID隔离。
- [main.js:L336](../src/main/resources/static/js/main.js#L336)：状态文字、口型渲染与语音输入/页面收尾。
- [MainActivity.kt:L255](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L255)：协议2版本/带ID播报桥；[回调分派:L347](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L347)。
