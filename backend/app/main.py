"""FastAPI 入口：API + 打包后的前端静态资源。"""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router as api_router

APP_VERSION = "0.5.1"


def _frontend_dist() -> Path:
    """源码运行时用 frontend/dist；PyInstaller 打包后从解包目录的 frontend_dist 取。"""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) / "frontend_dist"
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = _frontend_dist()

app = FastAPI(
    title="ControlLab API",
    version=APP_VERSION,
    description="线性连续系统的传递函数、稳定性、时域、频域与根轨迹分析接口",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", summary="健康检查")
def health() -> dict[str, str]:
    return {"status": "ok", "version": APP_VERSION}


if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")
