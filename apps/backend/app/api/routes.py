from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import SessionLocal
from app.models.models import Entity, Edge
from app.schemas.entities import EntityCreate, EntityRead

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get('/health')
def health():
    return {'ok': True}

@router.post('/entities', response_model=EntityRead)
def create_entity(payload: EntityCreate, db: Session = Depends(get_db)):
  e = Entity(**payload.dict())
  db.add(e)
  db.commit()
  db.refresh(e)
  return e

@router.get('/graph')
def get_graph(entity_id: UUID, depth: int = 1, limit: int = 200, db: Session = Depends(get_db)):
  # Simple depth-1 neighborhood using new Edge model (undirected)
  edges = db.query(Edge).filter((Edge.a_entity_id == entity_id) | (Edge.b_entity_id == entity_id)).limit(limit).all()
  node_ids = {entity_id}
  for e in edges:
    node_ids.add(e.a_entity_id)
    node_ids.add(e.b_entity_id)
  nodes = db.query(Entity).filter(Entity.id.in_(list(node_ids))).all()
  return {
    'nodes': [
      {
        'id': str(n.id),
        'name': n.name,
        'group': 'current_user' if n.is_current_user else 'entity'
      } for n in nodes
    ],
    'links': [
      {
        'source': str(e.a_entity_id),
        'target': str(e.b_entity_id),
        'value': 1
      } for e in edges
    ]
  }

# Map endpoint removed (geometry dropped). Placeholder for future spatial support.
