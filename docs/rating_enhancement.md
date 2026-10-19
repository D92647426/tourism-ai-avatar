# 游客评分权重、情感分析与路线推荐集成

本文档记录游客评分增强逻辑。完整需求归档见 [REQ-021 游客个性化评分、路线反哺与数据大屏](./requirements_traceability.md#req-021-游客个性化评分路线反哺与数据大屏)。

## 核心实现

| 功能 | 说明 | 实现位置 |
|---|---|---|
| 情感分析 | 使用确定性中文词典分析评论正负向，返回 `sentiment`、`score`、`confidence` 和关键词 | [analyze_sentiment backend/app/services/rating_service.py:L36-L85](../backend/app/services/rating_service.py#L36-L85) |
| 评分权重 | 根据评分完整性、评论长度、情感一致性、公开状态和历史稳定性计算 0.5 到 1.5 权重 | [calculate_rating_weight backend/app/services/rating_service.py:L88-L121](../backend/app/services/rating_service.py#L88-L121) |
| 景点统计 | 返回均分、加权均分、评分分布、高频标签和情绪分布 | [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277) |
| 游客画像 | 从会话历史评分生成关注维度、标签偏好、评分模式和总评分数 | [get_user_preference_profile backend/app/services/rating_service.py:L286-L327](../backend/app/services/rating_service.py#L286-L327) |
| 后台排行 | 基于加权满意度和评分数生成景点评分排行 | [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366) |
| 评分趋势 | 按日期聚合平均分和正中负情绪数量 | [get_admin_rating_trend backend/app/services/rating_service.py:L369-L385](../backend/app/services/rating_service.py#L369-L385) |

## 路线推荐集成

路线推荐不再只依赖静态景点分，而是读取评分统计与游客画像：

| 环节 | 实现位置 |
|---|---|
| 读取评分统计和游客画像 | [_route_context backend/app/services/route_service.py:L110-L115](../backend/app/services/route_service.py#L110-L115) |
| 根据兴趣选择评分维度 | [_rating_dimension_score backend/app/services/route_service.py:L48-L59](../backend/app/services/route_service.py#L48-L59) |
| 根据游客画像加分 | [_profile_bonus backend/app/services/route_service.py:L62-L79](../backend/app/services/route_service.py#L62-L79) |
| 综合评分公式 | [_score_spot backend/app/services/route_service.py:L82-L107](../backend/app/services/route_service.py#L82-L107) |
| 路线持久化 | [_persist_route backend/app/services/route_service.py:L118-L133](../backend/app/services/route_service.py#L118-L133) |

当前公式将兴趣匹配、基础热度、文化/自然/拍照/设施基础分、加权综合评分、兴趣维度评分、游客画像加分、必看点加分、距离成本、拥挤惩罚和体力惩罚合并计算。

## 数据大屏集成

| 指标 | 数据来源 | 实现位置 |
|---|---|---|
| 平均满意度 | `visitor_spot_rating.overall_rating` | [dashboard_overview backend/app/services/analytics_service.py:L71-L87](../backend/app/services/analytics_service.py#L71-L87) |
| 负向反馈 | `visitor_spot_rating.sentiment = negative` | [dashboard_overview backend/app/services/analytics_service.py:L71-L87](../backend/app/services/analytics_service.py#L71-L87) |
| 评分排行 | `get_admin_rating_ranking()` | [dashboard_overview backend/app/services/analytics_service.py:L83-L85](../backend/app/services/analytics_service.py#L83-L85) |
| 高频标签 | `visitor_spot_rating.user_tags` | [dashboard_overview backend/app/services/analytics_service.py:L64-L87](../backend/app/services/analytics_service.py#L64-L87) |

## 测试

| 项目 | 实现位置 |
|---|---|
| 单元测试 | [test_rating_upsert_stats_and_preference_profile backend/tests/test_rating_service.py:L13-L64](../backend/tests/test_rating_service.py#L13-L64) |
| 测试说明 | [TEST-022 docs/test_reference.md:L254-L264](./test_reference.md#L254-L264) |

运行：

```powershell
python scripts\run_local.py test-backend
```
