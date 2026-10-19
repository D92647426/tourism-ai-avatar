"""Static Ling Shan scenic spot catalog used by the MVP backend.

对应需求：
- REQ-005 灵山真实景点地图与路线导览
- docs/requirements_traceability.md#req-005-灵山真实景点地图与路线导览

The coordinates are normalized percentages for the custom SVG map. They are
not GPS coordinates; they preserve the visitor flow described by the local
Ling Shan guide documents: entrance -> central Buddhist axis -> core Buddha
area -> west-side palace/tantric area.
"""

from sqlalchemy import select

from app.core.database import new_session
from app.models.persistence import Facility, ScenicSpot


SCENIC_SPOTS = [
    {
        "id": 1,
        "name": "南门游客中心",
        "description": "灵山胜境游客入园与导览服务入口，适合作为路线起点。",
        "guide_text": "从南门入园后，建议先确认游览时间和体力，再沿中轴线进入核心景区。",
        "map_x": 12,
        "map_y": 82,
        "tags": ["service", "start", "family", "elderly"],
        "recommended_duration": 5,
        "popularity_score": 0.75,
        "culture_score": 0.5,
        "nature_score": 0.35,
        "photo_score": 0.45,
        "facility_score": 0.95,
    },
    {
        "id": 2,
        "name": "灵山大照壁",
        "description": "景区入口处的标志性门户景观，被资料称为“华夏第一壁”。",
        "guide_text": "大照壁长约39.8米、高约7米，是灵山胜境的文化序章，适合拍照和开场讲解。",
        "map_x": 21,
        "map_y": 74,
        "tags": ["history", "photo", "culture"],
        "recommended_duration": 8,
        "popularity_score": 0.78,
        "culture_score": 0.82,
        "nature_score": 0.25,
        "photo_score": 0.82,
        "facility_score": 0.75,
    },
    {
        "id": 3,
        "name": "佛足坛",
        "description": "位于菩提大道起点，是进入核心景区前的重要朝圣节点。",
        "guide_text": "佛足坛以佛祖足印为象征，适合讲解佛教圣迹、祈福文化和进入核心区的礼仪。",
        "map_x": 31,
        "map_y": 64,
        "tags": ["history", "culture", "prayer", "elderly"],
        "recommended_duration": 10,
        "popularity_score": 0.7,
        "culture_score": 0.84,
        "nature_score": 0.3,
        "photo_score": 0.62,
        "facility_score": 0.65,
    },
    {
        "id": 4,
        "name": "五智门",
        "description": "核心景区门户，区分外围区域与核心朝圣区域。",
        "guide_text": "五智门为汉白玉牌坊造型，位于中轴线上，是进入灵山核心景观前的庄严节点。",
        "map_x": 39,
        "map_y": 55,
        "tags": ["history", "photo", "culture"],
        "recommended_duration": 10,
        "popularity_score": 0.82,
        "culture_score": 0.8,
        "nature_score": 0.25,
        "photo_score": 0.78,
        "facility_score": 0.68,
    },
    {
        "id": 5,
        "name": "菩提大道",
        "description": "连接五智门与九龙灌浴广场的中轴线步道，两侧绿植繁茂。",
        "guide_text": "菩提大道适合慢行讲解，两侧菩提树营造禅意氛围，也是串联核心景观的主通道。",
        "map_x": 47,
        "map_y": 48,
        "tags": ["nature", "culture", "elderly"],
        "recommended_duration": 12,
        "popularity_score": 0.76,
        "culture_score": 0.68,
        "nature_score": 0.82,
        "photo_score": 0.7,
        "facility_score": 0.7,
    },
    {
        "id": 6,
        "name": "九龙灌浴",
        "description": "灵山胜境标志性动态景观，是游客必看的核心景点之一。",
        "guide_text": "九龙灌浴通过动态演艺呈现佛祖诞生故事，表演结束后可参与圣水祈福体验。",
        "map_x": 55,
        "map_y": 39,
        "tags": ["history", "photo", "family", "show"],
        "recommended_duration": 25,
        "popularity_score": 0.96,
        "culture_score": 0.86,
        "nature_score": 0.35,
        "photo_score": 0.9,
        "facility_score": 0.72,
    },
    {
        "id": 7,
        "name": "降魔成道浮雕",
        "description": "九龙灌浴北侧的巨型佛教故事浮雕，展示佛陀成道历程。",
        "guide_text": "浮雕长约26米、高约4.6米，适合亲子和研学游客观察佛教艺术细节。",
        "map_x": 61,
        "map_y": 33,
        "tags": ["history", "research", "family"],
        "recommended_duration": 12,
        "popularity_score": 0.72,
        "culture_score": 0.88,
        "nature_score": 0.2,
        "photo_score": 0.58,
        "facility_score": 0.6,
    },
    {
        "id": 8,
        "name": "阿育王柱",
        "description": "位于祥符禅寺正前方，传递佛教和平精神的石质地标。",
        "guide_text": "阿育王柱通高约16.9米，是中轴线上兼具地标打卡与文化科普功能的节点。",
        "map_x": 66,
        "map_y": 28,
        "tags": ["history", "photo", "culture"],
        "recommended_duration": 10,
        "popularity_score": 0.78,
        "culture_score": 0.84,
        "nature_score": 0.2,
        "photo_score": 0.74,
        "facility_score": 0.6,
    },
    {
        "id": 9,
        "name": "祥符禅寺",
        "description": "小灵山佛教文化发源地，资料记载其与北宋大中祥符年间赐额有关。",
        "guide_text": "祥符禅寺连接灵山历史与现代景区，是讲解千年佛教传承的核心点位。",
        "map_x": 72,
        "map_y": 22,
        "tags": ["history", "culture", "research", "elderly"],
        "recommended_duration": 30,
        "popularity_score": 0.9,
        "culture_score": 0.96,
        "nature_score": 0.42,
        "photo_score": 0.72,
        "facility_score": 0.74,
    },
    {
        "id": 10,
        "name": "佛手广场",
        "description": "“天下第一掌”是灵山大佛右手复制景观，寓意沾福气、保平安。",
        "guide_text": "佛手广场适合安排祈福体验，与抱佛脚并称灵山两大祈福体验。",
        "map_x": 78,
        "map_y": 36,
        "tags": ["photo", "prayer", "family"],
        "recommended_duration": 12,
        "popularity_score": 0.86,
        "culture_score": 0.72,
        "nature_score": 0.3,
        "photo_score": 0.88,
        "facility_score": 0.68,
    },
    {
        "id": 11,
        "name": "灵山大佛",
        "description": "1997年落成开光，是灵山胜境最具代表性的标志性建筑。",
        "guide_text": "灵山大佛是核心朝圣与拍照节点，适合讲解佛教造像艺术和景区建设历史。",
        "map_x": 83,
        "map_y": 18,
        "tags": ["history", "photo", "culture", "must"],
        "recommended_duration": 40,
        "popularity_score": 1.0,
        "culture_score": 0.98,
        "nature_score": 0.55,
        "photo_score": 0.95,
        "facility_score": 0.76,
    },
    {
        "id": 12,
        "name": "灵山梵宫",
        "description": "2009年正式开放，汇集木雕、琉璃、油画、景泰蓝等传统工艺。",
        "guide_text": "梵宫建筑面积约72000平方米，是佛教艺术殿堂，适合深度文化、艺术和研学讲解。",
        "map_x": 59,
        "map_y": 16,
        "tags": ["history", "photo", "research", "indoor"],
        "recommended_duration": 50,
        "popularity_score": 0.96,
        "culture_score": 1.0,
        "nature_score": 0.35,
        "photo_score": 0.92,
        "facility_score": 0.86,
    },
    {
        "id": 13,
        "name": "五印坛城",
        "description": "与灵山梵宫隔湖相望，适合体验藏传佛教文化与转经祈福。",
        "guide_text": "五印坛城适合讲解藏传佛教建筑、转经祈福和不同佛教文化融合。",
        "map_x": 44,
        "map_y": 18,
        "tags": ["history", "photo", "research", "prayer"],
        "recommended_duration": 35,
        "popularity_score": 0.86,
        "culture_score": 0.94,
        "nature_score": 0.45,
        "photo_score": 0.86,
        "facility_score": 0.72,
    },
    {
        "id": 14,
        "name": "百子戏弥勒",
        "description": "青铜群雕呈现欢喜、包容的民俗文化氛围，亲子游客关注度高。",
        "guide_text": "百子戏弥勒造型生动活泼，适合亲子互动、民俗祈福和轻松拍照。",
        "map_x": 69,
        "map_y": 43,
        "tags": ["family", "photo", "prayer"],
        "recommended_duration": 10,
        "popularity_score": 0.72,
        "culture_score": 0.66,
        "nature_score": 0.25,
        "photo_score": 0.76,
        "facility_score": 0.65,
    },
]


SCENIC_FACILITIES = [
    {"id": 101, "name": "南门游客中心服务台", "type": "游客中心", "map_x": 12, "map_y": 84, "service_radius": 18},
    {"id": 102, "name": "南门停车场", "type": "停车场", "map_x": 8, "map_y": 88, "service_radius": 26},
    {"id": 103, "name": "入口售票处", "type": "售票处", "map_x": 14, "map_y": 79, "service_radius": 16},
    {"id": 104, "name": "菩提大道公共洗手间", "type": "厕所", "map_x": 48, "map_y": 46, "service_radius": 12},
    {"id": 105, "name": "九龙灌浴医疗点", "type": "医疗点", "map_x": 57, "map_y": 37, "service_radius": 14},
    {"id": 106, "name": "梵宫餐饮点", "type": "餐饮点", "map_x": 60, "map_y": 18, "service_radius": 15},
    {"id": 107, "name": "梵宫母婴室", "type": "母婴室", "map_x": 58, "map_y": 14, "service_radius": 10},
    {"id": 108, "name": "大佛无障碍服务点", "type": "无障碍设施", "map_x": 81, "map_y": 22, "service_radius": 12},
]


def list_scenic_spots() -> list[dict]:
    """Return the in-memory Ling Shan scenic spot catalog."""
    return SCENIC_SPOTS


def list_facilities() -> list[dict]:
    """Return the in-memory facility catalog used by the MVP guide APIs."""
    return SCENIC_FACILITIES


def ensure_scenic_catalog() -> None:
    """Seed the PostgreSQL scenic catalog used by ratings and analytics."""
    with new_session() as db:
        existing_spots = {row.id: row for row in db.execute(select(ScenicSpot)).scalars().all()}
        for spot in SCENIC_SPOTS:
            row = existing_spots.get(spot["id"])
            values = {
                "name": spot["name"],
                "description": spot["description"],
                "guide_text": spot["guide_text"],
                "map_x": float(spot["map_x"]),
                "map_y": float(spot["map_y"]),
                "tags_json": spot.get("tags", []),
                "recommended_duration": int(spot.get("recommended_duration", 10)),
                "popularity_score": float(spot.get("popularity_score", 0.5)),
                "culture_score": float(spot.get("culture_score", 0.5)),
                "nature_score": float(spot.get("nature_score", 0.5)),
                "photo_score": float(spot.get("photo_score", 0.5)),
                "facility_score": float(spot.get("facility_score", 0.5)),
                "enabled": True,
            }
            if row:
                for key, value in values.items():
                    setattr(row, key, value)
            else:
                db.add(ScenicSpot(id=spot["id"], **values))

        existing_facilities = {row.id: row for row in db.execute(select(Facility)).scalars().all()}
        for facility in SCENIC_FACILITIES:
            values = {
                "name": facility["name"],
                "type": facility["type"],
                "map_x": float(facility["map_x"]),
                "map_y": float(facility["map_y"]),
                "service_radius": int(facility.get("service_radius", 10)),
                "enabled": True,
            }
            row = existing_facilities.get(facility["id"])
            if row:
                for key, value in values.items():
                    setattr(row, key, value)
            else:
                db.add(Facility(id=facility["id"], **values))
        db.commit()
