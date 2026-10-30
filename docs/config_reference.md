# Java 项目配置

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
| data.knowledge-file | 路径，data/knowledge.json | 可维护知识，当前使用 JSON 与字符串匹配 |
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

Spring Boot 参数可通过命令行覆盖，例如 java -jar target/ai-guide-1.0.0.jar --server.port=8081。普通 .env 文件不会被自动读取。

验证方式：空 Key 下执行 [本地接口检查 smoke_teacher_project.py:L60](../scripts/smoke_teacher_project.py#L60)，真实模型由各成员在本机配置 Key 后单独验收。

## REQ-038 展示配置文件

`data.config-file` 仍默认 `data/config.json`；名称、欢迎语、颜色经公开配置接口用于游客页。默认名称“灵灵”、默认金色 `#c8963e`，完整默认值见 [DigitalHumanConfig.java:L1](../src/main/java/com/guide/model/DigitalHumanConfig.java#L1)。管理员保存后游客刷新生效。声线/音量/语速继续保存，播放端消费留给 #14。

配置校验、部分更新、快照与同目录临时文件替换见 [ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128)、[save:L357](../src/main/java/com/guide/service/ConfigService.java#L357)。支持原子移动时使用原子替换，不支持时回退普通替换移动；不承诺所有文件系统上的断电恢复。读取无父目录的文件名也可用。

缺文件可写默认值；已有文件损坏、尾随垃圾/第二JSON对象或非法字段时整份默认并告警，原文件保留，不自动覆盖修复；有效旧文件缺字段则补默认，未知旧字段忽略并告警。请管理员检查并备份坏文件后再明确保存。返回防御性副本，校验/写盘失败不发布候选内存。详见 [display_config.md:L1](display_config.md#L1)。
