from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import can_access_project, get_current_user, get_current_user_optional
from app.models.catalog_meta import ObjectType
from app.models.project import Project, ProjectSolution
from app.models.robot import Robot
from app.models.user import User, utcnow
from app.schemas import ProjectSolutionOut
from app.services.audit import log_action
from app.services.matching import match_robot_to_project, run_matching

router = APIRouter(prefix="/matching", tags=["Подбор"])


class SelectSolutionRequest(BaseModel):
    robot_id: int = Field(..., description="ID решения каталога для экономики проекта")


def _project_writable(user: User, project: Project) -> bool:
    """Свой не-демо проект (или admin). Общие демо — только просмотр."""
    if user.role == "admin":
        return True
    if project.owner_id != user.id:
        return False
    return not bool(project.is_demo)


def _apply_economics_robot(db: Session, project: Project, robot_id: int) -> ProjectSolution:
    """Пометить одно решение как базу экономики; остальные selected=false."""
    robot = db.query(Robot).filter(Robot.id == robot_id, Robot.archived.is_(False)).first()
    if not robot:
        raise HTTPException(404, detail="Решение не найдено в каталоге")

    object_type_code = None
    if project.object_type_id:
        ot = db.query(ObjectType).filter(ObjectType.id == project.object_type_id).first()
        object_type_code = ot.code if ot else None

    row = (
        db.query(ProjectSolution)
        .filter(ProjectSolution.project_id == project.id, ProjectSolution.robot_id == robot_id)
        .first()
    )
    if not row:
        matched = match_robot_to_project(robot, project.object_params or {}, object_type_code)
        row = ProjectSolution(
            project_id=project.id,
            robot_id=robot_id,
            selected=True,
            match_score=matched.get("match_score"),
            match_reasons=matched.get("match_reasons"),
            exclusion_reasons=matched.get("exclusion_reasons"),
            status=matched.get("status") or "needs_review",
        )
        db.add(row)
    else:
        row.selected = True

    others = (
        db.query(ProjectSolution)
        .filter(ProjectSolution.project_id == project.id, ProjectSolution.robot_id != robot_id)
        .all()
    )
    for o in others:
        o.selected = False

    params = dict(project.object_params or {})
    params["economics_robot_id"] = int(robot_id)
    project.object_params = params
    project.updated_at = utcnow()
    db.flush()
    return row


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

    # Демо общие — без записи; свои проекты (в т.ч. гостевые) сохраняются
    read_only = bool(project.is_demo and project.owner_id != user.id)
    if user.role == "guest" and project.is_demo:
        read_only = True
    preferred_id = None
    if isinstance(project.object_params, dict):
        raw_pref = project.object_params.get("economics_robot_id")
        if raw_pref not in (None, "", 0, "0"):
            try:
                preferred_id = int(raw_pref)
            except (TypeError, ValueError):
                preferred_id = None

    # Если «подходит» пусто — автовыбор топа «требует проверки», иначе экономика без базы цены
    auto_ids = set(top_ids)
    if not auto_ids:
        review = [r for r in results if r["status"] == "needs_review"]
        auto_ids = {r["robot_id"] for r in review[:select_top]}

    if preferred_id is not None:
        auto_ids = {preferred_id}

    if not read_only:
        db.query(ProjectSolution).filter(ProjectSolution.project_id == project_id).delete()
        for r in results:
            db.add(
                ProjectSolution(
                    project_id=project_id,
                    robot_id=r["robot_id"],
                    selected=r["robot_id"] in auto_ids,
                    match_score=r["match_score"],
                    match_reasons=r["match_reasons"],
                    exclusion_reasons=r["exclusion_reasons"],
                    status=r["status"],
                )
            )
        if preferred_id is not None and preferred_id not in {r["robot_id"] for r in results}:
            _apply_economics_robot(db, project, preferred_id)
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
        item["selected"] = r["robot_id"] in auto_ids
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
        "read_only": read_only,
        "results": out,
    }


@router.post("/{project_id}/select", summary="Выбрать решение для расчёта экономики")
def select_solution(
    project_id: int,
    body: SelectSolutionRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, detail="Проект не найден")
    if not can_access_project(user, project):
        raise HTTPException(403, detail="Нет доступа")
    if not _project_writable(user, project):
        raise HTTPException(
            403,
            detail="Пример проекта только для просмотра. Создайте копию, чтобы выбрать решение.",
        )

    row = _apply_economics_robot(db, project, body.robot_id)
    db.commit()
    robot = db.query(Robot).filter(Robot.id == body.robot_id).first()
    log_action(
        db,
        "matching.select",
        user.id,
        "project",
        project_id,
        {"robot_id": body.robot_id, "status": row.status},
    )
    return {
        "project_id": project_id,
        "robot_id": body.robot_id,
        "robot_name": robot.name if robot else None,
        "robot_price_rub": robot.price_rub if robot else None,
        "status": row.status,
        "selected": True,
        "message": "Решение выбрано для расчёта экономики. Пересчитайте экономику.",
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
