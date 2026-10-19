# 链接规范

## 相对路径链接

本项目文档中定位代码必须使用文件和行号绑定在一起的 Markdown 链接：

```md
[说明 backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88)
```

## TODO-LINES

无法确认真实行号时使用：

```md
[说明 frontend/src/pages/visitor/ChatGuide.vue:TODO-LINES](../frontend/src/pages/visitor/ChatGuide.vue)
```

后续运行 [generate_symbol_index scripts/generate_symbol_index.py:L40-L51](../scripts/generate_symbol_index.py#L40-L51) 后，应尽量把 `TODO-LINES` 更新为真实 `#Lx-Ly`。

## 链接检查

```powershell
python scripts\check_doc_links.py
```

检查逻辑在 [check_doc_links scripts/check_doc_links.py:L13-L37](../scripts/check_doc_links.py#L13-L37)。
