# 会话隔离与景点上下文（Issue #11）

## REQ-039：产品行为

游客可以连续追问当前景点，不必每句重复景点名。前端首次发送消息时不提供 `conversationId`，服务端创建会话并在响应中返回随机 ID；后续消息带回此 ID。游客可以点击“新对话”清空上下文。传入有效 `spotId` 会把该景点设为当前景点并清除之前景点的聊天记录；不传 `spotId` 时沿用当前景点，文本中明确提到其他景点也会切换。

会话只在当前浏览器的服务端 HTTP Session 中保存，管理员登录状态变化也会重置所属人不符的会话。随机 ID 是会话校验的一部分，单独拿到 ID 无法读取另一个浏览器的记录。请求里的旧 `userId` 不用于授权。最多保留六轮问答，闲置 20 分钟过期；这不是跨设备的永久记忆。

## API-039：接口约定

`POST /api/chat` 接受 JSON `{ "message": "它有什么故事", "conversationId": "...", "spotId": 1 }`。`conversationId` 和 `spotId` 可以省略。响应沿用 `reply`、`fallback`，增加当前 `conversationId` 和 `spotId`。`POST /api/chat/new` 接受 `{}`，返回新的 `{ "conversationId": "...", "spotId": null }`。两个写接口都使用现有 CSRF 令牌。

`message` 必须为 1–600 个非空字符，`spotId` 必须对应存在的景点，否则返回 400。其他会话的 ID、点击新对话后失效的 ID 返回 403；当前会话闲置过期并携带原 ID 返回 410。模型调用失败且没有可用回复时，不将这次问答写入历史。已有本地兜底答复是成功回复，会进入历史并以 `fallback: true` 标明。

## 实现与限制

[ConversationService.java](../src/main/java/com/guide/service/ConversationService.java#L21) 在 HTTP Session 中管理会话、景点和六轮问答。[ChatService.java](../src/main/java/com/guide/service/ChatService.java#L110) 在模型请求中按顺序放入当前景点、历史消息和新问题。网页入口见 [index.html](../src/main/resources/static/index.html#L91) 与 [main.js](../src/main/resources/static/js/main.js#L202)。

当前验证使用模型 HTTP mock 和无模型密钥的本地兜底；没有验证真实第三方模型的回答质量。景点事实来源仍是项目的景点数据，不能把模型回答当作已核验事实。此分支基于 #5 身份认证分支；#6 聊天可靠性改动在另一条分支，合并前需将两条分支的前端聊天逻辑整合并复测。

## TEST-039：验收证据

[ConversationServiceTest.java](../src/test/java/com/guide/service/ConversationServiceTest.java#L1) 覆盖访客隔离、登录主体切换、景点切换、失败不入历史、过期和长度边界；[ChatHistoryRequestTest.java](../src/test/java/com/guide/service/ChatHistoryRequestTest.java#L1) 检查真实发往模型的消息顺序；[conversation.test.js](../tests/frontend/conversation.test.js#L1) 检查前端 ID 传递、新对话、CSRF 和过期提示；[smoke_teacher_project.py](../scripts/smoke_teacher_project.py#L1) 用真实 HTTP 与两个 Cookie 容器验证跨会话拒绝、景点切换及重置。运行 `mvn -o clean verify`、`node --test tests/frontend/*.test.js` 与冒烟脚本。
