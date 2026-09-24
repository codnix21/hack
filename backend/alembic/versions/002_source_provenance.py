"""Source provenance fields and import_batches

Revision ID: 002
Revises: 001
Create Date: 2024-06-01 00:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("robots", sa.Column("external_id", sa.String(64), nullable=True))
    op.create_index("ix_robots_external_id", "robots", ["external_id"], unique=True)

    op.add_column("robots", sa.Column("source_file", sa.String(512), nullable=True))
    op.add_column("robots", sa.Column("source_sheet", sa.String(255), nullable=True))
    op.add_column("robots", sa.Column("source_row", sa.Integer(), nullable=True))
    op.add_column("robots", sa.Column("source_column", sa.String(128), nullable=True))
    op.add_column("robots", sa.Column("source_date", sa.DateTime(), nullable=True))
    op.add_column(
        "robots",
        sa.Column("source_status", sa.String(32), nullable=True),
    )
    op.add_column("robots", sa.Column("catalog_type_raw", sa.String(64), nullable=True))
    op.add_column("robots", sa.Column("subtype_raw", sa.String(255), nullable=True))
    op.add_column("robots", sa.Column("scenario_raw", sa.Text(), nullable=True))
    op.add_column("robots", sa.Column("cases_text", sa.Text(), nullable=True))
    op.add_column("robots", sa.Column("trl_level", sa.Integer(), nullable=True))
    op.add_column("robots", sa.Column("market_potential", sa.Float(), nullable=True))
    op.add_column("robots", sa.Column("industry_raw", sa.String(255), nullable=True))
    op.add_column("robots", sa.Column("region_raw", sa.String(255), nullable=True))
    op.add_column(
        "robots",
        sa.Column(
            "data_origin",
            sa.String(32),
            nullable=False,
            server_default="demo",
        ),
    )

    op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("imported_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(64), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warnings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("report_json", sa.JSON()),
        sa.Column("notes", sa.Text()),
    )


def downgrade() -> None:
    op.drop_table("import_batches")
    op.drop_column("robots", "data_origin")
    op.drop_column("robots", "region_raw")
    op.drop_column("robots", "industry_raw")
    op.drop_column("robots", "market_potential")
    op.drop_column("robots", "trl_level")
    op.drop_column("robots", "cases_text")
    op.drop_column("robots", "scenario_raw")
    op.drop_column("robots", "subtype_raw")
    op.drop_column("robots", "catalog_type_raw")
    op.drop_column("robots", "source_status")
    op.drop_column("robots", "source_date")
    op.drop_column("robots", "source_column")
    op.drop_column("robots", "source_row")
    op.drop_column("robots", "source_sheet")
    op.drop_column("robots", "source_file")
    op.drop_index("ix_robots_external_id", table_name="robots")
    op.drop_column("robots", "external_id")
