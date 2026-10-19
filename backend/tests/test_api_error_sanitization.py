"""Публичные ответы API не содержат SQL, traceback, абсолютных путей и секретов."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.main import app
from app.services.dxf_import import parse_dxf
from app.services.safe_errors import looks_internal, public_error_detail


LEAK_MARKERS = (
    "traceback",
    "sqlalchemy",
    "psycopg",
    "select * from",
    "c:\\users",
    "/usr/",
    "/home/",
    "/var/lib",
    "site-packages",
    "operationalerror",
    "duplicate key value",
    "secret_key",
    "bearer ",
    "eyj",
)


def _assert_safe_detail(detail: object) -> None:
    blob = str(detail).lower()
    for m in LEAK_MARKERS:
        assert m not in blob, f"leak marker {m!r} in {detail!r}"


@pytest.mark.parametrize(
    "raw",
    [
        "OperationalError: SELECT * FROM users WHERE id=1",
        "duplicate key value violates unique constraint \"users_email_key\"",
        "could not connect to server: Connection refused",
        "Traceback (most recent call last):\n  File \"/app/app/main.py\", line 10",
        r"Permission denied: C:\Users\demo\secret\file.db",
        "No such file or directory: /var/lib/postgresql/data/pgdata",
        "JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.xxx leaked",
        "password=SuperSecret123 connection failed",
        "SECRET_KEY=change-me-in-production-robot-platform-secret-key-2024",
        "some long english library message about connection refused",
    ],
)
def test_public_error_detail_blocks_internal_and_secrets(raw: str):
    out = public_error_detail(Exception(raw), fallback="Безопасный fallback")
    assert out == "Безопасный fallback"
    assert looks_internal(raw)


def test_public_error_detail_allows_safe_russian_validation():
    msg = "Производительность должна быть больше 0"
    assert public_error_detail(ValueError(msg), fallback="x") == msg


def test_public_error_detail_valueerror_with_sql_is_blocked():
    """Тип ValueError сам по себе не делает сообщение безопасным."""
    assert (
        public_error_detail(
            ValueError("SELECT password FROM users"),
            fallback="Некорректные данные",
        )
        == "Некорректные данные"
    )


def test_public_error_detail_nested_cause():
    try:
        raise RuntimeError("SELECT * FROM secrets")
    except RuntimeError as inner:
        try:
            raise ValueError("обёртка") from inner
        except ValueError as outer:
            assert public_error_detail(outer, fallback="Ошибка") == "Ошибка"


def test_public_error_detail_multiline_takes_first_safe_line_or_fallback():
    multi = "Кратко\nFile \"/usr/lib/python/site-packages/x.py\", line 1"
    assert public_error_detail(multi, fallback="Ошибка") == "Ошибка"


def test_corrupt_dxf_api_style_response_has_no_internal_leak():
    with pytest.raises(HTTPException) as ei:
        parse_dxf(b"not-a-real-dxf-content-xxxxx", "broken.dxf")
    assert ei.value.status_code == 400
    _assert_safe_detail(ei.value.detail)
    assert "DXF" in str(ei.value.detail)


def test_economics_value_error_stays_russian_safe(client, db_session):
    from app.models.project import Project
    from app.models.user import User

    user = db_session.query(User).filter(User.email == "user@demo.local").first()
    assert user
    project = Project(
        name="Err sanitization",
        owner_id=user.id,
        object_params={
            "peak_demand": 100,
            "current_labor_cost_year": 1_000_000,
            "unit_price": 3_500_000,
        },
        region="МСК",
        work_mode="2shift",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    tok = client.post(
        "/api/auth/login",
        json={"email": "user@demo.local", "password": "User123!"},
    )
    assert tok.status_code == 200, tok.text
    headers = {"Authorization": f"Bearer {tok.json()['access_token']}"}

    r = client.post(
        f"/api/economics/{project.id}/calculate",
        json={"scenario": "purchase", "productivity": 0, "peak_demand": 100},
        headers=headers,
    )
    assert r.status_code == 400
    detail = r.json().get("detail")
    _assert_safe_detail(detail)
    assert isinstance(detail, str)


def test_unhandled_exception_returns_neutral_500(db_session):
    """Фактический HTTP-ответ при неожиданном исключении.

    Starlette ServerErrorMiddleware после своего handler всегда re-raise'ит
    исключение — TestClient по умолчанию (raise_server_exceptions=True)
    пробрасывает его в тест. Проверяем тело ответа с raise_server_exceptions=False.
    """
    from fastapi.testclient import TestClient

    from app.database import get_db

    @app.get("/__test_internal_boom__")
    def _boom():
        raise RuntimeError(
            "OperationalError: SELECT * FROM users; path=/var/lib/postgresql password=x"
        )

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app, raise_server_exceptions=False) as tc:
            r = tc.get("/__test_internal_boom__")
        assert r.status_code == 500
        detail = r.json().get("detail")
        assert detail == "Внутренняя ошибка сервера. Попробуйте позже."
        _assert_safe_detail(detail)
        blob = r.text.lower()
        assert "select" not in blob
        assert "postgresql" not in blob
        assert "password" not in blob
        assert "traceback" not in blob
    finally:
        app.dependency_overrides.clear()
        app.router.routes = [
            rt for rt in app.router.routes if getattr(rt, "path", None) != "/__test_internal_boom__"
        ]


def test_validation_422_format_preserved(client):
    r = client.post("/api/auth/login", json={"email": "not-an-email"})
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body


def test_health_has_no_secret_or_path_leak(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    blob = str(body).lower()
    assert "secret" not in blob
    assert "password" not in blob
    _assert_safe_detail(blob)


def test_forbidden_does_not_reveal_private_project(client, db_session):
    """403/404 для чужого проекта — без внутренних деталей (SQLite-тест, не Postgres)."""
    from app.models.project import Project
    from app.models.user import User

    owner = db_session.query(User).filter(User.email == "user@demo.local").first()
    assert owner
    project = Project(name="Private", owner_id=owner.id, object_params={}, region="МСК")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    guest = client.post("/api/auth/guest")
    assert guest.status_code == 200
    headers = {"Authorization": f"Bearer {guest.json()['access_token']}"}
    r = client.get(f"/api/projects/{project.id}", headers=headers)
    assert r.status_code in (403, 404)
    _assert_safe_detail(r.json().get("detail"))
