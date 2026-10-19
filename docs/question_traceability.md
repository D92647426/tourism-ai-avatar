# 当前问题记录

## Q-0027 能否改为基于老师提供的项目？

已检查老师的压缩包，包含 Java/Spring Boot、HTML/JS 网页、Live2D 示例和 Android 源码。用户随后明确要求替换仓库内容，本次按 REQ-027 导入该基线。

定位：[UPSTREAM.md:L1](../UPSTREAM.md#L1)、[architecture.md:L1](./architecture.md#L1)、[team_setup.md:L1](./team_setup.md#L1)。

旧项目与此前讨论的完整文档保存在标签 baseline-lingtour-20261019。课设主创意尚未由小组共同确认。

## Q-0028 管理员账号是什么？

老师原版没有独立的管理员账号、默认管理员密码或管理角色校验。管理页直接访问 `/admin.html`；普通游客注册登录由另一组接口处理，不是管理员认证。

依据：[admin.html:L12](../src/main/resources/static/admin.html#L12)、[管理页请求 admin.js:L33](../src/main/resources/static/js/admin.js#L33)、[管理接口 AdminController.java:L17](../src/main/java/com/guide/controller/AdminController.java#L17)、[普通登录 AuthController.java:L62](../src/main/java/com/guide/controller/AuthController.java#L62)。

验证（2026-10-19）：本地未携带 Cookie 或认证头，GET `/admin.html` 和 GET `/api/admin/dashboard` 均返回 HTTP 200。当前预览地址为 http://127.0.0.1:8081/admin.html。仅记录现状，本次未新增账号或改动认证逻辑。

## Q-0029 哪些地方值得改进？

评估结果与三人分工见 [improvement_review.md:L1](./improvement_review.md#L1)。主要问题包括管理接口和密码字段、单轮对话、整句检索、固定路线、统计口径与语音口型状态。推荐以“今天你当导游”加景区内容包形成原创演示闭环；此处仅提供评估建议，未实现或正式选定新功能。

## Q-0030 数字人形象如何实现，是否容易改进和替换？

实现原理、配置边界与数字人制作路线见 [avatar_replacement.md:L1](./avatar_replacement.md#L1)。游客端实际由 main.js 直接加载 Haru；后台 modelName 尚未连接到加载器，不能只改配置字段或替换三视图图片。
