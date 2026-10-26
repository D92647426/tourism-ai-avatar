# Java 项目配置

## REQ-033 模型连接与搭档等待

沿用 ai.api-key/base-url/model，不新增环境变量。读取位置改为 [AiCompletionClient.java:L1](../src/main/java/com/guide/service/AiCompletionClient.java#L1)，同时供原聊天和讲解搭档使用。Key默认空，直接本地提示；配置非空Key后，仅在用户请求时尝试供应商，无自动重试。测试使用显式假Key/假客户端，不读取开发者凭据。

| 边界 | 默认值与类型 | 修改位置/影响/验证 |
|---|---|---|
| 连接时限 | 整数3000毫秒，代码常量 | AiCompletionClient的CONNECT_TIMEOUT_MILLIS；过长会拖慢降级。验证 [AiCompletionClientTest.java:L1](../src/test/java/com/guide/service/AiCompletionClientTest.java#L1) |
| 读取时限 | 整数15000毫秒，代码常量 | READ_TIMEOUT_MILLIS；是一次读取阻塞时限，不是严格整体生成期限，同上验证 |
| 搭档页面总等待 | 整数20000毫秒，代码固定 | [coach-request.js:L1](../src/main/resources/static/js/coach-request.js#L1)，覆盖JSON解析；取消不保证后端立即停止。验证 [coach-request.test.js:L1](../tests/frontend/coach-request.test.js#L1) |

真实供应商由项目配置提供，客户端提交的来源URL不会被当作模型地址或抓取目标。修改供应商、模型或Key后，需要另做真实服务联调；当前自动证据均来自本地假供应商与空Key。

## REQ-032 浏览器内容包与本机记录

新增字段不改变 Java 配置。JSON 包字段类型、默认值/必填、长度、用途、版本变更风险与验证方式集中记录在 [exploration_guide.md:L29](./exploration_guide.md#L29)；两份静态示例默认加载灵山观察包，可导入校园包，记录键按 userId/packId/version 隔离。

配置入口：[application.yml:L1](../src/main/resources/application.yml#L1)。

| 字段 | 类型/默认 | 用途与修改影响 |
|---|---|---|
| server.port | 整数，8080 | 网页和 API 端口，改变后同步客户端地址 |
| ai.api-key | 字符串，读取 DEEPSEEK_API_KEY，默认空 | 模型凭据，空值进入本地降级回答 |
| ai.base-url | URL，源码默认 DeepSeek v1 地址 | 模型 API 基址，改变后验证响应兼容性 |
| ai.model | 字符串，源码默认 deepseek-chat | 模型名称，使用服务商实际支持的名称 |
| data.knowledge-file | 路径，data/knowledge.json | 可维护知识，当前使用 JSON 与字符串匹配 |
| data.interactions-file | 路径，data/interactions.json | 本地问答记录，被 Git 忽略 |
| data.config-file | 路径，data/config.json | 显示和语音设置 |

用户文件由 UserService 固定使用 data/users.json，被 Git 忽略。以上默认值来自导入源码，不代表真实模型 API 已完成联网验收。

Spring Boot 参数可通过命令行覆盖，例如 java -jar target/ai-guide-1.0.0.jar --server.port=8081。普通 .env 文件不会被自动读取。

验证方式：空 Key 下执行 [本地接口检查 smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，真实模型由各成员在本机配置 Key 后单独验收。
