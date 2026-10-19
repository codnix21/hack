"""Production vs demo: проверка SECRET_KEY без утечки значения в assertions."""

from __future__ import annotations

import pytest

from app.config import Settings, get_settings


def _clear():
    get_settings.cache_clear()


def test_demo_allows_default_secret(monkeypatch):
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "demo")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production-robot-platform-secret-key-2024")
    s = Settings()
    assert s.is_production is False
    assert s.secret_key_is_insecure() is True
    s.validate_for_runtime()  # не бросает
    # путь get_settings (как при импорте приложения)
    _clear()
    s2 = get_settings()
    assert s2.ENVIRONMENT == "demo"


def test_production_rejects_default_secret(monkeypatch):
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production-robot-platform-secret-key-2024")
    s = Settings()
    assert s.is_production is True
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        s.validate_for_runtime()


def test_production_rejects_empty_secret(monkeypatch):
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "")
    s = Settings()
    # пустой или fallback на default — в любом случае insecure
    assert s.secret_key_is_insecure() is True
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        s.validate_for_runtime()
    _clear()
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        get_settings()


def test_production_rejects_short_secret(monkeypatch):
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "short-but-not-default")
    s = Settings()
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        s.validate_for_runtime()


def test_production_accepts_strong_secret(monkeypatch):
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "x" * 48)
    s = Settings()
    assert s.secret_key_is_insecure() is False
    s.validate_for_runtime()
    _clear()
    assert get_settings().is_production is True


def test_get_settings_blocks_production_startup_path(monkeypatch):
    """Реальный путь старта: main импортирует get_settings() → RuntimeError."""
    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production-robot-platform-secret-key-2024")
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        get_settings()
    _clear()


@pytest.mark.asyncio
async def test_lifespan_blocks_production_weak_secret(monkeypatch):
    """Реальный lifespan: слабый SECRET_KEY в production → отказ старта."""
    from app import main as main_mod

    _clear()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me-in-production-robot-platform-secret-key-2024")
    weak = Settings()
    assert weak.is_production and weak.secret_key_is_insecure()
    monkeypatch.setattr(main_mod, "settings", weak)
    with pytest.raises(RuntimeError, match="Небезопасная конфигурация"):
        async with main_mod.lifespan(main_mod.app):
            pass
    _clear()


def test_health_exposes_environment_not_secret(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "environment" in body
    assert "SECRET_KEY" not in body
    assert "secret" not in {k.lower() for k in body.keys()}
    blob = str(body).lower()
    assert "change-me" not in blob
