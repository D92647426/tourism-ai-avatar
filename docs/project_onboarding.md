# 当前项目入门

老师提供的源码已成为 main 基线，原 Python/Vue 版本见标签 baseline-lingtour-20261019。

1. 先看 [README.md:L1](../README.md#L1) 和 [团队上手 team_setup.md:L1](./team_setup.md#L1)。
2. 项目由 Spring Boot 提供 HTML/JS 页面和 Java API，默认端口 8080。
3. Java 源码入口为 [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1)，网页入口为 [index.html:L1](../src/main/resources/static/index.html#L1)。
4. 源码、资产和排除说明见 [UPSTREAM.md:L1](../UPSTREAM.md#L1)。
5. CI 验证 Maven 构建与 HTTP 资源，不代表 Android 或真实模型服务已经验收。
6. 小组先在 Issue #1 确定创意，然后通过任务分支、PR 与评审记录自己的贡献。
