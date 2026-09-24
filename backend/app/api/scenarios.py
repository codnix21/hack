from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user, get_current_user_optional
from app.models.project import Project, Scenario
from app.models.user import User
from app.schemas import ScenarioOut, ScenarioUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/scenarios", tags=["Сценарии"])


@router.get("/{project_id}", response_model=list[ScenarioOut], summary="Сценарии проекта")
def list_scenarios(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    rows = db.query(Scenario).filter(Scenario.project_id == project_id).all()
    if not rows:
        for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
            db.add(Scenario(project_id=project_id, code=code, name_ru=name, params={}, results={}))
        db.commit()
        rows = db.query(Scenario).filter(Scenario.project_id == project_id).all()
    return [ScenarioOut.model_validate(r) for r in rows]


@router.patch("/{project_id}/{code}", response_model=ScenarioOut, summary="Обновить сценарий")
def update_scenario(
    project_id: int,
    code: str,
    data: ScenarioUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if user.role != "admin" and project.owner_id != user.id:
        raise HTTPException(403, detail="Нет доступа")
    sc = db.query(Scenario).filter(Scenario.project_id == project_id, Scenario.code == code).first()
    if not sc:
        raise HTTPException(404, detail="Сценарий не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(sc, k, v)
    db.commit()
    db.refresh(sc)
    log_action(db, "scenario.update", user.id, "scenario", sc.id)
    return ScenarioOut.model_validate(sc)
