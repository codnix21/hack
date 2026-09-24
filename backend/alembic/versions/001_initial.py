"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "manufacturers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("country", sa.String(128)),
        sa.Column("website", sa.String(512)),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_table(
        "industries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
    )
    op.create_table(
        "object_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id")),
        sa.Column("parameter_schema", sa.JSON()),
    )
    op.create_table(
        "solution_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
    )
    op.create_table(
        "robots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("manufacturer_id", sa.Integer(), sa.ForeignKey("manufacturers.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("solution_type_id", sa.Integer(), sa.ForeignKey("solution_types.id")),
        sa.Column("purpose", sa.Text()),
        sa.Column("country", sa.String(128)),
        sa.Column("availability_status", sa.String(64)),
        sa.Column("payload_kg", sa.Float()),
        sa.Column("length_mm", sa.Float()),
        sa.Column("width_mm", sa.Float()),
        sa.Column("height_mm", sa.Float()),
        sa.Column("speed_mps", sa.Float()),
        sa.Column("productivity_ops_per_hour", sa.Float()),
        sa.Column("autonomy_hours", sa.Float()),
        sa.Column("positioning_accuracy_mm", sa.Float()),
        sa.Column("navigation", sa.String(128)),
        sa.Column("operating_conditions", sa.JSON()),
        sa.Column("infrastructure_requirements", sa.JSON()),
        sa.Column("price_rub", sa.Float()),
        sa.Column("software_cost_rub", sa.Float()),
        sa.Column("implementation_cost_rub", sa.Float()),
        sa.Column("maintenance_cost_year_rub", sa.Float()),
        sa.Column("service_life_years", sa.Float()),
        sa.Column("acquisition_model", sa.String(64)),
        sa.Column("supported_processes", sa.JSON()),
        sa.Column("limitations", sa.JSON()),
        sa.Column("cases", sa.JSON()),
        sa.Column("source", sa.String(255)),
        sa.Column("source_url", sa.String(512)),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("confirmation_level", sa.String(32), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("raw_data", sa.JSON()),
    )
    op.create_table(
        "robot_characteristics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("robot_id", sa.Integer(), sa.ForeignKey("robots.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.String(512)),
        sa.Column("unit", sa.String(64)),
        sa.Column("source", sa.String(255)),
        sa.Column("source_url", sa.String(512)),
        sa.Column("obtained_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("confirmation_status", sa.String(32), nullable=False),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("industry_id", sa.Integer(), sa.ForeignKey("industries.id")),
        sa.Column("object_type_id", sa.Integer(), sa.ForeignKey("object_types.id")),
        sa.Column("description", sa.Text()),
        sa.Column("region", sa.String(128)),
        sa.Column("work_mode", sa.String(64)),
        sa.Column("status", sa.String(64), nullable=False),
        sa.Column("object_params", sa.JSON()),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_calc_at", sa.DateTime()),
    )
    op.create_table(
        "project_solutions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("robot_id", sa.Integer(), sa.ForeignKey("robots.id"), nullable=False),
        sa.Column("selected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("match_score", sa.Float()),
        sa.Column("match_reasons", sa.JSON()),
        sa.Column("exclusion_reasons", sa.JSON()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.UniqueConstraint("project_id", "robot_id", name="uq_project_robot"),
    )
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("params", sa.JSON()),
        sa.Column("results", sa.JSON()),
        sa.UniqueConstraint("project_id", "code", name="uq_project_scenario"),
    )
    op.create_table(
        "calculations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("inputs", sa.JSON()),
        sa.Column("assumptions", sa.JSON()),
        sa.Column("results", sa.JSON()),
        sa.Column("changed_params", sa.JSON()),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(64)),
        sa.Column("entity_id", sa.Integer()),
        sa.Column("details", sa.JSON()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "normatives",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(64)),
        sa.Column("source", sa.String(512)),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("editable", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_table(
        "data_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.String(512)),
        sa.Column("description", sa.Text()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    for t in [
        "data_sources",
        "normatives",
        "audit_logs",
        "calculations",
        "scenarios",
        "project_solutions",
        "projects",
        "robot_characteristics",
        "robots",
        "solution_types",
        "object_types",
        "industries",
        "manufacturers",
        "users",
    ]:
        op.drop_table(t)
