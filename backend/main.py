import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, text

from backend.config import settings
from backend.db import get_session, init_db
from backend.routers import (
    categories,
    compare,
    logs,
    models,
    notifications,
    recommend,
    stats,
    sync,
)
from backend.routers import settings as settings_router
from backend.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("companion")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting comp[AI]on — init_db + scheduler")
    init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("comp[AI]on stopped")


app = FastAPI(title="comp[AI]on", version="0.5.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Limit", "X-Offset"],
)

app.include_router(logs.router)
app.include_router(models.router)
app.include_router(categories.router)
app.include_router(stats.router)
app.include_router(settings_router.router)
app.include_router(notifications.router)
app.include_router(recommend.router)
app.include_router(compare.router)
app.include_router(sync.router)


@app.get("/api/health")
def health(session: Session = Depends(get_session)):
    session.exec(text("SELECT 1")).one()
    return {"status": "ok", "db": "connected"}


FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        index = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index)
