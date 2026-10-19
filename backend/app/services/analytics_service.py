"""Dashboard aggregation service backed by PostgreSQL tables."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import new_session
from app.models.persistence import ChatMessage, RoutePlan, ScenicSpot, VisitorSpotRating
from app.services.rating_service import get_admin_rating_ranking, get_admin_rating_trend


def _empty_dashboard() -> dict:
    return {
        "today_service_count": 0,
        "week_service_count": 0,
        "avg_latency_ms": 0,
        "satisfaction_score": None,
        "knowledge_hit_rate": 0,
        "rating_count": 0,
        "negative_rating_count": 0,
        "hot_questions": [],
        "hot_spots": [],
        "route_preferences": [],
        "emotion_trend": [],
        "rating_ranking": [],
        "rating_trend": [],
        "top_tags": [],
    }


def dashboard_overview() -> dict:
    """Return real dashboard aggregates from chat, route and rating tables."""
    try:
        with new_session() as db:
            now = datetime.utcnow()
            today_start = datetime(now.year, now.month, now.day)
            week_start = now - timedelta(days=7)
            messages = list(db.execute(select(ChatMessage)).scalars().all())
            assistant_messages = [item for item in messages if item.role == "assistant"]
            ratings = list(db.execute(select(VisitorSpotRating)).scalars().all())
            routes = list(db.execute(select(RoutePlan)).scalars().all())
            spots = {spot.id: spot.name for spot in db.execute(select(ScenicSpot)).scalars().all()}

            today_service_count = sum(1 for item in messages if item.created_at >= today_start)
            week_service_count = sum(1 for item in messages if item.created_at >= week_start)
            avg_latency = int(sum(item.latency_ms for item in assistant_messages) / len(assistant_messages)) if assistant_messages else 0
            referenced_chunks = sum(len(item.references_json or []) for item in assistant_messages)
            knowledge_hit_rate = round(sum(1 for item in assistant_messages if item.references_json) / len(assistant_messages), 2) if assistant_messages else 0

            question_counter = Counter(item.content[:24] for item in messages if item.role == "user")
            spot_counter: Counter[str] = Counter()
            for route in routes:
                for spot_id in route.spot_ids or []:
                    spot_counter.update([spots.get(spot_id, f"景点 {spot_id}")])

            route_counter: Counter[str] = Counter()
            for route in routes:
                for tag in route.interest_tags or ["classic"]:
                    route_counter.update([tag])

            sentiment_buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
            tag_counter: Counter[str] = Counter()
            for rating in ratings:
                day = rating.created_at.date().isoformat()
                sentiment_buckets[day][rating.sentiment or "neutral"] += 1
                tag_counter.update(rating.user_tags or [])

            return {
                "today_service_count": today_service_count,
                "week_service_count": week_service_count,
                "avg_latency_ms": avg_latency,
                "satisfaction_score": round(sum(item.overall_rating for item in ratings) / len(ratings), 2) if ratings else None,
                "knowledge_hit_rate": knowledge_hit_rate,
                "rating_count": len(ratings),
                "negative_rating_count": sum(1 for item in ratings if item.sentiment == "negative"),
                "referenced_chunk_count": referenced_chunks,
                "hot_questions": [{"topic": topic, "count": count} for topic, count in question_counter.most_common(6)],
                "hot_spots": [{"name": name, "count": count} for name, count in spot_counter.most_common(8)],
                "route_preferences": [{"name": name, "value": count} for name, count in route_counter.most_common(8)],
                "emotion_trend": [{"date": day, **values} for day, values in sorted(sentiment_buckets.items())],
                "rating_ranking": get_admin_rating_ranking(db)[:10],
                "rating_trend": get_admin_rating_trend(db),
                "top_tags": [{"tag": tag, "count": count} for tag, count in tag_counter.most_common(10)],
            }
    except Exception:
        return _empty_dashboard()


def sentiment_report() -> dict:
    """Return a visitor sentiment report based on rating comments."""
    data = dashboard_overview()
    if not data["rating_count"]:
        return {
            "summary": "当前还没有游客评分数据，建议先在游客端引导游客对路线和景点提交多维评分。",
            "suggestions": ["在景点卡片增加评分入口", "在路线完成页提示游客评价", "后台大屏持续观察低分维度"],
        }
    lowest = sorted(data.get("rating_ranking", []), key=lambda item: item.get("average_facility") or 5)[:3]
    suggestions = ["优先分析负面评论和设施便利低分景点", "把高分拍照点纳入推荐路线", "根据高频标签优化游客端快捷问题"]
    if lowest:
        suggestions.insert(0, f"关注设施评分偏低景点：{', '.join(item['spot_name'] for item in lowest if item.get('spot_name'))}")
    return {
        "summary": f"当前累计 {data['rating_count']} 条游客评分，平均满意度 {data['satisfaction_score']}，负向反馈 {data['negative_rating_count']} 条。",
        "suggestions": suggestions,
    }
