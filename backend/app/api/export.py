from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user_optional
from app.models.catalog_meta import ObjectType
from app.models.misc import Calculation, DataSource
from app.models.project import Project, ProjectSolution, Scenario
from app.models.robot import Robot
from app.models.user import User
from app.schemas import EconomicsRequest
from app.services.export import export_project_excel, export_project_pdf
from app.services.matching import run_matching

router = APIRouter(prefix="/export", tags=["Экспорт"])


def _raise_if_economics_stale(db: Session, project: Project) -> None:
    """Не отдаём отчёт с устаревшей экономикой после изменения обязательных входов."""
    from app.api.economics import _economics_input_mismatches, _resolve_inputs

    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project.id)
        .order_by(Calculation.version.desc())
        .first()
    )
    if not calc or not isinstance(calc.inputs, dict):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "economics_not_calculated",
                "message": "Сначала выполните расчёт экономики — в отчёте нет актуальных KPI.",
            },
        )
    # Демо: гость не может пересчитать; отдаём последний сохранённый расчёт.
    if project.is_demo:
        return
    current = _resolve_inputs(db, project, EconomicsRequest(scenario="purchase"))
    mismatches = _economics_input_mismatches(calc.inputs, current)
    if mismatches:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "economics_stale",
                "message": (
                    "Экономика устарела после изменения исходных данных. "
                    "Пересчитайте экономику перед экспортом."
                ),
                "mismatches": mismatches,
            },
        )


def _solutions_from_db(db: Session, project_id: int) -> list[dict]:
    sols = db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id).all()
    robot_ids = [s.robot_id for s in sols if s.robot_id]
    robots = {
        r.id: r
        for r in (db.query(Robot).filter(Robot.id.in_(robot_ids)).all() if robot_ids else [])
    }
    out: list[dict] = []
    for s in sols:
        robot = robots.get(s.robot_id)
        out.append(
            {
                "robot_id": s.robot_id,
                "robot_name": robot.name if robot else None,
                "status": s.status,
                "match_score": s.match_score,
                "match_reasons": s.match_reasons,
                "exclusion_reasons": s.exclusion_reasons,
                "selected": bool(s.selected),
                "data_origin": getattr(robot, "data_origin", None) if robot else None,
                "source_file": getattr(robot, "source_file", None) if robot else None,
                "source_row": getattr(robot, "source_row", None) if robot else None,
            }
        )
    return out


def _solutions_live_match(db: Session, project: Project) -> list[dict]:
    """Если в БД нет сохранённого подбора (гость) — пересчитать для отчёта."""
    object_type_code = None
    if project.object_type_id:
        ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
        object_type_code = ot.code if ot else None
    robots = db.query(Robot).filter(Robot.archived.is_(False)).all()
    results = run_matching(robots, project.object_params or {}, object_type_code)
    robot_by_id = {r.id: r for r in robots}
    out: list[dict] = []
    for r in results:
        robot = robot_by_id.get(r["robot_id"])
        out.append(
            {
                "robot_id": r["robot_id"],
                "robot_name": robot.name if robot else None,
                "status": r["status"],
                "match_score": r["match_score"],
                "match_reasons": r.get("match_reasons"),
                "exclusion_reasons": r.get("exclusion_reasons"),
                # Без сохранённого выбора не помечаем все «suitable» как базу экономики
                "selected": False,
                "data_origin": getattr(robot, "data_origin", None) if robot else None,
                "source_file": getattr(robot, "source_file", None) if robot else None,
                "source_row": getattr(robot, "source_row", None) if robot else None,
            }
        )
    return out


def _solutions_with_provenance(db: Session, project: Project) -> list[dict]:
    saved = _solutions_from_db(db, project.id)
    if saved:
        return saved
    return _solutions_live_match(db, project)


def _latest_what_if(db: Session, project_id: int, economics: Optional[dict]) -> Optional[dict]:
    if isinstance(economics, dict) and economics.get("what_if"):
        return economics.get("what_if")
    # Ищем в предыдущих версиях расчёта (пересчёт мог «затёрть» what_if)
    rows = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .limit(20)
        .all()
    )
    for row in rows:
        res = row.results if isinstance(row.results, dict) else None
        if res and res.get("what_if"):
            return res.get("what_if")
    return None


_SCENARIO_ORDER = ("baseline", "purchase", "raas")
_SCENARIO_NAMES = {
    "baseline": "Без роботизации",
    "purchase": "Покупка оборудования",
    "raas": "Роботы как услуга",
}


def _scenario_has_metrics(results: Any) -> bool:
    if not isinstance(results, dict) or not results:
        return False
    return any(
        results.get(k) is not None
        for k in ("capex", "opex", "annual_effect", "robots_count", "tco", "npv")
    )


def _scenarios_for_export(db: Session, project: Project) -> list[dict]:
    """Сценарии для отчёта: из БД, иначе досчёт baseline/purchase/raas на лету."""
    rows = {
        s.code: {"code": s.code, "name_ru": s.name_ru, "results": s.results}
        for s in db.query(Scenario).filter(Scenario.project_id == project.id).all()
    }
    need_live = [
        code
        for code in _SCENARIO_ORDER
        if code not in rows or not _scenario_has_metrics(rows[code].get("results"))
    ]
    if need_live:
        from app.api.economics import _ensure_economics_inputs, _resolve_inputs
        from app.services.economics import calculate_scenario

        try:
            for code in need_live:
                req = EconomicsRequest(scenario=code)
                _ensure_economics_inputs(db, project, req)
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
                rows[code] = {
                    "code": code,
                    "name_ru": _SCENARIO_NAMES.get(code, code),
                    "results": result,
                }
        except Exception:
            # Не валим весь экспорт: отдадим то, что есть в БД
            pass

    out: list[dict] = []
    for code in _SCENARIO_ORDER:
        if code in rows and _scenario_has_metrics(rows[code].get("results")):
            row = rows[code]
            out.append(
                {
                    "code": code,
                    "name_ru": row.get("name_ru") or _SCENARIO_NAMES.get(code, code),
                    "results": row.get("results"),
                }
            )
    # дополнительные (fleet_* и т.п.)
    for code, row in rows.items():
        if code in _SCENARIO_ORDER:
            continue
        if _scenario_has_metrics(row.get("results")):
            out.append(row)
    return out


def _export_bundle(db: Session, project: Project) -> dict[str, Any]:
    solutions = _solutions_with_provenance(db, project)
    scenarios = _scenarios_for_export(db, project)
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project.id)
        .order_by(Calculation.version.desc())
        .first()
    )
    economics = calc.results if calc else None
    what_if = _latest_what_if(db, project.id, economics if isinstance(economics, dict) else None)
    sources = db.query(DataSource).all()
    return {
        "solutions": solutions,
        "scenarios": scenarios,
        "economics": economics,
        "what_if": what_if,
        "assumptions": (economics or {}).get("assumptions") if isinstance(economics, dict) else None,
        "sources": sources,
    }


@router.get("/{project_id}/excel", summary="Экспорт Excel")
def export_excel(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    _raise_if_economics_stale(db, project)
    bundle = _export_bundle(db, project)
    data = export_project_excel(
        project,
        bundle["solutions"],
        bundle["economics"],
        bundle["scenarios"],
        assumptions=bundle["assumptions"],
        sources=bundle["sources"],
        what_if=bundle["what_if"],
    )
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="project_{project_id}.xlsx"'},
    )


@router.get("/{project_id}/pdf", summary="Экспорт PDF")
def export_pdf(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    _raise_if_economics_stale(db, project)
    bundle = _export_bundle(db, project)
    data = export_project_pdf(
        project,
        bundle["economics"],
        bundle["solutions"],
        scenarios=bundle["scenarios"],
        assumptions=bundle["assumptions"],
        sources=bundle["sources"],
        what_if=bundle["what_if"],
    )
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="project_{project_id}.pdf"'},
    )
