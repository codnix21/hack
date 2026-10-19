"""Идемпотентная очистка истёкших гостевых сессий и их проектов."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.misc import Calculation
from app.models.project import Project, ProjectSolution, Scenario
from app.models.user import User, utcnow


def _purge_project(db: Session, project: Project) -> None:
    db.query(ProjectSolution).filter(ProjectSolution.project_id == project.id).delete()
    db.query(Scenario).filter(Scenario.project_id == project.id).delete()
    db.query(Calculation).filter(Calculation.project_id == project.id).delete()
    db.delete(project)


def cleanup_expired_guests(db: Session) -> dict[str, Any]:
    """
    Удаляет только действительно истёкшие гостевые данные.

    - не трогает зарегистрированных пользователей и их проекты;
    - не удаляет демо;
    - опубликованный проект не удаляется раньше project.expires_at;
    - идемпотентно (безопасен при autoflush=False).
    """
    now = utcnow()
    removed_users = 0
    removed_projects = 0

    expired_projects = (
        db.query(Project)
        .filter(
            Project.is_demo.is_(False),
            Project.expires_at.isnot(None),
            Project.expires_at < now,
        )
        .all()
    )
    for p in expired_projects:
        owner = db.query(User).filter(User.id == p.owner_id).first()
        if owner and owner.role == "guest":
            _purge_project(db, p)
            removed_projects += 1
    db.flush()

    guests = (
        db.query(User)
        .filter(User.role == "guest", User.expires_at.isnot(None), User.expires_at < now)
        .all()
    )
    for guest in list(guests):
        projects = (
            db.query(Project)
            .filter(Project.owner_id == guest.id, Project.is_demo.is_(False))
            .all()
        )
        for p in list(projects):
            # Публикация с ещё не истёкшим expires_at сохраняется
            if (
                p.published_at is not None
                and p.expires_at is not None
                and p.expires_at >= now
            ):
                continue
            if p.expires_at is not None and p.expires_at >= now:
                continue
            _purge_project(db, p)
            removed_projects += 1
        db.flush()
        left = (
            db.query(Project)
            .filter(Project.owner_id == guest.id, Project.is_demo.is_(False))
            .count()
        )
        if left == 0:
            db.delete(guest)
            removed_users += 1

    db.commit()
    return {
        "removed_guest_users": removed_users,
        "removed_projects": removed_projects,
        "ran_at": now.isoformat(),
        "idempotent": True,
    }
