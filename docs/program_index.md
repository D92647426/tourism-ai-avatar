# 当前程序索引

## 讲解搭档（REQ-033）

| 边界 | 位置 |
|---|---|
| 共享模型调用、严格响应解析和超时 | [AiCompletionClient.java:L1](../src/main/java/com/guide/service/AiCompletionClient.java#L1) |
| 任务校验、本地提示、模型建议与来源回填 | [ExplorationCoachService.java:L1](../src/main/java/com/guide/service/ExplorationCoachService.java#L1) |
| HTTP与400错误映射 | [ExplorationCoachController.java:L1](../src/main/java/com/guide/controller/ExplorationCoachController.java#L1) |
| 请求快照、20秒等待、引用一致性校验 | [coach-request.js:L1](../src/main/resources/static/js/coach-request.js#L1) |
| 编辑/切站/切包时清理反馈 | [exploration.js:L1](../src/main/resources/static/js/exploration.js#L1) |
## 后台统计（REQ-034）

| 功能 | 位置 |
|---|---|
| 单时刻/日志副本、上海七日窗口、真实计数与情绪规则 | [AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1) |
| 仪表盘/报告契约 | [DashboardData.java:L1](../src/main/java/com/guide/model/DashboardData.java#L1)、[SentimentReport.java:L1](../src/main/java/com/guide/model/SentimentReport.java#L1) |
| 数字格式、0/null区分、旧口径隔离 | [admin-stats.js:L1](../src/main/resources/static/js/admin-stats.js#L1) |
| 页面刷新/图表空态/失败状态与报告快照 | [admin.js:L1](../src/main/resources/static/js/admin.js#L1)、[admin.html:L1](../src/main/resources/static/admin.html#L1) |

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
| 打包默认知识库 | [knowledge.json:L1](../src/main/resources/knowledge.json#L1) |
| 知识数据结构检查 | [check_data_integrity.py:L516](../scripts/check_data_integrity.py#L516) |
| 知识数据检查测试 | [test_data_integrity.py:L111](../scripts/test_data_integrity.py#L111) |
| 对话服务测试 | [ChatServiceTest.java:L21](../src/test/java/com/guide/service/ChatServiceTest.java#L21) |
| 知识服务测试 | [KnowledgeServiceTest.java:L39](../src/test/java/com/guide/service/KnowledgeServiceTest.java#L39) |
| 景点服务测试 | [SpotServiceTest.java:L17](../src/test/java/com/guide/service/SpotServiceTest.java#L17) |

## 自然提问检索（REQ-037）

| 功能 | 位置 |
|---|---|
| 名称/别名、确定性排序和上下文预算 | [KnowledgeRetriever.java:L54](../src/main/java/com/guide/service/KnowledgeRetriever.java#L54) |
| 一次检索快照/兼容字符串入口 | [KnowledgeService.java:L297](../src/main/java/com/guide/service/KnowledgeService.java#L297)、[KnowledgeRetrieval.java:L1](../src/main/java/com/guide/service/KnowledgeRetrieval.java#L1) |
| 候选引用DTO/响应 | [KnowledgeReference.java:L1](../src/main/java/com/guide/model/KnowledgeReference.java#L1)、[ChatResponse.java:L30](../src/main/java/com/guide/model/ChatResponse.java#L30) |
| 人工维护的16景点别名 | [retrieval-entities.json:L1](../src/main/resources/retrieval-entities.json#L1) |


整合后的服务/页面边界见 [REQ-041](integration_first_round.md#L7)。


[voice-settings.js](../src/main/resources/static/js/voice-settings.js#L1) 是REQ-042配置/设备声线的纯模块；调用边界见 [实现记录](voice_settings.md#L17)。


[director-core.js](../src/main/resources/static/js/director-core.js#L1) 负责编排；[director.js](../src/main/resources/static/js/director.js#L1) 适配DOM；[界面与边界](director_design.md#L15) 说明观察和样式扩展。

## REQ-046 讲解方式模块

[NarrationMode](../src/main/java/com/guide/model/NarrationMode.java#L1) 负责白名单与模型提示；[ConversationService](../src/main/java/com/guide/service/ConversationService.java#L78) 负责模式隔离与成功提交；[ChatService](../src/main/java/com/guide/service/ChatService.java#L79) 兼容旧调用、传模型提示并在 [本地组装](../src/main/java/com/guide/service/ChatService.java#L310) 复用实际字段；[main.js](../src/main/resources/static/js/main.js#L240) 负责选择、恢复、重试废弃和回答标签。见 [行为与修改边界](narration_design.md#L7)。

## REQ-047/048 导览衔接与候选

[journey-core.create](../src/main/resources/static/js/journey-core.js#L8)纯状态和原子校验；[journey.mount](../src/main/resources/static/js/journey.js#L7)处理真实站点选择/下一站/拒绝反馈；[chat-references.append](../src/main/resources/static/js/chat-references.js#L8)做白名单、去重、限量与纯文本披露。主页面仍由 [main.js](../src/main/resources/static/js/main.js#L1)管理请求/语音及方案失效守卫。主聊天单独启用HTTP400纠正模式，共享 [chat-request.create](../src/main/resources/static/js/chat-request.js#L25)默认契约保持兼容。

## REQ-049 追问模块

[chat-followups.append](../src/main/resources/static/js/chat-followups.js#L21) 验证并复制站点、渲染纯文本折叠卡与局部反馈。主聊天 [prepareFollowup](../src/main/resources/static/js/main.js#L424) 将显式站点交给既有草稿守卫，同一当前方案站保持接力。模板和扩展位置见 [设计](followups_design.md#L15)。

## REQ-050 本地追问组织

[LocalFollowupReply.build](../src/main/java/com/guide/service/LocalFollowupReply.java#L20) 完整匹配本站固定模板并组织既有字段，返回文本或 null；[ChatService.localFallback](../src/main/java/com/guide/service/ChatService.java#L215) 在外景/多实体判断后复用并追加统一提示。模板与前端契约见 [设计](local_followups_design.md#L13)。

## REQ-051 讲解回听

[chat-audio.paragraphs/append](../src/main/resources/static/js/chat-audio.js#L1) 负责完整段落快照、最多12段、安全控件与状态。主聊天的 [回听入口](../src/main/resources/static/js/main.js#L1) 守卫会话/请求、取消语音待发送计时并管理单一卡片归属，复用既有 speech-lifecycle。接口见 [设计](segmented_audio_design.md#L9)。

## REQ-052 主题服务与页面

[ThemeGuideService](../src/main/java/com/guide/service/ThemeGuideService.java#L1) 读取可信方法内容并绑定实际景点，校验请求和生成本地讲解；[ThemeGuideController](../src/main/java/com/guide/controller/ThemeGuideController.java#L1) 提供目录。[theme-guide.js](../src/main/resources/static/js/theme-guide.js#L1) 校验目录、管理本页响应回顾，复用 [director](../src/main/resources/static/js/director.js#L1)/[journey](../src/main/resources/static/js/journey.js#L1)/[main](../src/main/resources/static/js/main.js#L1) 的方案、草稿和生命周期。接口与验收见 [设计](superpowers/specs/2026-11-05-theme-guide-design.md#L9)。

## REQ-053 语音引擎接入

[LocalSpeechController.synthesize](../src/main/java/com/guide/controller/LocalSpeechController.java#L21) 提供同源音频；[LocalSpeechService.synthesize](../src/main/java/com/guide/service/LocalSpeechService.java#L41) 验证输入并有界请求loopback服务；[load_engine](../scripts/local_voice_server.py#L94) 读取外置模型、预热、限制并发且禁止联网。[GuideLocalSpeech.create](../src/main/resources/static/js/local-speech.js#L16) 分句、预取、播放及释放资源；[beginLocal](../src/main/resources/static/js/speech-lifecycle.js#L350) 管真实播放事件、旧任务隔离和未完成句回退。见 [运行](local_voice_runbook.md#L1)。


## REQ-054～059 校园模块

| 类、函数或资源 | 职责与修改入口 | 跳转 |
|---|---|---|
| CampusCatalog.snapshot/place/campus/task/searchPlaces | 打包目录、防御性拷贝、校区别名和稳定ID查询 | [snapshot](../src/main/java/com/guide/campus/CampusCatalog.java#L55)、[searchPlaces](../src/main/java/com/guide/campus/CampusCatalog.java#L274) |
| CampusAssistantController | 五个目录/上下文/聊天/新对话/取消端点及400/409适配 | [controller](../src/main/java/com/guide/campus/CampusAssistantController.java#L14) |
| CampusAssistantService.current/start/cancel/chat | Cookie会话、revision、32请求幂等、锁外调用及原子提交 | [current](../src/main/java/com/guide/campus/CampusAssistantService.java#L37)、[start](../src/main/java/com/guide/campus/CampusAssistantService.java#L42)、[cancel](../src/main/java/com/guide/campus/CampusAssistantService.java#L51)、[chat](../src/main/java/com/guide/campus/CampusAssistantService.java#L74) |
| CampusRequestValidation.chat/mergeContext | 类型与目录ID白名单，模拟退出、显式位置null和有限环境快照 | [chat](../src/main/java/com/guide/campus/CampusRequestValidation.java#L22)、[mergeContext](../src/main/java/com/guide/campus/CampusRequestValidation.java#L51) |
| CampusLocalAnswers.answer/confirmedArrival/confirmedDeparture | 本地事项消歧、用途、餐饮、路线，明确到馆和离馆物理证据 | [answer](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L16)、[confirmedArrival](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L242)、[confirmedDeparture](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L253) |
| CampusModelOrchestrator.answer/finalTurn | 受控工具、总期限、动作与证据校验、模型失败回退 | [answer](../src/main/java/com/guide/campus/CampusModelOrchestrator.java#L40)、[finalTurn](../src/main/java/com/guide/campus/CampusModelOrchestrator.java#L121) |
| CampusModelTools.execute | 六工具执行并绑定当前目录、环境和路线起点 | [工具](../src/main/java/com/guide/campus/CampusModelTools.java#L1) |
| CampusWeatherController.current / CampusWeatherService.current | 天气第六端点、WGS84校验、Open-Meteo缓存与资料状态 | [HTTP](../src/main/java/com/guide/campus/CampusWeatherController.java#L27)、[service](../src/main/java/com/guide/campus/CampusWeatherService.java#L57) |
| campus.html / campus.js.submit/render | 人物开场、持续对话、取消重试和统一轮次提交 | [页面](../src/main/resources/static/campus.html#L1)、[submit](../src/main/resources/static/js/campus.js#L118)、[render](../src/main/resources/static/js/campus.js#L71) |
| CampusScene.create/render | 地点/事项/校区范围预览、天气正文与来源入口、返回舞台清理、资源版本及外部高德搜索 | [create](../src/main/resources/static/js/campus-scene.js#L55)、[render](../src/main/resources/static/js/campus-scene.js#L104) |
| CampusEnvironment.create/setContext/exitDemo | confirmed/device/simulated证据分离、安静环境、前台定位与模拟退出 | [create](../src/main/resources/static/js/campus-environment.js#L4)、[setContext](../src/main/resources/static/js/campus-environment.js#L147)、[exitDemo](../src/main/resources/static/js/campus-environment.js#L136) |
| CampusCompanion.create | 纯邀约状态、停留、冷却、接受复核 | [create](../src/main/resources/static/js/campus-companion.js#L16) |
| CampusVoice.create | 既有语音生命周期、公开声音设置、识别和静音 | [create](../src/main/resources/static/js/campus-voice.js#L4) |
| verify_campus(base) | 运行中空Key服务的真实HTTP校园契约和三业务闭环 | [smoke helper](../scripts/smoke_teacher_project.py#L76) |

API、配置与使用步骤见 [校园API](api_reference.md#L252)、[运行手册](campus_demo_runbook.md#L1)，旧景区模块索引继续适用各自入口。


`CampusLocalAnswers.reconcile` 在模型动作验证完成后统一业务条件与当前建议，复用本地事项变体和图书馆用途选项。`CampusEnvironment.syncEnvironment` 维护物理证据版本，位置复核按钮仅把真实点击作为新确认。[最终协调](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L132)、[环境版本](../src/main/resources/static/js/campus-environment.js#L22)、[显式复核](../src/main/resources/static/js/campus-environment.js#L167)
