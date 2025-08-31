"""Core graph + group models (Step 1 schema).

Old models (int PK + geo) removed in favor of UUID-based people/groups graph.
Edges are undirected at the application level; DB enforces canonical uniqueness
via an expression index created in Alembic migration.
"""

import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, Float, ForeignKey, UniqueConstraint, DateTime
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base


class Group(Base):
    __tablename__ = "groups"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    color_hex = Column(String)
    parent_group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    parent = relationship("Group", remote_side=[id], backref="children", lazy="joined")


class Entity(Base):  # People
    __tablename__ = "entities"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    contact_email = Column(String, unique=True)
    contact_phone = Column(String, unique=True)
    notes = Column(Text)
    main_group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"))
    is_current_user = Column(Boolean, server_default="false", nullable=False)
    pos_x = Column(Float)
    pos_y = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    main_group = relationship("Group", foreign_keys=[main_group_id], lazy="joined")
    groups = relationship(
        "Group",
        secondary="entity_groups",
    backref="members",
    lazy="selectin",
    passive_deletes=True,  # rely on DB-level ON DELETE CASCADE for association cleanup
    )


class EntityGroup(Base):
    __tablename__ = "entity_groups"
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("entity_id", "group_id", name="uq_entity_group"),
    )


class Edge(Base):
    # Renamed physical table to avoid conflict with PostGIS/tiger extension table "edges"
    __tablename__ = "graph_edges"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    a_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    b_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    label = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Canonical uniqueness (LEAST/GREATEST) enforced via Alembic raw SQL index.
    __table_args__ = (
        UniqueConstraint("a_entity_id", "b_entity_id", name="uq_edge_pair"),  # app-level fast-path; DB index adds canonical
    )

    a = relationship("Entity", foreign_keys=[a_entity_id])
    b = relationship("Entity", foreign_keys=[b_entity_id])

