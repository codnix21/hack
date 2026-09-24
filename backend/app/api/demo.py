import copy
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models.project import Project, Scenario
from app.models.user import User
from app.schemas import ProjectOut
from app.services.audit import log_action

router = APIRouter(prefix="/demo", tags=["Демо"])


@router.get("/projects", response_model=list[ProjectOut], summary="Список демо-проектов")
def list_demos(
    db: Annotated[Session, Depends(get_db)],
):
    rows = (
        db.query(Project)
        .filter(Project.is_demo.is_(True), Project.is_archived.is_(False))
        .order_by(Project.id)
        .all()
    )
    return [ProjectOut.model_validate(p) for p in rows]


@router.get("/projects/{project_id}", response_model=ProjectOut, summary="Открыть демо-проект")
def open_demo(project_id: int, db: Annotated[Session, Depends(get_db)]):
    p = db.query(Project).filter(Project.id == project_id, Project.is_demo.is_(True)).first()
    if not p:
        raise HTTPException(404, detail="Демо-проект не найден")
    return ProjectOut.model_validate(p)


@router.post("/projects/{project_id}/clone", response_model=ProjectOut, summary="Клонировать демо в свой проект")
def clone_demo(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == "guest":
        raise HTTPException(403, detail="Зарегистрируйтесь, чтобы клонировать демо-проект")
    src = db.query(Project).filter(Project.id == project_id, Project.is_demo.is_(True)).first()
    if not src:
        raise HTTPException(404, detail="Демо-проект не найден")
    clone = Project(
        owner_id=user.id,
        name=f"{src.name} (мой проект)",
        industry_id=src.industry_id,
        object_type_id=src.object_type_id,
        description=src.description,
        region=src.region,
        work_mode=src.work_mode,
        status="draft",
        object_params=copy.deepcopy(src.object_params or {}),
        is_demo=False,
    )
    db.add(clone)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=clone.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(clone)
    log_action(db, "demo.clone", user.id, "project", clone.id, {"from": project_id})
    return ProjectOut.model_validate(clone)
