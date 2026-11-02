# 议题进度（2026-11-02）

此表在本轮交付时根据 GitHub 状态核对；后续状态以议题和 PR 页面为准。“已实现”表示代码与验证已提交，只有合并并关闭后才算正式完成。

## 已合并完成

整合 PR [#27](https://github.com/D92647426/tourism-ai-avatar/pull/27) 已合入 main（ed420be），下列11个功能议题已关闭。

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

## 本轮新开发

#14 语音参数生效已实现，刚提交 [PR #28](https://github.com/D92647426/tourism-ai-avatar/pull/28)：设备中文声线、音量0、语速、旧值兼容与Android参数回退。

## 后续开发与团队工作

| 议题 | 后续内容 |
|---|---|
| [#14](https://github.com/D92647426/tourism-ai-avatar/issues/14) | 本轮已开发，PR #28 待评审；合并后完成第一轮功能清单 |
| [#1](https://github.com/D92647426/tourism-ai-avatar/issues/1) | 三人确认主创意、分工和 90 秒演示脚本；已有创意功能原型，仍需小组决定 |
| [#2](https://github.com/D92647426/tourism-ai-avatar/issues/2) | 各成员实际跑通环境、提交与互审首个 PR |
| [#3](https://github.com/D92647426/tourism-ai-avatar/issues/3) | 汇总上游复用与小组新增证据，核对素材和代码授权 |
| [#4](https://github.com/D92647426/tourism-ai-avatar/issues/4) | 按依赖整合、回归验收，合并后勾选任务清单 |

## 本轮验证和整合事项

整合版 Java221/221、Node152/152，文档链接、隔离HTTP冒烟和GitHub CI通过后合并。#14 后续新增至Node156项；真实后台验证保存重载音量0、语速0.75与设备声线，见 [语音验收](voice_settings.md#L17)。第三方真实模型、扬声器音质与Android真机未验收。

此前各功能文档中的分支依赖属于提交时状态，整合已完成；后续开发从最新main开始。本表不替小组成员记录不存在的开发或评审贡献。
