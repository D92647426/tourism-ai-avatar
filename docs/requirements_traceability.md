# 当前基线需求追踪

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

游客的多轮追问、景点切换、显式新对话、六轮上限与 20 分钟过期，见 [功能与验收说明](conversation_context.md)、[实现](../src/main/java/com/guide/service/ConversationService.java#L21) 和 [测试](../src/test/java/com/guide/service/ConversationServiceTest.java#L1)。
