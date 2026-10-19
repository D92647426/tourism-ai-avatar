# RAG 与知识库说明

## 1. 当前是否使用了用户资料？

是。当前知识库构建会读取以下资料：

| 来源 | 用途 | 实现位置 |
|---|---|---|
| `data/faq.csv` | FAQ 问答 | [load_faq_entries backend/app/services/vector_store.py:L70-L96](../backend/app/services/vector_store.py#L70-L96) |
| `data/scenic_spots.csv` | 结构化景点资料 | [load_spot_entries backend/app/services/vector_store.py:L99-L128](../backend/app/services/vector_store.py#L99-L128) |
| `data/raw_documents/demo_scenic_guide.md` | 演示导览资料 | [load_raw_document_entries backend/app/services/vector_store.py:L131-L148](../backend/app/services/vector_store.py#L131-L148) |
| `灵山/示范景区公开资料包/*.docx` | 用户提供的真实景区资料 | [load_scenic_pack_entries backend/app/services/vector_store.py:L191-L216](../backend/app/services/vector_store.py#L191-L216) |
| `灵山/示范景区公开资料包/*.xlsx` | 行为分析数据，默认不直接用于游客路线问答 | [extract_xlsx_text backend/app/services/vector_store.py:L151-L188](../backend/app/services/vector_store.py#L151-L188) |

当前构建结果：

```text
entry_count = 3377
```

## 2. 当前向量库如何生成？

流程：

```text
CSV / Markdown / DOCX / XLSX
  ↓
文本抽取
  ↓
chunk_text 切片
  ↓
tokenize 分词
  ↓
vectorize 生成哈希向量
  ↓
写入 data/vector_db/scenic_vector_store.json
```

核心位置：

- [chunk_text backend/app/services/vector_store.py:L58-L67](../backend/app/services/vector_store.py#L58-L67)
- [vectorize backend/app/services/vector_store.py:L42-L51](../backend/app/services/vector_store.py#L42-L51)
- [build_knowledge_base backend/app/services/vector_store.py:L223-L243](../backend/app/services/vector_store.py#L223-L243)
- [retrieve_context backend/app/services/vector_store.py:L252-L273](../backend/app/services/vector_store.py#L252-L273)

## 3. 当前有没有使用具体知识作答？

有。游客提问时，后端会先检索知识库，再把检索片段放进 DeepSeek prompt。

实现位置：

- [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88)
- [retrieve_context backend/app/services/knowledge_service.py:L5-L18](../backend/app/services/knowledge_service.py#L5-L18)

示例：

```text
问题：附近哪里有洗手间？
命中：faq_3
来源：data/faq.csv
内容：入口游客服务中心和文化展馆附近均设置洗手间。
```

示例：

```text
问题：古建筑群有什么特色？
命中：spot_3
来源：data/scenic_spots.csv
内容：集中展示传统建筑风貌和历史文化故事。
```

## 4. RAG 是否等于把知识库转换成向量库？

不完全等于。

RAG 是 Retrieval-Augmented Generation，完整链路包括：

```text
1. 知识准备：收集资料、清洗、切片
2. 索引构建：把切片转换为向量或其他可检索索引
3. 检索：根据用户问题找相关片段
4. Prompt 增强：把检索片段放入大模型上下文
5. 生成：由大模型基于检索片段回答
6. 引用与约束：返回 source_ids / references，降低幻觉
```

所以，“知识库转换为向量库”只是 RAG 的第 2 步。没有检索、上下文注入和基于证据回答，就不能算完整 RAG。

## 5. 当前实现与生产级 RAG 的区别

当前比赛版实现：

| 项目 | 当前实现 | 生产增强 |
|---|---|---|
| 向量方式 | Python 标准库哈希 embedding，维度由 `PGVECTOR_DIMENSION` 控制 | bge-m3 / text2vec / Qwen Embedding |
| 向量库 | PostgreSQL + pgvector 的 `knowledge_chunk.embedding` | 仍建议优先 pgvector；只有千万级以上或多租户强隔离时再评估专用向量库 |
| 重排 | 余弦相似度排序 | reranker + hybrid search |
| 数据隔离 | 游客问答过滤 `behavior_data` | 按知识域、景区、权限分 collection |

当前这样设计的原因：项目规模适合单库架构，景点、评分、问答日志和知识 chunk 都需要和 PostgreSQL 结构化数据 JOIN；引入 Chroma / Milvus / Qdrant 会增加部署和同步复杂度。

## 6. 为什么 xlsx 不默认用于游客路线问答？

真实 xlsx 行为分析表体积较大，并包含多景区行为数据。直接喂给游客问答会污染回答。当前策略：

- xlsx 仍进入 PostgreSQL `knowledge_chunk`，供后台数据分析扩展使用。
- 游客问答默认过滤 `behavior_data` 和 `.xlsx`。
- 路线问题优先使用结构化景点和导览资料。

过滤位置：

- [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137)

## 7. 如何验证 RAG 使用了知识库？

```bash
python scripts/run_local.py build-kb
python scripts/run_local.py smoke-backend
```

或直接运行：

```bash
python scripts/smoke_vue_full_stack.py
```

预期输出里应包含：

```text
search_top
chat_model: deepseek-v4-flash
chat_answer_preview
```
