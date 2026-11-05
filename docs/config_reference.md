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
## REQ-034 统计的日期口径

统计时区固定Asia/Shanghai，窗口固定含今天的七个自然日（起点today-6日00:00、截止本次统计时刻）。这是代码契约，不新增配置字段或环境变量。默认使用系统时钟，测试可注入固定Clock；改变JVM默认时区不改变统计分日。修改窗口/时区须同时改页面说明、API文档和日期边界测试。

位置与验证：[AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1)、[AnalyticsServiceTest.java:L1](../src/test/java/com/guide/service/AnalyticsServiceTest.java#L1)。仍使用data.interactions-file，测试/预览用隔离合成日志，不读取开发者已有历史数据。

配置入口：[application.yml:L1](../src/main/resources/application.yml#L1)。

| 字段 | 类型/默认 | 用途与修改影响 |
|---|---|---|
| server.port | 整数，8080 | 网页和 API 端口，改变后同步客户端地址 |
| server.servlet.session.timeout | 时长，30m | 服务端会话过期时间；过期后页面按未登录处理 |
| server.servlet.session.cookie.http-only | 布尔，true | JSESSIONID 不可被前端脚本读取 |
| server.servlet.session.cookie.same-site | 枚举，lax | 降低跨站请求携带会话 Cookie 的风险 |
| ai.api-key | 字符串，读取 DEEPSEEK_API_KEY，默认空 | 模型凭据，空值进入本地降级回答 |
| ai.base-url | URL，源码默认 DeepSeek v1 地址 | 模型 API 基址，改变后验证响应兼容性 |
| ai.model | 字符串，源码默认 deepseek-chat | 模型名称，使用服务商实际支持的名称 |
| data.knowledge-file | 路径，data/knowledge.json | 可维护知识；外部合法文件优先（含空数组），缺文件时写打包默认库，损坏时降级且不覆盖原文件；加载逻辑见 [KnowledgeService.java:L75](../src/main/java/com/guide/service/KnowledgeService.java#L75) |
| data.interactions-file | 路径，data/interactions.json | 本地问答记录，被 Git 忽略 |
| data.config-file | 路径，data/config.json | 显示和语音设置 |
| data.users-file | 路径，data/users.json | 用户记录（BCrypt 哈希）；默认文件被 Git 忽略；测试与迁移可用临时路径覆盖 |

## 管理员初始化环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| APP_ADMIN_USERNAME | 否 | 仅在需要本地管理员时设置，2-20 个字符 |
| APP_ADMIN_PASSWORD | 否 | 仅在需要本地管理员时设置，至少 8 位、最多 64 字符且 UTF-8 不超过 72 字节 |

规则（REQ-030 / GitHub #5）：

- 两个变量都未设置时**不会**创建默认管理员，管理页只显示登录入口。
- 只设置其中一个会启动失败，避免“半配置”产生不可用管理员。
- 用户名已被游客占用时明确拒绝初始化，不会静默把游客提升为管理员。
- 已存在 ADMIN 记录时重复启动不会覆盖其密码。
- 不要提交、打印或截图真实凭据；真实用户文件、迁移备份、本机日志都不进入 Git。

示例（PowerShell）见 [README.md:L46](../README.md#L46)；本机可只对当前终端生效，不写入仓库文件。

## 用户数据迁移与备份

旧版 `data/users.json` 的 `password` 是明文。升级后首次启动时：

1. 先把原文件复制为同目录 `users.json.bak-<时间戳>`（已被 [.gitignore:L13](../.gitignore#L13) 忽略）；
2. 对每条旧记录生成 BCrypt `passwordHash`，保留 id、用户名、兴趣、注册时间；
3. 通过同目录临时文件 + 原子替换写回，避免中途崩溃产生半截 JSON。

迁移失败（JSON 损坏、记录既无 `password` 也无 `passwordHash`）会**终止启动并保留原文件**，不会从空用户列表覆盖。迁移逻辑见 [UserService.java:L154](../src/main/java/com/guide/service/UserService.java#L154)。

## 会话与 CSRF

- 登录/退出会在服务端建立/销毁会话，前端 localStorage 只做显示缓存，不作为权限依据。
- 状态变更请求必须带 `X-XSRF-TOKEN`；浏览器前端通过 `/api/auth/csrf` 获取，见 [security.js:L10](../src/main/resources/static/js/security.js#L10)。
- 管理端页面进入时通过 `/api/auth/me` 校验身份，但真正的权限由服务端 [SecurityConfig.java:L137](../src/main/java/com/guide/config/SecurityConfig.java#L137) 强制。

## 其他
默认知识库是 classpath 资源 [knowledge.json:L1](../src/main/resources/knowledge.json#L1)，内容须与仓库 [data/knowledge.json:L1](../data/knowledge.json#L1) 语义一致；一致性由 [check_data_integrity.py:L353](../scripts/check_data_integrity.py#L353) 检查，结构通过不等同事实核验。修改外部知识文件前建议备份，初始化时不会覆盖损坏文件；之后的管理员增删改操作仍会保存当前内存库，如需保留原件请先备份。

用户文件由 UserService 固定使用 data/users.json，被 Git 忽略。以上默认值来自导入源码，不代表真实模型 API 已完成联网验收。

Spring Boot 参数可通过命令行覆盖，例如 java -jar target/ai-guide-1.0.0.jar --server.port=8081。普通 .env 文件不会被自动读取。

验证方式：空 Key 下执行 [本地接口检查 smoke_teacher_project.py:L60](../scripts/smoke_teacher_project.py#L60)，真实模型由各成员在本机配置 Key 后单独验收。
验证方式：空 Key 下执行 [本地接口检查 smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，真实模型由各成员在本机配置 Key 后单独验收。

## REQ-036 语音故障边界

不新增持久化设置。内部常量：声线等待1500ms、开始事件总等待8000ms、播放故障上限120000ms；位置 [speech-lifecycle.js:L14](../src/main/resources/static/js/speech-lifecycle.js#L14)。仅作异常收尾，不按字数估时或宣称音素同步。Web默认rate1.05/pitch1.1/volume1，Android默认rate1.0/pitch1.1；#14再接管理设置。修改后运行 [语音测试:L1](../tests/frontend/speech-lifecycle.test.js#L1)。完整边界见 [speech_lifecycle.md:L1](./speech_lifecycle.md#L1)。

## REQ-038 展示配置文件

`data.config-file` 仍默认 `data/config.json`；名称、欢迎语、颜色经公开配置接口用于游客页。默认名称“灵灵”、默认金色 `#c8963e`，完整默认值见 [DigitalHumanConfig.java:L1](../src/main/java/com/guide/model/DigitalHumanConfig.java#L1)。管理员保存后游客刷新生效。声线/音量/语速继续保存，播放端消费留给 #14。

配置校验、部分更新、快照与同目录临时文件替换见 [ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128)、[save:L357](../src/main/java/com/guide/service/ConfigService.java#L357)。支持原子移动时使用原子替换，不支持时回退普通替换移动；不承诺所有文件系统上的断电恢复。读取无父目录的文件名也可用。

缺文件可写默认值；已有文件损坏、尾随垃圾/第二JSON对象或非法字段时整份默认并告警，原文件保留，不自动覆盖修复；有效旧文件缺字段则补默认，未知旧字段忽略并告警。请管理员检查并备份坏文件后再明确保存。返回防御性副本，校验/写盘失败不发布候选内存。详见 [display_config.md:L1](display_config.md#L1)。
## REQ-037 检索规则

不新增环境变量或配置接口。打包字典 [retrieval-entities.json:L1](../src/main/resources/retrieval-entities.json#L1) 的entities为name/aliases数组，excludedNames排除明确外景名称里的短别名；没有绑定知识ID。修改时核对现有16景点正式名，别名需至少2字符，重建JAR后生效。不是通用实体识别，未列的别名/外景可能需要后续维护，不宣称自动消歧所有中文句子。原知识ID与内容不改。

排序：实体标题300、精确关键词180、正文提及20；正文单纯列过景点不能独立成为候选，需另有相关关键词。查询完整/部分标题80，去重关键词30+min(长度,20)，历史/故事等泛词不单独召回。按分数降序/ID升序稳定排序，多实体先各给一个主要候选再填余位。知识预算最多3条、标题80字符、正文200字符、总1200个Java字符串字符（UTF-16单位），裁剪避免割裂代理对。位置 [KnowledgeRetriever.java:L18](../src/main/java/com/guide/service/KnowledgeRetriever.java#L18)，回归 [NaturalRetrievalTest.java:L1](../src/test/java/com/guide/service/NaturalRetrievalTest.java#L1)。


REQ-042：volume 数值0–1（默认1）、speechRate数值0.5–2（默认1）、voiceType非空字符串最多200字符（历史默认female，兼容male/female，新增auto或设备voiceURI）。省略字段保留当前值。使用位置、修改风险与验证见 [语音设置](voice_settings.md#L11)。

REQ-047内部调用参数：GuideChatRequest.create 的 requireCorrectionOn400（boolean，默认false）仅主导览聊天传true，将400映射为需修改问题/重新选站且不可原样重放；观察搭档沿用默认旧契约。不是管理后台或环境变量配置。位置 [chat-request.js](../src/main/resources/static/js/chat-request.js#L1)，验证 [HTTP400回归](../tests/frontend/chat-request.test.js#L73)。

## REQ-052 打包主题内容

[theme-guide.json](../src/main/resources/theme-guide.json#L1) 为可信打包内容，修改后重新构建并启动。id为主题标识，默认scene-details；title/question/notice为名称、贯穿问题和来源提示，均为必填字符串。stops为固定三站数组，name为必须能匹配现有景点的正式名，focus/question/method/briefMethod/bridge/recap分别为焦点、本站问题、标准观察方法、精简观察方法、衔接和回顾词条，均必填。

站点ID在运行时按 [SpotService](../src/main/java/com/guide/service/SpotService.java#L1) 目录解析。缺站/无效ID时主题不可用，普通导览继续使用原数据；打包必填字段无效会启动失败。该文件保存方法内容，景点事实来自当前简介并保留待核验说明。没有环境变量或管理员上传入口。修改风险为目录不可用或讲解依据不一致，检查 [ThemeGuideTest](../src/test/java/com/guide/service/ThemeGuideTest.java#L1)、GET /api/themes和三站HTTP路径。
