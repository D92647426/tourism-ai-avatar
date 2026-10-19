from __future__ import annotations

import json
from datetime import datetime

from app.core.database import new_session
from app.models.persistence import AvatarConfig


DEFAULT_AVATAR = {
    "name": "灵灵",
    "avatar_style": "ancient",
    "clothes": "traditional_blue",
    "voice_name": "female_warm",
    "voice_speed": 1.0,
    "opening_text": "您好，我是您的 AI 数字人导游灵灵。",
    "expressions": ["idle", "listening", "thinking", "speaking", "happy", "concerned"],
}


def _payload(row: AvatarConfig) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "avatar_style": row.avatar_style,
        "clothes": row.clothes,
        "voice_name": row.voice_name,
        "voice_speed": row.voice_speed,
        "opening_text": row.opening_text,
        "expressions": json.loads(row.expressions_json or "[]"),
        "enabled": row.enabled,
    }


def ensure_default_avatar() -> dict:
    """
    Ensure a persistent active avatar exists.

    对应需求：
    - REQ-008 后台权限、版本化知识库与数据库持久化
    """
    db = new_session()
    try:
        active = db.query(AvatarConfig).filter(AvatarConfig.enabled.is_(True)).first()
        if active:
            return _payload(active)
        row = AvatarConfig(
            name=DEFAULT_AVATAR["name"],
            avatar_style=DEFAULT_AVATAR["avatar_style"],
            clothes=DEFAULT_AVATAR["clothes"],
            voice_name=DEFAULT_AVATAR["voice_name"],
            voice_speed=DEFAULT_AVATAR["voice_speed"],
            opening_text=DEFAULT_AVATAR["opening_text"],
            expressions_json=json.dumps(DEFAULT_AVATAR["expressions"], ensure_ascii=False),
            enabled=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _payload(row)
    finally:
        db.close()


def get_active_avatar() -> dict:
    db = new_session()
    try:
        active = db.query(AvatarConfig).filter(AvatarConfig.enabled.is_(True)).first()
        if not active:
            return ensure_default_avatar()
        return _payload(active)
    finally:
        db.close()


def save_avatar_config(payload: dict) -> dict:
    """Persist and activate the current digital human profile."""
    db = new_session()
    try:
        for row in db.query(AvatarConfig).all():
            row.enabled = False
            row.updated_at = datetime.utcnow()
        expressions = payload.get("expressions") or DEFAULT_AVATAR["expressions"]
        row = AvatarConfig(
            name=payload.get("name") or DEFAULT_AVATAR["name"],
            avatar_style=payload.get("avatar_style") or DEFAULT_AVATAR["avatar_style"],
            clothes=payload.get("clothes") or DEFAULT_AVATAR["clothes"],
            voice_name=payload.get("voice_name") or DEFAULT_AVATAR["voice_name"],
            voice_speed=float(payload.get("voice_speed") or DEFAULT_AVATAR["voice_speed"]),
            opening_text=payload.get("opening_text") or DEFAULT_AVATAR["opening_text"],
            expressions_json=json.dumps(expressions, ensure_ascii=False),
            enabled=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _payload(row)
    finally:
        db.close()
