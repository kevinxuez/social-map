from sqlalchemy import Column, Integer, String, ForeignKey, Float
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry
from .base import Base

class Entity(Base):
    __tablename__ = 'entities'
    id = Column(Integer, primary_key=True)
    type = Column(String, nullable=False)   # person|org
    name = Column(String, nullable=False)
    attributes = Column(JSONB, default=dict)
    location = Column(Geometry('POINT', srid=4326), nullable=True)

class Edge(Base):
    __tablename__ = 'edges'
    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey('entities.id', ondelete='CASCADE'))
    target_id = Column(Integer, ForeignKey('entities.id', ondelete='CASCADE'))
    relation_type = Column(String, nullable=False)
    weight = Column(Float, default=1.0)
