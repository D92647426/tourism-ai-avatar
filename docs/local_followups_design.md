# 本地追问讲解

## REQ-050

依赖 [追问卡](followups_design.md#L1)。旧版在无模型密钥时，三个追问模板返回同一段景点介绍。本轮为固定模板加入可离线验证的讲解组织方式。

只匹配完整问题“关于【实际景点名】，固定模板”。抓重点将完整简介、类别与通用观察方法排成三个部分。比喻先展示简介，再用看图画书类比观察顺序，标明其用途。细节回应先给简介作为资料线索，再请游客选一个实际可见的局部，描述形状或相对位置并留下待核对问题。各部分以资料摘录、比喻、观察建议区分。简介的限定语和缺失状态保留。

前端按钮由“30 秒抓重点”改为“抓重点”。模板正文保留兼容。完整匹配之外沿用原问答逻辑，未承诺开放式意图识别。先执行外景和多实体边界检查，再在已解析的唯一景点或当前景点上匹配模板。显式名字不同的模板不能套用旧景点。三个现有 narrationMode 值沿用，family 增加亲子轮流描述提示。

在线模型仍按原路径优先处理原始问题与历史，失败后进入同一本地回复路径。本地回应附原有静态课程示例提示，候选仍来自当次一次检索快照。

## API-050 与程序

复用 POST /api/chat 的 message、spotId、conversationId、narrationMode，响应 reply/fallback/knowledgeReferences 沿用。请求示例 `{"message":"关于【灵山大佛】，请把核心看点压缩为三句，方便我边走边听。","spotId":11,"narrationMode":"family"}`。返回 fallback=true 且 reply 为分块本地资料。既有 400/403/410/502 契约沿用。

[LocalFollowupReply](../src/main/java/com/guide/service/LocalFollowupReply.java#L1) 负责固定模板匹配和组织已有字段，返回匹配文本或 null；[ChatService](../src/main/java/com/guide/service/ChatService.java#L1) 在既有范围解析后使用，附统一资料边界。模板在此模块与 [前端卡片](../src/main/resources/static/js/chat-followups.js#L1) 同步维护，通过文件契约测试校验。

## TEST-050

[LocalFollowupReplyTest](../src/test/java/com/guide/service/LocalFollowupReplyTest.java#L1) 覆盖三种意图与模式、字段缺失和限定语、真实服务路径、外景/多实体/自定义名称、在线成功与失败、一次候选快照、前端模板契约。隔离 [HTTP 冒烟](../scripts/smoke_teacher_project.py#L1) 验证三模板回答不同且 spot/mode/fallback 一致。

运行 mvn -o verify、node --test tests/frontend/*.test.js、python scripts/check_doc_links.py、python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar。PR 以前置 codex/guide-followups 为 base，先合并 PR #43，再将本轮 PR 调整到 main。文档中的已实现与已合并状态分开记录。
