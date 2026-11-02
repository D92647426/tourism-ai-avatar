# 第一轮整合与语音设置 Implementation Plan

> **For agentic workers:** Execute the checked tasks inline; follow repository conventions and verify before merging.

**Goal:** 将已验证的第一轮功能整合到 main，然后开发 #14。
**Architecture:** 保留原功能分支提交历史，在整合分支合并各依赖链并解决交叉修改。聊天使用单一请求生命周期，保留 CSRF、会话 ID、待发送景点选择与语音取消状态。
**Tech Stack:** Java 17 / Spring Boot、原生 JavaScript、Node tests、Python HTTP smoke。
**Spec:** GitHub #4、#14，以及各功能议题与 docs 中的验收记录。

## Global Constraints

不提交凭据或真实用户数据；不强推；不声称真实模型或 Android 已验收。

## Review Focus

- CSRF 与匿名/管理员边界在聊天、创意入口保持一致。
- 请求取消、重试、新会话与景点切换不能相互覆盖。
- 本地检索与当前景点追问必须组合工作。
- 数字人名称/主题配置和语音状态不互相覆盖。
- 音量 0、设备无中文声线和 Android 能力限制应准确呈现。

## Task 1：整合已提交功能

- [ ] 合并 #12（含 #5/#11）、#7（含 #6/#17/#19）、#8、#10（含 #9）、#13 的提交。
- [ ] 按上述边界解决 Java/JS/HTML/CSS/测试/文档冲突。
- [ ] Maven verify、全部 Node 测试、文档链接和真实 HTTP 冒烟通过。
- [ ] 检查整合 diff，创建整合 PR，等待该提交 CI，通过后合并并核对原 PR/议题状态。

## Task 2：#14 语音参数

- [ ] 检查整合后的 ConfigService、展示配置、admin/main 与 speech-lifecycle。
- [ ] 明确语速范围、音量 0 与实际设备声线标识；旧 male/female 显示兼容提示。
- [ ] 实现配置校验与公开 DTO、后台设备声线选择、Web 播报参数和 Android 限制提示。
- [ ] 对保存/加载/播报参数、不可用声线和停止行为添加针对性 mock 验证。
- [ ] 运行适用检查、提交 PR 与截图/验证记录，更新进度清单。
