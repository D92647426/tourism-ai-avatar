# 后端补齐方案：DeepSeek 接入 + RAG + 会话持久化 + 异常体系

## 结论

当前骨架的 **AI 推理能力全部为 Mock**，缺少真实的 DeepSeek 调用、RAG 向量检索、ASR/TTS 闭环节点以及会话持久化。后端需要在 **5 个工作日内** 补齐 P0 核心链路：DeepSeek 适配器 → 向量数据库构建 → 真实检索上下文 → DeepSeek 生成回答 → TTS 生成音频 → 持久化会话与对话记录。同时统一异常处理，为管理后台提供真实数据。

---

## P0 任务（必须立即完成）

### 1. DeepSeek 模型适配器 — `backend/app/core/llm.py`（新建）

**功能**：封装 DeepSeek API 的同步/异步调用，支持流式（后续前端SSE）。  
**关键代码框架**：

```python
import httpx
from app.core.config import settings

class DeepSeekClient:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.base_url = settings.DEEPSEEK_BASE_URL or "https://api.deepseek.com"
        self.model = "deepseek-chat"  # 或 deepseek-reasoner

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 512,
        stream: bool = False,
    ) -> dict:
        """返回完整响应 dict，包含 choices[0].message.content"""
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
```

**配置项**（修改 `backend/app/core/config.py`）：

```python
DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
```

**异常处理**：在调用处捕获 `httpx.HTTPStatusError`，返回降级 fallback 回答（详见5）。

---

### 2. RAG 向量检索 — `backend/app/services/vector_store.py`（新建）

**功能**：使用 chromadb（嵌入式）将 FAQ + 景点描述 + 知识文档写入向量库，并提供 `retrieve_context` 函数。

**实现步骤**：

- 安装 `chromadb`, `sentence-transformers`（或使用 OpenAI embedding 占位）
- 脚本：`backend/scripts/init_vector_db.py`，读取 `data/faq.csv` 和 `data/scenic_spots.csv`，将每条记录的 `question+answer` 或 `description` 作为文本，生成 embedding 并存入 `data/chroma_db/`。
- 服务函数：

```python
import chromadb
from sentence_transformers import SentenceTransformer

# 初始化 embedding 模型（可选本地模型）
embedder = SentenceTransformer("shibing624/text2vec-base-chinese")

def retrieve_context(query: str, top_k: int = 3) -> list[dict]:
    client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
    collection = client.get_or_create_collection(name="scenic_kb")
    q_emb = embedder.encode(query).tolist()
    results = collection.query(query_embeddings=[q_emb], n_results=top_k)
    # 返回格式：[{"text": ..., "source": ..., "chunk_id": ...}, ...]
    return [
        {"text": doc, "source": meta.get("source", ""), "chunk_id": meta.get("id", "")}
        for doc, meta in zip(results["documents"][0], results["metadatas"][0])
    ]
```

**注意**：若不想依赖 SentenceTransformer，可先直接返回 CSV 全文匹配（P0 简化）。但建议使用向量库。

---

### 3. DeepSeek + RAG 真实回答 — `backend/app/services/ai_service.py`（新建）

**功能**：接收用户消息 + 会话历史 + RAG context，构造 Prompt 并调用 DeepSeek，返回回答、emotion、confidence。

**关键实现**：

```python
from app.core.llm import DeepSeekClient
from app.services.vector_store import retrieve_context
from app.core.config import settings

llm_client = DeepSeekClient()

async def generate_answer(session_uuid: str, user_message: str, user_profile: dict = None) -> dict:
    # 1. 检索
    context = retrieve_context(user_message)
    context_text = "\n".join([f"[{item['source']}] {item['text']}" for item in context])

    # 2. 构建系统 prompt（从 prompt_template.md 读取并填充）
    system_prompt = settings.PROMPT_TEMPLATE.format(
        user_profile=user_profile or {},
        retrieved_context=context_text,
        question=user_message,
    )

    # 3. 调用 DeepSeek
    messages = [
        {"role": "system", "content": system_prompt},
        # 可选加入历史消息（后续从 DB 加载）
        {"role": "user", "content": user_message},
    ]
    try:
        response = await llm_client.chat(messages, temperature=0.6)
        raw_answer = response["choices"][0]["message"]["content"]
    except Exception as e:
        # 降级处理：返回 context 中的第一条
        fallback = context[0]["text"] if context else "抱歉，我暂时无法回答，请稍后再试。"
        raw_answer = fallback

    # 4. 解析 emotion / confidence（可让模型输出 JSON 结构）
    # 简单实现：从回答中根据关键词判断
    emotion = parse_emotion(raw_answer)
    confidence = 0.85 if context else 0.5

    return {
        "answer": raw_answer,
        "emotion": emotion,
        "confidence": confidence,
        "references": [{"document": item["source"], "chunk_id": item["chunk_id"]} for item in context],
    }

def parse_emotion(text: str) -> str:
    if any(w in text for w in ["建议", "推荐", "可以"]):
        return "happy"
    elif any(w in text for w in ["抱歉", "不清楚", "没有"]):
        return "concerned"
    else:
        return "thinking"
```

**配置项**：在 `config.py` 中添加 `PROMPT_TEMPLATE: str = open("ai_service/rag/prompt_template.md").read()`。

---

### 4. TTS 服务 — `backend/app/services/tts_service.py`（新建）

**功能**：使用 `edge-tts` 将文本转为 mp3，返回音频 URL（存储在 `backend/static/audio/`）。

```python
import edge_tts
import uuid
from pathlib import Path

async def text_to_audio(text: str, voice: str = "zh-CN-XiaoxiaoNeural") -> str:
    """生成音频文件，返回相对路径如 /static/audio/uuid.mp3"""
    audio_dir = Path("backend/static/audio")
    audio_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.mp3"
    output_path = audio_dir / filename
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))
    return f"/static/audio/{filename}"
```

**依赖**：在 `requirements.txt` 添加 `edge-tts`。

---

### 5. 统一异常处理 — `backend/app/core/exception_handler.py`（新建）`backend/app/main.py` 注册

**功能**：捕获所有 HTTPException 和通用异常，返回统一 `{"code": -1, "message": "error details", "data": null}`。

```python
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.status_code, "message": exc.detail, "data": None},
        )
    # 记录日志
    return JSONResponse(
        status_code=500,
        content={"code": -1, "message": "Internal server error", "data": None},
    )
```

在 `main.py` 中添加：

```python
from app.core.exception_handler import global_exception_handler
app.add_exception_handler(Exception, global_exception_handler)
```

---

### 6. 会话持久化 + 对话记录 — `backend/app/models/session.py`, `backend/app/models/chat.py`

**数据模型**（SQLAlchemy）：

```python
# session.py
class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, index=True)
    user_profile = Column(JSON, default={})
    created_at = Column(DateTime, default=func.now())
    ended_at = Column(DateTime, nullable=True)

# chat.py
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    session_uuid = Column(String(36), ForeignKey("sessions.uuid"))
    role = Column(String(10))  # user / assistant
    content = Column(Text)
    emotion = Column(String(20), nullable=True)
    audio_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=func.now())
```

**迁移**：使用 Alembic 或直接 `Base.metadata.create_all(bind=engine)`（开发阶段）。

**修改 `create_session` / `chat_with_text`**：写入数据库。

---

## P1 任务（可在 P0 后立即开始）

### 7. ASR 真实化 — `backend/app/services/asr_service.py`

P0 阶段仍可 Mock，但建议集成 `whisper`（本地）或 `api`（如阿里云）。如果团队有 GPU 可用，使用 `faster-whisper`。

```python
import whisper
model = whisper.load_model("base")

def transcribe(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        result = model.transcribe(f.name, language="zh")
        return result["text"].strip()
```

**注意**：也可暂时保留 Mock，等 P0 跑通后再替换。

### 8. 图像识别真实化 — `backend/app/services/image_service.py`

暂未开放真实需求，可保持返回固定结果。若需集成，可用 `clip` 或调用第三方 API。

### 9. 管理后台实际数据

- 修改 `analytics_service.py`，从数据库聚合今天会话数、平均轮次、情绪分布等。
- 修改 `knowledge_service.py`，从 chromadb 中执行 `search_test`。

---

## P2 任务（后续迭代）

- 流式 SSE 支持（`POST /chat/text` 改为 `text/event-stream`）
- JWT 认证替代固定 token
- Live2D 数字人集成（Pixi.js）
- WebSocket 实时数字人状态

---

## 下一步可直接执行清单

1. **安装依赖**（在 backend 目录下）：
   ```bash
   pip install httpx chromadb sentence-transformers edge-tts
   ```
2. **配置环境变量**：在 `.env` 中添加：
   ```
   DEEPSEEK_API_KEY=sk-your-key
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   CHROMA_DB_PATH=./data/chroma_db
   ```
3. **初始化向量库**：
   ```bash
   python backend/scripts/init_vector_db.py
   ```
4. **新建文件**（按以下顺序）：
   - `backend/app/core/llm.py`
   - `backend/app/services/vector_store.py`
   - `backend/app/services/ai_service.py`
   - `backend/app/services/tts_service.py`
   - `backend/app/core/exception_handler.py`
   - `backend/app/models/session.py`
   - `backend/app/models/chat.py`
5. **修改已有文件**：
   - `backend/app/core/config.py`：添加上述配置项
   - `backend/app/services/chat_service.py`：替换 `chat_with_text` 为调用 `ai_service.generate_answer` + `tts_service.text_to_audio`，并将结果存入数据库
   - `backend/app/api/visitor.py`：添加异常包装
   - `backend/app/main.py`：注册全局异常处理器，添加 `app.mount("/static", StaticFiles(directory="backend/static"))`
6. **测试 DeepSeek 连通性**：临时写一个 `test_llm.py` 脚本，尝试发送简单消息。

团队可按此清单最短路径完成 P0 闭环，停止 Mock 依赖。
