# 三人协作约定

每人使用自己的 GitHub 账号、Git 姓名和邮箱。当前应用已切换为老师提供的 Java/Spring Boot 项目。

## 分工建议

| 角色 | 交付内容 |
|---|---|
| A：产品与网页交互 | 游客流程、页面、Live2D 交互 |
| B：后端与 AI | Java 接口、会话、模型与知识服务 |
| C：创意内容与质量 | 玩法、内容工具、验收与 Android 协作 |

分工由三人确认，每个人承担实际交付，并评审另一人的改动。

## 一项任务一个分支

在 Issue 写明目标、范围、负责人和验收方式。确认当前修改已保存或提交后，从最新 main 创建任务分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/任务简短英文名
```

AI 创建工作分支使用 `codex/` 前缀。分支名在命令中替换为实际值。

## 提交与评审

```bash
git status
git add 本次修改的文件
git diff --cached
git commit -m "feat: 本次完成的内容"
git push -u origin 当前分支名
```

创建目标为 main 的 Pull Request，关联 Issue，说明效果和验证结果，请另一人评审。页面改动附截图，接口改动附请求结果。处理具体检查失败后再合并。

## 检查

- Java 或资源改动：`mvn verify`。
- 启动与接口验证：`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。
- 文档：`python scripts/check_doc_links.py`。
- Android 改动在 Android Studio 中验证，说明使用的 SDK/设备；当前 CI 不验证 APK。

不要提交模型 Key、用户数据、聊天记录、编译缓存或自己的 SDK 路径。不向共享分支强推，修改公共接口和全局样式前在 Issue 协调。

每周汇总完成的 Issue、PR、演示效果和问题。报告区分老师源码的继承部分、小组新增和 AI 辅助内容，来源见 [UPSTREAM](UPSTREAM.md#L1)。

每次交付后更新 [议题进度清单](docs/issue_progress.md#L1)，向用户列出已合并完成、刚提交和后续内容；已提交未合并须明确标注，不等同于议题关闭。
