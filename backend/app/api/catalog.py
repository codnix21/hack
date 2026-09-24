from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_optional
from app.models.catalog_meta import Industry, ObjectType, SolutionType
from app.models.manufacturer import Manufacturer
from app.models.robot import Robot
from app.models.user import User
from app.schemas import IndustryOut, ObjectTypeOut, PaginatedRobots, RobotOut

router = APIRouter(prefix="/catalog", tags=["Каталог"])


def _distinct_nonempty(db: Session, column) -> list[str]:
    rows = (
        db.query(column)
        .filter(column.isnot(None), column != "")
        .distinct()
        .order_by(column.asc())
        .all()
    )
    return [r[0] for r in rows if r[0]]


@router.get("", response_model=PaginatedRobots, summary="Список решений")
def list_robots(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    solution_type_id: Optional[int] = None,
    manufacturer_id: Optional[int] = None,
    country: Optional[str] = None,
    min_payload: Optional[float] = None,
    max_payload: Optional[float] = None,
    confirmation_level: Optional[str] = None,
    data_origin: Optional[str] = None,
    catalog_type_raw: Optional[str] = None,
    subtype_raw: Optional[str] = None,
    region_raw: Optional[str] = None,
    industry_raw: Optional[str] = None,
    scenario_raw: Optional[str] = None,
    availability_status: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("name", pattern="^(name|price_rub|payload_kg|updated_at|productivity_ops_per_hour)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    include_archived: bool = False,
):
    q = db.query(Robot)
    if not include_archived or (user and user.role != "admin"):
        q = q.filter(Robot.archived.is_(False))
    if search:
        like = f"%{search}%"
        q = q.filter(Robot.name.ilike(like) | Robot.purpose.ilike(like))
    if solution_type_id:
        q = q.filter(Robot.solution_type_id == solution_type_id)
    if manufacturer_id:
        q = q.filter(Robot.manufacturer_id == manufacturer_id)
    if country:
        q = q.filter(Robot.country.ilike(f"%{country}%"))
    if min_payload is not None:
        q = q.filter(Robot.payload_kg >= min_payload)
    if max_payload is not None:
        q = q.filter(Robot.payload_kg <= max_payload)
    if confirmation_level:
        q = q.filter(Robot.confirmation_level == confirmation_level)
    if data_origin:
        q = q.filter(Robot.data_origin == data_origin)
    if catalog_type_raw:
        q = q.filter(Robot.catalog_type_raw.ilike(f"%{catalog_type_raw}%"))
    if subtype_raw:
        q = q.filter(Robot.subtype_raw.ilike(f"%{subtype_raw}%"))
    if region_raw:
        q = q.filter(Robot.region_raw.ilike(f"%{region_raw}%"))
    if industry_raw:
        q = q.filter(Robot.industry_raw.ilike(f"%{industry_raw}%"))
    if scenario_raw:
        q = q.filter(Robot.scenario_raw.ilike(f"%{scenario_raw}%"))
    if availability_status:
        q = q.filter(Robot.availability_status == availability_status)
    if min_price is not None:
        q = q.filter(Robot.price_rub >= min_price)
    if max_price is not None:
        q = q.filter(Robot.price_rub <= max_price)

    col = getattr(Robot, sort_by)
    q = q.order_by(col.desc() if sort_dir == "desc" else col.asc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedRobots(
        items=[RobotOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", summary="Статистика каталога по происхождению")
def catalog_stats(db: Annotated[Session, Depends(get_db)]):
    base = db.query(Robot).filter(Robot.archived.is_(False))
    total = base.count()
    source_count = base.filter(Robot.data_origin == "source").count()
    demo_count = base.filter(Robot.data_origin == "demo").count()
    return {
        "total": total,
        "source_count": source_count,
        "demo_count": demo_count,
    }


@router.get("/meta/filters", summary="Справочники для фильтров")
def catalog_filters(db: Annotated[Session, Depends(get_db)]):
    return {
        "solution_types": [
            {"id": s.id, "code": s.code, "name_ru": s.name_ru}
            for s in db.query(SolutionType).all()
        ],
        "manufacturers": [
            {"id": m.id, "name": m.name, "country": m.country}
            for m in db.query(Manufacturer).filter(Manufacturer.archived.is_(False)).all()
        ],
        "catalog_type_raw": _distinct_nonempty(db, Robot.catalog_type_raw),
        "subtype_raw": _distinct_nonempty(db, Robot.subtype_raw),
        "industry_raw": _distinct_nonempty(db, Robot.industry_raw),
        "region_raw": _distinct_nonempty(db, Robot.region_raw),
        "scenario_raw": _distinct_nonempty(db, Robot.scenario_raw),
        "availability_status": _distinct_nonempty(db, Robot.availability_status),
        "data_origin": _distinct_nonempty(db, Robot.data_origin),
    }


@router.get("/meta/object-types", response_model=list[ObjectTypeOut], summary="Типы объектов")
def catalog_object_types(db: Annotated[Session, Depends(get_db)]):
    return [ObjectTypeOut.model_validate(o) for o in db.query(ObjectType).order_by(ObjectType.id).all()]


@router.get("/meta/industries", response_model=list[IndustryOut], summary="Отрасли")
def catalog_industries(db: Annotated[Session, Depends(get_db)]):
    return [IndustryOut.model_validate(i) for i in db.query(Industry).order_by(Industry.id).all()]


@router.get("/compare", summary="Сравнение решений")
def compare_robots(
    ids: str = Query(..., description="ID через запятую"),
    db: Session = Depends(get_db),
):
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
    if len(id_list) < 2:
        raise HTTPException(400, detail="Укажите минимум 2 ID")
    robots = db.query(Robot).filter(Robot.id.in_(id_list)).all()
    fields = [
        "name",
        "payload_kg",
        "speed_mps",
        "productivity_ops_per_hour",
        "price_rub",
        "width_mm",
        "autonomy_hours",
        "navigation",
        "maintenance_cost_year_rub",
        "confirmation_level",
    ]
    comparison = []
    for f in fields:
        row = {"field": f, "values": {str(r.id): getattr(r, f) for r in robots}}
        comparison.append(row)
    return {
        "robots": [RobotOut.model_validate(r) for r in robots],
        "comparison": comparison,
    }


@router.get("/{robot_id}", response_model=RobotOut, summary="Карточка решения")
def get_robot(robot_id: int, db: Annotated[Session, Depends(get_db)]):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(404, detail="Решение не найдено")
    return RobotOut.model_validate(robot)
