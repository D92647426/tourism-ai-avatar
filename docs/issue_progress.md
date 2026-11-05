# 议题进度（2026-11-02）

此表在本轮交付时根据 GitHub 状态核对；后续状态以议题和 PR 页面为准。“已实现”表示代码与验证已提交，只有合并并关闭后才算正式完成。

## 已合并完成

整合 PR [#27](https://github.com/D92647426/tourism-ai-avatar/pull/27) 已合入 main（ed420be），下列第一轮功能议题均已合并关闭。#14 后续由 PR #28 合入 main（f19098b）。

## 已合并议题清单

| 议题 | 内容 | PR | 本轮状态 |
|---|---|---|---|
| [#5](https://github.com/D92647426/tourism-ai-avatar/issues/5) | 管理员权限与密码保护 | [#15](https://github.com/D92647426/tourism-ai-avatar/pull/15) | 已合并并关闭 |
| [#6](https://github.com/D92647426/tourism-ai-avatar/issues/6) | 聊天超时、取消与重试 | [#16](https://github.com/D92647426/tourism-ai-avatar/pull/16) | 已合并并关闭 |
| [#7](https://github.com/D92647426/tourism-ai-avatar/issues/7) | 语音、口型与数字人状态 | [#22](https://github.com/D92647426/tourism-ai-avatar/pull/22) | 已合并并关闭 |
| [#8](https://github.com/D92647426/tourism-ai-avatar/issues/8) | 名称、欢迎语与主题配置 | [#24](https://github.com/D92647426/tourism-ai-avatar/pull/24) | 已合并并关闭 |
| [#9](https://github.com/D92647426/tourism-ai-avatar/issues/9) | 知识错配与乱码 | [#21](https://github.com/D92647426/tourism-ai-avatar/pull/21) | 已合并并关闭 |
| [#10](https://github.com/D92647426/tourism-ai-avatar/issues/10) | 自然提问与知识检索 | [#23](https://github.com/D92647426/tourism-ai-avatar/pull/23) | 已合并并关闭 |
| [#11](https://github.com/D92647426/tourism-ai-avatar/issues/11) | 多轮对话与当前景点 | [#25](https://github.com/D92647426/tourism-ai-avatar/pull/25) | 已合并并关闭 |
| [#13](https://github.com/D92647426/tourism-ai-avatar/issues/13) | 后台统计口径 | [#20](https://github.com/D92647426/tourism-ai-avatar/pull/20) | 已合并并关闭 |
| [#17](https://github.com/D92647426/tourism-ai-avatar/issues/17) | 观察任务与可复用内容包 | [#18](https://github.com/D92647426/tourism-ai-avatar/pull/18) | 已合并并关闭 |
| [#19](https://github.com/D92647426/tourism-ai-avatar/issues/19) | 有来源的讲解搭档 | [#18](https://github.com/D92647426/tourism-ai-avatar/pull/18) | 已合并并关闭 |
| [#12](https://github.com/D92647426/tourism-ai-avatar/issues/12) | 景点详情提问入口 | [#26](https://github.com/D92647426/tourism-ai-avatar/pull/26) | 已合并并关闭 |
| [#14](https://github.com/D92647426/tourism-ai-avatar/issues/14) | 语速、静音与设备声线 | [#28](https://github.com/D92647426/tourism-ai-avatar/pull/28) | 已合并并关闭 |
| [#29](https://github.com/D92647426/tourism-ai-avatar/issues/29) | 游览导演与情境方案 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |
| [#30](https://github.com/D92647426/tourism-ai-avatar/issues/30) | 可选观察与草稿衔接 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |
| [#31](https://github.com/D92647426/tourism-ai-avatar/issues/31) | 游客界面与手机聊天 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |

## 本轮开发（主题收拢）

PR #32 已合入 main（a40f763），#29/#30/#31均关闭。用户确认主线为景区数字人导览，本轮实施 [#37](https://github.com/D92647426/tourism-ai-avatar/issues/37) 标准/亲子/精简讲解，已提交 [PR #40](https://github.com/D92647426/tourism-ai-avatar/pull/40)，已合并（b686d01），#37已关闭。设计见 [REQ-046](narration_design.md#L1)。

研究PR [#36](https://github.com/D92647426/tourism-ai-avatar/pull/36)关闭保留；[#33](https://github.com/D92647426/tourism-ai-avatar/issues/33)、[#34](https://github.com/D92647426/tourism-ai-avatar/issues/34)、[#35](https://github.com/D92647426/tourism-ai-avatar/issues/35)以not planned关闭并退回备选，不是开发完成。不会自动继续剧情、AR或多人证据板。

第一轮总计划 [#4](https://github.com/D92647426/tourism-ai-avatar/issues/4) 已全部勾选并关闭。

## 本轮合并交付清单

本节随 [PR #41](https://github.com/D92647426/tourism-ai-avatar/pull/41) 进入main时生效；评审分支不等于已合并，当前状态以GitHub页面为准。前置PR #40已合并。

| 议题 | 内容 | 合并交付 |
|---|---|---|
| [#37](https://github.com/D92647426/tourism-ai-avatar/issues/37) | 标准/亲子/精简讲解 | PR #40 已合并并关闭 |
| [#38](https://github.com/D92647426/tourism-ai-avatar/issues/38) | 当前站/下一站讲解衔接 | 随 PR #41 合并关闭 |
| [#39](https://github.com/D92647426/tourism-ai-avatar/issues/39) | 同次回答的参考候选 | 随 PR #41 合并关闭 |

## 后续开发与团队工作

| 议题 | 后续内容 |
|---|---|
| [#1](https://github.com/D92647426/tourism-ai-avatar/issues/1) | 三人确认主创意、分工和 90 秒演示脚本；已有创意功能原型，仍需小组决定 |
| [#2](https://github.com/D92647426/tourism-ai-avatar/issues/2) | 各成员实际跑通环境、提交与互审首个 PR |
| [#3](https://github.com/D92647426/tourism-ai-avatar/issues/3) | 汇总上游复用与小组新增证据，核对素材和代码授权 |

## 本轮验证和整合事项

整合版 Java221/221、Node152/152，文档链接、隔离HTTP冒烟和GitHub CI通过后合并。#14 后续新增至Node156项；真实后台验证保存重载音量0、语速0.75与设备声线，见 [语音验收](voice_settings.md#L17)。第三方真实模型、扬声器音质与Android真机未验收。

此前各功能文档中的分支依赖属于提交时状态，整合已完成；后续开发从最新main开始。本表不替小组成员记录不存在的开发或评审贡献。

本轮新功能与截图见 [设计验收](director_design.md#L3)。后续仍需#1/#2/#3的团队确认、互审联调与来源证据，以及真实场景/模型/设备验收。

本轮#37：Java228/228、Node164/164、文档链接、隔离HTTP冒烟及桌面/手机/短横屏验证通过；双轴复查3项需求发现均修正，规范无剩余问题。详情与截图见 [交付记录](narration_design.md#L33)。

本轮用户明确要求开发#38/#39并合并；先合入前置PR #40（#37），之后按 [REQ-047/048](journey_references_design.md#L1)开发，Java228/228、Node176/176、文档链接、隔离HTTP和桌面/手机/短横屏通过，双轴复查无剩余项；按用户授权通过PR #41合并。

## 2026-11-05 追问卡开发

前置 #37/#38/#39 已合并关闭。新增 [#42 导游追问卡](https://github.com/D92647426/tourism-ai-avatar/issues/42)，实现抓重点、比喻和细节问题的显式草稿及历史回答选站。开发位于独立工作区，保留主仓库已有路径文档修改。交付采用 PR，提交与合并状态以 GitHub 为准。

Java 228/228、Node 185/185、文档链接、隔离 HTTP 以及桌面/手机/短横屏检查通过。详情见 [REQ-049](followups_design.md#L1)。后续 #1 小组确认与演示、#2 成员首 PR/互审、#3 来源和贡献证据仍开放，需记录真实小组活动。

本轮交付 [PR #43](https://github.com/D92647426/tourism-ai-avatar/pull/43)，#42 已实现并提交，待评审合并；不是已关闭议题。Standards 与 Spec 独立复查均 0 发现。当前已合并功能包括 #37/#38/#39，后续团队事项为 #1/#2/#3。

## 2026-11-05 本地追问讲解

[#44](https://github.com/D92647426/tourism-ai-avatar/issues/44) 修复三个固定追问在本地返回同一介绍的问题，已提交 [PR #45](https://github.com/D92647426/tourism-ai-avatar/pull/45)。这是依赖 PR #43 的增量 PR，先合并 #43，再将 #45 调整到 main。当前 #42 与 #44 均开放待合并。上轮 #37/#38/#39 已合并完成，#1/#2/#3 仍为团队后续事项。

Java 236/236、Node 185/185、数据工具 44/44、文档链接、隔离 HTTP 与桌面/手机/短横屏通过。两项独立复查均 0 发现。完整范围与截图见 [REQ-050](local_followups_design.md#L1)。原主仓库三份路径文档修改保持原状。

## 2026-11-05 合并与讲解回听

用户明确要求合并后继续。PR #43 已合入 main（4d26533），随后将 PR #45 的目标调整为 main，核对相同运行代码与通过的 CI 后合并（9720555）。#42、#44 已完成关闭。前述待合并文字为各轮提交时记录，以本节及 GitHub 为当前状态。

本地主仓库 main 已同步，三份未提交路径文档修改按原差异恢复并核对一致。本轮从 9720555 开发 [#46 按段听讲解](https://github.com/D92647426/tourism-ai-avatar/issues/46)，详情见 [REQ-051](segmented_audio_design.md#L1)。#1/#2/#3 仍为团队后续事项。

本轮新增 #46 已实现并提交 [PR #47](https://github.com/D92647426/tourism-ai-avatar/pull/47)，待评审合并，议题保持开放。已合并完成包括 #37/#38/#39/#42/#44，后续 #1/#2/#3 继续由团队推进。Java236、Node199、工具44、HTTP及桌面/手机/短横屏通过；两项独立复查发现的同一P2已修复并确认，实际语音截图使用无声mock。完整证据见 [交付记录](segmented_audio_design.md#L29)。

## 2026-11-05 主题讲解首版

PR #47 已按用户授权合并（036e6cd），#46已完成关闭。用户确认离线完整、联网增强的主题讲解设计后，新增 [#48](https://github.com/D92647426/tourism-ai-avatar/issues/48)，已实现并提交 [PR #49](https://github.com/D92647426/tourism-ai-avatar/pull/49)，待评审合并，议题保持开放。

本轮为一条主题线、三站衔接及成功响应回顾，复用原方案、模式、草稿和回听。Java245/245、Node210/210、工具44/44、文档/结构/隔离HTTP/桌面手机短屏通过。两轴复查发现已修复并确认，详细证据见 [设计验收](superpowers/specs/2026-11-05-theme-guide-design.md#L39)。

当前已合并完成包括 #37/#38/#39/#42/#44/#46。本轮待合并为#48/PR49。后续#1三人分工与演示、#2成员首PR和互审、#3来源授权及贡献证据继续开放。真实模型、景区事实和Android真机仍需另行验收。
