from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    device_type: str = "web"
    user_profile: dict = Field(default_factory=dict)
    start_location: dict = Field(default_factory=dict)


class ChatTextRequest(BaseModel):
    session_uuid: str
    message: str
    current_location: dict = Field(default_factory=dict)


class RouteRecommendRequest(BaseModel):
    session_uuid: str
    interest: list[str] = Field(default_factory=list)
    available_time: int = 120
    physical_strength: str = "normal"
    start_spot_id: int = 1
    avoid_crowd: bool = True


class SpotRatingRequest(BaseModel):
    """Request schema for visitor to submit spot rating."""
    session_uuid: str
    spot_id: int
    overall_rating: int = Field(..., ge=1, le=5, description="综合评分 (1-5 分)")
    culture_rating: int | None = Field(None, ge=1, le=5, description="文化体验评分 (1-5 分)")
    nature_rating: int | None = Field(None, ge=1, le=5, description="自然景观评分 (1-5 分)")
    photo_rating: int | None = Field(None, ge=1, le=5, description="拍照价值评分 (1-5 分)")
    facility_rating: int | None = Field(None, ge=1, le=5, description="设施便利评分 (1-5 分)")
    comment: str | None = Field(None, description="文字反馈")
    user_tags: list[str] = Field(default_factory=list, description="用户标签")
    visit_date: str | None = Field(None, description="访问日期 (ISO 格式)")
    weather_condition: str | None = Field(None, description="天气状况")
    crowd_level: str | None = Field(None, description="拥挤程度")
    is_public: bool = False
    user_profile_snapshot: dict = Field(default_factory=dict, description="提交评分时的匿名游客画像快照")
    source: str = Field("visitor_page", description="评分来源")


class SpotRatingResponse(BaseModel):
    """Response schema for spot rating."""
    id: str
    session_uuid: str
    spot_id: int
    spot_name: str | None = None
    overall_rating: int
    culture_rating: int | None = None
    nature_rating: int | None = None
    photo_rating: int | None = None
    facility_rating: int | None = None
    comment: str | None = None
    user_tags: list[str] = Field(default_factory=list)
    visit_date: str | None = None
    weather_condition: str | None = None
    crowd_level: str | None = None
    is_public: bool = False
    review_status: str = "approved"
    sentiment: str = "neutral"
    sentiment_score: float = 0.0
    source: str = "visitor_page"
    created_or_updated: str | None = None
    created_at: str
    updated_at: str
