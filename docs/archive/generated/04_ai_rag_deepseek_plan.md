# DeepSeek 为核心文本模型的 AI 服务层实现方案

> 2026-05-15 落地更新：当前仓库已优先采用“CSV/Markdown 资料 + Python 标准库哈希向量索引 + DeepSeek RAG”的轻量方案，避免 `chromadb`、`sentence-transformers`、`pandas` 等重依赖阻塞比赛演示。原文中的 ChromaDB 方案保留为 P1/P2 增强参考，P0 实现以 [backend/app/services/vector_store.py:L223-L273](../../../backend/app/services/vector_store.py#L223-L273) 为准。

## 结论

当前骨架的 AI 回答全部为 Mock，缺少真实的 DeepSeek 调用、向量知识库、FAQ 命中判定、路线推荐推理和情绪分析。  
本方案以 **DeepSeek Chat（deepseek-chat）** 作为核心文本生成模型，采用 **ChromaDB + 轻量嵌入** 构建知识检索层，通过 **结构化 Prompt（含情绪标记、路线指令、FAQ 命中标记）** 统一驱动问答、推荐与情感分析，实现从“检索 → 推理 → 回答 → 情绪 → 引用”的完整链路。

---

## P0 任务（3 天内必须交付）

### 1. 向量知识库初始化 — `ai_service/rag/vector_store.py`（新建）

**目标**：将 `data/faq.csv`、`data/scenic_spots.csv` 和后续知识文档切片后写入 ChromaDB，支持 `retrieve_context(query)` 返回 top‑3 结果。

```python
# ai_service/rag/vector_store.py
import chromadb
import pandas as pd
from pathlib import Path
from sentence_transformers import SentenceTransformer

CHROMA_PATH = Path("data/chroma_db")
EMBEDDER = SentenceTransformer("shibing624/text2vec-base-chinese")  # 仅需 200MB

def init_knowledge_base():
    """一次性写入所有知识条目（可在 docker 启动时调用）"""
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_or_create_collection(name="scenic_kb")
    
    # 1. FAQ 数据
    faq_df = pd.read_csv("data/faq.csv")
    faq_texts = [f"Q: {row.question}\nA: {row.answer}" for _, row in faq_df.iterrows()]
    faq_ids = [f"faq_{row.id}" for _, row in faq_df.iterrows()]
    faq_metas = [{"source": "faq", "category": row.category} for _, row in faq_df.iterrows()]
    
    # 2. 景点数据  
    spot_df = pd.read_csv("data/scenic_spots.csv")
    spot_texts = [f"景点名: {row.name}, 标签: {row.tags}, 介绍: {row.description}" for _, row in spot_df.iterrows()]
    spot_ids = [f"spot_{row.id}" for _, row in spot_df.iterrows()]
    spot_metas = [{"source": "scenic_spot", "category": "spot"} for _ in range(len(spot_df))]
    
    # 3. 未来可添加文档切片
    all_texts = faq_texts + spot_texts
    all_ids = faq_ids + spot_ids
    all_metas = faq_metas + spot_metas
    
    # 清理旧数据后插入
    collection.delete(where={})
    embeddings = EMBEDDER.encode(all_texts).tolist()
    collection.add(embeddings=embeddings, documents=all_texts, metadatas=all_metas, ids=all_ids)
    print(f"知识库初始化完成，共 {len(all_texts)} 条")

def retrieve_context(query: str, top_k: int = 3) -> list[dict]:
    """返回 [{text, source, chunk_id, score}]"""
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_collection(name="scenic_kb")
    q_emb = EMBEDDER.encode(query).tolist()
    results = collection.query(query_embeddings=[q_emb], n_results=top_k)
    items = []
    for i in range(len(results["documents"][0])):
        items.append({
            "text": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", ""),
            "chunk_id": results["ids"][0][i],
            "score": results["distances"][0][i] if "distances" in results else 0
        })
    return items
```

### 2. DeepSeek 客户端封装 — `ai_service/llm/deepseek_client.py`（新建）

**目标**：提供 `async def chat(messages, temperature, max_tokens, response_format=None)`，支持 JSON mode 输出。

```python
# ai_service/llm/deepseek_client.py
import httpx
import json
from app.core.config import settings

class DeepSeekClient:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.base_url = settings.DEEPSEEK_BASE_URL or "https://api.deepseek.com/v1"
        self.model = "deepseek-chat"
    
    async def chat(self, messages: list[dict], temperature=0.7, max_tokens=1024, response_format=None):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if response_format:
            payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            if response_format:
                return json.loads(content)
            return content
```

### 3. 结构化 Prompt 模板 — `ai_service/rag/prompt_builder.py`（新建）

**目标**：生成 DeepSeek 的 system prompt，包含 emotion、route 指令和 FAQ 命中标记。

```python
# ai_service/rag/prompt_builder.py
def build_prompt(question: str, context: list[dict], user_profile: dict = None, intention: str = "qa"):
    """构造完整 prompt 列表"""
    system = """你是景区 AI 数字人导游，名字叫“灵灵”。你具备以下能力：
1. 景区知识问答（优先使用检索结果，准确引用来源）
2. FAQ 命中（当检索结果中包含 FAQ 条目时，必须明确回答）
3. 路线推荐（当用户询问路线时，输出规划建议）
4. 情绪输出（在回答末尾用 JSON 块 `{"emotion": "happy|neutral|thinking|concerned", "confidence": 0.8}` 标明情绪）

回答规则：
- 不超过 200 字，适合语音播报
- 如果检索结果不够，不要编造，提示“建议以景区现场公告为准”
- 使用第二人称“您”
- 对于路线推荐，需要给出具体景点顺序和时长"""

    user_profile_str = ""
    if user_profile:
        user_profile_str = f"游客画像：{json.dumps(user_profile, ensure_ascii=False)}"

    context_str = "\n检索结果：\n"
    for item in context:
        context_str += f"- [{item['source']}] {item['text']}\n"

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"{user_profile_str}\n{context_str}\n游客问题：{question}"}
    ]
    return messages
```

### 4. 核心 AI 回答服务 — `ai_service/rag/ai_qa.py`（新建）

**目标**：串联检索 + Prompt + DeepSeek 调用，返回带 emotion 和引用字段的答案。

```python
# ai_service/rag/ai_qa.py
from ai_service.llm.deepseek_client import DeepSeekClient
from ai_service.rag.vector_store import retrieve_context
from ai_service.rag.prompt_builder import build_prompt

llm = DeepSeekClient()

async def generate_answer(question: str, session_uuid: str = None, user_profile: dict = None) -> dict:
    # 1. 检索
    context = retrieve_context(question, top_k=3)
    
    # 2. 判断意图（简单规则 + 可选的 DeepSeek 意图识别）
    intention = "qa"
    route_keywords = ["路线", "怎么逛", "怎么走", "行程", "游览顺序", "推荐路线"]
    if any(kw in question for kw in route_keywords):
        intention = "route"
        # 为路线推荐增加一条特殊上下文（从景点 CSV 中获取）
        # 可直接再检索景点描述
        spots_context = retrieve_context("景区入口 古建筑群 文化展馆 观景台", top_k=4)
        context = spots_context  # 覆盖为景点列表
    
    # 3. 构造 Prompt
    messages = build_prompt(question, context, user_profile, intention)
    
    # 4. 调用 DeepSeek（JSON mode）
    try:
        result = await llm.chat(messages, response_format={"type": "json_object"})
        # 期望返回: {"answer": "...", "emotion": "happy", "confidence": 0.9}
        answer = result.get("answer", "")
        emotion = result.get("emotion", "neutral")
        confidence = result.get("confidence", 0.7)
    except Exception:
        answer = "抱歉，我暂时无法回答，请稍后再试。"
        emotion = "concerned"
        confidence = 0.0

    # 5. 提取引用来源
    references = [{"document": item["source"], "chunk_id": item["chunk_id"]} for item in context]
    
    return {
        "answer": answer,
        "emotion": emotion,
        "confidence": confidence,
        "references": references,
        "latency_ms": 0  # 由调用方填充
    }
```

### 5. 集成到后端 — 改造 `backend/app/services/chat_service.py`

**目标**：将 `chat_with_text` 改用真实 DeepSeek 调用。

```python
# backend/app/services/chat_service.py
from ai_service.rag.ai_qa import generate_answer
import time

async def chat_with_text(payload: ChatTextRequest) -> dict:
    start = time.time()
    result = await generate_answer(payload.message, payload.session_uuid, payload.user_profile)
    elapsed = int((time.time() - start) * 1000)
    
    # 如果 emotion 是 route，自动添加路线卡片
    cards = []
    if payload.message 中涉及路线:
        cards.append(quick_route_card())
    
    return {
        "answer": result["answer"],
        "intent": "route_recommendation" if "路线" in payload.message else "scenic_qa",
        "emotion": result["emotion"],
        "audio_url": "/static/audio/demo-answer.mp3",  # 暂时保持 Mock
        "lip_sync": {"mode": "rms", "duration_ms": 5200},
        "cards": cards,
        "references": result["references"],
        "latency_ms": elapsed,
    }
```

### 6. FAQ 命中逻辑 — 直接集成在 `ai_qa.py` 中

**目标**：当检索结果的 top‑1 来自 FAQ 且距离小于阈值时，标记命中并优先使用 FAQ 答案。

```python
# 在 generate_answer 中增加
top_context = context[0] if context else None
if top_context and top_context["score"] < 0.8:  # 距离小表示相似度高
    # 强制使用 FAQ 答案
    answer = top_context["text"]  # 格式 "Q: ...\nA: ..."
    # 解析出 A 部分
    if "A:" in answer:
        answer = answer.split("A:")[-1].strip()
    emotion = "happy"
```

### 7. 情绪分析 — 由 DeepSeek JSON mode 直接输出

如上所述，在 Prompt 中要求以 JSON 块结尾，DeepSeek 会按要求输出 `{"emotion": "...", "confidence": ...}`。  
无需单独的情绪模型，P0 阶段足够。

### 8. 路线推荐增强 — `ai_service/services/route_recommender.py`（新建）

**目标**：调用 DeepSeek 进行个性化路线规划，结合用户画像和偏好。

```python
# ai_service/services/route_recommender.py
from ai_service.llm.deepseek_client import DeepSeekClient
from ai_service.rag.vector_store import retrieve_context

async def recommend_route(start_time: str, duration_hours: int, interests: list[str], age_group: str = "adult") -> dict:
    llm = DeepSeekClient()
    
    # 获取所有景点作为上下文
    spots = retrieve_context("景区 景点 列表", top_k=10)
    spots_context = "\n".join([f"{i+1}. {s['text']}" for i, s in enumerate(spots)])
    
    sys_prompt = f"""你是景区导游，根据以下景点和游客偏好，推荐一条最优游览路线。
景点列表：
{spots_context}

输出必须是以下 json 格式：
{{
    "name": "路线名称",
    "duration": 120,
    "spots": [
        {{
            "spot_name": "古建筑群",
            "duration": 30,
            "order": 1,
            "description": "简要理由"
        }}
    ],
    "reason": "路线整体说明"
}}"""

    user_msg = f"时间：{start_time}，游玩时长：{duration_hours}小时，兴趣：{','.join(interests)}，人群：{age_group}"
    
    result = await llm.chat([
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_msg}
    ], response_format={"type": "json_object"})
    return result
```

---

## P1 任务（后续 3 天）

### 1. 知识库自动切片脚本 — `ai_service/scripts/slice_docs.py`

- 支持 PDF/TXT 文档上传后自动切分（按段落或 200 字符滑动窗口）
- 生成切片元数据（文档名、页码、切片序号）
- 增量写入 ChromaDB

### 2. 多轮上下文管理

- 在 `chat_service` 中维护会话的上下文（最近 3 轮问答）
- 将历史消息作为 `messages` 上下文传入 DeepSeek

### 3. 情绪分析独立服务 — `ai_service/services/emotion_analyzer.py`

- 当 DeepSeek 未输出 emotion 时，使用关键词规则或小型分类模型补充
- 提供 `analyze_emotion(text) -> {"emotion":"happy","confidence":0.7}`

### 4. 路线推荐 + 实时拥堵数据

- 在路由推荐 prompt 中可加入各景点实时流量（从 Redis 获取），调整顺序

---

## P2 任务（长期优化）

### 1. 降级与熔断

- 当 DeepSeek API 不可用时，退化为本地模板拼接（基于检索结果直接拼接）
- 使用 `tenacity` 重试两次后 fallback

### 2. 回答评测

- 收集用户反馈（点赞/点踩）
- 定期用 DeepSeek 评测回答质量，标记低分样本

### 3. 多模型支持（可选）

- 配置化切换 DeepSeek / 本地 Llama / Azure OpenAI

---

## 下一步可直接执行清单（Checklist）

```text
[ ] 1. 安装依赖（pip install chromadb sentence-transformers pandas httpx）
[ ] 2. 运行 ai_service/scripts/init_vector_db.py 初始化 ChromaDB
     python ai_service/scripts/init_vector_db.py
[ ] 3. 配置环境变量 DEEPSEEK_API_KEY 和 DEEPSEEK_BASE_URL
[ ] 4. 实现 ai_service/llm/deepseek_client.py
[ ] 5. 实现 ai_service/rag/prompt_builder.py 与 ai_service/rag/ai_qa.py
[ ] 6. 修改 backend/app/services/chat_service.py 调用真实 AI 回答
[ ] 7. 修改 backend/app/services/route_service.py 调用 route_recommender
[ ] 8. 测试文本问答：POST /api/visitor/chat/text -> 应返回真实 emotion 和 references
[ ] 9. 测试 FAQ 命中：发送“景区几点关门” -> 应返回 FAQ 对应答案
[ ] 10. 测试路线推荐：发送“推荐一条2小时游览路线” -> 应返回结构化路线卡片
```

以上步骤完成后，AI 数字人将具备真实的知识检索、FAQ 精准回答、路线推荐和情绪表达能力，满足 A5 赛题核心要求。
