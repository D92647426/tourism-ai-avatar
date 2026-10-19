from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.admin import router as admin_router
from app.api.v1 import router as v1_router
from app.api.visitor import router as visitor_router
from app.core.database import init_db
from app.core.config import settings
from app.services.auth_service import ensure_admin_user
from app.services.avatar_service import ensure_default_avatar
from app.services.knowledge_service import migrate_existing_admin_documents


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _frontend_dist_dir() -> Path:
    return _repo_root() / "frontend" / "dist"


def _resolve_frontend_asset(dist_dir: Path, relative_path: str) -> Path | None:
    if not relative_path:
        return None
    candidate = (dist_dir / relative_path).resolve()
    try:
        candidate.relative_to(dist_dir.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


def create_app() -> FastAPI:
    app = FastAPI(title="LingTour AI API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(visitor_router, prefix="/api/visitor", tags=["visitor"])
    app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
    app.include_router(v1_router, prefix="/api/v1", tags=["v1"])

    @app.get("/api/health")
    def health():
        return {"code": 0, "message": "success", "data": {"status": "ok"}}

    @app.get("/api/v1/health")
    def health_v1():
        return {"code": 0, "message": "success", "data": {"status": "ok"}}

    @app.on_event("startup")
    def startup():
        init_db()
        ensure_admin_user()
        ensure_default_avatar()
        migrate_existing_admin_documents()

    dist_dir = _frontend_dist_dir()
    index_file = dist_dir / "index.html"
    if index_file.exists():
        @app.get("/", include_in_schema=False)
        def frontend_index():
            return FileResponse(index_file)

        @app.get("/{full_path:path}", include_in_schema=False)
        def frontend_spa(full_path: str):
            asset = _resolve_frontend_asset(dist_dir, full_path)
            if asset is not None:
                return FileResponse(asset)
            return FileResponse(index_file)

    return app


app = create_app()
