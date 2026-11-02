# 游客讲解方式 Implementation Plan

> **For agentic workers:** 按任务依次执行；用户已经授权继续开发，本轮由 Codex 原生执行，完成后按 code-review 技能分两轴复查。

**Goal:** 让游客按需要切换标准/亲子/精简讲解，并持续用于当前景点的追问。

**Architecture:** NarrationMode 白名单承载模式与模型提示，ConversationService 只在成功时提交本会话偏好。ChatService 兼容旧入口并在本地降级按现有景点字段组织回答；main.js 复用现有单请求/重试/语音生命周期。

**Tech Stack:** 现有 Java/Spring Boot、原生 JS、JUnit/Mockito 与 Node 内置测试，不增加依赖。

**Spec:** [REQ-046](../../narration_design.md#L1)。

## Global Constraints

- 保留 Cookie/CSRF、六轮对话/20分钟闲置和资料未核验边界。
- 标准 standard、亲子 family、精简 brief；非法值400；新对话standard。
- 只在用户主动提问时发送，无年龄采集、无localStorage模式保存。

## Review Focus

- 模式变更后旧重试不得继续带旧模式；前端测试覆盖。
- 失败的回答不能提交偏好；服务端回归覆盖。
- 无字段景点不得拼出null；离线测试覆盖。
- 切站保留模式，身份切换不沿用；会话测试覆盖。
- 窄屏聊天输入区不被新控件挤出；实际浏览器测量。

### Task 1: 服务端契约与回答

Files: 新建 NarrationMode.java、NarrationModeTest.java；修改 ChatRequest/ChatResponse、ConversationService、ChatService、相关现有mock测试。

Interfaces: request.narrationMode可省略；响应/快照总回显允许的字符串。ChatService.chat(message,interest,history,currentSpot,NarrationMode) 新重载，旧入口仍为standard。

- [x] 写会话偏好/失败/隔离、本地字段回答、模型system传递测试并确认未实现时失败。
- [x] 实现白名单、成功提交与两种本地组织方式，保留历史和景点。
- [x] 跑目标JUnit与现有会话/聊天控制器测试，检查0失败。

### Task 2: 游客入口与交付

Files: 修改 index.html、main.js、tour-experience.css、smoke_teacher_project.py；新建 narration.test.js；同步主题与追踪文档。

Interfaces: select.value与快照同步，sendMessage固定本次mode；切模式reset重试并停止旧语音，onSuccess用返回mode标记回答。

- [x] 写前端偏好恢复、主动发送、重试失效、忙态和新对话测试并确认失败。
- [x] 实现select/说明/标签与首页文案，保留草稿及原有观察能力。
- [x] 跑Node全套、Maven verify、文档链接和隔离HTTP smoke；桌面/手机实际操作截图。
- [x] 相对origin/main固定基点双轴代码复查，修正发现后针对性复测；提交PR并更新已完成/刚提交/后续议题。
