from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.catalog_meta import ObjectType, SolutionType
from app.models.import_batch import ImportBatch
from app.models.manufacturer import Manufacturer
from app.models.misc import AuditLog, DataSource, Normative
from app.models.project import Project
from app.models.robot import Robot
from app.models.user import User
from app.schemas import (
    AuditLogOut,
    DataSourceCreate,
    DataSourceOut,
    DataSourceUpdate,
    ImportBatchOut,
    ManufacturerCreate,
    ManufacturerOut,
    ManufacturerUpdate,
    MessageOut,
    NormativeOut,
    NormativeUpdate,
    ObjectTypeCreate,
    ObjectTypeOut,
    ObjectTypeUpdate,
    RobotCreate,
    RobotOut,
    RobotUpdate,
    SolutionTypeCreate,
    SolutionTypeOut,
    SolutionTypeUpdate,
    UserAdminUpdate,
    UserOut,
)
from app.services.audit import log_action
from app.services.economics import DEFAULT_ASSUMPTIONS, FORMULAS_RU
from app.services.import_catalog import apply_import, preview_import, validate_mapped_rows, read_tabular
from app.services.import_docx_examples import import_docx_examples
from app.services.import_source_catalog import import_source_catalog
from app.services.import_source_datasets import import_source_datasets
from app.services.uploads import read_and_validate_upload

router = APIRouter(prefix="/admin", tags=["Администрирование"])


@router.get("/users", response_model=list[UserOut], summary="Пользователи")
def list_users(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    return [UserOut.model_validate(u) for u in db.query(User).order_by(User.id).all()]


@router.patch("/users/{user_id}", response_model=UserOut, summary="Изменить пользователя")
def update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, detail="Пользователь не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    log_action(db, "admin.user_update", admin.id, "user", user_id, data.model_dump(exclude_unset=True))
    return UserOut.model_validate(u)


@router.get("/robots", response_model=list[RobotOut], summary="Все роботы (админ)")
def admin_robots(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    include_archived: bool = True,
):
    q = db.query(Robot)
    if not include_archived:
        q = q.filter(Robot.archived.is_(False))
    return [RobotOut.model_validate(r) for r in q.order_by(Robot.id).all()]


@router.post("/robots", response_model=RobotOut, summary="Создать робота")
def create_robot(
    data: RobotCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    robot = Robot(**data.model_dump())
    db.add(robot)
    db.commit()
    db.refresh(robot)
    log_action(db, "admin.robot_create", admin.id, "robot", robot.id)
    return RobotOut.model_validate(robot)


@router.patch("/robots/{robot_id}", response_model=RobotOut, summary="Обновить робота")
def update_robot(
    robot_id: int,
    data: RobotUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(404, detail="Робот не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(robot, k, v)
    db.commit()
    db.refresh(robot)
    log_action(db, "admin.robot_update", admin.id, "robot", robot_id)
    return RobotOut.model_validate(robot)


@router.delete("/robots/{robot_id}", response_model=MessageOut, summary="Архивировать робота")
def delete_robot(
    robot_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(404, detail="Робот не найден")
    robot.archived = True
    db.commit()
    log_action(db, "admin.robot_archive", admin.id, "robot", robot_id)
    return MessageOut(message="Робот архивирован")


@router.get("/manufacturers", response_model=list[ManufacturerOut], summary="Производители")
def list_manufacturers(db: Annotated[Session, Depends(get_db)], admin: Annotated[User, Depends(require_admin)]):
    return [ManufacturerOut.model_validate(m) for m in db.query(Manufacturer).all()]


@router.post("/manufacturers", response_model=ManufacturerOut, summary="Создать производителя")
def create_manufacturer(
    data: ManufacturerCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    m = Manufacturer(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    log_action(db, "admin.manufacturer_create", admin.id, "manufacturer", m.id)
    return ManufacturerOut.model_validate(m)


@router.patch("/manufacturers/{item_id}", response_model=ManufacturerOut, summary="Обновить производителя")
def update_manufacturer(
    item_id: int,
    data: ManufacturerUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    m = db.query(Manufacturer).filter(Manufacturer.id == item_id).first()
    if not m:
        raise HTTPException(404, detail="Производитель не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    log_action(db, "admin.manufacturer_update", admin.id, "manufacturer", item_id)
    return ManufacturerOut.model_validate(m)


@router.delete("/manufacturers/{item_id}", response_model=MessageOut, summary="Удалить производителя")
def delete_manufacturer(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    m = db.query(Manufacturer).filter(Manufacturer.id == item_id).first()
    if not m:
        raise HTTPException(404, detail="Производитель не найден")
    linked = db.query(Robot).filter(Robot.manufacturer_id == item_id).count()
    if linked:
        raise HTTPException(
            400,
            detail=f"Нельзя удалить: используется в {linked} решениях каталога. Снимите привязку или архивируйте.",
        )
    db.delete(m)
    db.commit()
    log_action(db, "admin.manufacturer_delete", admin.id, "manufacturer", item_id)
    return MessageOut(message="Производитель удалён")


@router.get("/object-types", response_model=list[ObjectTypeOut], summary="Типы объектов")
def list_object_types(db: Annotated[Session, Depends(get_db)], admin: Annotated[User, Depends(require_admin)]):
    return [ObjectTypeOut.model_validate(o) for o in db.query(ObjectType).all()]


@router.post("/object-types", response_model=ObjectTypeOut, summary="Создать тип объекта")
def create_object_type(
    data: ObjectTypeCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    o = ObjectType(**data.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    log_action(db, "admin.object_type_create", admin.id, "object_type", o.id)
    return ObjectTypeOut.model_validate(o)


@router.patch("/object-types/{item_id}", response_model=ObjectTypeOut, summary="Обновить тип объекта")
def update_object_type(
    item_id: int,
    data: ObjectTypeUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    o = db.query(ObjectType).filter(ObjectType.id == item_id).first()
    if not o:
        raise HTTPException(404, detail="Тип объекта не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    log_action(db, "admin.object_type_update", admin.id, "object_type", item_id)
    return ObjectTypeOut.model_validate(o)


@router.delete("/object-types/{item_id}", response_model=MessageOut, summary="Удалить тип объекта")
def delete_object_type(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    o = db.query(ObjectType).filter(ObjectType.id == item_id).first()
    if not o:
        raise HTTPException(404, detail="Тип объекта не найден")
    db.delete(o)
    db.commit()
    log_action(db, "admin.object_type_delete", admin.id, "object_type", item_id)
    return MessageOut(message="Тип объекта удалён")


@router.get("/solution-types", response_model=list[SolutionTypeOut], summary="Типы решений")
def list_solution_types(db: Annotated[Session, Depends(get_db)], admin: Annotated[User, Depends(require_admin)]):
    return [SolutionTypeOut.model_validate(s) for s in db.query(SolutionType).all()]


@router.post("/solution-types", response_model=SolutionTypeOut, summary="Создать тип решения")
def create_solution_type(
    data: SolutionTypeCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = SolutionType(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    log_action(db, "admin.solution_type_create", admin.id, "solution_type", s.id)
    return SolutionTypeOut.model_validate(s)


@router.patch("/solution-types/{item_id}", response_model=SolutionTypeOut, summary="Обновить тип решения")
def update_solution_type(
    item_id: int,
    data: SolutionTypeUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = db.query(SolutionType).filter(SolutionType.id == item_id).first()
    if not s:
        raise HTTPException(404, detail="Тип решения не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    log_action(db, "admin.solution_type_update", admin.id, "solution_type", item_id)
    return SolutionTypeOut.model_validate(s)


@router.delete("/solution-types/{item_id}", response_model=MessageOut, summary="Удалить тип решения")
def delete_solution_type(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = db.query(SolutionType).filter(SolutionType.id == item_id).first()
    if not s:
        raise HTTPException(404, detail="Тип решения не найден")
    linked = db.query(Robot).filter(Robot.solution_type_id == item_id).count()
    if linked:
        raise HTTPException(
            400,
            detail=f"Нельзя удалить: используется в {linked} решениях каталога.",
        )
    db.delete(s)
    db.commit()
    log_action(db, "admin.solution_type_delete", admin.id, "solution_type", item_id)
    return MessageOut(message="Тип решения удалён")


@router.get("/sources", response_model=list[DataSourceOut], summary="Источники данных")
def list_sources(db: Annotated[Session, Depends(get_db)], admin: Annotated[User, Depends(require_admin)]):
    return [DataSourceOut.model_validate(s) for s in db.query(DataSource).all()]


@router.post("/sources", response_model=DataSourceOut, summary="Добавить источник")
def create_source(
    data: DataSourceCreate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = DataSource(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    log_action(db, "admin.source_create", admin.id, "source", s.id)
    return DataSourceOut.model_validate(s)


@router.patch("/sources/{item_id}", response_model=DataSourceOut, summary="Обновить источник")
def update_source(
    item_id: int,
    data: DataSourceUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = db.query(DataSource).filter(DataSource.id == item_id).first()
    if not s:
        raise HTTPException(404, detail="Источник не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    log_action(db, "admin.source_update", admin.id, "source", item_id)
    return DataSourceOut.model_validate(s)


@router.delete("/sources/{item_id}", response_model=MessageOut, summary="Удалить источник")
def delete_source(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    s = db.query(DataSource).filter(DataSource.id == item_id).first()
    if not s:
        raise HTTPException(404, detail="Источник не найден")
    db.delete(s)
    db.commit()
    log_action(db, "admin.source_delete", admin.id, "source", item_id)
    return MessageOut(message="Источник удалён")


@router.get("/normatives", response_model=list[NormativeOut], summary="Нормативы")
def list_normatives(db: Annotated[Session, Depends(get_db)], admin: Annotated[User, Depends(require_admin)]):
    return [NormativeOut.model_validate(n) for n in db.query(Normative).all()]


@router.patch("/normatives/{norm_id}", response_model=NormativeOut, summary="Обновить норматив")
def update_normative(
    norm_id: int,
    data: NormativeUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    n = db.query(Normative).filter(Normative.id == norm_id).first()
    if not n:
        raise HTTPException(404, detail="Норматив не найден")
    if not n.editable:
        raise HTTPException(400, detail="Норматив нельзя редактировать")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(n, k, v)
    db.commit()
    db.refresh(n)
    log_action(db, "admin.normative_update", admin.id, "normative", norm_id)
    return NormativeOut.model_validate(n)


@router.get("/assumptions", summary="Допущения модели")
def assumptions(admin: Annotated[User, Depends(require_admin)]):
    return {"defaults": DEFAULT_ASSUMPTIONS, "formulas": FORMULAS_RU}


@router.post("/import/catalog/preview", summary="Превью импорта каталога")
async def import_preview(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    content = await read_and_validate_upload(file)
    return preview_import(content, file.filename or "catalog.csv")


@router.post("/import/catalog/validate", summary="Валидация импорта каталога")
async def import_validate(
    mapping_json: str = Query(..., description="JSON-маппинг колонок"),
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    import json

    mapping = json.loads(mapping_json)
    content = await read_and_validate_upload(file)
    df = read_tabular(content, file.filename or "catalog.csv")
    return validate_mapped_rows(df, mapping)


@router.post("/import/catalog/confirm", summary="Подтвердить импорт каталога")
async def import_confirm(
    mapping_json: str = Query(..., description="JSON-маппинг колонок"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    import json

    mapping = json.loads(mapping_json)
    content = await read_and_validate_upload(file)
    result = apply_import(db, content, file.filename or "catalog.csv", mapping)
    log_action(db, "admin.catalog_import", admin.id, "robot", None, result)
    return result


@router.post("/import/source-catalog", summary="Импорт каталога из материалов проекта")
async def import_source_catalog_endpoint(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    path: Optional[str] = Query(None, description="Путь к CSV на сервере"),
    file: Optional[UploadFile] = File(None),
):
    """Импорт catalog_export_v4.csv: путь на сервере или загрузка файла."""
    if file is not None and file.filename:
        content = await read_and_validate_upload(file)
        report = import_source_catalog(
            db, content=content, filename=file.filename, write_normalized=True
        )
    else:
        report = import_source_catalog(db, path=path, write_normalized=True)
    payload = report.to_dict()
    log_action(db, "admin.source_catalog_import", admin.id, "robot", None, payload)
    if report.status == "failed":
        raise HTTPException(400, detail=payload)
    return payload


@router.post("/import/source-datasets", summary="Импорт датасетов объектов из материалов проекта")
async def import_source_datasets_endpoint(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    path: Optional[str] = Query(None, description="Путь к XLSX на сервере"),
    file: Optional[UploadFile] = File(None),
):
    if file is not None and file.filename:
        content = await read_and_validate_upload(file)
        report = import_source_datasets(
            db, content=content, filename=file.filename, update_demo_projects=True
        )
    else:
        report = import_source_datasets(db, path=path, update_demo_projects=True)
    payload = report.to_dict()
    log_action(db, "admin.source_datasets_import", admin.id, "object_type", None, payload)
    if report.status == "failed":
        raise HTTPException(400, detail=payload)
    return payload


@router.post("/import/docx-examples", summary="Обогащение каталога из Примеры_решений DOCX")
def import_docx_examples_endpoint(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    path: Optional[str] = Query(None, description="Путь к DOCX на сервере"),
):
    """Читает DOCX (data/sources или /data/sources), обогащает matched robots."""
    report = import_docx_examples(db, path=path, write_reports=True, commit=True)
    payload = report.to_dict()
    log_action(db, "admin.docx_examples_import", admin.id, "robot", None, payload)
    if report.errors and report.robots_updated == 0:
        raise HTTPException(400, detail=payload)
    return payload


@router.get("/import/batches", response_model=list[ImportBatchOut], summary="Партии импорта")
def list_import_batches(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=200),
):
    rows = db.query(ImportBatch).order_by(ImportBatch.id.desc()).limit(limit).all()
    return [ImportBatchOut.model_validate(r) for r in rows]


@router.get("/audit", response_model=list[AuditLogOut], summary="Журнал аудита")
def audit_log(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    limit: int = Query(100, ge=1, le=500),
):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    if not rows:
        return []

    user_ids = {r.user_id for r in rows if r.user_id}
    users = {
        u.id: u
        for u in (db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else [])
    }

    project_ids = {r.entity_id for r in rows if r.entity_type == "project" and r.entity_id}
    projects = {
        p.id: p
        for p in (db.query(Project).filter(Project.id.in_(project_ids)).all() if project_ids else [])
    }
    robot_ids = {r.entity_id for r in rows if r.entity_type == "robot" and r.entity_id}
    robots = {
        rb.id: rb
        for rb in (db.query(Robot).filter(Robot.id.in_(robot_ids)).all() if robot_ids else [])
    }
    user_entity_ids = {r.entity_id for r in rows if r.entity_type == "user" and r.entity_id}
    user_entities = {
        u.id: u
        for u in (
            db.query(User).filter(User.id.in_(user_entity_ids)).all() if user_entity_ids else []
        )
    }

    out: list[AuditLogOut] = []
    for r in rows:
        item = AuditLogOut.model_validate(r)
        u = users.get(r.user_id) if r.user_id else None
        if u:
            item.user_email = u.email
            item.user_name = u.full_name or None
        if r.entity_type == "project" and r.entity_id in projects:
            item.entity_name = projects[r.entity_id].name
        elif r.entity_type == "robot" and r.entity_id in robots:
            item.entity_name = robots[r.entity_id].name
        elif r.entity_type == "user" and r.entity_id in user_entities:
            ue = user_entities[r.entity_id]
            item.entity_name = ue.full_name or ue.email
        out.append(item)
    return out
