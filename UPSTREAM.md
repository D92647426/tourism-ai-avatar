# 项目来源与版本切换

## 当前基线

- 来源：老师提供的 `软件杯7.16.rar`。
- 压缩包 SHA-256：`7a5a6063f507416b716d6aab03e3f9b907eb7bdb10bb8dcc133abfd19dcc860c`。
- 导入日期：2026-10-19。
- 选取压缩包内 `软件杯(1)/软件杯/` 为源码根目录。
- 基线包含 Java/Spring Boot 网页应用、Live2D 示例资源和 Android 源码。

## 导入时的处理

- 保留应用源码、网页、Live2D 库和示例模型、Android 源码，以及知识与显示配置。
- 排除 `target/`、Android `build/`、`.gradle/`、IDE/AI 工具个人设置、SDK 本机路径。
- 排除历史 `data/users.json` 和 `data/interactions.json`，由各自运行环境生成。
- 将配置中原有接口 Key 改为读取环境变量 `DEEPSEEK_API_KEY`，默认空值。
- Windows 启动脚本改为运行本项目 JAR，不再强行结束占用 8080 的其他进程。
- 保留并更新三人协作模板、文档和 GitHub 检查。应用业务逻辑沿用老师源码。

来源文件清单和校验值见 [import_manifest.json:L1](docs/import_manifest.json#L1)。压缩包未附项目级许可证，本仓库维持私有协作，保留原第三方库和模型的版权说明。

## 旧基线

此前使用的 LingTour 项目：https://github.com/2667741708/ling-shan-digital-guide 。

旧仓库内容保存在标签 `baseline-lingtour-20261019`，无需覆盖当前目录即可查看：

```bash
git show baseline-lingtour-20261019:README.md
```

Git 历史和团队远程地址保持可追踪。小组后续通过各自身份的 Issue、分支、提交与评审记录新增贡献。
