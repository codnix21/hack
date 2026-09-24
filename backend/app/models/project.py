from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.types import JSON

from app.database import Base
from app.models.user import utcnow


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    industry_id = Column(Integer, ForeignKey("industries.id"), nullable=True)
    object_type_id = Column(Integer, ForeignKey("object_types.id"), nullable=True)
    description = Column(Text, nullable=True)
    region = Column(String(128), nullable=True)
    work_mode = Column(String(64), nullable=True)  # 1с|2с|3с|24/7
    status = Column(String(64), default="draft", nullable=False)
    object_params = Column(JSON, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    last_calc_at = Column(DateTime, nullable=True)


class ProjectSolution(Base):
    __tablename__ = "project_solutions"
    __table_args__ = (UniqueConstraint("project_id", "robot_id", name="uq_project_robot"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    robot_id = Column(Integer, ForeignKey("robots.id"), nullable=False, index=True)
    selected = Column(Boolean, default=False, nullable=False)
    match_score = Column(Float, nullable=True)
    match_reasons = Column(JSON, nullable=True)
    exclusion_reasons = Column(JSON, nullable=True)
    status = Column(String(32), default="suitable", nullable=False)  # suitable|needs_review|excluded


class Scenario(Base):
    __tablename__ = "scenarios"
    __table_args__ = (UniqueConstraint("project_id", "code", name="uq_project_scenario"),)

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)  # baseline|purchase|raas
    name_ru = Column(String(255), nullable=False)
    params = Column(JSON, nullable=True)
    results = Column(JSON, nullable=True)
