from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.admin import LoginRequest
from app.services.analytics_service import dashboard_overview, sentiment_report
from app.services.auth_service import authenticate_admin, require_admin_user
from app.services.avatar_service import get_active_avatar, save_avatar_config
from app.services.knowledge_service import archive_document, delete_document, list_documents, list_history, list_versions
from app.services.knowledge_service import publish_document, rebuild_index, save_document, search_test, update_document
from app.services.rating_service import get_admin_rating_ranking, get_admin_rating_trend, list_admin_ratings, rating_to_response
from app.services.scenic_service import list_scenic_spots

router = APIRouter()


@router.post("/login")
def login(payload: LoginRequest):
    return {"code": 0, "message": "success", "data": authenticate_admin(payload.username, payload.password)}


@router.get("/me")
def me(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": admin}


@router.get("/scenic-spots")
def scenic_spots(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": list_scenic_spots()}


@router.get("/knowledge/documents")
def knowledge_documents(status: str = "all", admin=Depends(require_admin_user)):
    try:
        documents = list_documents(status=status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": documents}


@router.post("/knowledge/upload")
async def knowledge_upload(
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
    return {"code": 0, "message": "success", "data": document}


@router.put("/knowledge/documents/{document_id}")
def knowledge_update(document_id: str, payload: dict, admin=Depends(require_admin_user)):
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


@router.post("/knowledge/documents/{document_id}/publish")
def knowledge_publish(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = publish_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.post("/knowledge/documents/{document_id}/archive")
def knowledge_archive(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = archive_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.delete("/knowledge/documents/{document_id}")
def knowledge_delete(document_id: str, admin=Depends(require_admin_user)):
    try:
        document = delete_document(document_id, admin["username"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": document}


@router.get("/knowledge/documents/{document_id}/versions")
def knowledge_versions(document_id: str, admin=Depends(require_admin_user)):
    try:
        versions = list_versions(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": versions}


@router.get("/knowledge/documents/{document_id}/history")
def knowledge_history(document_id: str, admin=Depends(require_admin_user)):
    try:
        history = list_history(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"code": 0, "message": "success", "data": history}


@router.post("/knowledge/reindex")
def knowledge_reindex(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": rebuild_index(admin["username"])}


@router.post("/knowledge/search-test")
def knowledge_search_test(query: dict, admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": search_test(query.get("query", ""))}


@router.get("/avatar-configs/active")
def active_avatar(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": get_active_avatar()}


@router.post("/avatar-configs")
def avatar_configs(payload: dict, admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": save_avatar_config(payload)}


@router.get("/analytics/overview")
def analytics_overview(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": dashboard_overview()}


@router.get("/analytics/report")
def analytics_report(admin=Depends(require_admin_user)):
    return {"code": 0, "message": "success", "data": sentiment_report()}


@router.get("/ratings")
def admin_ratings(
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


@router.get("/ratings/ranking")
def admin_ratings_ranking(admin=Depends(require_admin_user), db: Session = Depends(get_db)):
    return {"code": 0, "message": "success", "data": get_admin_rating_ranking(db)}


@router.get("/ratings/trend")
def admin_ratings_trend(admin=Depends(require_admin_user), db: Session = Depends(get_db)):
    return {"code": 0, "message": "success", "data": get_admin_rating_trend(db)}
