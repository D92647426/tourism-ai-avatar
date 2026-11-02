# 议题进度（2026-11-02）

此表在本轮交付时根据 GitHub 状态核对；后续状态以议题和 PR 页面为准。“已实现”表示代码与验证已提交，只有合并并关闭后才算正式完成。

## 已合并完成

整合 PR [#27](https://github.com/D92647426/tourism-ai-avatar/pull/27) 已合入 main（ed420be），下列第一轮功能议题均已合并关闭。#14 后续由 PR #28 合入 main（f19098b）；#29/#30/#31 由 PR #32 合入 main（a40f763）。

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
| [#29](https://github.com/D92647426/tourism-ai-avatar/issues/29) | 游览导演、情境重排、逐站理由 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |
| [#30](https://github.com/D92647426/tourism-ai-avatar/issues/30) | 观察辅助、草稿保留、旅程衔接 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |
| [#31](https://github.com/D92647426/tourism-ai-avatar/issues/31) | 游客界面与手机聊天 | [#32](https://github.com/D92647426/tourism-ai-avatar/pull/32) | 已合并并关闭 |

## 本轮研究与新提交议题

本轮先完成官方来源选型、主次计划、90秒演示脚本和三人分工建议，研究文档已提交 [PR #36](https://github.com/D92647426/tourism-ai-avatar/pull/36)，待评审，没有接入新引擎。详见 [创意路线](research/2026-11-02-creative-roadmap.md#L1)、[一手来源](research/2026-11-02-ar-story-panorama-sources.md#L1)。下列是刚创建的待开发议题，不是已实现功能。

| 议题 | 内容 | 状态 |
|---|---|---|
| [#33](https://github.com/D92647426/tourism-ai-avatar/issues/33) | P0：inkjs 一幕可重玩的景区推理故事 | 下一步优先开发；单设备两角色、三决策节点、两个结尾 |
| [#34](https://github.com/D92647426/tourism-ai-avatar/issues/34) | P1：MindAR 实体证据卡与手动回退 | 依赖 #33，须真实手机/HTTPS验收 |
| [#35](https://github.com/D92647426/tourism-ai-avatar/issues/35) | P2：双人互补线索与共享证据板验证 | #33 稳定后验证收益，再决定是否引入 Yjs |


第一轮总计划 [#4](https://github.com/D92647426/tourism-ai-avatar/issues/4) 已全部勾选并关闭。

## 后续开发与团队工作

| 议题 | 后续内容 |
|---|---|
| [#1](https://github.com/D92647426/tourism-ai-avatar/issues/1) | 三人确认主创意、分工和 90 秒演示脚本；已有创意功能原型，仍需小组决定 |
| [#2](https://github.com/D92647426/tourism-ai-avatar/issues/2) | 各成员实际跑通环境、提交与互审首个 PR |
| [#3](https://github.com/D92647426/tourism-ai-avatar/issues/3) | 汇总上游复用与小组新增证据，核对素材和代码授权 |

## 本轮验证和整合事项

整合版 Java221/221、Node152/152，文档链接、隔离HTTP冒烟和GitHub CI通过后合并。#14 后续新增至Node156项；真实后台验证保存重载音量0、语速0.75与设备声线，见 [语音验收](voice_settings.md#L17)。第三方真实模型、扬声器音质与Android真机未验收。

此前各功能文档中的分支依赖属于提交时状态，整合已完成；后续开发从最新main开始。本表不替小组成员记录不存在的开发或评审贡献。

PR #32 新功能与截图见 [设计验收](director_design.md#L3)，其头提交 a952b3d 的两组GitHub CI成功后本轮合并。创意研究仅文档改动，验证文档链接与差异格式，不代表新引擎或真机已经测试。后续仍需#1/#2/#3的团队确认、互审联调与来源证据，以及真实场景/模型/设备验收。
