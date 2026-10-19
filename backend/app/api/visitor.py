from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.visitor import (
    ChatTextRequest,
    CreateSessionRequest,
    RouteRecommendRequest,
    SpotRatingRequest,
)
from app.services.chat_service import chat_with_text, create_session, image_chat, voice_chat
from app.services.route_service import recommend_route
from app.services.scenic_service import list_scenic_spots
from app.services.rating_service import (
    create_or_update_rating, 
    get_ratings_by_session, 
    get_spot_statistics, 
    list_public_ratings,
    rating_to_response,
    get_user_preference_profile,
    analyze_sentiment,
)

router = APIRouter()


@router.post("/sessions")
def create_visitor_session(payload: CreateSessionRequest):
    return {"code": 0, "message": "success", "data": create_session(payload)}


@router.post("/chat/text")
def text_chat(payload: ChatTextRequest):
    return {"code": 0, "message": "success", "data": chat_with_text(payload)}


@router.post("/chat/voice")
async def chat_voice(session_uuid: str = Form(...), audio_file: UploadFile = File(...)):
    return {"code": 0, "message": "success", "data": await voice_chat(session_uuid, audio_file)}


@router.post("/chat/image")
async def chat_image(
    session_uuid: str = Form(...),
    question: str = Form("这是哪个景点？"),
    image_file: UploadFile = File(...),
):
    return {"code": 0, "message": "success", "data": await image_chat(session_uuid, question, image_file)}


@router.get("/scenic-spots")
def scenic_spots():
    return {"code": 0, "message": "success", "data": list_scenic_spots()}


@router.post("/routes/recommend")
def routes_recommend(payload: RouteRecommendRequest):
    return {"code": 0, "message": "success", "data": recommend_route(payload)}


@router.post("/ratings")
def submit_rating(payload: SpotRatingRequest, db: Session = Depends(get_db)):
    """Submit or update a visitor's rating for a scenic spot."""
    rating = create_or_update_rating(db, payload)
    return {"code": 0, "message": "success", "data": rating_to_response(rating).model_dump()}


@router.get("/sessions/{session_uuid}/ratings")
def list_session_ratings(session_uuid: str, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    """Get all ratings submitted by a specific session."""
    ratings = get_ratings_by_session(db, session_uuid, page, page_size)
    return {"code": 0, "message": "success", "data": [rating_to_response(r).model_dump() for r in ratings]}


@router.get("/spots/{spot_id}/ratings/stats")
def get_spot_rating_stats(spot_id: int, db: Session = Depends(get_db)):
    """Get aggregated rating statistics for a specific spot with weighted scoring and sentiment analysis."""
    return {"code": 0, "message": "success", "data": get_spot_statistics(db, spot_id)}


@router.get("/spots/{spot_id}/ratings/public")
def get_public_ratings(spot_id: int, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    """Get public approved ratings for a specific spot."""
    ratings = list_public_ratings(db, spot_id, page, page_size)
    return {"code": 0, "message": "success", "data": [rating_to_response(r).model_dump() for r in ratings]}


@router.get("/sessions/{session_uuid}/preference-profile")
def get_preference_profile(session_uuid: str, db: Session = Depends(get_db)):
    """Get user preference profile based on their rating history."""
    return {"code": 0, "message": "success", "data": get_user_preference_profile(db, session_uuid)}


@router.post("/sentiment/analyze")
def analyze_comment_sentiment(comment: str):
    """Analyze sentiment of a comment text."""
    result = analyze_sentiment(comment)
    return {"code": 0, "message": "success", "data": result}
