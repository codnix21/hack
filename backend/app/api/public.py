"""Публичный просмотр опубликованных проектов (только чтение)."""

from __future__ import annotations

import copy
from datetime import timedelta
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models.misc import Calculation
from app.models.project import Project, ProjectSolution, Scenario
from app.models.robot import Robot
from app.models.user import User, utcnow
from app.schemas import ProjectOut
from app.services.audit import log_action
from app.services.layout import sanitize_layout
from app.services.visualization import generate_layout

router = APIRouter(prefix="/public", tags=["Публичный просмотр"])


def _public_project_card(project: Project) -> dict[str, Any]:
    """Без owner_id, токена и внутренних полей."""
    params = project.object_params or {}
    w = params.get("area_width_m") or (project.layout or {}).get("width_m")
    l = params.get("area_length_m") or (project.layout or {}).get("length_m")
    area = None
    try:
        if w is not None and l is not None:
            area = round(float(w) * float(l), 1)
    except (TypeError, ValueError):
        area = None
    return {
        "name": project.name,
        "description": project.description,
        "region": project.region,
        "work_mode": project.work_mode,
        "object_params": {
            k: v
            for k, v in params.items()
            if k
            in {
                "area_width_m",
                "area_length_m",
                "aisle_width_mm",
                "peak_demand",
                "zones_count",
                "charging_stations",
                "required_payload_kg",
                "current_labor_cost_year",
            }
        },
        "area_m2": area,
        "published_at": project.published_at.isoformat() if project.published_at else None,
    }


def _public_economics(results: Optional[dict]) -> Optional[dict]:
    if not isinstance(results, dict):
        return None
    return {
        "robots_count": results.get("robots_count"),
        "capex": results.get("capex"),
        "opex": results.get("opex"),
        "annual_effect": results.get("annual_effect"),
        "payback": results.get("payback"),
        "roi": results.get("roi"),
        "tco": results.get("tco"),
        "npv": results.get("npv"),
        "irr": results.get("irr"),
        "cashflows": results.get("cashflows"),
        "assumptions": results.get("assumptions"),
        "assumption_flags": results.get("assumption_flags"),
        "scenario_name_ru": results.get("scenario_name_ru"),
    }


def _get_published(db: Session, token: str) -> Project:
    if not token or len(token) < 24:
        raise HTTPException(404, detail="Публикация не найдена")
    project = (
        db.query(Project)
        .filter(Project.public_token == token, Project.published_at.isnot(None))
        .first()
    )
    if not project or project.is_archived:
        raise HTTPException(404, detail="Публикация не найдена или отключена")
    if project.expires_at and project.expires_at < utcnow():
        raise HTTPException(404, detail="Срок публикации истёк")
    return project


@router.get("/p/{token}", summary="Опубликованный проект")
def public_project(token: str, db: Annotated[Session, Depends(get_db)]):
    project = _get_published(db, token)
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project.id)
        .order_by(Calculation.version.desc())
        .first()
    )
    n = 3
    if calc and calc.results:
        n = int(calc.results.get("robots_count") or 3)
    layout = generate_layout(project.object_params or {}, n, saved_layout=project.layout)
    solutions = (
        db.query(ProjectSolution)
        .filter(ProjectSolution.project_id == project.id)
        .order_by(ProjectSolution.match_score.desc())
        .limit(8)
        .all()
    )
    robots_out = []
    for s in solutions:
        if not s.selected and s.status != "suitable":
            continue
        robot = db.query(Robot).filter(Robot.id == s.robot_id).first()
        robots_out.append(
            {
                "name": robot.name if robot else f"Решение #{s.robot_id}",
                "match_score": s.match_score,
                "status": s.status,
                "selected": s.selected,
                "payload_kg": robot.payload_kg if robot else None,
                "price_rub": robot.price_rub if robot else None,
            }
        )
        if len(robots_out) >= 5:
            break

    fleet = []
    for sc in (
        db.query(Scenario)
        .filter(Scenario.project_id == project.id, Scenario.code.like("fleet_%"))
        .order_by(Scenario.code)
        .all()
    ):
        fleet.append(
            {
                "code": sc.code,
                "name_ru": sc.name_ru,
                "params": sc.params,
                "results": sc.results,
            }
        )

    return {
        "project": _public_project_card(project),
        "layout": layout,
        "geometry": sanitize_layout(project.layout) if project.layout else None,
        "economics": _public_economics(calc.results if calc else None),
        "selected_robots": robots_out,
        "fleet_scenarios": fleet,
        "read_only": True,
        "disclaimer": (
            "Публичная демонстрация только для просмотра. "
            "Финансовые показатели — предварительная оценка."
        ),
    }


@router.post("/p/{token}/clone", response_model=ProjectOut, summary="Копия опубликованного проекта")
def clone_public(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    src = _get_published(db, token)
    ttl = get_settings().GUEST_TTL_DAYS
    clone = Project(
        owner_id=user.id,
        name=f"{src.name} (копия)",
        industry_id=src.industry_id,
        object_type_id=src.object_type_id,
        description=src.description,
        region=src.region,
        work_mode=src.work_mode,
        status="draft",
        object_params=copy.deepcopy(src.object_params or {}),
        layout=copy.deepcopy(src.layout) if src.layout else None,
        is_demo=False,
        public_token=None,
        published_at=None,
        expires_at=(utcnow() + timedelta(days=ttl)) if user.role == "guest" else None,
    )
    db.add(clone)
    db.flush()
    for code, name in [
        ("baseline", "Без роботизации"),
        ("purchase", "Покупка оборудования"),
        ("raas", "Роботы как услуга"),
    ]:
        db.add(Scenario(project_id=clone.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(clone)
    log_action(db, "public.clone", user.id, "project", clone.id, {"from_token": token[:8]})
    return ProjectOut.model_validate(clone)
