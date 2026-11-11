# 当前基线需求追踪

## REQ-033 当前观察的讲解搭档（GitHub #19）

根据当前任务/草稿提供建议与后续观察问题，展示真实生成方式和本次资料来源，编辑/切站后失效，不判分、不自动保存或播报。抽取旧聊天和搭档共同的供应商调用，限制连接与读取时间、严格检查空响应并明确降级。设计：[exploration_coach_design.md:L1](./exploration_coach_design.md#L1)；API：[api_reference.md:L3](./api_reference.md#L3)；页面请求：[coach-request.js:L1](../src/main/resources/static/js/coach-request.js#L1)。
## REQ-034 后台统计口径纠正（GitHub #13）

实际问答次数、近7天上海时区窗口、有效情绪样本与正向问句占比；无样本null、真实0%保留，未采集的访客/满意度/耗时不输出假数值。Dashboard和报告按单一时刻与日志副本聚合，页面失败不冒充空数据，空图表不造样本。设计与迁移见 [analytics_accuracy.md:L1](./analytics_accuracy.md#L1)。

## REQ-026 三人协作

仓库保留独立 Git 历史、Issue/PR 模板、个人身份与评审流程。见 [CONTRIBUTING.md:L1](../CONTRIBUTING.md#L1)、[team_join_guide.md:L1](./team_join_guide.md#L1)。

## REQ-027 将仓库切换为老师压缩包源码

用户明确要求主代码替换为老师提供的压缩包内容。导入 Java/Spring Boot、网页 Live2D、JSON 数据样本和 Android 源码，保留 Git 与协作配置。旧基线标签为 baseline-lingtour-20261019。

| 内容 | 位置 |
|---|---|
| 源码与环境 | [pom.xml:L1](../pom.xml#L1)、[application.yml:L1](../src/main/resources/application.yml#L1) |
| 来源与排除项 | [UPSTREAM.md:L1](../UPSTREAM.md#L1)、[import_manifest.json:L1](./import_manifest.json#L1) |
| 启动说明 | [team_setup.md:L1](./team_setup.md#L1) |
| 验证 | [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)、[checks.yml:L1](../.github/workflows/checks.yml#L1) |

本次不改变老师应用业务逻辑。配置中的真实 Key 外置，历史账号和聊天记录不上传，启动脚本不强杀占用端口的进程。

## REQ-028 集中整理本地项目资料

把 D:/Code 下与景区数字人课设相关的目录和资料集中到 D:/Code/旅游AI数字人。保留主仓库历史和未提交改动，恢复本地预览，更新入组路径。记录见 [local_workspace.md:L1](./local_workspace.md#L1)。

## REQ-029 统一旅游 AI 数字人项目名称

项目中文名为“旅游 AI 数字人”，GitHub 仓库名为 tourism-ai-avatar，本地集中目录为 D:/Code/旅游AI数字人，正式仓库为其下 tourism-ai-avatar。说明、入组手册、界面标题与团队任务采用统一名称，角色方案使用通用称呼。模型供应商的真实接口地址、环境变量与模型 ID 属于连接配置，保持有效值。

位置：[README.md:L1](../README.md#L1)、[local_workspace.md:L1](./local_workspace.md#L1)、[index.html:L6](../src/main/resources/static/index.html#L6)。验证：文档链接、Maven 构建、页面与接口检查。

## REQ-030 管理员登录、接口权限与密码保护（GitHub #5）

对应 GitHub 议题 #5，属于 P0 安全边界任务；只建立认证、授权与密码存储边界，不包含欢迎语、语速等后续功能。

| 内容 | 位置 |
|---|---|
| 安全过滤链、会话固定防护、CSRF、退出 | [SecurityConfig.java:L42](../src/main/java/com/guide/config/SecurityConfig.java#L42) |
| 登录/注册/身份/兴趣接口 | [AuthController.java:L44](../src/main/java/com/guide/controller/AuthController.java#L44) |
| 管理员初始化（环境变量） | [AdminBootstrapRunner.java:L20](../src/main/java/com/guide/config/AdminBootstrapRunner.java#L20) |
| 密码策略（游客 ≥4、管理员 ≥8） | [PasswordPolicy.java:L15](../src/main/java/com/guide/security/PasswordPolicy.java#L15) |
| 用户存储、BCrypt、旧明文迁移与原子写入 | [UserService.java:L48](../src/main/java/com/guide/service/UserService.java#L48) |
| 安全 DTO（不含密码字段） | [UserView.java:L13](../src/main/java/com/guide/dto/UserView.java#L13)、[AuthResult.java:L13](../src/main/java/com/guide/dto/AuthResult.java#L13) |
| 匿名/游客 JSON 401 与 403 | [RestAuthenticationEntryPoint.java:L23](../src/main/java/com/guide/security/RestAuthenticationEntryPoint.java#L23)、[RestAccessDeniedHandler.java:L26](../src/main/java/com/guide/security/RestAccessDeniedHandler.java#L26) |
| 公开只读数字人配置 | [PublicConfigController.java:L21](../src/main/java/com/guide/controller/PublicConfigController.java#L21) |
| 前端会话/CSRF 封装 | [security.js:L131](../src/main/resources/static/js/security.js#L131) |
| 管理页身份校验与退出 | [admin.js:L150](../src/main/resources/static/js/admin.js#L150)、[admin.html:L13](../src/main/resources/static/admin.html#L13) |
| 用户数据一致性回滚 | [UserServiceConsistencyTest.java:L38](../src/test/java/com/guide/service/UserServiceConsistencyTest.java#L38) |
| 测试 | [SecurityIntegrationTest.java:L54](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L54)、[UserServiceMigrationTest.java:L33](../src/test/java/com/guide/service/UserServiceMigrationTest.java#L33) |
| 前端行为测试 | [security.test.js](../tests/frontend/security.test.js) 等 4 个文件 |

验收事实：匿名访问 `/api/admin/**` 返回 401；游客返回 403；管理员可读写；退出后服务端会话失效；缺少/错误 CSRF 返回 403 且与匿名 401 区分；注册忽略客户端注入的角色；所有认证响应不含 `password`/`passwordHash`；新注册只存 BCrypt；旧明文记录迁移前备份、迁移保留 ID/用户名/兴趣/时间；`APP_ADMIN_*` 未配置时不创建管理员；用户名冲突拒绝初始化；落盘失败会回滚内存；重复 ID/用户名与空数据根会被拒绝且不覆盖原文件。自动化覆盖为 41 个 Java 测试 + 27 个前端行为测试（`node:test` + `vm` 执行真实脚本）。详见 [TEST-030](./test_reference.md) 与 [API 说明](./api_reference.md)。

## REQ-039 会话隔离与景点上下文

游客的多轮追问、景点切换、显式新对话、六轮上限与 20 分钟过期，见 [功能与验收说明](conversation_context.md#L3)、[实现](../src/main/java/com/guide/service/ConversationService.java#L25) 和 [测试](../src/test/java/com/guide/service/ConversationServiceTest.java#L1)。

## REQ-040 景点详情提问入口

对应 #12，景点 ID 随主动提问发送、明确显示当前上下文、切换与重开无自动重复消息。见 [设计与验收](spot_chat_entry.md#L3)。
## REQ-031 聊天发送、超时处理与重试（GitHub #6）

单请求、30秒总超时、取消/关闭隔离迟到回复、显式重试与草稿保护，详见 [chat_reliability.md:L1](./chat_reliability.md#L1)。不修改后端协议，不依赖未合并的 #15。

## REQ-032 观察式导览与可复用内容包（GitHub #17）

用户授权继续发挥开源课设创意，由 Codex 选定“今天你当导游”首版。任务、资料对照、发现到聊天草稿的交接、本机用户隔离、包校验与预览、旅程导出见 [exploration_design.md:L1](./exploration_design.md#L1)、[exploration_guide.md:L1](./exploration_guide.md#L1)。不声称三人已投票定案、模型判分或实际到访认证。

## REQ-036 语音播报与数字人状态同步（GitHub #7）

真实播报事件驱动口型，任务ID隔离旧回调，声线等待/错误/关闭/后台统一收尾。新增待机/聆听/思考/等待声音/讲解/暂停/失败状态；Android协议2支持带ID回调，旧协议降级Web或文字。方案、分支顺序与未验证边界见 [speech_lifecycle.md:L1](./speech_lifecycle.md#L1)。实现见 [speech-lifecycle.js:L80](../src/main/resources/static/js/speech-lifecycle.js#L80)、[main.js:L336](../src/main/resources/static/js/main.js#L336)、[MainActivity.kt:L255](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L255)。

## REQ-038 展示设置（GitHub #8）

管理员保存名称、首次欢迎语和主题色后，游客刷新即生效；只读接口保留公开访问，管理写入保留 ADMIN/CSRF。配置失败有默认显示，迟到欢迎语不改写聊天；非法更新整次拒绝，落盘失败不发布内存。

| 环节 | 实现 / 验收定位 |
|---|---|
| 设计与边界 | [display_config.md:L1](display_config.md#L1) |
| 公开只读 | [PublicConfigController.java:L21](../src/main/java/com/guide/controller/PublicConfigController.java#L21) |
| 校验、快照与持久化 | [ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128) |
| 管理 API 失败状态 | [AdminController.java:L116](../src/main/java/com/guide/controller/AdminController.java#L116) |
| 页面默认、主题、超时 | [display-config.js:L1](../src/main/resources/static/js/display-config.js#L1) |
| 后台加载与保存确认 | [admin.js:L479](../src/main/resources/static/js/admin.js#L479) |
| 行为与真实 HTTP | [display-config.test.js:L24](../tests/frontend/display-config.test.js#L24)、[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) |

结果：65 Java、41 前端测试通过；JAR HTTP 覆盖管理员保存→匿名读取→非法拒绝→重启读取。语音参数播放消费属 #14；本次没有更换 Live2D 模型。
## REQ-035 知识数据完整性（GitHub #9）

知识初始化改用打包 JSON 默认库并做最小结构校验；知识 1/2/3 错配正文改为“待补充”，4–16 标注未核验课程示例；修正景点上下文标签与“、”分隔符并关闭资源流；对话服务增加资料边界提示并删除硬编码餐饮价格。只修复可信输入基础，不编造史实、不改检索算法与模型接口。方案与逐条审查见 [knowledge_integrity.md:L1](./knowledge_integrity.md#L1)。

| 内容 | 位置 |
|---|---|
| 知识数据（外部库） | [data/knowledge.json:L1](../data/knowledge.json#L1) |
| 知识数据（打包默认库） | [knowledge.json:L1](../src/main/resources/knowledge.json#L1) |
| 加载、降级与结构校验 | [KnowledgeService.java:L64](../src/main/java/com/guide/service/KnowledgeService.java#L64) |
| 景点上下文与示例边界 | [SpotService.java:L90](../src/main/java/com/guide/service/SpotService.java#L90) |
| 对话资料边界 | [ChatService.java:L31](../src/main/java/com/guide/service/ChatService.java#L31) |
| 数据检查工具 | [check_data_integrity.py:L516](../scripts/check_data_integrity.py#L516) |
| 测试 | [KnowledgeServiceTest.java:L39](../src/test/java/com/guide/service/KnowledgeServiceTest.java#L39)、[SpotServiceTest.java:L17](../src/test/java/com/guide/service/SpotServiceTest.java#L17)、[ChatServiceTest.java:L21](../src/test/java/com/guide/service/ChatServiceTest.java#L21)、[test_data_integrity.py:L111](../scripts/test_data_integrity.py#L111) |
| CI 接入 | [checks.yml:L1](../.github/workflows/checks.yml#L1) |

验证命令见 [test_reference.md:L24](./test_reference.md#L24) 的 TEST-035。结构检查通过不等同景区事实核验。

## REQ-037 自然提问检索（GitHub #10）

人工实体/别名/关键词，确定性排序、多实体分配与1200字符知识上下文上限；返回本地候选引用，简称可用于离线景点回复，无命中明确说明。沿用既有字段和管理搜索，不引入向量库/付费模型/会话。方案与依赖见 [natural_retrieval.md:L1](./natural_retrieval.md#L1)。代码：[KnowledgeRetriever.java:L54](../src/main/java/com/guide/service/KnowledgeRetriever.java#L54)、[KnowledgeService.java:L297](../src/main/java/com/guide/service/KnowledgeService.java#L297)、[ChatService.java:L65](../src/main/java/com/guide/service/ChatService.java#L65)。


REQ-041：第一轮组合整合与验收，见 [整合记录](integration_first_round.md#L3)。


REQ-042 / #14：语音设置进入实际播报，含0音量、设备声线与Android回退，见 [设计与验收](voice_settings.md#L3)。


REQ-043（#29）情境编排、REQ-044（#30）观察辅助、REQ-045（#31）游客界面，见 [验收说明](director_design.md#L3)。

## REQ-046 游客讲解方式（#37）

当前主题以景区数字人导览为主线，标准/亲子/精简方式沿当前会话延续，新对话回标准；观察为可选补充。行为、API与边界见 [设计](narration_design.md#L1)，实现为 [模式白名单](../src/main/java/com/guide/model/NarrationMode.java#L1)、[成功后提交](../src/main/java/com/guide/service/ConversationService.java#L78)、[回答组织](../src/main/java/com/guide/service/ChatService.java#L79)、[页面控件](../src/main/resources/static/js/main.js#L240)。

## REQ-047 / REQ-048（#38 / #39）

方案接力讲解与逐条回答的参考候选，行为、接口和边界见 [设计](journey_references_design.md#L1)。[journey-core](../src/main/resources/static/js/journey-core.js#L1)保存页内选择，[journey页面适配](../src/main/resources/static/js/journey.js#L1)显式准备草稿，[参考候选渲染器](../src/main/resources/static/js/chat-references.js#L1)只渲染同次响应的有效本地候选。无新后端接口/持久化/模型依赖。

## REQ-049 导游追问卡（#42）

每条景点回答可准备抓重点、生活比喻、观察细节的显式草稿，保留当前模式与已有草稿。历史卡片绑定当次景点，同站保留方案接力。见 [行为与验收](followups_design.md#L1)。

## REQ-050 本地追问讲解（#44）

三个固定问题在离线模式下组织不同回应，保留完整简介与字段缺失说明，区分资料、比喻和观察方法。在线与会话契约沿用。范围和验收见 [设计](local_followups_design.md#L1)。

## REQ-051 按段听讲解（#46）

每条成功回答可回听全文或指定段落，保持草稿、当前景点、方案和方式，复用真实语音状态。范围与验收见 [设计](segmented_audio_design.md#L1)。

## REQ-052 跨景点主题讲解（#48）

一个问题串联灵山大佛、九龙灌浴、灵山梵宫，复用方案与讲解；本页回顾依据成功收到的唯一主题讲解响应。离线方法与简介、联网上下文、草稿编辑/取消和来源边界见 [已确认设计](superpowers/specs/2026-11-05-theme-guide-design.md#L1)。

## REQ-053 本地角色声线（#50）

已确认新声线接入：先显示文字、逐句取音频并预取下一句，沿用停止/打断/嘴型/回听，故障从未完成句回退系统声音。范围、限制与API-053/TEST-053见 [设计](local_voice_design.md#L1) 和 [运行手册](local_voice_runbook.md#L1)。入口：[LocalSpeechController.synthesize](../src/main/java/com/guide/controller/LocalSpeechController.java#L21)、[GuideLocalSpeech.create](../src/main/resources/static/js/local-speech.js#L16)。


## REQ-054～059 燕小北校园首版

需求由2026年11月9日已批准设计和实施计划冻结，当前分支交付状态以独立复审与PR合并记录为准。

| 需求与议题 | 本轮实现与范围 | 程序和验证 |
|---|---|---|
| REQ-054 / #52 | 五现行校区、26地点、7事项19变体、8素材，学综楼现行窗口与访客用途来源 | [目录](../src/main/java/com/guide/campus/CampusCatalog.java#L55)、[来源回归](../src/test/java/com/guide/campus/CampusCatalogTest.java#L95) |
| REQ-055 / #53 | 统一AssistantTurn、离线业务与六模型工具、受控场景、4～6建议、幂等取消和版本提交 | [chat](../src/main/java/com/guide/campus/CampusAssistantService.java#L74)、[模型往返](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L22) |
| REQ-056 / #54 | 按需设备定位、校时、天气时点、本部范围和地址预览、显式外部地图搜索 | [环境](../src/main/resources/static/js/campus-environment.js#L4)、[天气](../src/main/java/com/guide/campus/CampusWeatherService.java#L57)、[场景](../src/main/resources/static/js/campus-scene.js#L55) |
| REQ-057 / #55 | 前台饭点/图书馆轻邀约、忙态冷却、馆内静音、馆外清物理确认。教学区离开和校门事件由#61跟进，#55保持open追踪后续 | [陪伴](../src/main/resources/static/js/campus-companion.js#L16)、[馆内外](../src/test/java/com/guide/campus/CampusAssistantTest.java#L231) |
| REQ-058 / #56 | 燕小北二维人物舞台、实景、侧边陪伴、图片版本隔离，来源保留许可状态 | [页面](../src/main/resources/static/campus.html#L1)、[素材](../src/main/resources/static/media/campus/SOURCES.md#L1)、[前端测试](../tests/frontend/campus-page.test.js#L1) |
| REQ-059 / #57 | 午间与到馆模拟、持续标识、30秒停留加速、退出清除并重新定位 | [模拟](../src/main/resources/static/js/campus-environment.js#L120)、[退出回归](../src/test/java/com/guide/campus/CampusAssistantTest.java#L318) |

课堂操作、来源、模型/声音与手机待验边界见 [运行手册](campus_demo_runbook.md#L1)，六API见 [API-054a～f](api_reference.md#L252)，验证命令与本轮实际结果见 [TEST-054～059](test_reference.md#L1)。旧景区入口与数据继续独立保留，校园目录随JAR发布。


REQ-055最终复审补齐显式导航换目标和模型最终意图协调，餐厅实际选项可继续地点与导航。REQ-057覆盖library-area馆内分区静音、简短出馆清除物理位置，以及真实已确认地点的显式复核邀约。物理版本和普通轮次分别维护，保留旧调用方兼容规则。[换目标回归](../src/test/java/com/guide/campus/CampusAssistantTest.java#L75)、[模型实际选项](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L138)、[真实复核入口](../tests/frontend/campus-page.test.js#L7)


REQ-055限定复审补齐无关地点照片切换后的导航闭环。同业务地点及已知馆内分区的父馆照片按实际关联保留业务，显式无关照片建立新目标。[照片目标切换](../src/test/java/com/guide/campus/CampusAssistantTest.java#L149)、[模型增强与导航](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L217)
