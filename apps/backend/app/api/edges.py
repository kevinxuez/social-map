from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import SessionLocal
from app.models.models import Edge
from app.core.redis import get_redis

router = APIRouter(prefix="/edges")
CACHE_KEY = 'graph:v1'

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/')
async def create_edge(payload: dict, db: Session = Depends(get_db)):
    a = UUID(payload['a_id'])
    b = UUID(payload['b_id'])
    if a == b:
        raise HTTPException(status_code=400, detail='Self edge not allowed')
    a_c, b_c = sorted([a, b], key=lambda x: str(x))
    existing = db.query(Edge).filter(Edge.a_entity_id==a_c, Edge.b_entity_id==b_c).first()
    if existing:
        return {'id': str(existing.id)}
    edge = Edge(a_entity_id=a_c, b_entity_id=b_c, label=payload.get('label'))
    db.add(edge)
    db.commit()
    db.refresh(edge)
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'id': str(edge.id)}

@router.patch('/{edge_id}')
async def update_edge(edge_id: UUID, payload: dict, db: Session = Depends(get_db)):
    edge = db.query(Edge).get(edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail='Not found')
    if 'label' in payload:
        edge.label = payload['label']
    db.commit()
    db.refresh(edge)
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'updated': True}

@router.delete('/{edge_id}')
async def delete_edge(edge_id: UUID, db: Session = Depends(get_db)):
    edge = db.query(Edge).get(edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail='Not found')
    db.delete(edge)
    db.commit()
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'deleted': True}
