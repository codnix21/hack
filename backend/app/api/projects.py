import copy
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user, get_current_user_optional
from app.models.catalog_meta import ObjectType
from app.models.misc import Calculation
from app.models.project import Project, ProjectSolution, Scenario
from app.models.user import User, utcnow
from app.schemas import (
    MessageOut,
    ProjectCreate,
    ProjectOut,
    ProjectParamsUpdate,
    ProjectUpdate,
)
from app.services.audit import log_action
from app.services.import_catalog import import_project_params, preview_import, validate_mapped_rows, read_tabular
from app.services.param_templates import build_params_template_xlsx, template_filename
from app.services.uploads import read_and_validate_upload

router = APIRouter(prefix="/projects", tags=["Проекты"])


def _get_project(db: Session, project_id: int) -> Project:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, detail="Проект не найден")
    return p


def _ensure_access(user: Optional[User], project: Project, write: bool = False):
    if write:
        if user is None:
            raise HTTPException(401, detail="Требуется аутентификация")
        if user.role == "admin":
            return
        if project.is_demo and user.role == "guest":
            raise HTTPException(403, detail="Гость не может изменять демо-проекты — клонируйте проект")
        if project.owner_id != user.id and not (project.is_demo and not write):
            if project.owner_id != user.id:
                raise HTTPException(403, detail="Нет доступа к проекту")
        return
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа к проекту")


@router.get("", response_model=list[ProjectOut], summary="Список проектов")
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    include_archived: bool = False,
):
    q = db.query(Project)
    if user.role == "admin":
        pass
    elif user.role == "guest":
        q = q.filter(Project.is_demo.is_(True))
    else:
        q = q.filter((Project.owner_id == user.id) | (Project.is_demo.is_(True)))
    if not include_archived:
        q = q.filter(Project.is_archived.is_(False))
    return [ProjectOut.model_validate(p) for p in q.order_by(Project.updated_at.desc()).all()]


@router.post("", response_model=ProjectOut, summary="Создать проект")
def create_project(
    data: ProjectCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == "guest":
        raise HTTPException(403, detail="Гость не может создавать проекты — зарегистрируйтесь")
    project = Project(
        owner_id=user.id,
        name=data.name,
        industry_id=data.industry_id,
        object_type_id=data.object_type_id,
        description=data.description,
        region=data.region,
        work_mode=data.work_mode,
        object_params=data.object_params or {},
        status="draft",
    )
    db.add(project)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=project.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(project)
    log_action(db, "project.create", user.id, "project", project.id)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut, summary="Получить проект")
def get_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = _get_project(db, project_id)
    _ensure_access(user, project)
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectOut, summary="Обновить проект")
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    log_action(db, "project.update", user.id, "project", project.id)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", response_model=MessageOut, summary="Удалить проект")
def delete_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    if project.is_demo and user.role != "admin":
        raise HTTPException(403, detail="Нельзя удалить демо-проект")
    db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id).delete()
    db.query(Scenario).filter(Scenario.project_id == project_id).delete()
    db.query(Calculation).filter(Calculation.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    log_action(db, "project.delete", user.id, "project", project_id)
    return MessageOut(message="Проект удалён")


@router.post("/{project_id}/copy", response_model=ProjectOut, summary="Копировать проект")
def copy_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    src = _get_project(db, project_id)
    _ensure_access(user, src)
    if user.role == "guest":
        raise HTTPException(403, detail="Гость не может копировать проекты")
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
        is_demo=False,
    )
    db.add(clone)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=clone.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(clone)
    log_action(db, "project.copy", user.id, "project", clone.id, {"from": project_id})
    return ProjectOut.model_validate(clone)


@router.post("/{project_id}/archive", response_model=ProjectOut, summary="Архивировать проект")
def archive_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    project.is_archived = True
    project.status = "archived"
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}/export", summary="Экспорт проекта (excel|pdf)")
def export_project(
    project_id: int,
    format: str = "excel",
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Совместимый эндпоинт — делегирует в /export/{id}/pdf|excel."""
    from app.api.export import export_excel, export_pdf

    if format == "pdf":
        return export_pdf(project_id, db, user)
    return export_excel(project_id, db, user)


# --- params ---
@router.get("/{project_id}/params", summary="Параметры объекта")
def get_params(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = _get_project(db, project_id)
    _ensure_access(user, project)
    schema = None
    if project.object_type_id:
        ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
        schema = ot.parameter_schema if ot else None
    return {"object_params": project.object_params or {}, "parameter_schema": schema}


@router.put("/{project_id}/params", response_model=ProjectOut, summary="Обновить параметры")
def update_params(
    project_id: int,
    data: ProjectParamsUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    project.object_params = data.object_params
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}/params/import/template", summary="Скачать шаблон импорта параметров")
def params_import_template(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    """Excel-шаблон с примерами значений под тип объекта проекта."""
    project = _get_project(db, project_id)
    _ensure_access(user, project)
    code = None
    schema = None
    if project.object_type_id:
        ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
        if ot:
            code = ot.code
            schema = ot.parameter_schema
    content = build_params_template_xlsx(code, schema)
    filename = template_filename(code)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{project_id}/params/import/preview", summary="Превью импорта параметров")
async def params_import_preview(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    content = await read_and_validate_upload(file)
    preview = preview_import(content, file.filename or "params.csv")
    parsed = import_project_params(content, file.filename or "params.csv")
    return {**preview, "parsed_params": parsed.get("object_params"), "mode": parsed.get("mode")}


@router.post("/{project_id}/params/import/validate", summary="Валидация маппинга параметров")
async def params_import_validate(
    project_id: int,
    file: UploadFile = File(...),
    mapping_json: str = "{}",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import json

    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    content = await read_and_validate_upload(file)
    df = read_tabular(content, file.filename or "params.csv")
    try:
        mapping = json.loads(mapping_json or "{}")
    except json.JSONDecodeError:
        mapping = {}
    if isinstance(mapping, dict) and "mapping" in mapping:
        mapping = mapping["mapping"]
    validation = validate_mapped_rows(df, mapping or {})
    return {
        **validation,
        "mapping": mapping,
        "row_count": len(df),
    }


@router.post("/{project_id}/params/import/confirm", summary="Подтвердить импорт параметров")
async def params_import_confirm(
    project_id: int,
    file: UploadFile = File(...),
    mapping_json: str = "{}",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import json

    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    content = await read_and_validate_upload(file)
    try:
        mapping = json.loads(mapping_json or "{}")
    except json.JSONDecodeError:
        mapping = {}
    if isinstance(mapping, dict) and "mapping" in mapping:
        mapping = mapping["mapping"]
    parsed = import_project_params(content, file.filename or "params.csv", mapping or None)
    params = parsed.get("object_params") or {}
    merged = {**(project.object_params or {}), **params}
    project.object_params = merged
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    log_action(db, "project.params_import", user.id, "project", project.id, {"keys": list(params.keys())})
    return {"message": "Параметры импортированы", "object_params": project.object_params}
