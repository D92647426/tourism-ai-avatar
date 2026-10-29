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

## REQ-037 检索规则

不新增环境变量或配置接口。打包字典 [retrieval-entities.json:L1](../src/main/resources/retrieval-entities.json#L1) 的entities为name/aliases数组，excludedNames排除明确外景名称里的短别名；没有绑定知识ID。修改时核对现有16景点正式名，别名需至少2字符，重建JAR后生效。不是通用实体识别，未列的别名/外景可能需要后续维护，不宣称自动消歧所有中文句子。原知识ID与内容不改。

排序：实体标题300、精确关键词180、正文提及20；正文单纯列过景点不能独立成为候选，需另有相关关键词。查询完整/部分标题80，去重关键词30+min(长度,20)，历史/故事等泛词不单独召回。按分数降序/ID升序稳定排序，多实体先各给一个主要候选再填余位。知识预算最多3条、标题80字符、正文200字符、总1200个Java字符串字符（UTF-16单位），裁剪避免割裂代理对。位置 [KnowledgeRetriever.java:L18](../src/main/java/com/guide/service/KnowledgeRetriever.java#L18)，回归 [NaturalRetrievalTest.java:L1](../src/test/java/com/guide/service/NaturalRetrievalTest.java#L1)。
