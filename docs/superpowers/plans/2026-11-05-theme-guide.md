# 跨景点主题讲解 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal** 完成一个主题、三站衔接、仅基于成功响应的回顾。

**Architecture** 主题服务提供可信打包方法内容并动态匹配景点；现有聊天增加请求级主题上下文；页面复用director/journey/chat生命周期。

**Tech Stack** Java8语法、Spring Boot、Jackson、原生HTML/CSS/JS、Node内置测试。

**Spec** [已确认设计](../specs/2026-11-05-theme-guide-design.md#L1)

## Global Constraints

- 一个主题、三站、一次回顾，离线完整、联网增强。
- 原有不带主题字段的调用、构造方法和mock调用路径兼容。
- 主题ID请求级，true讲解动作显式校验，错误不提交会话。
- 回顾依据themeId匹配且themeLecture=true的成功响应；页面刷新/换方案/新对话清空。
- 真实景点ID动态匹配，资料待核验，复用现有候选、模式、回听、草稿守卫。

## Task 1 后端主题上下文

Files为 [ThemeGuideService.java](../../../src/main/java/com/guide/service/ThemeGuideService.java#L1)、[theme-guide.json](../../../src/main/resources/theme-guide.json#L1)、[ThemeGuideController.java](../../../src/main/java/com/guide/controller/ThemeGuideController.java#L1)、[ChatRequest.java](../../../src/main/java/com/guide/model/ChatRequest.java#L1)、[ChatResponse.java](../../../src/main/java/com/guide/model/ChatResponse.java#L1)、[ConversationService.java](../../../src/main/java/com/guide/service/ConversationService.java#L1)、[ChatService.java](../../../src/main/java/com/guide/service/ChatService.java#L1)、[ThemeGuideTest.java](../../../src/test/java/com/guide/service/ThemeGuideTest.java#L1)。

接口为 GET /api/themes 数组，POST /api/chat 可选themeId/themeLecture，响应themeId/themeLecture。主题DTO站点字段spotId/name/focus/question/bridge/recap。新增ChatService重载保持原有构造和不带字段的5参调用。

- [ ] 写目录/本地讲解/非法请求/模型mock回归，并运行 `mvn -o -Dtest=ThemeGuideTest test`。
- [ ] 实现服务和兼容路径。目录缺站为空，非法主题400，明确讲解缺主题或站不属于主题400，自由问题跨站使用普通逻辑。
- [ ] 再运行目标测试，检查一次检索、候选和会话回滚，提交仅本任务文件。

示例断言

```java
assertEquals(3, themes.list().get(0).getStops().size());
assertTrue(response.isThemeLecture());
assertEquals("scene-details", response.getThemeId());
assertTrue(response.getReply().contains("未核验"));
```

## Task 2 页面主题闭环

Files为 [theme-guide.js](../../../src/main/resources/static/js/theme-guide.js#L1)、[director.js](../../../src/main/resources/static/js/director.js#L1)、[journey.js](../../../src/main/resources/static/js/journey.js#L1)、[main.js](../../../src/main/resources/static/js/main.js#L1)、[index.html](../../../src/main/resources/static/index.html#L1)、[tour-experience.css](../../../src/main/resources/static/css/tour-experience.css#L1)、[theme-guide.test.js](../../../tests/frontend/theme-guide.test.js#L1)、[harness.js](../../../tests/frontend/harness.js#L1)。GuideDirectorPage.mount 返回 showTheme(theme)，main保存为GuideDirectorView。GuideTour.snapshot新增themeId，prepare将主题信息交给GuideChatDraft。GuideThemePage提供mount/sync/success/reset，接受实际response更新回顾。

- [ ] 写实际main联动测试，`node --test tests/frontend/theme-guide.test.js` 检查无自动发送与三站成功回顾。
- [ ] 接入目录读取、showTheme和主题面板，保护草稿、输入编辑、模式和过时请求。
- [ ] 追加部分成功/重复/失败/取消/重编/新对话/XSS测试，运行Node全套并提交。

示例断言

```javascript
assert.equal(calls.length, 0);
assert.equal(calls[0].themeId, 'scene-details');
assert.equal(calls[0].themeLecture, true);
assert.equal(el('themeProgress').textContent.includes('3 / 3'), true);
```

## Task 3 整合与交付

Files为 [smoke_teacher_project.py](../../../scripts/smoke_teacher_project.py#L1)、[requirements_traceability.md](../../../docs/requirements_traceability.md#L1)、[api_reference.md](../../../docs/api_reference.md#L1)、[test_reference.md](../../../docs/test_reference.md#L1)、[program_index.md](../../../docs/program_index.md#L1)、[config_reference.md](../../../docs/config_reference.md#L1)、[issue_progress.md](../../../docs/issue_progress.md#L1)。截图和设计记录见 [规格](../specs/2026-11-05-theme-guide-design.md#L1)。

- [ ] HTTP读取主题并依次发送三站，校验mode/spot/themeLecture，非法ID400后context不变。
- [ ] 更新追踪文档和资源配置说明，运行Maven/Node/文档/数据工具/隔离HTTP全套。
- [ ] 实际浏览器验收三站与重编守卫，截图桌面/手机/短横屏并检查。
- [ ] Standards/Spec独立检查相对036e6cd的整个分支，修复后复验。
- [ ] 提交PR关联议题，确认最终head CI，报告完成/待合并/后续。

## 执行裁定

用户已明确授权设计落地与开工，按现有隔离工作区继续，主仓库三份未提交文档保留。执行时由Codex后端实现子任务和主代理页面整合协作，独立审查负责复核。选择请求级主题上下文，避免改变现有会话快照与刷新行为。
