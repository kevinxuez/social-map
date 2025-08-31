"""Baseline graph schema after removing legacy geo tables.

Revision ID: 000001_baseline
Revises: 
Create Date: 2025-08-30
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "000001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:  # noqa: D401
    op.create_table(
        "groups",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("color_hex", sa.String()),
        sa.Column("parent_group_id", sa.UUID(), sa.ForeignKey("groups.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "entities",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("contact_email", sa.String(), unique=True),
        sa.Column("contact_phone", sa.String(), unique=True),
        sa.Column("notes", sa.Text()),
        sa.Column("main_group_id", sa.UUID(), sa.ForeignKey("groups.id", ondelete="SET NULL")),
        sa.Column("is_current_user", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pos_x", sa.Float()),
        sa.Column("pos_y", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "entity_groups",
        sa.Column("entity_id", sa.UUID(), sa.ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("group_id", sa.UUID(), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint("uq_entity_group", "entity_groups", ["entity_id", "group_id"])
    op.create_table(
        "graph_edges",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("a_entity_id", sa.UUID(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("b_entity_id", sa.UUID(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint("uq_edge_pair", "graph_edges", ["a_entity_id", "b_entity_id"])
    # Canonical UNDIRECTED uniqueness index (LEAST/GREATEST) for symmetry enforcement
    op.execute(
        """
        CREATE UNIQUE INDEX uq_graph_edges_canonical
        ON graph_edges (
            LEAST(a_entity_id, b_entity_id),
            GREATEST(a_entity_id, b_entity_id)
        );
        """
    )


def downgrade() -> None:  # noqa: D401
    op.drop_index("uq_graph_edges_canonical", table_name="graph_edges")
    op.drop_constraint("uq_edge_pair", "graph_edges", type_="unique")
    op.drop_table("graph_edges")
    op.drop_constraint("uq_entity_group", "entity_groups", type_="unique")
    op.drop_table("entity_groups")
    op.drop_table("entities")
    op.drop_table("groups")
