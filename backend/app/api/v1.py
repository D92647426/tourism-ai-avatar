from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.admin import LoginRequest
from app.schemas.api_v1 import (
    AvatarSpeakRequestV1,
    GuideAskRequestV1,
    GuideSessionRequestV1,
    RagRetrieveRequestV1,
    RouteRecommendRequestV1,
    TtsSynthesizeRequestV1,
)
from app.schemas.visitor import ChatTextRequest, CreateSessionRequest, RouteRecommendRequest, SpotRatingRequest
from app.services.analytics_service import dashboard_overview
from app.services.auth_service import authenticate_admin, require_admin_user
from app.services.avatar_service import get_active_avatar, save_avatar_config
from app.services.chat_service import chat_with_text, create_session, voice_chat
from app.services.knowledge_service import (
    archive_document,
    delete_document,
    embed_document,
    list_documents,
    list_history,
    list_knowledge_bases,
    list_versions,
    publish_document,
    rebuild_index,
    retrieve_context,
    save_document,
    search_test,
    update_document,
)
from app.services.route_service import recommend_route
from app.services.rating_service import (
    create_or_update_rating,
    get_admin_rating_ranking,
    get_admin_rating_trend,
    get_ratings_by_session,
    get_spot_statistics,
    list_admin_ratings,
    list_public_ratings,
    rating_to_response,
)
from app.services.scenic_service import list_facilities, list_scenic_spots
from app.services.system_service import get_system_status


router = APIRouter()
DEFAULT_KB_ID = "default"
SCENE_TO_SPOT_ID = {
    "main_gate": 1,
    "south_gate": 1,
    "visitor_center": 1,
    "buddha_square": 10,
    "ling_shan_buddha": 11,
    "fantastic_palace": 12,
}


def _message_id(prefix: str = "m") -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def _resolve_session_id(session_id: str | None, scene_code: str, user_profile: dict) -> str:
    if session_id:
        return session_id
    payload = CreateSessionRequest(
        device_type="web",
        user_profile=user_profile,
        start_location={"type": "scene_code", "scene_code": scene_code},
    )
    session = create_session(payload)
    return session["session_uuid"]


def _route_payload_from_v1(payload: RouteRecommendRequestV1, session_id: str = "v1_route") -> RouteRecommendRequest:
    interest_tags = list(payload.interest_tags)
    if payload.group_type and payload.group_type not in interest_tags:
        interest_tags.append(payload.group_type)
    return RouteRecommendRequest(
        session_uuid=session_id,
        interest=interest_tags,
        available_time=payload.available_minutes,
        physical_strength="elderly" if payload.group_type in {"elderly", "senior"} else "normal",
        start_spot_id=SCENE_TO_SPOT_ID.get(payload.start_point, 1),
        avoid_crowd=True,
    )


def _avatar_directive(emotion: str, question: str) -> dict:
    avatar = get_active_avatar()
    return {
        "emotion": emotion,
        "action": "point_right" if any(word in question for word in ["路线", "怎么逛", "哪里"]) else "welcome",
        "speech_style": "history_guide" if any(word in question for word in ["历史", "文化", "故事"]) else "scenic_guide",
        "voice_speed": avatar.get("voice_speed", 1.0),
        "voice_name": avatar.get("voice_name", "female_warm"),
    }


def _find_document_or_404(document_id: str) -> dict:
    for document in list_documents("all"):
        if document["id"] == document_id:
            return document
    raise HTTPException(status_code=404, detail=f"knowledge document not found: {document_id}")


@router.post("/guide/sessions")
def create_guide_session_v1(payload: GuideSessionRequestV1):
    session = create_session(
        CreateSessionRequest(
            device_type="web",
            user_profile=payload.user_profile,
            start_location={"type": "scene_code", "scene_code": payload.scene_code},
        )
    )
    return {"code": 0, "message": "success", "data": {**session, "session_id": session["session_uuid"], "scene_code": payload.scene_code}}


@router.post("/guide/ask")
def guide_ask_v1(payload: GuideAskRequestV1):
    session_id = _resolve_session_id(payload.session_id, payload.scene_code, payload.user_profile)
    result = chat_with_text(ChatTextRequest(session_uuid=session_id, message=payload.question))
    return {
        "code": 0,
        "message": "success",
        "data": {
            **result,
            "session_id": session_id,
            "message_id": _message_id(),
            "text": result["answer"],
            "avatar_directive": _avatar_directive(result.get("emotion", "smile"), payload.question),
        },
    }


@router.post("/guide/voice-ask")
async def guide_voice_ask_v1(
    audio_file: UploadFile = File(...),
    session_id: str = Form(""),
    scene_code: str = Form("main_gate"),
):
    resolved_session_id = _resolve_session_id(session_id or None, scene_code, {})
    result = await voice_chat(resolved_session_id, audio_file)
    return {
        "code": 0,
        "message": "success",
        "data": {
            **result,
            "session_id": resolved_session_id,
            "message_id": _message_id(),
            "text": result["answer"],
            "avatar_directive": _avatar_directive(result.get("emotion", "smile"), result.get("asr_text", "")),
        },
    }


@router.post("/asr/transcribe")
async def transcribe_audio_v1(audio_file: UploadFile = File(...)):
    return {
        "code": 0,
        "message": "success",
        "data": {
            "task_id": _message_id("asr"),
            "status": "completed",
            "text": "我第一次来这个景区，应该怎么逛？",
            "file_name": audio_file.filename or "audio.wav",
        },
    }


@router.post("/tts/synthesize")
def synthesize_tts_v1(payload: TtsSynthesizeRequestV1):
    return {
        "code": 0,
        "message": "success",
        "data": {
            "task_id": _message_id("tts"),
            "audio_id": _message_id("audio"),
            "status": "completed",
            "voice_id": payload.voice_id,
            "speed": payload.speed,
            "emotion": payload.emotion,
            "audio_url": "/static/audio/demo-answer.mp3",
        },
    }


@router.post("/avatar/speak")
def avatar_speak_v1(payload: AvatarSpeakRequestV1):
    avatar = get_active_avatar()
    return {
        "code": 0,
        "message": "success",
        "data": {
            "task_id": _message_id("avatar"),
            "status": "completed",
            "text": payload.text,
            "audio_url": "/static/audio/demo-answer.mp3",
            "avatar": avatar,
            "directive": {
                "emotion": payload.emotion,
                "action": "speak",
                "voice_id": payload.voice_id or avatar.get("voice_name", "female_warm"),
                "voice_speed": avatar.get("voice_speed", 1.0),
            },
        },
    }


@router.get("/scenic/spots")
def scenic_spots_v1():
    return {"code": 0, "message": "success", "data": list_scenic_spots()}


@router.get("/scenic/facilities")
def scenic_facilities_v1():
    return {"code": 0, "message": "success", "data": list_facilities()}


@router.post("/route/recommend")
def route_recommend_v1(payload: RouteRecommendRequestV1):
    result = recommend_route(_route_payload_from_v1(payload, payload.session_id or "v1_route"))
    return {"code": 0, "message": "success", "data": {**result, "route_id": _message_id("route")}}


@router.post("/visitor/ratings")
def submit_rating_v1(payload: SpotRatingRequest, db: Session = Depends(get_db)):
    rating = create_or_update_rating(db, payload)
    return {"code": 0, "message": "success", "data": rating_to_response(rating).model_dump()}


@router.get("/visitor/sessions/{session_uuid}/ratings")
def session_ratings_v1(session_uuid: str, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    ratings = get_ratings_by_session(db, session_uuid, page, page_size)
    return {"code": 0, "message": "success", "data": [rating_to_response(item).model_dump() for item in ratings]}


@router.get("/visitor/spots/{spot_id}/ratings/stats")
def spot_rating_stats_v1(spot_id: int, db: Session = Depends(get_db)):
    return {"code": 0, "message": "success", "data": get_spot_statistics(db, spot_id)}


@router.get("/visitor/spots/{spot_id}/ratings/public")
def spot_public_ratings_v1(spot_id: int, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    ratings = list_public_ratings(db, spot_id, page, page_size)
    return {"code": 0, "message": "success", "data": [rating_to_response(item).model_dump() for item in ratings]}


@router.post("/rag/retrieve")
def rag_retrieve_v1(payload: RagRetrieveRequestV1):
    return {"code": 0, "message": "success", "data": {"query": payload.query, "chunks": retrieve_context(payload.query, top_k=payload.top_k)}}


@router.post("/auth/login")
def auth_login_v1(payload: LoginRequest):
    return {"code": 0, "message": "success", "data": authenticate_admin(payload.username, payload.password)}


@router.get("/auth/me")
def auth_me_v1(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": admin}


@router.get("/admin/system/status")
def admin_system_status_v1(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": get_system_status()}


@router.get("/admin/analytics/overview")
def admin_analytics_overview_v1(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": dashboard_overview()}


@router.get("/admin/ratings")
def admin_ratings_v1(
    spot_id: int | None = None,
    rating_min: int | None = None,
    rating_max: int | None = None,
    sentiment: str | None = None,
    is_public: bool | None = None,
    keyword: str = "",
    admin=Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    ratings = list_admin_ratings(
        db,
        {
            "spot_id": spot_id,
            "rating_min": rating_min,
            "rating_max": rating_max,
            "sentiment": sentiment,
            "is_public": is_public,
            "keyword": keyword,
        },
    )
    return {"code": 0, "message": "success", "data": [rating_to_response(item).model_dump() for item in ratings]}


@router.get("/admin/ratings/ranking")
def admin_rating_ranking_v1(admin=Depends(require_admin_user), db: Session = Depends(get_db)):
    return {"code": 0, "message": "success", "data": get_admin_rating_ranking(db)}


@router.get("/admin/ratings/trend")
def admin_rating_trend_v1(admin=Depends(require_admin_user), db: Session = Depends(get_db)):
    return {"code": 0, "message": "success", "data": get_admin_rating_trend(db)}


@router.get("/admin/knowledge-bases")
def admin_knowledge_bases_v1(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": list_knowledge_bases()}


@router.get("/admin/knowledge-bases/{kb_id}/documents")
def admin_knowledge_base_documents_v1(kb_id: str, status: str = "all", admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": list_documents(status=status)}


@router.post("/admin/knowledge-bases/{kb_id}/documents")
async def admin_upload_document_v1(
    kb_id: str,
    file: UploadFile = File(...),
    title: str = Form(""),
    change_note: str = Form("initial upload"),
    admin=Depends(require_admin_user),
):
    try:
        data = await file.read()
        document = save_document(file.filename or "knowledge.md", data, title or None, admin["username"], "draft", change_note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": {**document, "knowledge_base_id": kb_id}}


@router.post("/admin/knowledge-bases/{kb_id}/reindex")
def admin_reindex_v1(kb_id: str, admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": {**rebuild_index(admin["username"]), "knowledge_base_id": kb_id}}


@router.post("/admin/knowledge-bases/{kb_id}/test-retrieve")
def admin_test_retrieve_v1(kb_id: str, payload: dict, admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": {**search_test(payload.get("query", "")), "knowledge_base_id": kb_id}}


@router.put("/admin/documents/{document_id}")
def admin_update_document_v1(document_id: str, payload: dict, admin=Depends(require_admin_user)):
    try:
        document = update_document(
            document_id,
            payload.get("title"),
            payload.get("content"),
            admin["username"],
            payload.get("change_note", "browser edit"),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.delete("/admin/documents/{document_id}")
def admin_delete_document_v1(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = delete_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.get("/admin/documents/{document_id}/versions")
def admin_document_versions_v1(document_id: str, admin=Depends(require_admin_user)):
    try:
        versions = list_versions(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": versions}


@router.get("/admin/documents/{document_id}/history")
def admin_document_history_v1(document_id: str, admin=Depends(require_admin_user)):
    try:
        history = list_history(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": history}


@router.post("/admin/documents/{document_id}/publish")
def admin_document_publish_v1(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = publish_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.post("/admin/documents/{document_id}/archive")
def admin_document_archive_v1(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = archive_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.get("/admin/documents/{document_id}/chunks")
def admin_document_chunks_v1(document_id: str, admin=Depends(require_admin_user)):
    document = _find_document_or_404(document_id)
    return {
        "code": 0,
        "message": "success",
        "data": {
            "document_id": document_id,
            "chunk_count": document.get("chunk_count", 0),
            "source": document.get("source"),
            "preview": document.get("preview", ""),
        },
    }


@router.post("/admin/documents/{document_id}/embed")
def admin_document_embed_v1(document_id: str, admin=Depends(require_admin_user)):
    document = _find_document_or_404(document_id)
    result = embed_document(document_id, admin["username"])
    return {
        "code": 0,
        "message": "success",
        "data": {
            "document_id": document_id,
            "status": document["status"],
            "embed_result": result,
            "chunk_count": result.get("chunk_count", document.get("chunk_count", 0)),
            "enabled_chunk_count": result.get("enabled_chunk_count", 0),
        },
    }


@router.get("/admin/avatar/profiles")
def admin_avatar_profiles_v1(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": [get_active_avatar()]}


@router.post("/admin/avatar/profiles")
def admin_create_avatar_profile_v1(payload: dict, admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": save_avatar_config(payload)}
