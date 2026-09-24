"""Проверка загружаемых файлов."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import get_settings


def validate_upload_bytes(filename: str | None, content: bytes) -> None:
    """Проверить размер и расширение. При ошибке — HTTP 400 с русским сообщением."""
    settings = get_settings()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Файл слишком большой. Максимальный размер — 10 МБ",
        )
    name = filename or ""
    ext = Path(name).suffix.lower()
    allowed = settings.ALLOWED_UPLOAD_EXTENSIONS
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Допустимы только файлы CSV и Excel (.csv, .xlsx, .xls)",
        )


async def read_and_validate_upload(file: UploadFile) -> bytes:
    content = await file.read()
    validate_upload_bytes(file.filename, content)
    return content
