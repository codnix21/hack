from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Известные небезопасные значения — только для детекции, не для логирования значений.
_INSECURE_SECRET_MARKERS = (
    "change-me",
    "changeme",
    "secret-key",
    "test-secret",
    "robot-platform-secret",
    "your-secret",
    "замените",
)


class Settings(BaseSettings):
    """Настройки приложения.

    ENVIRONMENT=demo (по умолчанию) — локальная/хакатон-демонстрация:
      допустим известный SECRET_KEY из compose/defaults.
    ENVIRONMENT=production — отказ запуска при коротком или известном SECRET_KEY.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "demo"
    DATABASE_URL: str = "postgresql://robot:robot@db:5432/robot_platform"
    SECRET_KEY: str = "change-me-in-production-robot-platform-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    APP_NAME: str = "Платформа подбора робототехники"
    MODEL_VERSION: str = "economics-v1.0"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    ALLOWED_UPLOAD_EXTENSIONS: set[str] = {".csv", ".xlsx", ".xls"}
    GUEST_TTL_DAYS: int = 14
    DXF_MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024

    @field_validator("ALLOWED_UPLOAD_EXTENSIONS", mode="before")
    @classmethod
    def _parse_extensions(cls, v: Any) -> set[str]:
        if v is None:
            return {".csv", ".xlsx", ".xls"}
        if isinstance(v, str):
            parts = [p.strip() for p in v.replace(";", ",").split(",") if p.strip()]
            return {p if p.startswith(".") else f".{p}" for p in parts}
        return set(v)

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def _normalize_env(cls, v: Any) -> str:
        s = str(v or "demo").strip().lower()
        if s in ("prod", "production"):
            return "production"
        if s in ("dev", "development", "local", "demo", "hackathon"):
            return "demo"
        return s

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def secret_key_is_insecure(self) -> bool:
        key = (self.SECRET_KEY or "").strip()
        if len(key) < 32:
            return True
        low = key.lower()
        return any(m in low for m in _INSECURE_SECRET_MARKERS)

    def validate_for_runtime(self) -> None:
        """В production запрещает слабый/дефолтный SECRET_KEY. Значение ключа не логируется."""
        if not self.is_production:
            return
        if self.secret_key_is_insecure():
            raise RuntimeError(
                "Небезопасная конфигурация: в ENVIRONMENT=production задайте SECRET_KEY "
                "длиной ≥ 32 символов, отличный от демонстрационного значения по умолчанию. "
                "См. .env.example."
            )


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.validate_for_runtime()
    return s
