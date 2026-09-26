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
from app.schemas import EconomicsRequest, SensitivityRequest, WhatIfRequest
from app.services.audit import log_action
from app.services.economics import (
    calculate_scenario,
    explain_calculation,
    get_formulas,
    sensitivity_analysis,
)

router = APIRouter(prefix="/economics", tags=["Экономика"])
settings = get_settings()


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
        selected = (
            db.query(ProjectSolution)
            .filter(ProjectSolution.project_id == project.id, ProjectSolution.selected.is_(True))
            .order_by(ProjectSolution.match_score.desc())
            .first()
        )
        if selected:
            robot = db.query(Robot).filter(Robot.id == selected.robot_id).first()

    peak = req.peak_demand if req.peak_demand is not None else float(
        params.get("peak_demand") or params.get("peak_ops_per_hour") or 200
    )
    productivity = req.productivity
    if productivity is None:
        productivity = float(
            (robot.productivity_ops_per_hour if robot and robot.productivity_ops_per_hour else None)
            or params.get("productivity")
            or 50
        )
    unit_price = float(robot.price_rub) if robot and robot.price_rub else float(params.get("unit_price") or 3_500_000)
    software = float(robot.software_cost_rub) if robot and robot.software_cost_rub else 0.0
    maintenance = float(robot.maintenance_cost_year_rub) if robot and robot.maintenance_cost_year_rub else 0.0
    impl = float(robot.implementation_cost_rub) if robot and robot.implementation_cost_rub else 0.0

    assumptions = _load_assumptions(db)
    overrides = dict(req.overrides or {})
    if "current_labor_cost_year" not in overrides:
        overrides["current_labor_cost_year"] = float(
            params.get("current_labor_cost_year") or assumptions.get("current_labor_cost_year") or 12_000_000
        )

    return {
        "scenario": req.scenario,
        "peak_demand": peak,
        "productivity": productivity,
        "unit_price": unit_price,
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
        raise HTTPException(400, detail=str(exc)) from exc
    result["robot_id"] = inputs["robot_id"]

    # Гость только смотрит расчёт — без записи в БД
    if user.role == "guest":
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

    # Гость — только просмотр, без записи what-if в БД
    if user.role == "guest":
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
        raise HTTPException(400, detail=str(exc)) from exc


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
        raise HTTPException(400, detail=str(exc)) from exc
