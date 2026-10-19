import copy
import secrets
from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
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
    ProjectSummary,
    ProjectUpdate,
)
from app.services.audit import log_action
from app.services.dxf_import import entities_to_layout, parse_dxf
from app.services.import_catalog import (
    import_project_params,
    preview_import,
    read_tabular,
    suggest_param_column_mapping,
    validate_project_params_import,
)
from app.services.layout import default_warehouse_objects, empty_layout, sanitize_layout
from app.services.layout_nav import clear_route_cache
from app.services.param_templates import build_params_template_xlsx, template_filename
from app.services.uploads import read_and_validate_upload

router = APIRouter(prefix="/projects", tags=["Проекты"])


class LayoutUpdate(BaseModel):
    layout: dict


class DxfConfirmBody(BaseModel):
    preview: dict
    unit_to_m: Optional[float] = None
    selected_ids: Optional[list[str]] = None
    entity_kinds: Optional[dict[str, str]] = None


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
        # Общие демо нельзя менять — только свои проекты (в т.ч. гостевые)
        if project.is_demo:
            raise HTTPException(
                403,
                detail="Демонстрационный проект только для просмотра. Создайте копию, чтобы редактировать.",
            )
        if project.owner_id != user.id:
            raise HTTPException(403, detail="Нет доступа к проекту")
        return
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа к проекту")


def _project_summary(db: Session, project: Project) -> ProjectSummary:
    params = project.object_params or {}
    w = params.get("area_width_m") or params.get("width_m")
    l = params.get("area_length_m") or params.get("length_m")
    if project.layout:
        w = project.layout.get("width_m") or w
        l = project.layout.get("length_m") or l
    area = None
    try:
        if w is not None and l is not None:
            area = round(float(w) * float(l), 1)
    except (TypeError, ValueError):
        area = None
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project.id)
        .order_by(Calculation.version.desc())
        .first()
    )
    robots = None
    capex = None
    payback = None
    npv = None
    unit_price = None
    if calc and isinstance(calc.results, dict):
        robots = calc.results.get("robots_count")
        c = calc.results.get("capex")
        if isinstance(c, dict):
            capex = c.get("capex")
        p = calc.results.get("payback")
        if isinstance(p, dict):
            payback = p.get("payback_years")
        n = calc.results.get("npv")
        if isinstance(n, dict):
            npv = n.get("npv")
    if calc and isinstance(calc.inputs, dict):
        try:
            up = float(calc.inputs.get("unit_price"))
            if up > 0:
                unit_price = up
        except (TypeError, ValueError):
            unit_price = None
    return ProjectSummary(
        area_m2=area,
        robots_count=int(robots) if robots is not None else None,
        capex=float(capex) if capex is not None else None,
        payback_years=float(payback) if payback is not None else None,
        npv=float(npv) if npv is not None else None,
        unit_price=float(unit_price) if unit_price is not None else None,
    )


def _to_out(db: Session, project: Project) -> ProjectOut:
    data = ProjectOut.model_validate(project)
    data.summary = _project_summary(db, project)
    return data


def _seed_layout(project: Project) -> None:
    params = project.object_params or {}
    w = float(params.get("area_width_m") or params.get("width_m") or 60)
    l = float(params.get("area_length_m") or params.get("length_m") or 40)
    layout = empty_layout(w, l)
    layout["objects"] = default_warehouse_objects(w, l, int(params.get("zones_count") or 3))
    layout["source"] = "default_example"
    project.layout = layout


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
        # Свои гостевые + демо для просмотра
        q = q.filter((Project.owner_id == user.id) | (Project.is_demo.is_(True)))
    else:
        q = q.filter((Project.owner_id == user.id) | (Project.is_demo.is_(True)))
    if not include_archived:
        q = q.filter(Project.is_archived.is_(False))
    rows = q.order_by(Project.updated_at.desc()).all()
    return [_to_out(db, p) for p in rows]


@router.post("", response_model=ProjectOut, summary="Создать проект")
def create_project(
    data: ProjectCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    ttl = get_settings().GUEST_TTL_DAYS
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
        expires_at=(utcnow() + timedelta(days=ttl)) if user.role == "guest" else None,
    )
    _seed_layout(project)
    db.add(project)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=project.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(project)
    log_action(db, "project.create", user.id, "project", project.id)
    return _to_out(db, project)


@router.get("/{project_id}", response_model=ProjectOut, summary="Получить проект")
def get_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = _get_project(db, project_id)
    _ensure_access(user, project)
    return _to_out(db, project)


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
    return _to_out(db, project)


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
        expires_at=(utcnow() + timedelta(days=ttl)) if user.role == "guest" else None,
    )
    if not clone.layout:
        _seed_layout(clone)
    db.add(clone)
    db.flush()
    for code, name in [("baseline", "Без роботизации"), ("purchase", "Покупка оборудования"), ("raas", "Роботы как услуга")]:
        db.add(Scenario(project_id=clone.id, code=code, name_ru=name, params={}, results={}))
    db.commit()
    db.refresh(clone)
    log_action(db, "project.copy", user.id, "project", clone.id, {"from": project_id})
    return _to_out(db, clone)


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
    return _to_out(db, project)


@router.get("/{project_id}/layout", summary="Геометрия склада проекта")
def get_layout(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = _get_project(db, project_id)
    _ensure_access(user, project)
    params = project.object_params or {}
    if not project.layout:
        return empty_layout(
            float(params.get("area_width_m") or 60),
            float(params.get("area_length_m") or 40),
        )
    return sanitize_layout(project.layout)


@router.put("/{project_id}/layout", response_model=ProjectOut, summary="Сохранить геометрию склада")
def put_layout(
    project_id: int,
    data: LayoutUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    layout = sanitize_layout(data.layout)
    project.layout = layout
    params = dict(project.object_params or {})
    params["area_width_m"] = layout["width_m"]
    params["area_length_m"] = layout["length_m"]
    project.object_params = params
    project.updated_at = utcnow()
    clear_route_cache()
    db.commit()
    db.refresh(project)
    log_action(db, "project.layout_update", user.id, "project", project.id)
    return _to_out(db, project)


@router.post("/{project_id}/layout/dxf/preview", summary="Превью импорта DXF")
async def dxf_preview(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    content = await file.read()
    return parse_dxf(content, file.filename, get_settings().DXF_MAX_UPLOAD_BYTES)


@router.post("/{project_id}/layout/dxf/confirm", response_model=ProjectOut, summary="Применить импорт DXF")
def dxf_confirm(
    project_id: int,
    body: DxfConfirmBody,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    preview = dict(body.preview)
    if body.entity_kinds:
        for ent in preview.get("entities") or []:
            kid = body.entity_kinds.get(ent.get("id"))
            if kid:
                ent["kind"] = kid
    layout = entities_to_layout(
        preview,
        unit_to_m=body.unit_to_m,
        selected_ids=body.selected_ids,
    )
    project.layout = sanitize_layout(layout)
    params = dict(project.object_params or {})
    params["area_width_m"] = layout["width_m"]
    params["area_length_m"] = layout["length_m"]
    project.object_params = params
    project.updated_at = utcnow()
    clear_route_cache()
    db.commit()
    db.refresh(project)
    log_action(db, "project.dxf_import", user.id, "project", project.id)
    return _to_out(db, project)


@router.post("/{project_id}/publish", response_model=ProjectOut, summary="Опубликовать презентацию")
def publish_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    # Новый непредсказуемый токен при каждой публикации после отзыва;
    # при повторной публикации того же активного токена сохраняем его.
    if not project.public_token or not project.published_at:
        project.public_token = secrets.token_urlsafe(32)
    project.published_at = utcnow()
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    log_action(db, "project.publish", user.id, "project", project.id)
    return _to_out(db, project)


@router.delete("/{project_id}/publish", response_model=ProjectOut, summary="Снять публикацию")
def unpublish_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = _get_project(db, project_id)
    _ensure_access(user, project, write=True)
    project.public_token = None
    project.published_at = None
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    log_action(db, "project.unpublish", user.id, "project", project.id)
    return _to_out(db, project)


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
    # Площадка в параметрах → размеры сохранённого плана (объекты не пересоздаём)
    params = data.object_params or {}
    w = params.get("area_width_m") or params.get("width_m")
    l = params.get("area_length_m") or params.get("length_m")
    if project.layout and (w is not None or l is not None):
        layout = dict(project.layout)
        if w is not None:
            layout["width_m"] = max(5.0, float(w))
        if l is not None:
            layout["length_m"] = max(5.0, float(l))
        project.layout = sanitize_layout(layout)
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


@router.get("/{project_id}/inputs-readiness", summary="Готовность входов по возможностям")
def inputs_readiness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Аддитивный контракт: готовность экономики / подбора / плана / DES / отчёта."""
    from app.models.misc import Calculation
    from app.models.project import ProjectSolution
    from app.models.robot import Robot
    from app.services.required_inputs import assess_capabilities

    project = _get_project(db, project_id)
    _ensure_access(user, project)
    params = project.object_params or {}
    robot = None
    pref = params.get("economics_robot_id")
    if pref not in (None, "", 0, "0"):
        try:
            robot = db.query(Robot).filter(Robot.id == int(pref)).first()
        except (TypeError, ValueError):
            robot = None
    if not robot:
        selected = (
            db.query(ProjectSolution)
            .filter(ProjectSolution.project_id == project_id, ProjectSolution.selected.is_(True))
            .order_by(ProjectSolution.match_score.desc())
            .first()
        )
        if selected:
            robot = db.query(Robot).filter(Robot.id == selected.robot_id).first()
    last = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    layout = project.layout or {}
    has_layout = bool(layout.get("objects"))
    layout_source = layout.get("source") if isinstance(layout, dict) else None
    return assess_capabilities(
        params,
        robot_price=float(robot.price_rub) if robot and robot.price_rub else None,
        has_selected_robot=bool(robot),
        has_layout_objects=has_layout,
        has_economics_result=bool(last and last.results),
        layout_source=str(layout_source) if layout_source else None,
    )


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
    fname = file.filename or "params.csv"
    preview = preview_import(content, fname)
    # Для параметров объекта — сопоставление колонок под object_params, не каталог роботов
    param_suggested = suggest_param_column_mapping(preview.get("columns") or [])
    parsed = import_project_params(content, fname)
    return {
        **preview,
        "suggested_mapping": param_suggested,
        "parsed_params": parsed.get("object_params"),
        "mode": parsed.get("mode"),
        "warnings": parsed.get("warnings") or [],
        "errors": parsed.get("errors") or [],
        "filename": fname,
        "file_size_bytes": len(content),
        "unrecognized_labels": parsed.get("unrecognized_labels") or [],
        "ignored_columns": parsed.get("ignored_columns") or [],
    }


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
    try:
        mapping = json.loads(mapping_json or "{}")
    except json.JSONDecodeError:
        mapping = {}
    if isinstance(mapping, dict) and "mapping" in mapping:
        mapping = mapping["mapping"]
    validation = validate_project_params_import(
        content,
        file.filename or "params.csv",
        mapping or None,
        existing_params=project.object_params or {},
    )
    return validation


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
    validation = validate_project_params_import(
        content,
        file.filename or "params.csv",
        mapping or None,
        existing_params=project.object_params or {},
    )
    if not validation.get("valid"):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail={
                "message": "Импорт отклонён: исправьте ошибки валидации",
                "errors": validation.get("errors") or [],
                "warnings": validation.get("warnings") or [],
            },
        )
    parsed = import_project_params(content, file.filename or "params.csv", mapping or None)
    params = parsed.get("object_params") or {}
    previous = dict(project.object_params or {})
    overwritten = [
        k
        for k, v in params.items()
        if not str(k).startswith("_") and k in previous and previous.get(k) not in (None, "") and previous.get(k) != v
    ]
    merged = {**previous, **params}
    project.object_params = merged
    project.updated_at = utcnow()
    db.commit()
    db.refresh(project)
    log_action(db, "project.params_import", user.id, "project", project.id, {"keys": list(params.keys())})
    updated_keys = [k for k in params.keys() if not str(k).startswith("_")]
    return {
        "message": "Параметры импортированы",
        "object_params": project.object_params,
        "updated_keys": updated_keys,
        "overwritten_keys": overwritten,
        "warnings": parsed.get("warnings") or validation.get("warnings") or [],
    }
