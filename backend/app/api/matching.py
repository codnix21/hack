from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user, get_current_user_optional
from app.models.catalog_meta import ObjectType
from app.models.project import Project, ProjectSolution
from app.models.robot import Robot
from app.models.user import User, utcnow
from app.schemas import ProjectSolutionOut
from app.services.audit import log_action
from app.services.matching import run_matching

router = APIRouter(prefix="/matching", tags=["Подбор"])


@router.post("/{project_id}/run", summary="Запустить подбор для проекта")
def run_match(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    select_top: int = 5,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    if user.role == "guest" and project.is_demo:
        pass  # allow run on demo for viewing
    elif project.owner_id != user.id and user.role != "admin" and not project.is_demo:
        raise HTTPException(403, detail="Нет доступа")

    object_type_code = None
    if project.object_type_id:
        ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
        object_type_code = ot.code if ot else None

    robots = db.query(Robot).filter(Robot.archived.is_(False)).all()
    results = run_matching(robots, project.object_params or {}, object_type_code)

    suitable = [r for r in results if r["status"] == "suitable"]
    top_ids = {r["robot_id"] for r in suitable[:select_top]}

    # Сохраняем всегда (в т.ч. гость на демо) — иначе аналитика/PDF/повторный вход пустые
    db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id).delete()
    for r in results:
        db.add(
            ProjectSolution(
                project_id=project_id,
                robot_id=r["robot_id"],
                selected=r["robot_id"] in top_ids,
                match_score=r["match_score"],
                match_reasons=r["match_reasons"],
                exclusion_reasons=r["exclusion_reasons"],
                status=r["status"],
            )
        )
    project.updated_at = utcnow()
    db.commit()
    log_action(
        db,
        "matching.run",
        user.id,
        "project",
        project_id,
        {"total": len(results), "suitable": len(suitable)},
    )

    out = []
    for r in results:
        robot = next((x for x in robots if x.id == r["robot_id"]), None)
        item = dict(r)
        item["selected"] = r["robot_id"] in top_ids
        item["id"] = r["robot_id"]
        item["project_id"] = project_id
        item["robot_name"] = robot.name if robot else None
        item["robot_payload_kg"] = robot.payload_kg if robot else None
        item["robot_price_rub"] = robot.price_rub if robot else None
        out.append(item)

    return {
        "project_id": project_id,
        "total": len(out),
        "suitable": len([x for x in out if x["status"] == "suitable"]),
        "needs_review": len([x for x in out if x["status"] == "needs_review"]),
        "excluded": len([x for x in out if x["status"] == "excluded"]),
        "read_only": False,
        "results": out,
    }


@router.get("/{project_id}/results", summary="Результаты подбора с объяснениями")
def get_results(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    status: Optional[str] = None,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    q = db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id)
    if status:
        q = q.filter(ProjectSolution.status == status)
    rows = q.order_by(ProjectSolution.match_score.desc()).all()
    enriched = []
    for s in rows:
        robot = db.query(Robot).filter(Robot.id == s.robot_id).first()
        enriched.append(
            {
                **ProjectSolutionOut.model_validate(s).model_dump(),
                "robot_name": robot.name if robot else None,
                "robot_payload_kg": robot.payload_kg if robot else None,
                "robot_price_rub": robot.price_rub if robot else None,
            }
        )
    return {"project_id": project_id, "results": enriched}
