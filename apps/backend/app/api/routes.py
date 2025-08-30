from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.models.models import Entity, Edge
from app.schemas.entities import EntityCreate, EntityOut

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

@router.post('/entities', response_model=EntityOut)
def create_entity(payload: EntityCreate, db: Session = Depends(get_db)):
    e = Entity(type=payload.type, name=payload.name, attributes=payload.attributes)
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.get('/graph')
def get_graph(entity_id: int, depth: int = 1, limit: int = 200, db: Session = Depends(get_db)):
    # naive depth-1 neighborhood
    edges = db.query(Edge).filter((Edge.source_id==entity_id)|(Edge.target_id==entity_id)).all()
    node_ids = {entity_id} | {e.source_id for e in edges} | {e.target_id for e in edges}
    nodes = db.query(Entity).filter(Entity.id.in_(node_ids)).all()
    return {
      'nodes': [{'id': str(n.id), 'name': n.name, 'group': n.type} for n in nodes],
      'links': [{'source': str(e.source_id), 'target': str(e.target_id), 'value': e.weight} for e in edges]
    }

@router.get('/map-entities')
def map_entities(bbox: str, db: Session = Depends(get_db)):
    # bbox = west,south,east,north
    west,south,east,north = map(float, bbox.split(','))
    sql = """
      SELECT id, name, ST_AsGeoJSON(location) AS geo
      FROM entities
      WHERE location && ST_MakeEnvelope(:w,:s,:e,:n,4326)
    """
    rows = db.execute(sql, {'w':west,'s':south,'e':east,'n':north}).mappings().all()
    feats = []
    for r in rows:
      feats.append({
        'type':'Feature',
        'geometry': r['geo'],
        'properties': {'id': r['id'], 'name': r['name']}
      })
    return {'type':'FeatureCollection', 'features': feats}
