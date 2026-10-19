#!/usr/bin/env python3
"""Очистка истёкших гостевых сессий. Запуск: python scripts/cleanup_guests.py

Рекомендуемая периодичность: ежедневно (cron / Task Scheduler).
Также вызывается идемпотентно при старте backend.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.cleanup_guests import cleanup_expired_guests


def main() -> None:
    db = SessionLocal()
    try:
        stats = cleanup_expired_guests(db)
        print(stats)
    finally:
        db.close()


if __name__ == "__main__":
    main()
