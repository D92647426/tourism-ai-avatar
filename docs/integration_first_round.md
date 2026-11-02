# 第一轮整合记录（2026-11-02）

## REQ-041：将已提交能力汇入主分支

用户授权合并此前具备条件的 PR。整合分支保留 #15/#16/#18/#20/#21/#22/#23/#24/#25/#26 的原提交，处理共同修改点后创建整合 PR。不会将当前 CI 通过等同于真实模型或 Android 真机验收。

## 交叉行为约定

聊天使用统一请求控制器，传送 CSRF、conversationId 和一次性的详情 spotId；重开或切换景点时清除旧重试。探索页在服务端确认身份后才绑定本地手册空间。探索草稿与聊天消息统一为最多 5000 UTF-16 字符，历史依然最多六轮、20 分钟闲置过期。

别名和会话切换使用同一实体词典；仅有一个明确实体时切换当前景点并清空旧历史。知识检索结果一次生成，模型请求、离线回答与引用使用同一份结果。模型调用统一经过带连接/读取超时和严格响应解析的 AiCompletionClient；历史作为 user/assistant 消息附加，不提升为系统指令。

## TEST-041：组合验收

[ConversationServiceTest](../src/test/java/com/guide/service/ConversationServiceTest.java#L1) 增加“别名→代词”与创意长草稿回归；[spot-chat.test.js](../tests/frontend/spot-chat.test.js#L1) 增加重开清除旧重试。此前测试夹具接入真实认证/配置/语音模块，分别保留模型 mock、自然检索和安全集成验证。

命令：`mvn -o verify`、`node --test tests/frontend/*.test.js`、`python scripts/check_doc_links.py`、`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。失败时优先检查 AuthGuard 启动顺序、请求控制器重试快照、会话实体识别和模型客户端注入。

浏览器和 Android 的真实声线质量仍需设备验收；#14 在主分支整合后继续开发。原功能文档中的分支依赖说明记录其提交时状态，最新合并状态以 [进度表](issue_progress.md#L1) 为准。
