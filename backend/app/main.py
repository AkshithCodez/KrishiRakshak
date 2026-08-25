"""
KrishiRakshak — Backend API Server

FastAPI application entrypoint for the KrishiRakshak portal.
Integrates Scan Reports, Community Outbreak Alerts, and Analytics endpoints.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import engine, Base
from .routes import scans, outbreaks, stats, auth

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables if not existing (ideal for quick start / demo)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Farmers Crop Disease Diagnostic and Regional Outbreak Reporting Portal",
    lifespan=lifespan,
)

# Enable CORS for dashboard and mobile web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(outbreaks.router)
app.include_router(stats.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
