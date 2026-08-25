"""
KrishiRakshak — Backend Configuration

Environment-based settings using pydantic-settings.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "KrishiRakshak Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://krishirakshak:krishirakshak@localhost:5432/krishirakshak"

    # ML Service
    ML_SERVICE_URL: str = "http://localhost:8001"

    # Auth
    API_SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # Outbreak Detection
    OUTBREAK_MIN_REPORTS: int = 3          # Minimum distinct devices to trigger alert
    OUTBREAK_TIME_WINDOW_DAYS: int = 7     # Rolling window in days
    OUTBREAK_GEOHASH_PRECISION: int = 5    # ~5km grid cells

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
