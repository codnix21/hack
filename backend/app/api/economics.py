from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import can_access_project, get_current_user, get_current_user_optional
from app.models.misc import Calculation, Normative
from app.models.project import Project, ProjectSolution, Scenario
from app.models.robot import Robot
from app.models.user import User, utcnow
from app.schemas import EconomicsRequest, FleetCompareRequest, SensitivityRequest, WhatIfRequest
from app.services.audit import log_action
from app.services.economics import (
    calculate_scenario,
    explain_calculation,
    get_formulas,
    sensitivity_analysis,
)
from app.services.fleet_compare import compare_fleet_counts
from app.services.required_inputs import validate_for_economics

router = APIRouter(prefix="/economics", tags=["Экономика"])
settings = get_settings()


def _robot_for_project(db: Session, project: Project, req: EconomicsRequest) -> Robot | None:
    robot = None
    if req.robot_id:
        robot = db.query(Robot).filter(Robot.id == req.robot_id).first()
    else:
        pref = (project.object_params or {}).get("economics_robot_id")
        if pref not in (None, "", 0, "0"):
            try:
                robot = db.query(Robot).filter(Robot.id == int(pref)).first()
            except (TypeError, ValueError):
                robot = None
        if not robot:
            selected = (
                db.query(ProjectSolution)
                .filter(ProjectSolution.project_id == project.id, ProjectSolution.selected.is_(True))
                .order_by(ProjectSolution.match_score.desc())
                .first()
            )
            if selected:
                robot = db.query(Robot).filter(Robot.id == selected.robot_id).first()
    return robot


def _raise_inputs_incomplete(validation: dict) -> None:
    raise HTTPException(
        status_code=400,
        detail={
            "code": "inputs_incomplete",
            "capability": validation.get("capability") or "economics",
            "message": "Недостаточно данных для расчёта",
            "errors": validation.get("errors") or [],
            "warnings": validation.get("warnings") or [],
            "checklist": validation.get("checklist") or [],
        },
    )


def _ensure_economics_inputs(db: Session, project: Project, req: EconomicsRequest) -> dict:
    """Блокирует расчёт при недостаточных входах (единая модель required_inputs)."""
    robot = _robot_for_project(db, project, req)
    robot_price = float(robot.price_rub) if robot and robot.price_rub else None
    selected = (
        db.query(ProjectSolution)
        .filter(ProjectSolution.project_id == project.id, ProjectSolution.selected.is_(True))
        .first()
    )
    validation = validate_for_economics(
        project.object_params or {},
        robot_price=robot_price,
        has_selected_robot=bool(
            selected or (project.object_params or {}).get("economics_robot_id")
        ),
        req_peak=req.peak_demand,
    )
    if not validation["ready"]:
        _raise_inputs_incomplete(validation)
    return validation


def _load_assumptions(db: Session) -> dict:
    norms = db.query(Normative).all()
    a = {}
    for n in norms:
        a[n.code] = n.value
    return a


def _resolve_inputs(db: Session, project: Project, req: EconomicsRequest) -> dict:
    params = project.object_params or {}
    robot = None
    if req.robot_id:
        robot = db.query(Robot).filter(Robot.id == req.robot_id).first()
    else:
        pref = params.get("economics_robot_id") if isinstance(params, dict) else None
        if pref not in (None, "", 0, "0"):
            try:
                robot = db.query(Robot).filter(Robot.id == int(pref)).first()
            except (TypeError, ValueError):
                robot = None
        if not robot:
            selected = (
                db.query(ProjectSolution)
                .filter(ProjectSolution.project_id == project.id, ProjectSolution.selected.is_(True))
                .order_by(ProjectSolution.match_score.desc())
                .first()
            )
            if selected:
                robot = db.query(Robot).filter(Robot.id == selected.robot_id).first()

    # Без молчаливого peak=200: при отсутствии значения вызывающий код должен
    # пройти validate_for_economics (или явно передать req.peak_demand).
    if req.peak_demand is not None:
        peak = float(req.peak_demand)
    else:
        raw_peak = params.get("peak_demand")
        if raw_peak in (None, ""):
            raw_peak = params.get("peak_ops_per_hour")
        peak = float(raw_peak) if raw_peak not in (None, "") else 0.0
    productivity_origin = "request"
    productivity_is_model_fallback = False
    if req.productivity is not None:
        productivity = float(req.productivity)
        productivity_origin = "request"
    elif robot and robot.productivity_ops_per_hour:
        productivity = float(robot.productivity_ops_per_hour)
        productivity_origin = "robot.productivity_ops_per_hour"
    elif params.get("productivity") not in (None, ""):
        productivity = float(params["productivity"])
        productivity_origin = "object_params.productivity"
    else:
        # Технический fallback модели — не характеристика выбранного робота
        productivity = 50.0
        productivity_origin = "model_fallback"
        productivity_is_model_fallback = True
    price_assumed = False
    price_origin = "missing"
    if robot and robot.price_rub:
        unit_price = float(robot.price_rub)
        price_origin = "robot.price_rub"
    elif params.get("unit_price") not in (None, "", 0, "0"):
        unit_price = float(params["unit_price"])
        price_origin = "unit_price"
    elif params.get("assumed_unit_price") not in (None, "", 0, "0"):
        # Только явное допущение пользователя — скрытые 3.5 млн ₽ не подставляем
        unit_price = float(params["assumed_unit_price"])
        price_assumed = True
        price_origin = "assumed_unit_price"
    else:
        unit_price = 0.0
        price_assumed = True
        price_origin = "missing"
    software = float(robot.software_cost_rub) if robot and robot.software_cost_rub else 0.0
    maintenance = float(robot.maintenance_cost_year_rub) if robot and robot.maintenance_cost_year_rub else 0.0
    impl = float(robot.implementation_cost_rub) if robot and robot.implementation_cost_rub else 0.0

    from app.services.labor_cost import resolve_current_labor_cost

    assumptions = _load_assumptions(db)
    overrides = dict(req.overrides or {})
    input_warnings: list[str] = []
    labor_meta: dict = {}
    if productivity_is_model_fallback:
        assumptions = {
            **assumptions,
            "productivity_model_fallback": True,
            "productivity_ops_per_hour": productivity,
            "productivity_origin": productivity_origin,
            "productivity_model_fallback_note": (
                "Производительность 50 оп/ч — допущение модели при отсутствии "
                "значения у робота и в параметрах объекта; не характеристика выбранного решения."
            ),
        }
        input_warnings.append(
            "Производительность 50 оп/ч — допущение модели (нет данных робота/параметров), "
            "не характеристика выбранного решения из каталога."
        )
    else:
        assumptions = {
            **assumptions,
            "productivity_ops_per_hour": productivity,
            "productivity_origin": productivity_origin,
        }
    if "current_labor_cost_year" not in overrides:
        labor_meta = resolve_current_labor_cost(
            params,
            assumption_default=float(assumptions.get("current_labor_cost_year") or 12_000_000),
        )
        overrides["current_labor_cost_year"] = labor_meta["current_labor_cost_year"]
        input_warnings.extend(labor_meta.get("warnings") or [])
        # Переносим предупреждения импорта параметров, если были
        for w in (params.get("_import_warnings") or []):
            if isinstance(w, str) and w not in input_warnings:
                input_warnings.append(w)
    # Пик из суточного объёма — оценка, не измерение
    if params.get("peak_demand_is_estimate") or any(
        isinstance(w, str)
        and (
            "peak_demand оценён" in w
            or ("Пиковая нагрузка" in w and "оцен" in w.lower())
        )
        for w in (params.get("_import_warnings") or [])
    ):
        overrides.setdefault("peak_is_estimate", True)
        assumptions = {**assumptions, "peak_is_estimate": True}
    if params.get("ops_count") and params.get("inbound_pallets_per_day"):
        input_warnings.append(
            "В параметрах есть и «строк отбора/сутки», и «паллеты приёмки/сутки» — это разные "
            "единицы. Пиковый спрос для экономики строится из объёма отбора (строк), "
            "а не из паллетопотока."
        )
    if price_assumed and price_origin == "assumed_unit_price":
        assumptions = {
            **assumptions,
            "unit_price_assumed": True,
            "unit_price_assumed_value": unit_price,
            "unit_price_origin": price_origin,
            "unit_price_assumed_note": (
                "Используется явное допущение цены (assumed_unit_price) — "
                "не коммерческое предложение поставщика."
            ),
        }
    elif price_origin == "unit_price":
        assumptions = {
            **assumptions,
            "unit_price_origin": price_origin,
            "unit_price_note": "Цена задана явно в параметрах объекта (unit_price).",
        }
    elif price_origin == "robot.price_rub":
        assumptions = {
            **assumptions,
            "unit_price_origin": price_origin,
            "unit_price_note": "Цена взята из выбранного решения каталога.",
        }

    return {
        "scenario": req.scenario,
        "peak_demand": peak,
        "productivity": productivity,
        "unit_price": unit_price,
        "unit_price_assumed": price_assumed,
        "unit_price_origin": price_origin,
        "productivity_origin": productivity_origin,
        "productivity_is_model_fallback": productivity_is_model_fallback,
        "software_cost": software,
        "maintenance_year": maintenance,
        "implementation_cost": impl,
        "robots_count": req.robots_count,
        "utilization": req.utilization,
        "availability": req.availability,
        "reserve": req.reserve,
        "years": req.years,
        "assumptions": assumptions,
        "overrides": overrides,
        "robot_id": robot.id if robot else None,
        "input_warnings": input_warnings,
        "labor_cost_origin": labor_meta.get("labor_cost_origin"),
        "labor_cost_sources": labor_meta.get("labor_cost_sources"),
    }


def _num_close(a, b, rel: float = 1e-6, abs_tol: float = 1e-3) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        fa, fb = float(a), float(b)
    except (TypeError, ValueError):
        return a == b
    if fa == fb:
        return True
    scale = max(abs(fa), abs(fb), 1.0)
    return abs(fa - fb) <= max(abs_tol, rel * scale)


def _economics_input_mismatches(stored: dict, current: dict) -> list[str]:
    """
    Сравнивает входы, зависящие от сохранённого проекта (object_params + выбранный робот).

    Не сравнивает эфемерные what-if поля запроса (utilization / years /
    labor_reduction_share и т.п.): иначе UI-расчёт с overrides всегда давал бы stale
    относительно EconomicsRequest() без overrides.
    """
    mismatches: list[str] = []
    scalar_keys = (
        "peak_demand",
        "productivity",
        "unit_price",
        "software_cost",
        "maintenance_year",
        "implementation_cost",
        "robot_id",
    )
    for key in scalar_keys:
        if not _num_close(stored.get(key), current.get(key)):
            mismatches.append(key)
    # Явно заданный robots_count в запросе (редкий случай) — только если оба заданы
    sr, cr = stored.get("robots_count"), current.get("robots_count")
    if sr is not None and cr is not None and not _num_close(sr, cr):
        mismatches.append("robots_count")
    so = stored.get("overrides") if isinstance(stored.get("overrides"), dict) else {}
    co = current.get("overrides") if isinstance(current.get("overrides"), dict) else {}
    # Затраты на персонал резолвятся из object_params в _resolve_inputs
    if "current_labor_cost_year" in so or "current_labor_cost_year" in co:
        if not _num_close(so.get("current_labor_cost_year"), co.get("current_labor_cost_year")):
            mismatches.append("overrides.current_labor_cost_year")
    return mismatches


@router.get("/{project_id}/freshness", summary="Актуальность последнего расчёта экономики")
def economics_freshness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """
    Сравнивает входы последнего сохранённого Calculation с текущим _resolve_inputs.
    Не использует только наличие CAPEX: после изменения object_params статус становится stale.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")

    last = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    if not last or not isinstance(last.inputs, dict):
        return {
            "status": "none",
            "last_calc_at": project.last_calc_at,
            "mismatches": [],
        }

    current = _resolve_inputs(db, project, EconomicsRequest(scenario="purchase"))
    mismatches = _economics_input_mismatches(last.inputs, current)
    return {
        "status": "stale" if mismatches else "fresh",
        "last_calc_at": project.last_calc_at,
        "mismatches": mismatches,
    }


@router.post("/{project_id}/calculate", summary="Расчёт экономики")
def calculate(
    project_id: int,
    req: EconomicsRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")

    validation = _ensure_economics_inputs(db, project, req)

    inputs = _resolve_inputs(db, project, req)
    try:
        result = calculate_scenario(
            scenario=inputs["scenario"],
            peak_demand=inputs["peak_demand"],
            productivity=inputs["productivity"],
            unit_price=inputs["unit_price"],
            software_cost=inputs["software_cost"],
            maintenance_year=inputs["maintenance_year"],
            implementation_cost=inputs["implementation_cost"],
            robots_count=inputs["robots_count"],
            utilization=inputs["utilization"],
            availability=inputs["availability"],
            reserve=inputs["reserve"],
            years=inputs["years"],
            assumptions=inputs["assumptions"],
            overrides=inputs["overrides"],
        )
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        raise HTTPException(
            400,
            detail=public_error_detail(exc, fallback="Некорректные параметры расчёта экономики"),
        ) from exc
    result["robot_id"] = inputs["robot_id"]
    merged_warn = list(inputs.get("input_warnings") or [])
    for w in validation.get("warnings") or []:
        msg = w.get("message") if isinstance(w, dict) else None
        if isinstance(msg, str) and msg not in merged_warn:
            merged_warn.append(msg)
    for w in result.get("model_warnings") or []:
        if isinstance(w, str) and w not in merged_warn:
            merged_warn.append(w)
    if merged_warn:
        result["input_warnings"] = merged_warn
    if inputs.get("labor_cost_origin"):
        result["labor_cost_origin"] = inputs["labor_cost_origin"]
        result["labor_cost_sources"] = inputs.get("labor_cost_sources") or {}
        result.setdefault("inputs", {})
        if isinstance(result["inputs"], dict):
            result["inputs"]["labor_cost_origin"] = inputs["labor_cost_origin"]
            result["inputs"]["current_labor_cost_year"] = inputs["overrides"].get(
                "current_labor_cost_year"
            )
    flags = dict(result.get("assumption_flags") or {})
    if inputs.get("unit_price_assumed"):
        flags["unit_price_assumed"] = True
        result.setdefault("assumptions", {})["unit_price_assumed"] = True
        warn = list(result.get("input_warnings") or [])
        warn.append(
            "CAPEX и OPEX используют явное допущение цены (assumed_unit_price) — "
            "не коммерческое предложение поставщика."
        )
        result["input_warnings"] = warn
    if inputs.get("productivity_is_model_fallback"):
        flags["productivity_model_fallback"] = True
        result.setdefault("assumptions", {})["productivity_model_fallback"] = True
        result.setdefault("assumptions", {})["productivity_ops_per_hour"] = inputs["productivity"]
        result.setdefault("assumptions", {})["productivity_origin"] = inputs.get(
            "productivity_origin"
        )
    if inputs.get("unit_price_origin"):
        result.setdefault("assumptions", {})["unit_price_origin"] = inputs["unit_price_origin"]
    if flags:
        result["assumption_flags"] = flags

    # Общий демо — без записи; свой проект гостя/пользователя сохраняется
    if project.is_demo and (user.role == "guest" or project.owner_id != user.id) and user.role != "admin":
        return {"calculation_id": None, "version": 0, "results": result, "read_only": True}

    last = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    # Не теряем сохранённый what-if при новом пересчёте
    if last and isinstance(last.results, dict) and last.results.get("what_if"):
        result["what_if"] = last.results["what_if"]
    version = (last.version + 1) if last else 1
    calc = Calculation(
        project_id=project_id,
        version=version,
        model_version=settings.MODEL_VERSION,
        author_id=user.id,
        inputs=inputs,
        assumptions=inputs["assumptions"],
        results=result,
        changed_params=None,
    )
    db.add(calc)

    sc = (
        db.query(Scenario)
        .filter(Scenario.project_id == project_id, Scenario.code == req.scenario)
        .first()
    )
    if sc:
        sc.results = result
        sc.params = {k: inputs[k] for k in ("peak_demand", "productivity", "utilization", "availability", "reserve", "years")}

    project.last_calc_at = utcnow()
    project.updated_at = utcnow()
    db.commit()
    db.refresh(calc)
    log_action(db, "economics.calculate", user.id, "project", project_id, {"version": version})
    return {"calculation_id": calc.id, "version": version, "results": result}


@router.post("/{project_id}/what-if", summary="What-if анализ")
def what_if(
    project_id: int,
    req: WhatIfRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")

    _ensure_economics_inputs(db, project, req.base)

    base_inputs = _resolve_inputs(db, project, req.base)
    base_result = calculate_scenario(
        scenario=base_inputs["scenario"],
        peak_demand=base_inputs["peak_demand"],
        productivity=base_inputs["productivity"],
        unit_price=base_inputs["unit_price"],
        software_cost=base_inputs["software_cost"],
        maintenance_year=base_inputs["maintenance_year"],
        implementation_cost=base_inputs["implementation_cost"],
        robots_count=base_inputs["robots_count"],
        utilization=base_inputs["utilization"],
        availability=base_inputs["availability"],
        reserve=base_inputs["reserve"],
        years=base_inputs["years"],
        assumptions=base_inputs["assumptions"],
        overrides=base_inputs["overrides"],
    )

    alt_kwargs = {
        "scenario": base_inputs["scenario"],
        "peak_demand": base_inputs["peak_demand"],
        "productivity": base_inputs["productivity"],
        "unit_price": base_inputs["unit_price"],
        "software_cost": base_inputs["software_cost"],
        "maintenance_year": base_inputs["maintenance_year"],
        "implementation_cost": base_inputs["implementation_cost"],
        "robots_count": base_inputs["robots_count"],
        "utilization": base_inputs["utilization"],
        "availability": base_inputs["availability"],
        "reserve": base_inputs["reserve"],
        "years": base_inputs["years"],
        "assumptions": dict(base_inputs["assumptions"]),
        "overrides": dict(base_inputs["overrides"]),
    }
    for k, v in req.changes.items():
        if k in alt_kwargs:
            alt_kwargs[k] = v
        elif k in alt_kwargs["assumptions"]:
            alt_kwargs["assumptions"][k] = v
        else:
            alt_kwargs["overrides"][k] = v

    alt_result = calculate_scenario(**alt_kwargs)
    delta = {
        "capex": alt_result["capex"]["capex"] - base_result["capex"]["capex"],
        "opex_annual": alt_result["opex"]["opex_annual"] - base_result["opex"]["opex_annual"],
        "annual_effect": alt_result["annual_effect"]["annual_effect"] - base_result["annual_effect"]["annual_effect"],
        "robots_count": alt_result["robots_count"] - base_result["robots_count"],
    }
    payload = {"base": base_result, "alternative": alt_result, "delta": delta, "changes": req.changes}

    if project.is_demo and (user.role == "guest" or project.owner_id != user.id) and user.role != "admin":
        return {**payload, "read_only": True}

    # Persist last what-if on latest calculation so Excel/PDF export can include it
    last = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    if last:
        results = dict(last.results or {})
        results["what_if"] = payload
        last.results = results
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(last, "results")
        db.commit()

    return payload


@router.post("/{project_id}/sensitivity", summary="Анализ чувствительности")
def sensitivity(
    project_id: int,
    req: SensitivityRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    _ensure_economics_inputs(db, project, req.base)
    inputs = _resolve_inputs(db, project, req.base)
    kwargs = {
        "scenario": inputs["scenario"],
        "peak_demand": inputs["peak_demand"],
        "productivity": inputs["productivity"],
        "unit_price": inputs["unit_price"],
        "software_cost": inputs["software_cost"],
        "maintenance_year": inputs["maintenance_year"],
        "implementation_cost": inputs["implementation_cost"],
        "robots_count": inputs["robots_count"],
        "utilization": inputs["utilization"],
        "availability": inputs["availability"],
        "reserve": inputs["reserve"],
        "years": inputs["years"],
        "assumptions": inputs["assumptions"],
        "overrides": inputs["overrides"],
    }
    return sensitivity_analysis(kwargs, req.parameter, req.values)


@router.get("/formulas", summary="Формулы расчёта")
def formulas():
    return {
        "formulas": get_formulas(),
        "description": "Все коэффициенты явные, скрытых множителей нет",
        "model_version": settings.MODEL_VERSION,
    }


@router.get("/{project_id}/explain", summary="Объяснение шагов расчёта экономики")
def explain_get(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    scenario: str = "purchase",
    robot_id: Optional[int] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    req = EconomicsRequest(scenario=scenario, robot_id=robot_id)
    _ensure_economics_inputs(db, project, req)
    try:
        inputs = _resolve_inputs(db, project, req)
        result = calculate_scenario(
            scenario=inputs["scenario"],
            peak_demand=inputs["peak_demand"],
            productivity=inputs["productivity"],
            unit_price=inputs["unit_price"],
            software_cost=inputs["software_cost"],
            maintenance_year=inputs["maintenance_year"],
            implementation_cost=inputs["implementation_cost"],
            robots_count=inputs["robots_count"],
            utilization=inputs["utilization"],
            availability=inputs["availability"],
            reserve=inputs["reserve"],
            years=inputs["years"],
            assumptions=inputs["assumptions"],
            overrides=inputs["overrides"],
        )
        return {
            "project_id": project_id,
            "explanation": explain_calculation(inputs, result),
            "results": result,
        }
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        raise HTTPException(
            400,
            detail=public_error_detail(exc, fallback="Некорректные параметры расчёта экономики"),
        ) from exc


@router.post("/{project_id}/fleet-compare", summary="Сравнение конфигураций парка")
def fleet_compare(
    project_id: int,
    req: FleetCompareRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Сравнивает N конфигураций (по умолчанию 4/6/8) без перезаписи основного расчёта purchase."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    counts = req.counts or [4, 6, 8]
    if len(counts) > 8:
        raise HTTPException(400, detail="Не более 8 конфигураций за раз")
    base = EconomicsRequest(
        robot_id=req.robot_id,
        peak_demand=req.peak_demand,
        productivity=req.productivity,
        utilization=req.utilization,
        availability=req.availability,
        reserve=req.reserve,
        years=req.years,
        scenario="purchase",
        overrides=req.overrides,
    )
    _ensure_economics_inputs(db, project, base)
    try:
        inputs = _resolve_inputs(db, project, base)
        result = compare_fleet_counts(
            counts,
            peak_demand=inputs["peak_demand"],
            productivity=inputs["productivity"],
            unit_price=inputs["unit_price"],
            software_cost=inputs["software_cost"],
            maintenance_year=inputs["maintenance_year"],
            implementation_cost=inputs["implementation_cost"],
            utilization=inputs["utilization"],
            availability=inputs["availability"],
            reserve=inputs["reserve"],
            years=inputs["years"],
            assumptions=inputs["assumptions"],
            overrides=inputs["overrides"],
            robot_id=inputs["robot_id"],
        )
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        raise HTTPException(
            400,
            detail=public_error_detail(exc, fallback="Некорректные параметры сравнения парка"),
        ) from exc

    # Persist only fleet_* rows; never overwrite purchase/baseline/raas
    can_write = (
        req.persist
        and not project.is_demo
        and (project.owner_id == user.id or user.role == "admin")
    )
    if can_write:
        for row in result["rows"]:
            code = row["code"]
            sc = (
                db.query(Scenario)
                .filter(Scenario.project_id == project_id, Scenario.code == code)
                .first()
            )
            payload = {
                "robots_count": row["robots_count"],
                "capex": row["economics"].get("capex"),
                "opex": row["economics"].get("opex"),
                "annual_effect": row["economics"].get("annual_effect"),
                "payback": row["economics"].get("payback"),
                "roi": row["economics"].get("roi"),
                "npv": row["economics"].get("npv"),
                "operations": row["operations"],
            }
            if not sc:
                db.add(
                    Scenario(
                        project_id=project_id,
                        code=code,
                        name_ru=row["name_ru"],
                        params={"robots_count": row["robots_count"]},
                        results=payload,
                    )
                )
            else:
                sc.name_ru = row["name_ru"]
                sc.params = {"robots_count": row["robots_count"]}
                sc.results = payload
        db.commit()
    result["persisted"] = bool(can_write)
    result["project_id"] = project_id
    return result


@router.post("/{project_id}/explain", summary="Объяснение шагов расчёта экономики")
def explain_post(
    project_id: int,
    req: EconomicsRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    _ensure_economics_inputs(db, project, req)
    try:
        inputs = _resolve_inputs(db, project, req)
        result = calculate_scenario(
            scenario=inputs["scenario"],
            peak_demand=inputs["peak_demand"],
            productivity=inputs["productivity"],
            unit_price=inputs["unit_price"],
            software_cost=inputs["software_cost"],
            maintenance_year=inputs["maintenance_year"],
            implementation_cost=inputs["implementation_cost"],
            robots_count=inputs["robots_count"],
            utilization=inputs["utilization"],
            availability=inputs["availability"],
            reserve=inputs["reserve"],
            years=inputs["years"],
            assumptions=inputs["assumptions"],
            overrides=inputs["overrides"],
        )
        return {
            "project_id": project_id,
            "explanation": explain_calculation(inputs, result),
            "results": result,
        }
    except ValueError as exc:
        from app.services.safe_errors import public_error_detail

        raise HTTPException(
            400,
            detail=public_error_detail(exc, fallback="Некорректные параметры расчёта экономики"),
        ) from exc
