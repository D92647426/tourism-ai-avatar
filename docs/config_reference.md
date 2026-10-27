# Java 项目配置

配置入口：[application.yml:L1](../src/main/resources/application.yml#L1)。

| 字段 | 类型/默认 | 用途与修改影响 |
|---|---|---|
| server.port | 整数，8080 | 网页和 API 端口，改变后同步客户端地址 |
| ai.api-key | 字符串，读取 DEEPSEEK_API_KEY，默认空 | 模型凭据，空值进入本地降级回答 |
| ai.base-url | URL，源码默认 DeepSeek v1 地址 | 模型 API 基址，改变后验证响应兼容性 |
| ai.model | 字符串，源码默认 deepseek-chat | 模型名称，使用服务商实际支持的名称 |
| data.knowledge-file | 路径，data/knowledge.json | 可维护知识；外部合法文件优先（含空数组），缺文件时写打包默认库，损坏时降级且不覆盖原文件；加载逻辑见 [KnowledgeService.java:L75](../src/main/java/com/guide/service/KnowledgeService.java#L75) |
| data.interactions-file | 路径，data/interactions.json | 本地问答记录，被 Git 忽略 |
| data.config-file | 路径，data/config.json | 显示和语音设置 |

默认知识库是 classpath 资源 [knowledge.json:L1](../src/main/resources/knowledge.json#L1)，内容须与仓库 [data/knowledge.json:L1](../data/knowledge.json#L1) 语义一致；一致性由 [check_data_integrity.py:L353](../scripts/check_data_integrity.py#L353) 检查，结构通过不等同事实核验。修改外部知识文件前建议备份，初始化时不会覆盖损坏文件；之后的管理员增删改操作仍会保存当前内存库，如需保留原件请先备份。

用户文件由 UserService 固定使用 data/users.json，被 Git 忽略。以上默认值来自导入源码，不代表真实模型 API 已完成联网验收。

Spring Boot 参数可通过命令行覆盖，例如 java -jar target/ai-guide-1.0.0.jar --server.port=8081。普通 .env 文件不会被自动读取。

验证方式：空 Key 下执行 [本地接口检查 smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，真实模型由各成员在本机配置 Key 后单独验收。
