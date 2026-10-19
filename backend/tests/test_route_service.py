from app.schemas.visitor import RouteRecommendRequest
from app.services.route_service import recommend_route
from app.services.scenic_service import list_scenic_spots


def test_scenic_spots_use_ling_shan_real_names():
    names = {spot["name"] for spot in list_scenic_spots()}
    assert "灵山大佛" in names
    assert "灵山梵宫" in names
    assert "九龙灌浴" in names


def test_recommend_route_returns_ling_shan_route():
    route = recommend_route(
        RouteRecommendRequest(
            session_uuid="test",
            interest=["history", "photo"],
            available_time=120,
            physical_strength="normal",
            start_spot_id=1,
        )
    )
    names = [spot["name"] for spot in route["spots"]]
    assert names[0] == "南门游客中心"
    assert any(name in names for name in {"灵山大佛", "九龙灌浴", "灵山梵宫"})
    assert route["total_duration"] <= 120
