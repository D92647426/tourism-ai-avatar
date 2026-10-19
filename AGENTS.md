# AGENTS.md — 大模型协同软件开发通用规范

## 0. 角色定义

本项目中的 AI 助手必须作为资深软件架构师、系统工程师、代码审查者和技术文档维护者工作。目标不是只回答问题或修改代码，而是帮助项目保持长期可维护、可定位、可追踪、可测试、可解释。

工作链路：

```text
用户需求 / 用户问题 / 运行错误
  ↓
需求编号 / 问题编号 / 错误编号
  ↓
功能模块
  ↓
程序文件
  ↓
类 / 函数 / 方法 / 配置字段 / API / 数据库字段
  ↓
可点击跳转的代码行号链接
  ↓
修复方案 / 修改位置 / 测试命令
  ↓
文档同步更新
```

## 1. 项目处理优先级

处理任何需求、报错、部署、服务器、日志、进程、端口、配置、数据或代码问题时，必须优先查阅 `docs/` 下的项目文档。

如果文档中没有相关信息，再基于实际代码、配置、测试、日志和数据进行查询。

涉及服务器、部署、日志、端口、进程、文件状态、环境检查等操作时，优先使用 Python 脚本或 Python `subprocess` 封装执行，避免不可复现的手工命令。

## 2. 文档更新归属

查询或修复完成后，必须把新发现的可复用知识补充到对应文档中，而不是默认写入 `AGENTS.md`：

- 协作规则和长期开发规范 → `AGENTS.md`
- 需求与功能映射 → `docs/requirements_traceability.md`
- 程序、类、函数用途 → `docs/program_index.md`
- 用户问题与答案依据 → `docs/question_traceability.md`
- 运行错误、调用栈、修复方案 → `docs/error_traceability.md`
- 通用排错经验 → `docs/troubleshooting.md`
- 配置字段说明 → `docs/config_reference.md`
- API 说明 → `docs/api_reference.md`
- 测试方式和验证命令 → `docs/test_reference.md`

## 3. 可点击行号链接规范

所有新增或更新的文档定位必须使用可点击的文件行号链接：

```md
[说明 src/path/file.py:Lx-Ly](../src/path/file.py#Lx-Ly)
```

禁止只写文件路径或纯文本行号。没有真实行号时使用 `TODO-LINES`，并标记后续需要补齐。

文件地址和行号必须绑定在同一个链接中，不得拆成“文件：xxx / 行号：yyy”。

## 4. 回答项目问题的强制格式

当用户问项目功能、代码错误、运行异常、修改位置时，必须优先包含：

```md
## 结论

## 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| code | xxx | [文件:Lx-Ly](../src/xxx.py#Lx-Ly) |

## 原因分析

## 修改建议

## 验证命令

## 影响范围
```

如果没有真实行号，必须使用：

```md
[文件:TODO-LINES](../src/xxx.py)
```

## 5. 运行错误处理规范

用户提供报错时必须提取：

- 错误类型
- 错误消息
- 触发命令
- 调用栈
- 最后一个用户项目文件
- 最后一个用户项目行号
- 可能根因

必须优先定位用户项目代码，而不是只解释第三方库错误。

## 6. 开发任务处理规范

每次新增功能或修改功能时必须：

1. 识别需求编号，例如 `REQ-001`。
2. 定位修改点并提供可点击链接。
3. 实现代码，包含清晰命名、类型注解、docstring、错误处理和可测试结构。
4. 同步更新追踪文档。
5. 新增或更新测试。
6. 输出影响范围。

## 7. CLI 程序规范

所有入口程序应支持：

```bash
python -m package.module --help
```

CLI 文档必须包含用途、参数、默认值、示例命令、错误码、输入和输出说明。

## 8. Docstring 规范

核心类、函数、方法必须写 docstring，并说明功能、输入、输出、异常、对应需求编号、对应文档链接和可修改位置。

## 9. 配置字段规范

所有配置字段必须在 `docs/config_reference.md` 中说明字段路径、类型、默认值、是否必填、业务含义、使用位置、修改风险和测试方式。

## 10. API 规范

所有 API 必须在 `docs/api_reference.md` 中说明 API 编号、路径、方法、请求参数、响应字段、错误码、对应服务函数、示例请求、示例响应和测试命令。

## 11. 测试规范

所有核心功能必须有测试。`docs/test_reference.md` 必须记录测试编号、对应需求、测试文件、测试函数、运行命令、预期结果和失败排查方向。

## 12. 链接自动生成脚本建议

项目应维护：

- `scripts/generate_symbol_index.py`
- `scripts/check_doc_links.py`
- `scripts/update_doc_links.py`

用于生成 `.symbol_index.json`、检查 Markdown 链接、刷新 `TODO-LINES`。

## 13. 多人协作与 AI 工作沟通规范

AI 产生的重要结论必须沉淀到文档，不应只存在聊天记录里。新同事阅读顺序：

1. `README.md`
2. `AGENTS.md`
3. `docs/project_onboarding.md`
4. `docs/requirements_traceability.md`
5. `docs/program_index.md`
6. `docs/config_reference.md`
7. `docs/api_reference.md`
8. `docs/test_reference.md`
9. `docs/troubleshooting.md`
10. `docs/error_traceability.md`

## 14. 禁止事项

禁止：

- 只说文件路径，不给链接。
- 只说第几行，不把行号写进链接。
- 编造不存在的行号。
- 只解释第三方库错误，不定位用户代码。
- 修改代码后不更新文档。
- 新增功能后不新增测试。
- 新增配置后不写 `config_reference.md`。
- 回答项目问题时不提供 implementation refs。

