# API 接口文档

统一响应格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 游客端

- `POST /api/visitor/sessions` 创建匿名会话
- `POST /api/visitor/chat/text` 文本问答。配置 `DEEPSEEK_API_KEY` 后使用 DeepSeek 生成回答，失败时降级为 mock。实现位置：[chat_with_text backend/app/services/chat_service.py:L38-L88](../../backend/app/services/chat_service.py#L38-L88)
- `POST /api/visitor/chat/voice` 语音问答，multipart 上传音频
- `POST /api/visitor/chat/image` 图片识景问答
- `GET /api/visitor/scenic-spots` 景点列表
- `POST /api/visitor/routes/recommend` 个性化路线推荐

## 管理端

- `POST /api/admin/login` 管理员登录
- `GET /api/admin/knowledge/documents` 知识文档列表
- `POST /api/admin/knowledge/search-test` 检索测试
- `GET /api/admin/avatar-configs/active` 当前数字人配置
- `POST /api/admin/avatar-configs` 保存数字人配置
- `GET /api/admin/analytics/overview` 数据大屏
- `GET /api/admin/analytics/report` 游客感受度报告
