from __future__ import annotations

from pydantic import BaseModel, Field


class GuideSessionRequestV1(BaseModel):
    scene_code: str = "main_gate"
    user_profile: dict = Field(default_factory=dict)


class GuideAskRequestV1(BaseModel):
    question: str
    session_id: str | None = None
    scene_code: str = "main_gate"
    user_profile: dict = Field(default_factory=dict)


class RouteRecommendRequestV1(BaseModel):
    session_id: str | None = None
    start_point: str = "main_gate"
    available_minutes: int = 120
    interest_tags: list[str] = Field(default_factory=list)
    group_type: str = "family"


class RagRetrieveRequestV1(BaseModel):
    query: str
    top_k: int = 5


class TtsSynthesizeRequestV1(BaseModel):
    text: str
    voice_id: str = "warm_female"
    speed: float = 1.0
    emotion: str = "neutral"


class AvatarSpeakRequestV1(BaseModel):
    text: str
    voice_id: str | None = None
    emotion: str = "smile"
