from app.core.database import new_session, reset_database
from app.schemas.visitor import SpotRatingRequest
from app.services.rating_service import (
    create_or_update_rating,
    get_admin_rating_ranking,
    get_spot_statistics,
    get_user_preference_profile,
    list_public_ratings,
)
from backend.tests.postgres_test_utils import postgres_test_database_url


def test_rating_upsert_stats_and_preference_profile():
    reset_database(postgres_test_database_url("rating"))

    with new_session() as db:
        created = create_or_update_rating(
            db,
            SpotRatingRequest(
                session_uuid="s_rating",
                spot_id=6,
                overall_rating=5,
                culture_rating=4,
                nature_rating=3,
                photo_rating=5,
                facility_rating=4,
                comment="九龙灌浴非常精彩，适合拍照，值得推荐！",
                user_tags=["必看", "适合拍照"],
                is_public=True,
                user_profile_snapshot={"group_type": "family", "available_minutes": 120},
            ),
        )
        assert getattr(created, "_created_or_updated") == "created"
        updated = create_or_update_rating(
            db,
            SpotRatingRequest(
                session_uuid="s_rating",
                spot_id=6,
                overall_rating=4,
                culture_rating=5,
                nature_rating=3,
                photo_rating=5,
                facility_rating=4,
                comment="表演精彩，但是排队有点久。",
                user_tags=["演出", "排队"],
                is_public=True,
            ),
        )
        assert getattr(updated, "_created_or_updated") == "updated"

        stats = get_spot_statistics(db, 6)
        assert stats["total_ratings"] == 1
        assert stats["rating_distribution"]["4"] == 1
        assert stats["average_culture"] == 5
        assert stats["top_tags"][0]["tag"] == "演出"

        public = list_public_ratings(db, 6)
        assert len(public) == 1
        ranking = get_admin_rating_ranking(db)
        assert ranking[0]["spot_id"] == 6

        profile = get_user_preference_profile(db, "s_rating")
        assert profile["total_ratings"] == 1
        assert "culture" in profile["preferred_dimensions"]
