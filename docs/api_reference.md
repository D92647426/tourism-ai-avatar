# 当前 Java API 入口

## 公开与学生侧接口

| 方法与地址 | 用途 | 位置 |
|---|---|---|
| POST /api/chat | 输入 message、可选 interest，返回 reply、fallback 与推荐路线；匿名可用，但需 CSRF 头 | [ChatController.java:L22](../src/main/java/com/guide/controller/ChatController.java#L22) |
| GET /api/spots | 景点列表，可选 keyword | [SpotController.java:L23](../src/main/java/com/guide/controller/SpotController.java#L23) |
| GET /api/spots/{id} | 景点详情 | [SpotController.java:L33](../src/main/java/com/guide/controller/SpotController.java#L33) |
| GET /api/digital-human-config | 公开只读的数字人展示配置，不含用户/凭据 | [PublicConfigController.java:L34](../src/main/java/com/guide/controller/PublicConfigController.java#L34) |

空 Key 的聊天示例：请求 JSON 为 {"message":"hello"}，结果应有非空 reply，并标记 fallback；状态变更请求必须携带 `X-XSRF-TOKEN`。

## 认证接口（REQ-030）

| 方法与地址 | 用途 | 位置 |
|---|---|---|
| GET /api/auth/csrf | 取 CSRF token（Cookie 双提交：`XSRF-TOKEN` + 响应字段 token） | [AuthController.java:L60](../src/main/java/com/guide/controller/AuthController.java#L60) |
| POST /api/auth/register | 注册游客账号；忽略客户端传入的 role，永远 GUEST；密码 ≥4 位 | [AuthController.java:L76](../src/main/java/com/guide/controller/AuthController.java#L76) |
| POST /api/auth/login | 登录并建立服务端 HttpSession；成功返回 role；失败 401 | [AuthController.java:L103](../src/main/java/com/guide/controller/AuthController.java#L103) |
| GET /api/auth/me | 读取当前服务端身份；匿名 401 | [AuthController.java:L131](../src/main/java/com/guide/controller/AuthController.java#L131) |
| POST /api/auth/interest | 更新当前登录用户的兴趣；忽略客户端 userId；需登录 + CSRF | [AuthController.java:L150](../src/main/java/com/guide/controller/AuthController.java#L150) |
| POST /api/auth/logout | 退出并使服务端会话失效，返回 200 JSON | [SecurityConfig.java:L117](../src/main/java/com/guide/config/SecurityConfig.java#L117) |

所有认证响应使用独立 DTO（[UserView.java:L13](../src/main/java/com/guide/dto/UserView.java#L13)、[AuthResult.java:L13](../src/main/java/com/guide/dto/AuthResult.java#L13)），响应中不会出现 `password` 或 `passwordHash`。

## 管理接口

| 方法与地址 | 用途 | 位置 |
|---|---|---|
| /api/admin/** | 知识、配置、统计、用户列表等管理接口，服务端要求 ADMIN | [AdminController.java:L26](../src/main/java/com/guide/controller/AdminController.java#L26) |

## 认证与错误行为（2026-10-23 起）

- 服务端权限：匿名访问 `/api/admin/**` 返回 HTTP 401 JSON；已登录游客返回 HTTP 403 JSON；管理员正常 200。
- CSRF：写操作缺少或使用错误 token 返回 403（提示“CSRF 校验失败”），与匿名 401 明确区分；浏览器应通过 `/api/auth/csrf` 获取 token。
- 会话：登录会更换 session id（会话固定防护），退出会 invalidateHttpSession 并清除 JSESSIONID/XSRF-TOKEN；默认 30 分钟过期。
- 注册永远创建 GUEST，不会接受客户端注入的 ADMIN 角色。

## 管理后台入口与认证现状（已修复）

2026-10-19 的基线状态是“没有管理员账号、管理接口无认证、`/admin.html` 可直接打开、未认证 dashboard 返回 200”。GitHub #5 / REQ-030 已修复该状态：

- 后台 API 的保护由 [SecurityConfig.java:L137](../src/main/java/com/guide/config/SecurityConfig.java#L137) 的 `authorizeRequests` 强制执行，不依赖页面检查；
- 管理页进入时通过 [admin.js:L89](../src/main/resources/static/js/admin.js#L89) 调 `/api/auth/me` 校验身份，未登录显示管理员登录入口（[admin.html:L13](../src/main/resources/static/admin.html#L13)），游客显示无权限；
- 管理员由启动环境变量 `APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD` 初始化，默认不创建，见 [config_reference.md](./config_reference.md)。
