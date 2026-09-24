from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://robot:robot@db:5432/robot_platform"
    SECRET_KEY: str = "change-me-in-production-robot-platform-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    APP_NAME: str = "Платформа подбора робототехники"
    MODEL_VERSION: str = "economics-v1.0"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    ALLOWED_UPLOAD_EXTENSIONS: set[str] = {".csv", ".xlsx", ".xls"}

    @field_validator("ALLOWED_UPLOAD_EXTENSIONS", mode="before")
    @classmethod
    def _parse_extensions(cls, v: Any) -> set[str]:
        if v is None:
            return {".csv", ".xlsx", ".xls"}
        if isinstance(v, str):
            parts = [p.strip() for p in v.replace(";", ",").split(",") if p.strip()]
            return {p if p.startswith(".") else f".{p}" for p in parts}
        return set(v)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
