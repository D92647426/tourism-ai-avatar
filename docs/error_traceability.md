# Java 基线运行问题记录

## ERR-027-001 Windows 检查结束时临时日志被占用

触发：通过 Oracle javapath 的 java 代理运行 JAR 后，只终止父进程会遗留实际 JVM 子进程，导致临时 server.log 无法删除。

修复：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) 在 Windows 退出时停止自己创建的进程树，在其他系统终止自身进程；不按端口结束任意进程。

已重新执行同一检查，验证通过，测试 Java 进程正常退出。

## ERR-030-001 旧用户文件迁移失败时应用拒绝启动

触发：升级到 REQ-030 后首次启动，`data/users.json` 含旧版明文 `password`，但文件损坏、或某条记录既没有 `password` 也没有 `passwordHash`。

错误表现：启动失败并抛出 `IllegalStateException`（“读取用户数据失败”或“用户记录缺少密码凭据，无法完成迁移”），服务不会以空用户列表继续运行。

原因：迁移采取“失败即终止”策略，避免从空集合覆盖原文件。

修复与排查：

1. 不要删除原文件；迁移前已生成同目录 `users.json.bak-<时间戳>` 备份；
2. 按报错中的记录 id 打开 JSON 修复该条记录（补 `password` 或 `passwordHash`）；
3. 重新启动，成功后文件只保留 `passwordHash`，见 [UserService.java:L129](../src/main/java/com/guide/service/UserService.java#L129)。

## ERR-030-002 浏览器修改请求返回 403（CSRF 校验失败）

触发：前端在未先取 token、或没有携带 `X-XSRF-TOKEN` 头的情况下发送 POST/PUT/DELETE。

错误表现：HTTP 403，JSON `{"success":false,"message":"CSRF 校验失败，请刷新页面后重试"}`。

修复：统一使用 [security.js:L99](../src/main/resources/static/js/security.js#L99) 的 `AuthGuard.apiFetch`，它会先请求 `/api/auth/csrf` 并自动附带 token；新增页面脚本不要直接裸写 `fetch` 修改接口。注意 GET 请求不需要 CSRF。

## ERR-030-003 MockMvc 中文响应断言乱码

触发：集成测试读取含中文的响应体时使用 `MockHttpServletResponse.getContentAsString()`。

错误表现：断言失败，实际值形如 `æå½±æå°`（UTF-8 字节被按 ISO-8859-1 解码）。

原因：MockMvc 响应默认字符集是 ISO-8859-1，而 JSON 转换器写出的字节是 UTF-8。

修复：按字节读取后再用 UTF-8 解码，见 [SecurityIntegrationTest.java:L188](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L188) 的 `jsonBody` 辅助方法。

