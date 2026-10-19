"""Visitor scenic spot rating service.

The service keeps visitor ratings in PostgreSQL so route recommendation,
dashboard analytics and visitor sentiment reports can share the same data.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.persistence import ScenicSpot, VisitorSpotRating
from app.schemas.visitor import SpotRatingRequest, SpotRatingResponse


POSITIVE_WORDS = {
    "好", "棒", "美", "赞", "喜欢", "值得", "推荐", "满意", "不错", "精彩",
    "震撼", "壮观", "漂亮", "愉快", "开心", "完美", "优秀", "出色", "迷人",
    "有趣", "好玩", "舒适", "方便", "干净", "整洁", "热情", "友好", "专业",
}

NEGATIVE_WORDS = {
    "差", "糟", "丑", "失望", "不满", "不好", "讨厌", "避免", "坑", "贵",
    "脏", "乱", "吵", "挤", "累", "远", "慢", "旧", "破", "糟糕", "无聊",
    "一般", "普通", "勉强", "凑合", "还行", "不过如此", "浪费时间", "排队",
}

INTENSIFIERS = {"非常", "特别", "极其", "十分", "太", "很", "超级", "格外", "异常"}
NEGATORS = {"不", "没", "无", "非", "未", "别", "莫", "勿"}


def analyze_sentiment(comment: str | None) -> dict[str, Any]:
    """Analyze a Chinese comment with a small deterministic lexicon."""
    if not comment:
        return {"sentiment": "neutral", "score": 0.0, "confidence": 0.0, "keywords": []}

    words: list[str] = []
    i = 0
    while i < len(comment):
        two_char = comment[i : i + 2]
        if two_char in INTENSIFIERS or two_char in NEGATORS or two_char in POSITIVE_WORDS or two_char in NEGATIVE_WORDS:
            words.append(two_char)
            i += 2
            continue
        one_char = comment[i : i + 1]
        if one_char in POSITIVE_WORDS or one_char in NEGATIVE_WORDS:
            words.append(one_char)
        i += 1

    scores: list[float] = []
    keywords: list[str] = []
    for idx, word in enumerate(words):
        multiplier = 1.5 if idx > 0 and words[idx - 1] in INTENSIFIERS else 1.0
        negated = idx > 0 and words[idx - 1] in NEGATORS
        if word in POSITIVE_WORDS:
            score = 1.0 * multiplier
        elif word in NEGATIVE_WORDS:
            score = -1.0 * multiplier
        else:
            continue
        if negated:
            score = -score * 0.5
        scores.append(score)
        keywords.append(word)

    if not scores:
        return {"sentiment": "neutral", "score": 0.0, "confidence": 0.0, "keywords": []}

    normalized = max(-1.0, min(1.0, sum(scores) / len(scores)))
    if normalized > 0.2:
        sentiment = "positive"
    elif normalized < -0.2:
        sentiment = "negative"
    else:
        sentiment = "neutral"
    return {
        "sentiment": sentiment,
        "score": round(normalized, 3),
        "confidence": round(min(1.0, len(scores) / 5.0), 3),
        "keywords": keywords[:10],
    }


def calculate_rating_weight(rating: VisitorSpotRating, user_history: list[VisitorSpotRating] | None = None) -> float:
    """Return the rating weight used by spot ranking and route scoring."""
    base_weight = 1.0
    dimension_count = sum(
        1
        for value in [
            rating.culture_rating,
            rating.nature_rating,
            rating.photo_rating,
            rating.facility_rating,
        ]
        if value is not None
    )
    base_weight += (dimension_count / 4.0) * 0.2
    if rating.comment:
        base_weight += min(0.2, len(rating.comment) / 250)
        normalized_rating = (rating.overall_rating - 3) / 2.0
        consistency = 1.0 - abs(normalized_rating - rating.sentiment_score)
        if consistency > 0.8:
            base_weight += 0.1
        elif consistency < 0.4:
            base_weight -= 0.1
    if rating.is_public:
        base_weight += 0.05
    if user_history and len(user_history) >= 2:
        values = [item.overall_rating for item in user_history]
        avg = sum(values) / len(values)
        variance = sum((value - avg) ** 2 for value in values) / len(values)
        std_dev = variance**0.5
        if 0.5 <= std_dev <= 1.5:
            base_weight += 0.1
        elif std_dev > 2.0:
            base_weight -= 0.1
    return max(0.5, min(1.5, base_weight))


def _parse_visit_date(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _apply_rating_payload(rating: VisitorSpotRating, payload: SpotRatingRequest) -> None:
    sentiment = analyze_sentiment(payload.comment)
    rating.overall_rating = payload.overall_rating
    rating.culture_rating = payload.culture_rating
    rating.nature_rating = payload.nature_rating
    rating.photo_rating = payload.photo_rating
    rating.facility_rating = payload.facility_rating
    rating.comment = payload.comment
    rating.user_tags = payload.user_tags
    rating.visit_date = _parse_visit_date(payload.visit_date)
    rating.weather_condition = payload.weather_condition
    rating.crowd_level = payload.crowd_level
    rating.is_public = payload.is_public
    rating.user_profile_snapshot = payload.user_profile_snapshot
    rating.source = payload.source
    rating.review_status = "approved"
    rating.sentiment = sentiment["sentiment"]
    rating.sentiment_score = float(sentiment["score"])
    rating.updated_at = datetime.utcnow()


def create_or_update_rating(db: Session, payload: SpotRatingRequest) -> VisitorSpotRating:
    """Upsert one rating by session and spot, then return the persisted row."""
    existing = db.execute(
        select(VisitorSpotRating).where(
            VisitorSpotRating.session_uuid == payload.session_uuid,
            VisitorSpotRating.spot_id == payload.spot_id,
        )
    ).scalar_one_or_none()
    if existing:
        _apply_rating_payload(existing, payload)
        db.commit()
        db.refresh(existing)
        setattr(existing, "_created_or_updated", "updated")
        return existing

    rating = VisitorSpotRating(
        session_uuid=payload.session_uuid,
        spot_id=payload.spot_id,
        overall_rating=payload.overall_rating,
    )
    _apply_rating_payload(rating, payload)
    db.add(rating)
    db.commit()
    db.refresh(rating)
    setattr(rating, "_created_or_updated", "created")
    return rating


def get_rating_by_id(db: Session, rating_id: str) -> VisitorSpotRating | None:
    """Get a rating by ID."""
    return db.execute(select(VisitorSpotRating).where(VisitorSpotRating.id == rating_id)).scalar_one_or_none()


def get_ratings_by_session(db: Session, session_uuid: str, page: int = 1, page_size: int = 20) -> list[VisitorSpotRating]:
    """List ratings submitted by one anonymous visitor session."""
    return list(
        db.execute(
            select(VisitorSpotRating)
            .where(VisitorSpotRating.session_uuid == session_uuid)
            .order_by(VisitorSpotRating.updated_at.desc())
            .offset((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )


def get_ratings_by_spot(db: Session, spot_id: int, include_public_only: bool = True) -> list[VisitorSpotRating]:
    """List ratings for one spot."""
    query = select(VisitorSpotRating).where(VisitorSpotRating.spot_id == spot_id)
    if include_public_only:
        query = query.where(VisitorSpotRating.is_public.is_(True), VisitorSpotRating.review_status == "approved")
    return list(db.execute(query.order_by(VisitorSpotRating.updated_at.desc())).scalars().all())


def list_public_ratings(db: Session, spot_id: int, page: int = 1, page_size: int = 20) -> list[VisitorSpotRating]:
    """List approved public comments for a scenic spot."""
    return list(
        db.execute(
            select(VisitorSpotRating)
            .where(
                VisitorSpotRating.spot_id == spot_id,
                VisitorSpotRating.is_public.is_(True),
                VisitorSpotRating.review_status == "approved",
            )
            .order_by(VisitorSpotRating.updated_at.desc())
            .offset((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )


def _avg(values: list[int | None]) -> float | None:
    actual = [value for value in values if value is not None]
    return round(sum(actual) / len(actual), 2) if actual else None


def get_spot_statistics(db: Session, spot_id: int) -> dict[str, Any]:
    """Return public and internal rating aggregates for one scenic spot."""
    ratings = get_ratings_by_spot(db, spot_id, include_public_only=False)
    spot = db.get(ScenicSpot, spot_id)
    distribution = {str(value): 0 for value in range(1, 6)}
    tag_counter: Counter[str] = Counter()
    sentiment_dist = {"positive": 0, "neutral": 0, "negative": 0}
    if not ratings:
        return {
            "spot_id": spot_id,
            "spot_name": spot.name if spot else None,
            "total_ratings": 0,
            "average_overall": None,
            "average_culture": None,
            "average_nature": None,
            "average_photo": None,
            "average_facility": None,
            "weighted_average_overall": None,
            "rating_distribution": distribution,
            "top_tags": [],
            "sentiment_distribution": sentiment_dist,
        }

    weighted_sum = 0.0
    weight_total = 0.0
    for rating in ratings:
        distribution[str(rating.overall_rating)] += 1
        sentiment_dist[rating.sentiment or "neutral"] = sentiment_dist.get(rating.sentiment or "neutral", 0) + 1
        tag_counter.update(rating.user_tags or [])
        weight = calculate_rating_weight(rating, ratings)
        weighted_sum += rating.overall_rating * weight
        weight_total += weight

    return {
        "spot_id": spot_id,
        "spot_name": spot.name if spot else None,
        "total_ratings": len(ratings),
        "average_overall": _avg([item.overall_rating for item in ratings]),
        "average_culture": _avg([item.culture_rating for item in ratings]),
        "average_nature": _avg([item.nature_rating for item in ratings]),
        "average_photo": _avg([item.photo_rating for item in ratings]),
        "average_facility": _avg([item.facility_rating for item in ratings]),
        "weighted_average_overall": round(weighted_sum / weight_total, 2) if weight_total else None,
        "rating_distribution": distribution,
        "top_tags": [{"tag": tag, "count": count} for tag, count in tag_counter.most_common(8)],
        "sentiment_distribution": sentiment_dist,
    }


def get_all_spot_statistics(db: Session) -> dict[int, dict[str, Any]]:
    """Return rating stats keyed by spot ID."""
    spot_ids = [row[0] for row in db.execute(select(ScenicSpot.id)).all()]
    return {spot_id: get_spot_statistics(db, spot_id) for spot_id in spot_ids}


def get_user_preference_profile(db: Session, session_uuid: str) -> dict[str, Any]:
    """Build an anonymous visitor preference profile from rating history."""
    ratings = get_ratings_by_session(db, session_uuid, page=1, page_size=200)
    if not ratings:
        return {
            "preferred_dimensions": [],
            "average_ratings_by_dimension": {},
            "preference_tags": [],
            "rating_pattern": "unknown",
            "total_ratings": 0,
        }

    dimensions = {
        "culture": [item.culture_rating for item in ratings if item.culture_rating is not None],
        "nature": [item.nature_rating for item in ratings if item.nature_rating is not None],
        "photo": [item.photo_rating for item in ratings if item.photo_rating is not None],
        "facility": [item.facility_rating for item in ratings if item.facility_rating is not None],
    }
    averages = {name: round(sum(values) / len(values), 2) for name, values in dimensions.items() if values}
    preferred_dimensions = [name for name, _ in sorted(averages.items(), key=lambda item: item[1], reverse=True)[:2]]
    tags: Counter[str] = Counter()
    for rating in ratings:
        tags.update(rating.user_tags or [])
        if rating.sentiment == "positive":
            tags.update(analyze_sentiment(rating.comment).get("keywords", [])[:3])

    overall_values = [item.overall_rating for item in ratings]
    avg_overall = sum(overall_values) / len(overall_values)
    if avg_overall >= 4.2:
        pattern = "lenient"
    elif avg_overall <= 2.8:
        pattern = "strict"
    else:
        pattern = "balanced"

    return {
        "preferred_dimensions": preferred_dimensions,
        "average_ratings_by_dimension": {"overall": round(avg_overall, 2), **averages},
        "preference_tags": [tag for tag, _ in tags.most_common(8)],
        "rating_pattern": pattern,
        "total_ratings": len(ratings),
    }


def list_admin_ratings(db: Session, filters: dict[str, Any] | None = None) -> list[VisitorSpotRating]:
    """List ratings for administrators with simple filters."""
    filters = filters or {}
    query = select(VisitorSpotRating)
    if filters.get("spot_id"):
        query = query.where(VisitorSpotRating.spot_id == int(filters["spot_id"]))
    if filters.get("sentiment"):
        query = query.where(VisitorSpotRating.sentiment == filters["sentiment"])
    if filters.get("is_public") is not None:
        query = query.where(VisitorSpotRating.is_public.is_(bool(filters["is_public"])))
    if filters.get("rating_min"):
        query = query.where(VisitorSpotRating.overall_rating >= int(filters["rating_min"]))
    if filters.get("rating_max"):
        query = query.where(VisitorSpotRating.overall_rating <= int(filters["rating_max"]))
    keyword = (filters.get("keyword") or "").strip()
    if keyword:
        query = query.where(VisitorSpotRating.comment.ilike(f"%{keyword}%"))
    return list(db.execute(query.order_by(VisitorSpotRating.updated_at.desc()).limit(200)).scalars().all())


def get_admin_rating_ranking(db: Session) -> list[dict[str, Any]]:
    """Rank scenic spots by weighted visitor satisfaction."""
    stats_map = get_all_spot_statistics(db)
    rows = [
        {
            "spot_id": spot_id,
            "spot_name": stats.get("spot_name"),
            "average_overall": stats.get("average_overall"),
            "average_photo": stats.get("average_photo"),
            "average_facility": stats.get("average_facility"),
            "total_ratings": stats.get("total_ratings", 0),
            "weighted_average_overall": stats.get("weighted_average_overall"),
        }
        for spot_id, stats in stats_map.items()
        if stats.get("total_ratings", 0) > 0
    ]
    return sorted(rows, key=lambda item: (item["weighted_average_overall"] or 0, item["total_ratings"]), reverse=True)


def get_admin_rating_trend(db: Session) -> list[dict[str, Any]]:
    """Return daily rating trend for dashboard charts."""
    buckets: dict[str, list[VisitorSpotRating]] = defaultdict(list)
    ratings = db.execute(select(VisitorSpotRating).order_by(VisitorSpotRating.created_at.asc())).scalars().all()
    for rating in ratings:
        buckets[rating.created_at.date().isoformat()].append(rating)
    return [
        {
            "date": day,
            "average_overall": _avg([item.overall_rating for item in items]),
            "total_ratings": len(items),
            "positive": sum(1 for item in items if item.sentiment == "positive"),
            "neutral": sum(1 for item in items if item.sentiment == "neutral"),
            "negative": sum(1 for item in items if item.sentiment == "negative"),
        }
        for day, items in sorted(buckets.items())
    ]


def rating_to_response(rating: VisitorSpotRating) -> SpotRatingResponse:
    """Convert a rating row to API response schema."""
    return SpotRatingResponse(
        id=rating.id,
        session_uuid=rating.session_uuid,
        spot_id=rating.spot_id,
        spot_name=rating.spot.name if getattr(rating, "spot", None) else None,
        overall_rating=rating.overall_rating,
        culture_rating=rating.culture_rating,
        nature_rating=rating.nature_rating,
        photo_rating=rating.photo_rating,
        facility_rating=rating.facility_rating,
        comment=rating.comment,
        user_tags=rating.user_tags or [],
        visit_date=rating.visit_date.isoformat() if rating.visit_date else None,
        weather_condition=rating.weather_condition,
        crowd_level=rating.crowd_level,
        is_public=rating.is_public,
        review_status=rating.review_status,
        sentiment=rating.sentiment,
        sentiment_score=rating.sentiment_score,
        source=rating.source,
        created_or_updated=getattr(rating, "_created_or_updated", None),
        created_at=rating.created_at.isoformat(),
        updated_at=rating.updated_at.isoformat(),
    )
