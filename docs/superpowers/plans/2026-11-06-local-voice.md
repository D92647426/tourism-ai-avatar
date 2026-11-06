# Local Character Voice Implementation Plan

> **For agentic workers:** Execute natively task-by-task; finish with independent Standards and Spec review through code-review. User already authorized implementation.

**Goal:** 将已试听的本地声线接入网页讲解、停止及回听。
**Architecture:** 独立Python常驻推理进程，Java同源受控代理，浏览器逐句预取/播放适配现有语音生命周期。
**Tech Stack:** Java8/Spring Boot、UMD JavaScript、Python3.12、外置GPT-SoVITS/CUDA。
**Spec:** docs/local_voice_design.md

## Global Constraints

- 保留文字问答协议、用户主工作区文档修改及离线系统声音回退。
- 权重、参考音频、虚拟环境、运行数据均不得提交Git。
- 上游配置仅loopback、无重定向、12秒读取和4MiB响应上限。
- 仅真实播放事件动嘴，所有过期事件隔离。

## Review Focus

- 自动播放被拒绝时，明确显示回听提示，不反复调用系统声音。
- 已播放第一句后第二句失败，不重复第一句。
- 静音0、慢速0.5和长文本均受相同限额约束。
- 旧请求仍占GPU时新提问可取消旧前端并有界排队。
- 未登录、CSRF失败、禁用、损坏WAV和上游泄露均有测试。

### Task 1: 本地服务和Java代理

- [x] 写工作进程校验/并发单测与Java代理HTTP/身份边界测试，先运行并确认失败。
- [x] 实现 scripts/local_voice_server.py（--help，外置模型/预热/有界推理）和 LocalSpeechService/Controller。
- [x] 跑对应Python/Java测试；记录本机启动方式与配置。

### Task 2: 网页逐句播报与回退

- [x] 写分句/预取/取消/旧事件/播放拒绝/中途故障回退和真实main配置接线测试。
- [x] 实现 local-speech.js 的 create(options).speak(text,settings,hooks) 返回取消函数，hooks=start/resume/wait/end/fallback/error。
- [x] 接入 speech-lifecycle/main/index/admin/default config，保留原系统声线路径。
- [x] 跑目标前端测试，修复后完整Node测试。

### Task 3: 集成与交付

- [x] 补齐REQ/API/TEST/配置/程序/运行文档和真实代码行号。
- [x] 完整Maven/Node/Python/文档检查、隔离HTTP和真实浏览器播放/停止/服务关闭回退。
- [x] code-review双审，修复实际发现；提交并创建PR，等用户后续要求合并。

执行结果：已提交PR #51，问题#50待合并；实际验证与复查记录见[设计](../../local_voice_design.md#L1)。
