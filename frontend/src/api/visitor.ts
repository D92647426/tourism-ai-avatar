import { http, unwrap } from "./http";

export interface ScenicSpot {
  id: number;
  name: string;
  description: string;
  guide_text?: string;
  map_x: number;
  map_y: number;
  tags?: string[];
  recommended_duration?: number;
}

export interface RouteSpot {
  id: number;
  name: string;
  stay_minutes: number;
  reason?: string;
}

export interface RoutePlan {
  route_name: string;
  total_duration: number;
  spots: RouteSpot[];
  reason: string;
  score_summary?: Record<string, unknown>;
}

export interface SpotRatingPayload {
  session_uuid: string;
  spot_id: number;
  overall_rating: number;
  culture_rating?: number;
  nature_rating?: number;
  photo_rating?: number;
  facility_rating?: number;
  comment?: string;
  user_tags?: string[];
  is_public?: boolean;
  user_profile_snapshot?: Record<string, unknown>;
  source?: string;
}

export interface SpotRatingStats {
  spot_id: number;
  spot_name?: string;
  total_ratings: number;
  average_overall?: number;
  average_culture?: number;
  average_nature?: number;
  average_photo?: number;
  average_facility?: number;
  weighted_average_overall?: number;
  top_tags: Array<{ tag: string; count: number }>;
  rating_distribution: Record<string, number>;
}

export function createSession() {
  return unwrap(http.post("/api/v1/guide/sessions", {
    scene_code: "main_gate",
    user_profile: { interest: ["history", "photo"], available_minutes: 120, physical_strength: "normal", group_type: "family" }
  }));
}

export function sendText(sessionUuid: string, message: string) {
  return unwrap(http.post("/api/v1/guide/ask", {
    question: message,
    session_id: sessionUuid,
    scene_code: "main_gate",
    user_profile: { interest: ["history", "photo"], available_minutes: 120, group_type: "family" }
  }));
}

export function fetchScenicSpots(): Promise<ScenicSpot[]> {
  return unwrap(http.get("/api/v1/scenic/spots"));
}

export function recommendRoute(sessionUuid: string, overrides: Partial<{ interest: string[]; available_time: number; physical_strength: string; start_spot_id: number }> = {}): Promise<RoutePlan> {
  return unwrap(http.post("/api/v1/route/recommend", {
    session_id: sessionUuid,
    start_point: "main_gate",
    available_minutes: overrides.available_time ?? 120,
    interest_tags: overrides.interest ?? ["history", "photo"],
    group_type: overrides.physical_strength === "elderly" ? "elderly" : "family"
  }));
}

export function submitSpotRating(payload: SpotRatingPayload) {
  return unwrap(http.post("/api/v1/visitor/ratings", payload));
}

export function fetchSpotRatingStats(spotId: number): Promise<SpotRatingStats> {
  return unwrap(http.get(`/api/v1/visitor/spots/${spotId}/ratings/stats`));
}

export function fetchSessionRatings(sessionUuid: string) {
  return unwrap(http.get(`/api/v1/visitor/sessions/${encodeURIComponent(sessionUuid)}/ratings`));
}
