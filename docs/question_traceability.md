# 当前问题记录

## Q-0027 能否改为基于老师提供的项目？

已检查老师的压缩包，包含 Java/Spring Boot、HTML/JS 网页、Live2D 示例和 Android 源码。用户随后明确要求替换仓库内容，本次按 REQ-027 导入该基线。

定位：[UPSTREAM.md:L1](../UPSTREAM.md#L1)、[architecture.md:L1](./architecture.md#L1)、[team_setup.md:L1](./team_setup.md#L1)。

旧项目与此前讨论的完整文档保存在标签 baseline-lingtour-20261019。课设主创意尚未由小组共同确认。

## Q-0028 管理员账号是什么？

初始基线（2026-10-19，老师原版）：没有独立的管理员账号、默认管理员密码或管理角色校验。管理页直接访问 `/admin.html`；普通游客注册登录由另一组接口处理，不是管理员认证。以下记录保留为历史基线，现状已由 REQ-030 修复。

基线依据：[admin.html:L13](../src/main/resources/static/admin.html#L13)、[管理页请求 admin.js](../src/main/resources/static/js/admin.js)（初始基线的行号已随 REQ-030 改动失效，此处不写旧行号）、[管理接口 AdminController.java:L26](../src/main/java/com/guide/controller/AdminController.java#L26)、[普通登录 AuthController.java:L103](../src/main/java/com/guide/controller/AuthController.java#L103)。

基线验证（2026-10-19）：本地未携带 Cookie 或认证头，GET `/admin.html` 和 GET `/api/admin/dashboard` 均返回 HTTP 200。

现状（2026-10-23，[REQ-030](./requirements_traceability.md)）：管理员通过环境变量初始化；`/api/admin/**` 由 [SecurityConfig.java:L137-L138](../src/main/java/com/guide/config/SecurityConfig.java#L137-L138) 在服务端强制 ADMIN；管理页用 [admin.js:L150](../src/main/resources/static/js/admin.js#L150) 校验服务端身份；用户列表改用 [UserView.java:L13](../src/main/java/com/guide/dto/UserView.java#L13)，响应不含密码字段。认证接口见 [API-030](./api_reference.md)，验证见 [TEST-030](./test_reference.md)。

## Q-0029 哪些地方值得改进？

评估结果与三人分工见 [improvement_review.md:L1](./improvement_review.md#L1)。主要问题包括管理接口和密码字段、单轮对话、整句检索、固定路线、统计口径与语音口型状态。推荐以“今天你当导游”加景区内容包形成原创演示闭环；此处仅提供评估建议，未实现或正式选定新功能。

## Q-0030 数字人形象如何实现，是否容易改进和替换？

实现原理、配置边界与数字人制作路线见 [avatar_replacement.md:L1](./avatar_replacement.md#L1)。游客端实际由 main.js 直接加载 Haru；后台 modelName 尚未连接到加载器，不能只改配置字段或替换三视图图片。

## Q-0031 现在的主题是什么，如何继续？

用户明确确认继续景区导览服务 AI 数字人。主线是景点讲解、游客问答与个性化游览，观察记录是自愿补充；#33/#34/#35和PR #36退回备选，未实现、不计作完成。当前实施#37讲解方式，见 [产品上下文](../PRODUCT.md#L3)、[REQ-046](narration_design.md#L1)。实现定位：[模式定义](../src/main/java/com/guide/model/NarrationMode.java#L1)、[会话处理](../src/main/java/com/guide/service/ConversationService.java#L78)、[页面同步](../src/main/resources/static/js/main.js#L240)。无新引擎依赖。

## REQ-053：能否换新声线并及时回复？

可以使用常驻、预热和分句预取降低等待；文字回复不等待配音。不能把独立引擎2.4秒基准当作完整LLM问答延迟；当前文字接口仍整包返回。正式接入和限制见 [设计](local_voice_design.md#L1)、[运行](local_voice_runbook.md#L1)。

## Q-0032 校园改版与持续主动互动怎样推进

2026年11月9日用户确认调整为北工大校园助手，服务新生及访客。开场人物居中问好，底部对话自动出现，DS按需调出内容，人物让到侧边。建议共4～6项且包含继续追问、自定义。位置、时间和天气作为上下文，选定后从助手内预览进入外部导航。

持续陪伴先覆盖页面可见阶段，主动气泡获得用户回应后再展开。课堂轨迹模拟明确标注。事务知识区分校区、人群和办理目标，实景图绑定具体地点。用户已确认以补卡、图书馆、饭点邀约三组场景形成首个Demo。需求REQ-054至REQ-059、数据、状态、分阶段实施与验收见[首版设计](superpowers/specs/2026-11-09-campus-assistant-design.md#L1)，校园事实与缺口见[核验记录](bjut_campus_research.md#L1)。

实际代码当前仍为景区实现，迁移入口依据[会话服务](../src/main/java/com/guide/service/ConversationService.java#L78)、[模型客户端](../src/main/java/com/guide/service/AiCompletionClient.java#L157)和[语音生命周期](../src/main/resources/static/js/speech-lifecycle.js#L447)展开。书面设计复核后编写实施计划，当前验证范围为文档和来源核验。
