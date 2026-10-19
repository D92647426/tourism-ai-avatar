# 测试报告

## 目标

- 景区事实性问答准确率 >= 90%
- 知识库命中率 >= 85%
- 语音问答首响 <= 5 秒
- 演示链路连续运行无崩溃

## 当前骨架测试

- `GET /api/health` 可用
- 文本问答返回答案、表情、引用来源和路线卡片
- 路线推荐根据兴趣和时间返回路线
- 管理后台大屏返回服务指标
- 本地知识库已读取 FAQ、景点 CSV、demo Markdown 和灵山公开资料包，构建结果 `entry_count = 3377`；构建入口：[build_knowledge_base backend/app/services/vector_store.py:L223-L243](../../backend/app/services/vector_store.py#L223-L243)
- 完整栈烟测已通过，启动入口：[main scripts/smoke_full_stack.py:L30-L61](../../scripts/smoke_full_stack.py#L30-L61)

## 后续补充

将 `data/test_questions.csv` 扩展到 150 条，并记录标准答案、实际答案、是否通过和错误类型。
