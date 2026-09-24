from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user_optional
from app.models.misc import Calculation
from app.models.project import Project
from app.models.user import User
from app.services.visualization import generate_layout, generate_simulation_config

router = APIRouter(prefix="/visualization", tags=["Визуализация"])


@router.get("/{project_id}/layout", summary="2D-раскладка объекта")
def layout(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    robots_count: Optional[int] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")

    n = robots_count
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    if n is None and calc and calc.results:
        n = calc.results.get("robots_count")
    n = int(n or (project.object_params or {}).get("robots_count") or 3)
    return generate_layout(project.object_params or {}, n)


@router.get("/{project_id}/simulation", summary="Конфигурация симуляции")
def simulation(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    n = 3
    prod = None
    economics = None
    if calc and calc.results:
        n = int(calc.results.get("robots_count") or 3)
        economics = calc.results
        inputs = calc.inputs or {}
        prod = inputs.get("productivity")
    return generate_simulation_config(project.object_params or {}, n, prod, economics)
