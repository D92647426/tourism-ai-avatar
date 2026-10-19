# 景区数字人课设 · 三人协作仓库

基于 LingTour AI 的课程项目。重点是探索景区导览的创意交互，数字人形象、最终项目名称与主创意由三人共同确定。

团队仓库：https://github.com/D92647426/whale-tour-course

## 先从这里开始

[给组员转发：AI 入组手册](docs/team_join_guide.md#L1)

| 想做什么 | 入口 |
|---|---|
| 第一次加入、分支开发、提交合并 | [三人协作说明](CONTRIBUTING.md#L1) |
| 克隆后启动项目、配置个人环境 | [团队上手指南](docs/team_setup.md#L1) |
| 看本阶段要做什么 | [GitHub Issues](https://github.com/D92647426/whale-tour-course/issues) |
| 讨论创意 | [创意方案（尚未定案）](docs/creative_directions.md#L1) |
| 查来源与贡献边界 | [来源说明](UPSTREAM.md#L1)、[保留的原始 README](README.upstream.md#L1) |

## 当前有什么

- Vue 3 + TypeScript 游客端与管理端。
- FastAPI 后端，PostgreSQL + pgvector 数据层。
- 问答、景区地图、规则路线推荐、游客评分、知识库维护与统计模块。
- 蓝鲸主题 Three.js 展示原型，支持旋转和状态预览。
- 前端状态测试、后端测试、文档链接检查和 GitHub 自动检查配置。

未配置模型 Key 时使用本地降级回答；后端语音、图片识景中仍有演示逻辑。精修角色、真实语音与创意玩法需要继续迭代，详见 [框架核查](docs/question_traceability.md#L719)。

## 快速运行

准备 Git、Docker Desktop，在根目录终端执行：

```powershell
Copy-Item .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

- 游客导览：http://127.0.0.1:8000/guide
- 地图：http://127.0.0.1:8000/map
- 管理端：http://127.0.0.1:8000/admin

默认开发管理员为 `admin / 123456`，只用于本机课程开发。个人 API Key 和管理员设置写入自己的 `.env`，该文件不会提交。

热更新、后端调试和检查命令见 [团队上手指南](docs/team_setup.md#L1)。

## 每次开发

1. Issue 写目标、负责人和验收方式。
2. 从最新 `main` 创建任务分支。
3. 小步提交，使用自己的 Git 姓名和邮箱。
4. 推送分支，创建 Pull Request，附效果与验证结果。
5. 另一位成员检查后合并。

`main` 保存能演示的版本。三人可同时开发不同任务，修改同一文件前在 Issue 沟通。

## 自动检查

推送与 Pull Request 会触发 [GitHub Actions](.github/workflows/checks.yml#L1)，执行前端测试与构建、后端测试、文档链接检查。实际运行结果查看仓库 Actions 页面。

## 更多文档

- [架构](docs/architecture.md#L1)
- [程序索引](docs/program_index.md#L1)
- [需求追踪](docs/requirements_traceability.md#L1)
- [测试说明](docs/test_reference.md#L1)
- [上游来源与贡献记录](UPSTREAM.md#L1)

已导入源码没有项目级 LICENSE。本次准备为私有团队仓库，没有为上游代码新增许可。课程报告应说明继承功能与本组新增贡献。
