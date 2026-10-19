def score_spot(spot: dict, interests: list[str], distance_cost: float = 0, crowd_penalty: float = 0, user_preference_profile: dict | None = None) -> float:
    """Score a scenic spot with optional user preference profile integration.
    
    Args:
        spot: Spot data dictionary
        interests: User's interest tags
        distance_cost: Normalized distance cost (0-1)
        crowd_penalty: Penalty for crowded spots (0-1)
        user_preference_profile: Optional user preference profile from rating history
    
    Returns:
        float score for the spot
    """
    tags = set(spot.get("tags", []))
    interest_score = len(tags.intersection(interests)) / max(len(interests), 1)
    
    # Base scores from spot attributes
    base_score = (
        0.30 * interest_score
        + 0.20 * spot.get("popularity_score", 0.5)
        + 0.15 * spot.get("culture_score", 0.5)
        + 0.15 * spot.get("nature_score", 0.5)
        + 0.10 * spot.get("photo_score", 0.5)
        + 0.10 * spot.get("facility_score", 0.5)
        - 0.15 * distance_cost
        - 0.10 * crowd_penalty
    )
    
    # Apply user preference adjustments if profile is available
    if user_preference_profile:
        pref_tags = user_preference_profile.get("preference_tags", [])
        preferred_dims = user_preference_profile.get("preferred_dimensions", [])
        rating_pattern = user_preference_profile.get("rating_pattern", "balanced")
        
        # Boost score if spot tags match user's positive sentiment keywords
        tag_match_bonus = 0.0
        for pref_tag in pref_tags[:5]:  # Top 5 preference tags
            if pref_tag.lower() in str(tags).lower():
                tag_match_bonus += 0.05
        tag_match_bonus = min(tag_match_bonus, 0.15)  # Cap at 0.15
        
        # Adjust weights based on preferred dimensions
        dim_bonus = 0.0
        if "culture" in preferred_dims and spot.get("culture_score", 0.5) > 0.7:
            dim_bonus += 0.08
        if "nature" in preferred_dims and spot.get("nature_score", 0.5) > 0.7:
            dim_bonus += 0.08
        if "photo" in preferred_dims and spot.get("photo_score", 0.5) > 0.7:
            dim_bonus += 0.08
        if "facility" in preferred_dims and spot.get("facility_score", 0.5) > 0.7:
            dim_bonus += 0.08
        dim_bonus = min(dim_bonus, 0.12)  # Cap at 0.12
        
        # Adjust for rating pattern (strict users get slightly higher recommendations)
        pattern_adjustment = 0.0
        if rating_pattern == "strict":
            pattern_adjustment = 0.05  # Strict users need extra encouragement
        elif rating_pattern == "lenient":
            pattern_adjustment = -0.03  # Lenient users might be too easily satisfied
        
        base_score += tag_match_bonus + dim_bonus + pattern_adjustment
    
    return base_score
