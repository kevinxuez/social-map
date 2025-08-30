"""init tables

Revision ID: 0001
Revises: 
Create Date: 2025-08-29
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    op.create_table(
        'entities',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('attributes', sa.dialects.postgresql.JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column('location', Geometry(geometry_type='POINT', srid=4326), nullable=True),
    )
    op.create_table(
        'edges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source_id', sa.Integer(), sa.ForeignKey('entities.id', ondelete='CASCADE')),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('entities.id', ondelete='CASCADE')),
        sa.Column('relation_type', sa.String(), nullable=False),
        sa.Column('weight', sa.Float(), server_default='1.0')
    )

def downgrade():
    op.drop_table('edges')
    op.drop_table('entities')
