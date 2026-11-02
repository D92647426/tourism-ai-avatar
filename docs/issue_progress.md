# 议题进度（2026-11-02）

此表在本轮交付时根据 GitHub 状态核对；后续状态以议题和 PR 页面为准。“已实现”表示代码与验证已提交，只有合并并关闭后才算正式完成。

## 已合并完成

暂无。本轮核对的所有功能 PR 仍待评审、合并。

## 已实现待合并

| 议题 | 内容 | PR | 本轮状态 |
|---|---|---|---|
| [#5](https://github.com/D92647426/tourism-ai-avatar/issues/5) | 管理员权限与密码保护 | [#15](https://github.com/D92647426/tourism-ai-avatar/pull/15) | 此前已提交，待评审 |
| [#6](https://github.com/D92647426/tourism-ai-avatar/issues/6) | 聊天超时、取消与重试 | [#16](https://github.com/D92647426/tourism-ai-avatar/pull/16) | 此前已提交，待评审 |
| [#7](https://github.com/D92647426/tourism-ai-avatar/issues/7) | 语音、口型与数字人状态 | [#22](https://github.com/D92647426/tourism-ai-avatar/pull/22) | 此前已提交，待评审 |
| [#8](https://github.com/D92647426/tourism-ai-avatar/issues/8) | 名称、欢迎语与主题配置 | [#24](https://github.com/D92647426/tourism-ai-avatar/pull/24) | 此前已提交，待评审 |
| [#9](https://github.com/D92647426/tourism-ai-avatar/issues/9) | 知识错配与乱码 | [#21](https://github.com/D92647426/tourism-ai-avatar/pull/21) | 此前已提交，待评审 |
| [#10](https://github.com/D92647426/tourism-ai-avatar/issues/10) | 自然提问与知识检索 | [#23](https://github.com/D92647426/tourism-ai-avatar/pull/23) | 此前已提交，待评审 |
| [#11](https://github.com/D92647426/tourism-ai-avatar/issues/11) | 多轮对话与当前景点 | [#25](https://github.com/D92647426/tourism-ai-avatar/pull/25) | 此前已提交，待评审 |
| [#13](https://github.com/D92647426/tourism-ai-avatar/issues/13) | 后台统计口径 | [#20](https://github.com/D92647426/tourism-ai-avatar/pull/20) | 此前已提交，待评审 |
| [#17](https://github.com/D92647426/tourism-ai-avatar/issues/17) | 观察任务与可复用内容包 | [#18](https://github.com/D92647426/tourism-ai-avatar/pull/18) | 此前已提交，待评审 |
| [#19](https://github.com/D92647426/tourism-ai-avatar/issues/19) | 有来源的讲解搭档 | [#18](https://github.com/D92647426/tourism-ai-avatar/pull/18) | 此前已提交，待评审 |
| [#12](https://github.com/D92647426/tourism-ai-avatar/issues/12) | 景点详情提问入口 | [#26](https://github.com/D92647426/tourism-ai-avatar/pull/26) | 刚提交，本地验证通过 |

## 后续开发与团队工作

| 议题 | 后续内容 |
|---|---|
| [#14](https://github.com/D92647426/tourism-ai-avatar/issues/14) | 让语速、音量（含 0）和实际可用声线控制播报；依赖 #7、#8 整合 |
| [#1](https://github.com/D92647426/tourism-ai-avatar/issues/1) | 三人确认主创意、分工和 90 秒演示脚本；已有创意功能原型，仍需小组决定 |
| [#2](https://github.com/D92647426/tourism-ai-avatar/issues/2) | 各成员实际跑通环境、提交与互审首个 PR |
| [#3](https://github.com/D92647426/tourism-ai-avatar/issues/3) | 汇总上游复用与小组新增证据，核对素材和代码授权 |
| [#4](https://github.com/D92647426/tourism-ai-avatar/issues/4) | 按依赖整合、回归验收，合并后勾选任务清单 |

## 本轮验证和整合事项

#12 本地 Java 48/48、Node 32/32、文档链接及真实 HTTP 冒烟通过。桌面和手机截图见 [验收记录](spot_chat_entry.md#L13)。第三方真实模型与 Android 真机未验收。

PR #26 → #25 → #15 为依赖链；#16 的前端请求生命周期合并时需与会话、景点选择整合。其他功能分支也应按各 PR 标注的基线整合并复测。本表不替小组成员记录不存在的开发或评审贡献。
