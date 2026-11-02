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

用户明确确认继续景区导览服务 AI 数字人。主线是景点讲解、游客问答与个性化游览，观察记录是自愿补充；#33/#34/#35和PR #36退回备选，未实现、不计作完成。当前实施#37讲解方式，见 [产品上下文](../PRODUCT.md#L3)、[REQ-046](narration_design.md#L1)。实现定位：[模式定义](../src/main/java/com/guide/model/NarrationMode.java#L1)、[会话处理](../src/main/java/com/guide/service/ConversationService.java#L78)、[页面同步](../src/main/resources/static/js/main.js#L235)。无新引擎依赖。
