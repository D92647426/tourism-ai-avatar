# 当前架构：老师提供的 Java 项目

## 结构

浏览器中的 HTML/CSS/JavaScript 和 Live2D → Spring Boot 控制器 → 聊天、知识、景点、配置、用户、统计服务 → JSON 文件。

模型调用通过 ChatService 连接 DeepSeek 兼容接口，未配置 Key 时使用本地匹配回答。Android 使用 WebView 与同一网页配合，并桥接系统语音识别与播报。

## 位置与边界

| 模块 | 实现 | 位置 |
|---|---|---|
| 应用入口 | Spring Boot 启动，默认 8080 | [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1) |
| 聊天 | 单次问题与资料拼接，兴趣对应预设路线 | [ChatService.java:L53](../src/main/java/com/guide/service/ChatService.java#L53) |
| 知识 | JSON 读写，字符串匹配检索 | [KnowledgeService.java:L186](../src/main/java/com/guide/service/KnowledgeService.java#L186) |
| 数字人 | PIXI + Haru 示例模型，口型和状态 | [main.js:L104](../src/main/resources/static/js/main.js#L104) |
| 网页 | 随 Java 应用提供静态页面 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| Android | WebView 与语音桥接 | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |

当前使用 JSON 文件，没有数据库或向量模型。账号与后台权限仍是演示实现。创意玩法和精修角色尚未落地，Android 构建尚未验收。
