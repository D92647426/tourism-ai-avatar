# Natural Retrieval Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. Steps track each testable deliverable.

**Goal:** 自然提问可召回本地知识、识别简称并解释未命中。
**Architecture:** KnowledgeRetriever集中处理别名/评分/预算，KnowledgeService读取快照，ChatService复用结果并返回引用。
**Tech Stack:** Java8语法、Spring Boot2.7.18、现有Jackson/JUnit、JSON字典，无新依赖。
**Spec:** [natural_retrieval.md:L1](../../natural_retrieval.md#L1)。

## Global Constraints

- 上下文最多1200字符，最多3条，标题80、正文200字符。
- 既有知识/景点ID和后台search行为不变；来源标识不是事实核验。
- 沿用当前干净checkout和独立任务分支，不额外创建worktree或自动合并PR。

## Review Focus

外景名称包含本地简称、用户自定义库复用ID、同分受列表顺序影响、多个实体被单实体淹没、超长资料引用与上下文不一致。全部纳入任务1/2回归。

## Task 1: 排序与引用

Files: KnowledgeService.java、KnowledgeRetriever.java、KnowledgeRetrieval.java、retrieval-entities.json、NaturalRetrievalTest.java。

- [x] 在旧接口写自然提问失败测试并确认是断言失败。
- [x] 实现实体/关键词匹配和有界上下文，复用旧入口。
- [x] 验证十个问题、稳定排序/多实体、同名外景、自定义ID和预算。

## Task 2: 聊天集成

Files: ChatService.java、ChatResponse.java、KnowledgeReference.java、NaturalChatTest.java。

- [x] 先写简称最终回复/引用/无命中失败测试。
- [x] 一次检索传入模型与降级；保留单景点/多个实体/无命中边界。
- [x] 运行本机模型HTTP mock和空Key最终回复检查。

## Task 3: 验证与交付

- [x] 更新REQ-037/API-037/TEST-037与程序索引/配置/README。
- [x] Maven clean verify、数据检查44项Python、文档链接和HTTP smoke。
- [ ] 固定基线进行规范/需求审查，修复发现并复验。
- [ ] 提交推送独立PR，附依赖和未验证限制，等待组员评审。


## 执行记录

2026-10-29：任务1/2完成，先验证RED再实现，定向27项和全Java49项通过；数据Python44项/文档/HTTP通过。Ruling: 沿用已授权的当前checkout和独立任务分支，不新增worktree/设计审批轮次；保持既有团队PR评审流程。排序补充：重复关键词去重，正文多次旁及不同景点不能累加冒充主要实体匹配，已先红后绿验证。审查与PR仍待完成。
