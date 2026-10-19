"""Безопасные сообщения об ошибках для клиента (без SQL/traceback/путей/секретов)."""

from __future__ import annotations

import logging
import re
import traceback
from typing import Any

logger = logging.getLogger("netcore.errors")

_INTERNAL_MARKERS = (
    "traceback",
    "sqlalchemy",
    "psycopg",
    "postgresql",
    "asyncpg",
    "operationalerror",
    "integrityerror",
    "programmingerror",
    "uniqueviolation",
    "foreignkeyviolation",
    "permission denied",
    "no such file",
    "errno",
    "exception:",
    "file not found",
    "modulenotfound",
    "   at 0x",
    "c:\\",
    "d:\\",
    "/home/",
    "/usr/",
    "/var/",
    "/tmp/",
    "/app/",
    "site-packages",
    "connection refused",
    "could not connect",
    "server closed the connection",
    "duplicate key value",
    "violates foreign key",
    "violates unique constraint",
)

_SECRET_MARKERS = (
    "secret_key",
    "secret key",
    "password",
    "passwd",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "bearer ",
    "authorization:",
    "jwt",
    "private_key",
    "-----begin",
)

_SQL_RE = re.compile(r"\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|INTO)\b", re.I)
_PATH_RE = re.compile(
    r"([A-Za-z]:\\[^\s\"']+)|((?:/[\w.\-]+){2,})",
)
_JWT_LIKE_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
_LATIN_RE = re.compile(r"[A-Za-z]")


def _flatten_exception_text(exc: BaseException | str) -> str:
    if isinstance(exc, str):
        return exc
    parts: list[str] = [str(exc)]
    cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
    seen: set[int] = {id(exc)}
    depth = 0
    while isinstance(cause, BaseException) and id(cause) not in seen and depth < 4:
        parts.append(str(cause))
        seen.add(id(cause))
        cause = getattr(cause, "__cause__", None) or getattr(cause, "__context__", None)
        depth += 1
    return "\n".join(parts)


def looks_internal(message: str) -> bool:
    low = message.lower().replace("\r\n", "\n")
    if any(m in low for m in _INTERNAL_MARKERS):
        return True
    if any(m in low for m in _SECRET_MARKERS):
        return True
    if _JWT_LIKE_RE.search(message):
        return True
    if _SQL_RE.search(message) and ("from" in low or "where" in low or "into" in low or "join" in low):
        return True
    if _PATH_RE.search(message):
        return True
    # многострочный traceback-подобный текст
    if "\n" in message and ("file " in low or 'file "' in low or "line " in low):
        return True
    return False


def public_error_detail(exc: BaseException | str, *, fallback: str, max_len: int = 280) -> str:
    """Текст для HTTP detail.

    Допускаются короткие русские сообщения валидации без внутренних маркеров.
    Тип ValueError сам по себе не считается доказательством безопасности.
    """
    msg = _flatten_exception_text(exc).strip()
    if not msg:
        return fallback
    # берём первую непустую строку для клиентского ответа
    first_line = next((ln.strip() for ln in msg.splitlines() if ln.strip()), msg)
    if looks_internal(msg) or looks_internal(first_line):
        return fallback
    # без кириллицы — только очень короткие коды (не системный EN prose)
    if not _CYRILLIC_RE.search(first_line) and _LATIN_RE.search(first_line):
        if len(first_line) > 40 or " " in first_line:
            return fallback
    if len(first_line) > max_len:
        return first_line[: max_len - 1] + "…"
    return first_line


def _redact_for_log(text: str) -> str:
    out = text
    out = _JWT_LIKE_RE.sub("[redacted-jwt]", out)
    for marker in ("password", "secret", "token", "authorization"):
        out = re.sub(
            rf"({marker}\s*[=:]\s*)(\S+)",
            r"\1[redacted]",
            out,
            flags=re.I,
        )
    return out[:500]


def log_safe_exception(context: str, exc: BaseException, **extra: Any) -> None:
    """Журнал сервера: тип + redacted текст + кадры стека без строки исключения.

    Не используем logger.exception: traceback.format_exception включает
    исходный str(exc) с возможными секретами.
    """
    blocked = {"password", "token", "secret", "authorization", "secret_key", "access_token"}
    safe_extra = {k: v for k, v in extra.items() if k.lower() not in blocked}
    frames = "".join(traceback.format_tb(exc.__traceback__)) if exc.__traceback__ else ""
    logger.error(
        "%s: %s: %s | %s\n%s",
        context,
        type(exc).__name__,
        _redact_for_log(_flatten_exception_text(exc)),
        safe_extra,
        frames,
    )
