"""Идемпотентное наполнение демо-проектов для комиссии / показа.

Создаёт витрину с разными отраслями и профилями окупаемости,
подбирает робота, пишет Calculation + Scenario.results и пример планировки.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Calculation, Industry, ObjectType, Project, Robot, Scenario, User
from app.models.project import ProjectSolution
from app.models.user import utcnow
from app.services.economics import DEFAULT_ASSUMPTIONS, calculate_scenario
from app.services.layout import default_warehouse_objects, empty_layout
from app.services.matching import run_matching

DATASET_NOTE = "Параметры из Датасеты_хакатон.xlsx"
SHOWCASE_NOTE = "Витрина NETCORE: расчёт и подбор предзаполнены."


def _params_warehouse(**extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "area_m2": 9600,
        "zones_count": 6,
        "work_mode": "3с",
        "shifts_count": 3,
        "staff_count": 45,
        "ops_count": 3200,
        "peak_demand": 400,
        "avg_demand": 220,
        "sku_count": 12000,
        "required_payload_kg": 200,
        "cargo_length_mm": 1200,
        "cargo_width_mm": 800,
        "cargo_height_mm": 1500,
        "aisle_width_mm": 1500,
        "route_length_m": 850,
        "floor_type": "бетон",
        "temperature_min_c": 5,
        "temperature_max_c": 30,
        "charging_stations": 4,
        "load_points": 8,
        "unload_points": 6,
        "layout_constraints": "Узкие проходы в зоне комплектации",
        "area_width_m": 80,
        "area_length_m": 120,
        "current_labor_cost_year": 18_000_000,
        "labor_reduction_share": 0.4,
        "unit_price": 5_150_000,
        "required_processes": ["transport", "picking"],
        "indoor": True,
        "required_navigation": "SLAM",
    }
    base.update(extra)
    return base


def _params_airport(**extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "passenger_flow": 45000,
        "cargo_flow": 320,
        "ops_count": 1800,
        "peak_demand": 250,
        "avg_demand": 140,
        "zones_count": 4,
        "route_length_m": 1200,
        "required_payload_kg": 500,
        "cargo_length_mm": 1600,
        "cargo_width_mm": 1200,
        "cargo_height_mm": 1400,
        "work_mode": "24/7",
        "shifts_count": 3,
        "staff_count": 60,
        "access_constraints": "Зона авиационной безопасности, пропуска",
        "security_requirements": "Контроль доступа, видеонаблюдение",
        "area_width_m": 100,
        "area_length_m": 200,
        "aisle_width_mm": 2500,
        "charging_stations": 3,
        "indoor": False,
        "temperature_min_c": -20,
        "temperature_max_c": 35,
        "current_labor_cost_year": 25_000_000,
        "labor_reduction_share": 0.35,
        "unit_price": 8_500_000,
        "required_processes": ["towing", "transport"],
        "zone_type": "перрон",
        "floor_type": "асфальт",
        "required_navigation": "SLAM",
    }
    base.update(extra)
    return base


def _params_medical(**extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "area_m2": 2400,
        "floors_count": 5,
        "ops_count": 600,
        "transport_count": 420,
        "meds_share": 35,
        "meals_share": 25,
        "linen_share": 20,
        "waste_share": 20,
        "route_length_m": 480,
        "elevators": 4,
        "sanitary_constraints": "Разделение чистых и грязных потоков",
        "work_mode": "2с",
        "staff_count": 28,
        "security_requirements": "Контроль доступа в proceduralные зоны",
        "area_width_m": 40,
        "area_length_m": 60,
        "aisle_width_mm": 1200,
        "required_payload_kg": 30,
        "peak_demand": 80,
        "charging_stations": 2,
        "humidity_max_pct": 70,
        "facility_type": "многопрофильный стационар",
        "current_labor_cost_year": 9_000_000,
        "labor_reduction_share": 0.4,
        "unit_price": 2_200_000,
        "required_processes": ["delivery", "cleaning"],
        "indoor": True,
        "temperature_min_c": 18,
        "temperature_max_c": 26,
        "floor_type": "плитка",
        "required_navigation": "SLAM",
    }
    base.update(extra)
    return base


# Витрина: отрасли + профили окупаемости (быстрая / средняя / долгая / без окупаемости в горизонте)
DEMO_SPECS: list[dict[str, Any]] = [
    {
        "name": "Автоматизация склада",
        "object_type": "warehouse",
        "industry": "logistics",
        "region": "Москва",
        "work_mode": "3с",
        "description": (
            "Базовый демо-склад: AMR и комплектация. Средняя окупаемость. "
            f"{DATASET_NOTE} {SHOWCASE_NOTE}"
        ),
        "preferred_robot": "MiR 250",
        "seed_layout": True,
        "params": _params_warehouse(
            peak_demand=220,
            current_labor_cost_year=24_000_000,
            labor_reduction_share=0.48,
            unit_price=1_200_000,
        ),
    },
    {
        "name": "Автоматизация аэропортового объекта",
        "object_type": "airport",
        "industry": "transport",
        "region": "Санкт-Петербург",
        "work_mode": "24/7",
        "description": (
            "Перрон и терминал: тягачи и AMR. "
            f"{DATASET_NOTE} {SHOWCASE_NOTE}"
        ),
        "preferred_robot": "MiR Hook 200",
        "seed_layout": True,
        "params": _params_airport(),
    },
    {
        "name": "Роботизация медицинского учреждения",
        "object_type": "medical",
        "industry": "healthcare",
        "region": "Казань",
        "work_mode": "2с",
        "description": (
            "Внутрибольничная логистика и клининг. "
            f"{DATASET_NOTE} {SHOWCASE_NOTE}"
        ),
        "preferred_robot": "Яндекс Ровер",
        "seed_layout": False,
        "params": _params_medical(),
    },
    {
        "name": "E-com фулфилмент — быстрая окупаемость",
        "object_type": "warehouse",
        "industry": "logistics",
        "region": "Москва",
        "work_mode": "3с",
        "description": (
            "Высокие затраты на труд и лёгкие AMR: целевая окупаемость ~1–2 года. "
            f"{SHOWCASE_NOTE}"
        ),
        "preferred_robot": "Locus Origin",
        "seed_layout": True,
        "params": _params_warehouse(
            area_m2=14000,
            zones_count=8,
            staff_count=90,
            ops_count=8000,
            peak_demand=180,
            avg_demand=120,
            sku_count=45000,
            required_payload_kg=40,
            aisle_width_mm=1400,
            route_length_m=600,
            area_width_m=100,
            area_length_m=140,
            current_labor_cost_year=42_000_000,
            labor_reduction_share=0.55,
            unit_price=1_100_000,
            required_processes=["picking", "transport"],
            layout_constraints="Высокая плотность пикинга, короткие маршруты",
        ),
    },
    {
        "name": "РЦ с штабелёрами — долгая окупаемость",
        "object_type": "warehouse",
        "industry": "logistics",
        "region": "Новосибирск",
        "work_mode": "2с",
        "description": (
            "Дорогой CAPEX (штабелёры) при умеренной экономии труда: "
            "в горизонте 5 лет может не окупаться (для сравнения сценариев). "
            f"{SHOWCASE_NOTE}"
        ),
        "preferred_robot": "Geek+ X1200",
        "seed_layout": True,
        "params": _params_warehouse(
            area_m2=22000,
            zones_count=5,
            staff_count=35,
            ops_count=1500,
            peak_demand=90,
            avg_demand=55,
            sku_count=8000,
            required_payload_kg=1000,
            cargo_height_mm=2200,
            aisle_width_mm=1800,
            route_length_m=1100,
            area_width_m=120,
            area_length_m=180,
            charging_stations=6,
            current_labor_cost_year=11_000_000,
            labor_reduction_share=0.28,
            unit_price=5_500_000,
            required_processes=["stacking", "storage"],
            layout_constraints="Высотное хранение, широкие проходы",
            work_mode="2с",
            shifts_count=2,
        ),
    },
    {
        "name": "Холодильный склад",
        "object_type": "warehouse",
        "industry": "logistics",
        "region": "Екатеринбург",
        "work_mode": "3с",
        "description": (
            "Низкотемпературная зона, средний профиль окупаемости. "
            f"{SHOWCASE_NOTE}"
        ),
        "preferred_robot": "OTTO 1500",
        "seed_layout": True,
        "params": _params_warehouse(
            area_m2=6000,
            zones_count=4,
            staff_count=32,
            ops_count=1400,
            peak_demand=70,
            avg_demand=45,
            required_payload_kg=500,
            aisle_width_mm=2000,
            route_length_m=700,
            area_width_m=60,
            area_length_m=100,
            temperature_min_c=-18,
            temperature_max_c=4,
            floor_type="бетон",
            current_labor_cost_year=26_000_000,
            labor_reduction_share=0.52,
            unit_price=4_500_000,
            required_processes=["transport"],
            layout_constraints="Холодильные камеры, ограниченное время циклов",
        ),
    },
    {
        "name": "Амбулаторный центр — малая логистика",
        "object_type": "medical",
        "industry": "healthcare",
        "region": "Нижний Новгород",
        "work_mode": "2с",
        "description": (
            "Небольшой поток, недорогие роботы-доставщики: короткая окупаемость. "
            f"{SHOWCASE_NOTE}"
        ),
        "preferred_robot": "Promobot Delivery",
        "seed_layout": False,
        "params": _params_medical(
            area_m2=900,
            floors_count=2,
            ops_count=220,
            transport_count=180,
            route_length_m=220,
            elevators=2,
            staff_count=14,
            area_width_m=30,
            area_length_m=40,
            required_payload_kg=15,
            peak_demand=40,
            charging_stations=1,
            facility_type="амбулаторный центр",
            current_labor_cost_year=7_500_000,
            labor_reduction_share=0.5,
            unit_price=520_000,
            required_processes=["delivery"],
        ),
    },
    {
        "name": "Терминал аэропорта — indoor клининг",
        "object_type": "airport",
        "industry": "transport",
        "region": "Сочи",
        "work_mode": "24/7",
        "description": (
            "Клининг пассажирской зоны: умеренный CAPEX, стабильный эффект. "
            f"{SHOWCASE_NOTE}"
        ),
        "preferred_robot": "Airport Clean X",
        "seed_layout": True,
        "params": _params_airport(
            passenger_flow=28000,
            cargo_flow=40,
            ops_count=900,
            peak_demand=70,
            avg_demand=45,
            zones_count=3,
            route_length_m=800,
            required_payload_kg=40,
            aisle_width_mm=1800,
            area_width_m=80,
            area_length_m=120,
            indoor=True,
            temperature_min_c=10,
            temperature_max_c=30,
            floor_type="плитка",
            zone_type="терминал",
            current_labor_cost_year=14_000_000,
            labor_reduction_share=0.45,
            unit_price=890_000,
            required_processes=["cleaning"],
            access_constraints="Пассажирская зона, работа в часы пик",
        ),
    },
]


def _load_assumptions(db: Session) -> dict[str, Any]:
    from app.models import Normative

    a = dict(DEFAULT_ASSUMPTIONS)
    for n in db.query(Normative).all():
        a[n.code] = n.value
    return a


def _ensure_scenarios(db: Session, project: Project) -> None:
    existing = {s.code for s in db.query(Scenario).filter(Scenario.project_id == project.id).all()}
    for code, name in (
        ("baseline", "Без роботизации"),
        ("purchase", "Покупка оборудования"),
        ("raas", "Роботы как услуга"),
    ):
        if code not in existing:
            db.add(Scenario(project_id=project.id, code=code, name_ru=name, params={}, results={}))


def _ensure_layout(project: Project, seed_layout: bool) -> None:
    if not seed_layout:
        return
    if project.layout and (project.layout.get("objects") or []):
        # Уже есть осмысленный план — не затираем
        objs = project.layout.get("objects") or []
        if any(o.get("kind") not in (None, "wall") for o in objs):
            return
    params = project.object_params or {}
    w = float(params.get("area_width_m") or 60)
    l = float(params.get("area_length_m") or 40)
    layout = empty_layout(w, l)
    layout["objects"] = default_warehouse_objects(w, l, int(params.get("zones_count") or 3))
    layout["source"] = "demo_showcase"
    project.layout = layout


def _pick_robot(db: Session, project: Project, preferred_name: Optional[str]) -> Optional[Robot]:
    if preferred_name:
        robot = db.query(Robot).filter(Robot.name == preferred_name, Robot.archived.is_(False)).first()
        if robot:
            return robot
    ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
    code = ot.code if ot else None
    robots = db.query(Robot).filter(Robot.archived.is_(False)).all()
    results = run_matching(robots, project.object_params or {}, code)
    for row in results:
        if row["status"] == "suitable":
            return db.query(Robot).filter(Robot.id == row["robot_id"]).first()
    for row in results:
        if row["status"] == "needs_review":
            return db.query(Robot).filter(Robot.id == row["robot_id"]).first()
    return None


def _sync_matching(db: Session, project: Project, selected: Robot) -> None:
    ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
    code = ot.code if ot else None
    robots = db.query(Robot).filter(Robot.archived.is_(False)).all()
    results = run_matching(robots, project.object_params or {}, code)
    db.query(ProjectSolution).filter(ProjectSolution.project_id == project.id).delete()
    for r in results:
        db.add(
            ProjectSolution(
                project_id=project.id,
                robot_id=r["robot_id"],
                selected=r["robot_id"] == selected.id,
                match_score=r["match_score"],
                match_reasons=r["match_reasons"],
                exclusion_reasons=r["exclusion_reasons"],
                status=r["status"],
            )
        )
    # Если preferred не в matching (редко) — всё равно отметим
    if not any(r["robot_id"] == selected.id for r in results):
        db.add(
            ProjectSolution(
                project_id=project.id,
                robot_id=selected.id,
                selected=True,
                match_score=50.0,
                match_reasons=["Демо-выбор витрины"],
                exclusion_reasons=[],
                status="suitable",
            )
        )
    params = dict(project.object_params or {})
    params["economics_robot_id"] = selected.id
    if selected.price_rub:
        params["unit_price"] = float(selected.price_rub)
    project.object_params = params


def _calc_scenario(
    db: Session,
    project: Project,
    robot: Robot,
    scenario: str,
    assumptions: dict[str, Any],
    author_id: Optional[int],
) -> dict[str, Any]:
    params = project.object_params or {}
    peak = float(params.get("peak_demand") or params.get("peak_ops_per_hour") or 0)
    productivity = float(
        robot.productivity_ops_per_hour
        or params.get("productivity")
        or 50.0
    )
    unit_price = float(robot.price_rub or params.get("unit_price") or 0)
    overrides = {
        "current_labor_cost_year": float(params.get("current_labor_cost_year") or 0),
        "labor_reduction_share": float(
            params.get("labor_reduction_share")
            if params.get("labor_reduction_share") is not None
            else assumptions.get("labor_reduction_share", 0.4)
        ),
    }
    if params.get("additional_revenue") not in (None, ""):
        overrides["additional_revenue"] = float(params["additional_revenue"])

    result = calculate_scenario(
        scenario=scenario,
        peak_demand=peak,
        productivity=productivity,
        unit_price=unit_price,
        software_cost=float(robot.software_cost_rub or 0),
        maintenance_year=float(robot.maintenance_cost_year_rub or 0),
        implementation_cost=float(robot.implementation_cost_rub or 0),
        assumptions=assumptions,
        overrides=overrides,
    )
    result["robot_id"] = robot.id
    result["robot_name"] = robot.name
    result.setdefault("assumptions", {})["unit_price_origin"] = (
        "robot.price_rub" if robot.price_rub else "unit_price"
    )

    inputs = {
        "scenario": scenario,
        "peak_demand": peak,
        "productivity": productivity,
        "unit_price": unit_price,
        "software_cost": float(robot.software_cost_rub or 0),
        "maintenance_year": float(robot.maintenance_cost_year_rub or 0),
        "implementation_cost": float(robot.implementation_cost_rub or 0),
        "robots_count": result.get("robots_count"),
        "robot_id": robot.id,
        "assumptions": assumptions,
        "overrides": overrides,
    }

    sc = (
        db.query(Scenario)
        .filter(Scenario.project_id == project.id, Scenario.code == scenario)
        .first()
    )
    if sc:
        sc.results = result
        sc.params = {
            "peak_demand": peak,
            "productivity": productivity,
            "unit_price": unit_price,
            "robots_count": result.get("robots_count"),
        }

    # Для purchase — основной Calculation (презентация / last_calc)
    if scenario == "purchase":
        last = (
            db.query(Calculation)
            .filter(Calculation.project_id == project.id)
            .order_by(Calculation.version.desc())
            .first()
        )
        version = (last.version + 1) if last else 1
        db.add(
            Calculation(
                project_id=project.id,
                version=version,
                model_version=get_settings().MODEL_VERSION,
                author_id=author_id,
                inputs=inputs,
                assumptions=assumptions,
                results=result,
                changed_params={"source": "demo_showcase"},
            )
        )
        project.last_calc_at = utcnow()

    return result


def _has_purchase_calc(db: Session, project_id: int) -> bool:
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    if not calc or not isinstance(calc.results, dict):
        return False
    return calc.results.get("scenario") == "purchase" and "payback" in calc.results


def ensure_demo_showcase(db: Session, *, force_recalc: bool = False) -> dict[str, Any]:
    """Создаёт недостающие демо и заполняет подбор + экономику.

    force_recalc=True — пересчитать даже при существующем Calculation (админ/CLI).
    """
    industries = {i.code: i for i in db.query(Industry).all()}
    object_types = {o.code: o for o in db.query(ObjectType).all()}
    if not industries or not object_types:
        return {"ok": False, "error": "нет industries/object_types — сначала seed_all"}

    admin = db.query(User).filter(User.role == "admin").first()
    author_id = admin.id if admin else None
    assumptions = _load_assumptions(db)

    report: dict[str, Any] = {
        "created": [],
        "enriched": [],
        "skipped_calc": [],
        "paybacks": {},
        "errors": [],
    }

    for spec in DEMO_SPECS:
        ot = object_types.get(spec["object_type"])
        ind = industries.get(spec["industry"])
        if not ot or not ind:
            report["errors"].append(f"{spec['name']}: нет типа/отрасли")
            continue

        project = (
            db.query(Project)
            .filter(Project.is_demo.is_(True), Project.name == spec["name"])
            .first()
        )
        if not project:
            project = Project(
                owner_id=None,
                name=spec["name"],
                industry_id=ind.id,
                object_type_id=ot.id,
                description=spec["description"],
                region=spec.get("region"),
                work_mode=spec.get("work_mode"),
                status="demo",
                is_demo=True,
                object_params=dict(spec["params"]),
            )
            db.add(project)
            db.flush()
            report["created"].append(spec["name"])
        else:
            # Не затираем вручную правившие демо: только дополняем description меткой витрины
            desc = project.description or ""
            if SHOWCASE_NOTE not in desc:
                project.description = (desc.rstrip() + f" {SHOWCASE_NOTE}").strip()
            # Если params пустые — подставить витринные
            if not project.object_params:
                project.object_params = dict(spec["params"])

        _ensure_scenarios(db, project)
        _ensure_layout(project, bool(spec.get("seed_layout")))

        robot = _pick_robot(db, project, spec.get("preferred_robot"))
        if not robot:
            report["errors"].append(f"{spec['name']}: нет подходящего робота")
            continue

        need_calc = force_recalc or not _has_purchase_calc(db, project.id)
        if not need_calc:
            report["skipped_calc"].append(spec["name"])
            # всё равно обновим matching, если пусто
            has_sel = (
                db.query(ProjectSolution)
                .filter(ProjectSolution.project_id == project.id, ProjectSolution.selected.is_(True))
                .first()
            )
            if not has_sel:
                _sync_matching(db, project, robot)
            continue

        _sync_matching(db, project, robot)
        purchase_result: dict[str, Any] | None = None
        for scenario in ("baseline", "purchase", "raas"):
            try:
                result = _calc_scenario(db, project, robot, scenario, assumptions, author_id)
                if scenario == "purchase":
                    purchase_result = result
            except (ValueError, TypeError) as exc:
                report["errors"].append(f"{spec['name']}/{scenario}: {exc}")

        project.updated_at = utcnow()
        report["enriched"].append(spec["name"])
        pb = (purchase_result or {}).get("payback") or {}
        capex = (purchase_result or {}).get("capex") or {}
        effect = (purchase_result or {}).get("annual_effect") or {}
        report["paybacks"][spec["name"]] = {
            "robot": robot.name,
            "payback_years": pb.get("payback_years"),
            "payback_display": pb.get("payback_display"),
            "robots_count": (purchase_result or {}).get("robots_count"),
            "capex": capex.get("capex"),
            "annual_effect": effect.get("annual_effect"),
        }

    db.commit()
    report["ok"] = not report["errors"]
    return report
