"""init schema

Revision ID: 809d6ac9ef10
Revises: 
Create Date: 2025-08-30 19:55:48.577245

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '809d6ac9ef10'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to initial application state (UUID graph + groups)."""
    # Core grouping table
    op.create_table(
        'groups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color_hex', sa.String(), nullable=True),
        sa.Column('parent_group_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['parent_group_id'], ['groups.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Entities (people/nodes)
    op.create_table(
        'entities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('contact_email', sa.String(), nullable=True),
        sa.Column('contact_phone', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('main_group_id', sa.UUID(), nullable=True),
        sa.Column('is_current_user', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('pos_x', sa.Float(), nullable=True),
        sa.Column('pos_y', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['main_group_id'], ['groups.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contact_email'),
        sa.UniqueConstraint('contact_phone')
    )

    # Many-to-many association
    op.create_table(
        'entity_groups',
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('group_id', sa.UUID(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('entity_id', 'group_id'),
        sa.UniqueConstraint('entity_id', 'group_id', name='uq_entity_group')
    )

    # Graph edges table (renamed from legacy tiger 'edges')
    op.create_table(
        'graph_edges',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('a_entity_id', sa.UUID(), nullable=False),
        sa.Column('b_entity_id', sa.UUID(), nullable=False),
        sa.Column('label', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['a_entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['b_entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('a_entity_id', 'b_entity_id', name='uq_edge_pair')
    )

    # OPTIONAL: canonical undirected uniqueness (LEAST/GREATEST) index
    # Uncomment if you want DB to forbid (b,a) when (a,b) exists independent of ordering
    # op.execute("""
    #     CREATE UNIQUE INDEX uq_graph_edges_canonical
    #     ON graph_edges (LEAST(a_entity_id, b_entity_id), GREATEST(a_entity_id, b_entity_id));
    # """)


def downgrade() -> None:
    """Revert initial schema (drops application tables)."""
    # Drop in FK dependency order
    op.drop_table('graph_edges')
    op.drop_table('entity_groups')
    op.drop_table('entities')
    op.drop_table('groups')
