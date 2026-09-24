from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user_optional
from app.models.misc import Calculation, DataSource
from app.models.project import Project, ProjectSolution, Scenario
from app.models.robot import Robot
from app.models.user import User
from app.services.export import export_project_excel, export_project_pdf

router = APIRouter(prefix="/export", tags=["Экспорт"])


def _solutions_with_provenance(db: Session, project_id: int) -> list[dict]:
    sols = db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id).all()
    robot_ids = [s.robot_id for s in sols if s.robot_id]
    robots = {
        r.id: r
        for r in db.query(Robot).filter(Robot.id.in_(robot_ids)).all()
    } if robot_ids else {}
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
                "data_origin": getattr(robot, "data_origin", None) if robot else None,
                "source_file": getattr(robot, "source_file", None) if robot else None,
                "source_row": getattr(robot, "source_row", None) if robot else None,
            }
        )
    return out


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
    solutions = _solutions_with_provenance(db, project_id)
    scenarios = [
        {"code": s.code, "name_ru": s.name_ru, "results": s.results}
        for s in db.query(Scenario).filter(Scenario.project_id == project_id).all()
    ]
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    economics = calc.results if calc else None
    what_if = None
    if isinstance(economics, dict) and economics.get("what_if"):
        what_if = economics.get("what_if")
    sources = db.query(DataSource).all()
    data = export_project_excel(
        project,
        solutions,
        economics,
        scenarios,
        assumptions=(economics or {}).get("assumptions") if economics else None,
        sources=sources,
        what_if=what_if,
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
    solutions = _solutions_with_provenance(db, project_id)
    scenarios = [
        {"code": s.code, "name_ru": s.name_ru, "results": s.results}
        for s in db.query(Scenario).filter(Scenario.project_id == project_id).all()
    ]
    calc = (
        db.query(Calculation)
        .filter(Calculation.project_id == project_id)
        .order_by(Calculation.version.desc())
        .first()
    )
    economics = calc.results if calc else None
    what_if = None
    if isinstance(economics, dict) and economics.get("what_if"):
        what_if = economics.get("what_if")
    sources = db.query(DataSource).all()
    data = export_project_pdf(
        project,
        economics,
        solutions,
        scenarios=scenarios,
        assumptions=(economics or {}).get("assumptions") if economics else None,
        sources=sources,
        what_if=what_if,
    )
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="project_{project_id}.pdf"'},
    )
