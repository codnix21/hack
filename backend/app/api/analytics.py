from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_optional
from app.models.catalog_meta import Industry, ObjectType, SolutionType
from app.models.manufacturer import Manufacturer
from app.models.misc import AuditLog, Calculation
from app.models.project import Project, ProjectSolution
from app.models.robot import Robot
from app.models.user import User
from app.services.matching import run_matching

router = APIRouter(prefix="/analytics", tags=["Аналитика"])


def _matching_stats_from_db(db: Session) -> dict[str, int]:
    match_stats = (
        db.query(ProjectSolution.status, func.count(ProjectSolution.id))
        .group_by(ProjectSolution.status)
        .all()
    )
    return {s: c for s, c in match_stats if s}


def _matching_stats_from_demos(db: Session) -> dict[str, int]:
    """Если в БД нет сохранённого подбора — сводка по демо (без записи)."""
    demos = db.query(Project).filter(Project.is_demo.is_(True), Project.is_archived.is_(False)).all()
    if not demos:
        return {}
    robots = db.query(Robot).filter(Robot.archived.is_(False)).all()
    if not robots:
        return {}
    counts: dict[str, int] = {"suitable": 0, "needs_review": 0, "excluded": 0}
    for project in demos:
        object_type_code = None
        if project.object_type_id:
            ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
            object_type_code = ot.code if ot else None
        for row in run_matching(robots, project.object_params or {}, object_type_code):
            st = row.get("status") or "needs_review"
            counts[st] = counts.get(st, 0) + 1
    return {k: v for k, v in counts.items() if v > 0}


@router.get("/summary", summary="Сводная аналитика")
def summary(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    robots_total = db.query(func.count(Robot.id)).filter(Robot.archived.is_(False)).scalar() or 0
    by_type = (
        db.query(SolutionType.name_ru, func.count(Robot.id))
        .outerjoin(Robot, Robot.solution_type_id == SolutionType.id)
        .group_by(SolutionType.name_ru)
        .all()
    )
    projects_total = db.query(func.count(Project.id)).filter(Project.is_archived.is_(False)).scalar() or 0
    demos = db.query(func.count(Project.id)).filter(Project.is_demo.is_(True)).scalar() or 0
    calcs = db.query(func.count(Calculation.id)).scalar() or 0
    matching_by_status = _matching_stats_from_db(db)
    if not matching_by_status:
        matching_by_status = _matching_stats_from_demos(db)
    manufacturers = db.query(func.count(Manufacturer.id)).filter(Manufacturer.archived.is_(False)).scalar() or 0

    avg_price = db.query(func.avg(Robot.price_rub)).filter(Robot.archived.is_(False), Robot.price_rub.isnot(None)).scalar()

    return {
        "robots_total": robots_total,
        "robots_by_type": [{"type": t or "без типа", "count": c} for t, c in by_type],
        "projects_total": projects_total,
        "demo_projects": demos,
        "calculations_total": calcs,
        "matching_by_status": matching_by_status,
        "manufacturers_total": manufacturers,
        "industries_total": db.query(func.count(Industry.id)).scalar() or 0,
        "object_types_total": db.query(func.count(ObjectType.id)).scalar() or 0,
        "avg_robot_price_rub": round(float(avg_price), 2) if avg_price else None,
        "recent_actions": db.query(func.count(AuditLog.id)).scalar() or 0,
    }


@router.get("/projects-by-industry", summary="Проекты по отраслям")
def projects_by_industry(db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(Industry.name_ru, func.count(Project.id))
        .outerjoin(Project, Project.industry_id == Industry.id)
        .group_by(Industry.name_ru)
        .all()
    )
    return [{"industry": n, "projects": c} for n, c in rows]
