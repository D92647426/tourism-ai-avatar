# Java 项目配置

## REQ-034 统计的日期口径

统计时区固定Asia/Shanghai，窗口固定含今天的七个自然日（起点today-6日00:00、截止本次统计时刻）。这是代码契约，不新增配置字段或环境变量。默认使用系统时钟，测试可注入固定Clock；改变JVM默认时区不改变统计分日。修改窗口/时区须同时改页面说明、API文档和日期边界测试。

位置与验证：[AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1)、[AnalyticsServiceTest.java:L1](../src/test/java/com/guide/service/AnalyticsServiceTest.java#L1)。仍使用data.interactions-file，测试/预览用隔离合成日志，不读取开发者已有历史数据。

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
