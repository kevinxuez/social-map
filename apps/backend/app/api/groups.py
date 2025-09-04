from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import SessionLocal
from app.models.models import Group, EntityGroup, Entity
from app.core.redis import get_redis

router = APIRouter(prefix="/groups")
CACHE_KEY = 'graph:v1'

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get('')
async def list_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).all()
    return [
        {
            'id': str(g.id),
            'name': g.name,
            'description': g.description,
            'color_hex': g.color_hex,
            'parent_group_id': str(g.parent_group_id) if g.parent_group_id else None
        } for g in groups
    ]

@router.post('')
async def create_group(payload: dict, db: Session = Depends(get_db)):
    g = Group(
        name=payload['name'],
        description=payload.get('description'),
        color_hex=payload.get('color_hex'),
        parent_group_id=payload.get('parent_group_id')
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'id': str(g.id)}

@router.patch('/{group_id}')
async def update_group(group_id: UUID, payload: dict, db: Session = Depends(get_db)):
    g = db.query(Group).get(group_id)
    if not g:
        raise HTTPException(status_code=404, detail='Not found')
    for k in ['name','description','color_hex','parent_group_id']:
        if k in payload:
            setattr(g,k,payload[k])
    db.commit()
    db.refresh(g)
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'updated': True}

@router.delete('/{group_id}')
async def delete_group(group_id: UUID, db: Session = Depends(get_db)):
    g = db.query(Group).get(group_id)
    if not g:
        raise HTTPException(status_code=404, detail='Not found')
    # Find members whose main_group_id is this; adjust
    members = db.query(Entity).filter(Entity.main_group_id==group_id).all()
    for m in members:
        # find earliest joined among remaining groups after removal
        memberships = db.query(EntityGroup).filter(EntityGroup.entity_id==m.id, EntityGroup.group_id!=group_id).order_by(EntityGroup.joined_at.asc()).all()
        m.main_group_id = memberships[0].group_id if memberships else None
    # Remove memberships in this group
    db.query(EntityGroup).filter(EntityGroup.group_id==group_id).delete(synchronize_session=False)
    db.delete(g)
    db.commit()
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'deleted': True}
