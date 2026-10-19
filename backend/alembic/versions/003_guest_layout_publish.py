"""Guest session TTL, warehouse layout, public share token

Revision ID: 003
Revises: 002
Create Date: 2026-10-16 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.add_column("projects", sa.Column("layout", sa.JSON(), nullable=True))
    op.add_column("projects", sa.Column("public_token", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("published_at", sa.DateTime(), nullable=True))
    op.add_column("projects", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.create_index("ix_projects_public_token", "projects", ["public_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_projects_public_token", table_name="projects")
    op.drop_column("projects", "expires_at")
    op.drop_column("projects", "published_at")
    op.drop_column("projects", "public_token")
    op.drop_column("projects", "layout")
    op.drop_column("users", "expires_at")
