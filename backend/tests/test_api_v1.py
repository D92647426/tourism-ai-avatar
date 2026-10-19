from fastapi.testclient import TestClient

from app.core.database import reset_database
from app.main import app
from tests.postgres_test_utils import postgres_test_database_url


def _reset_v1_db() -> None:
    reset_database(postgres_test_database_url("api_v1"))


def _admin_token(client: TestClient) -> str:
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "123456"})
    assert response.status_code == 200
    return response.json()["data"]["token"]


def test_v1_health_and_guide_ask() -> None:
    _reset_v1_db()
    client = TestClient(app)

    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["data"]["status"] == "ok"

    response = client.post(
        "/api/v1/guide/ask",
        json={
            "question": "我只有两个小时怎么逛？",
            "scene_code": "main_gate",
            "user_profile": {"group_type": "family", "available_minutes": 120},
        },
    )
    payload = response.json()["data"]
    assert response.status_code == 200
    assert payload["answer"]
    assert payload["session_id"]
    assert payload["message_id"]
    assert payload["avatar_directive"]["action"] in {"point_right", "welcome"}


def test_v1_scenic_and_route_endpoints() -> None:
    _reset_v1_db()
    client = TestClient(app)

    spots = client.get("/api/v1/scenic/spots")
    facilities = client.get("/api/v1/scenic/facilities")
    rating = client.post(
        "/api/v1/visitor/ratings",
        json={
            "session_uuid": "api_route_session",
            "spot_id": 6,
            "overall_rating": 5,
            "culture_rating": 5,
            "photo_rating": 5,
            "comment": "九龙灌浴非常精彩，适合拍照。",
            "user_tags": ["演出", "拍照"],
            "is_public": True,
        },
    )
    route = client.post(
        "/api/v1/route/recommend",
        json={
            "session_id": "api_route_session",
            "start_point": "main_gate",
            "available_minutes": 120,
            "interest_tags": ["history", "photo"],
            "group_type": "family",
        },
    )

    assert spots.status_code == 200
    assert facilities.status_code == 200
    assert rating.status_code == 200
    assert route.status_code == 200
    assert len(spots.json()["data"]) >= 10
    assert any(item["type"] == "厕所" for item in facilities.json()["data"])
    route_data = route.json()["data"]
    assert route_data["route_id"].startswith("route_")
    assert route_data["score_summary"]["uses_visitor_ratings"] is True
    assert route_data["score_summary"]["visitor_profile"]["total_ratings"] == 1


def test_v1_admin_knowledge_and_system_status() -> None:
    _reset_v1_db()
    client = TestClient(app)
    token = _admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    system_status = client.get("/api/v1/admin/system/status", headers=headers)
    knowledge_bases = client.get("/api/v1/admin/knowledge-bases", headers=headers)
    assert system_status.status_code == 200
    assert system_status.json()["data"]["backend"] == "ok"
    assert knowledge_bases.status_code == 200
    assert knowledge_bases.json()["data"][0]["vector_backend"] == "pgvector"

    upload = client.post(
        "/api/v1/admin/knowledge-bases/default/documents",
        headers=headers,
        files={"file": ("v1-test.md", "灵山测试知识：雨天路线建议先去梵宫。".encode("utf-8"), "text/markdown")},
        data={"title": "雨天路线", "change_note": "v1 upload"},
    )
    assert upload.status_code == 200
    document_id = upload.json()["data"]["id"]

    embed = client.post(f"/api/v1/admin/documents/{document_id}/embed", headers=headers)
    rag = client.post("/api/v1/rag/retrieve", json={"query": "洗手间在哪里", "top_k": 2})

    assert embed.status_code == 200
    assert embed.json()["data"]["document_id"] == document_id
    assert embed.json()["data"]["embed_result"]["chunk_count"] >= 1
    assert rag.status_code == 200
    assert rag.json()["data"]["chunks"]
