from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.db.session import SessionLocal
from app.models.models import Entity, EntityGroup, Edge
from app.schemas.entities import EntityCreate, EntityRead, EntityUpdate
from app.core.redis import get_redis

router = APIRouter(prefix="/entities")
CACHE_KEY = 'graph:v1'

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get('/')
async def list_entities(search: str | None = None, group_id: UUID | None = None, db: Session = Depends(get_db)):
    q = db.query(Entity)
    if search:
        ilike = f"%{search.lower()}%"
        q = q.filter(Entity.name.ilike(ilike))
    if group_id:
        q = q.join(EntityGroup, Entity.id == EntityGroup.entity_id).filter(EntityGroup.group_id == group_id)
    ents = q.all()
    return [
        {
            'id': str(e.id),
            'name': e.name,
            'contact_email': e.contact_email,
            'contact_phone': e.contact_phone,
            'notes': e.notes,
            'mainGroupId': str(e.main_group_id) if e.main_group_id else None,
            'isCurrentUser': e.is_current_user,
            'x': e.pos_x,
            'y': e.pos_y,
        } for e in ents
    ]

@router.post('/', response_model=EntityRead)
async def create_entity(payload: EntityCreate, db: Session = Depends(get_db)):
    groups_in = payload.groups_in
    connected = payload.connected_people
    data = payload.dict(exclude={'groups_in','connected_people'})
    # Coerce blank strings to None to avoid unique constraint collisions on empty values
    if data.get('contact_email') == '':
        data['contact_email'] = None
    if data.get('contact_phone') == '':
        data['contact_phone'] = None
    # main group fallback
    if not data.get('main_group_id') and groups_in:
        data['main_group_id'] = groups_in[0]
    ent = Entity(**data)
    db.add(ent)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unique constraint violation") from e
    db.refresh(ent)
    # memberships
    for gid in groups_in:
        db.add(EntityGroup(entity_id=ent.id, group_id=gid))
    # edges (canonical ordering) reciprocal handled by uniqueness
    for other_id in connected:
        if other_id == ent.id:
            continue
        a, b = sorted([ent.id, other_id], key=lambda x: str(x))
        exists = db.query(Edge).filter(Edge.a_entity_id==a, Edge.b_entity_id==b).first()
        if not exists:
            db.add(Edge(a_entity_id=a, b_entity_id=b, label=None))
    db.commit()
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return ent

@router.patch('/{entity_id}', response_model=EntityRead)
async def update_entity(entity_id: UUID, payload: EntityUpdate, db: Session = Depends(get_db)):
    ent = db.query(Entity).get(entity_id)
    if not ent:
        raise HTTPException(status_code=404, detail='Not found')
    data = payload.dict(exclude_unset=True)
    # Coerce blank strings to None
    if data.get('contact_email') == '':
        data['contact_email'] = None
    if data.get('contact_phone') == '':
        data['contact_phone'] = None
    groups_in = data.pop('groups_in', None)
    connected = data.pop('connected_people', None)
    for k,v in data.items():
        setattr(ent, k, v)
    # memberships reconciliation
    if groups_in is not None:
        current = {g.group_id for g in db.query(EntityGroup).filter(EntityGroup.entity_id==ent.id).all()}
        desired = set(groups_in)
        to_add = desired - current
        to_remove = current - desired
        for gid in to_add:
            db.add(EntityGroup(entity_id=ent.id, group_id=gid))
        if to_remove:
            db.query(EntityGroup).filter(EntityGroup.entity_id==ent.id, EntityGroup.group_id.in_(list(to_remove))).delete(synchronize_session=False)
        # main group adjustment
        if ent.main_group_id and ent.main_group_id not in desired:
            # pick earliest joined of remaining
            next_row = db.query(EntityGroup).filter(EntityGroup.entity_id==ent.id, EntityGroup.group_id.in_(list(desired)))\
                .order_by(EntityGroup.joined_at.asc()).first()
            ent.main_group_id = next_row.group_id if next_row else None
    # edges reconciliation
    if connected is not None:
        # get current neighbors
        cur_edges = db.query(Edge).filter((Edge.a_entity_id==ent.id)|(Edge.b_entity_id==ent.id)).all()
        current_neighbors = {e.a_entity_id if e.a_entity_id != ent.id else e.b_entity_id for e in cur_edges}
        desired_neighbors = set(connected)
        to_add = desired_neighbors - current_neighbors
        to_remove = current_neighbors - desired_neighbors
        # add
        for oid in to_add:
            if oid == ent.id:
                continue
            a,b = sorted([ent.id, oid], key=lambda x: str(x))
            if not db.query(Edge).filter(Edge.a_entity_id==a, Edge.b_entity_id==b).first():
                db.add(Edge(a_entity_id=a, b_entity_id=b))
        # remove
        if to_remove:
            for oid in to_remove:
                a,b = sorted([ent.id, oid], key=lambda x: str(x))
                db.query(Edge).filter(Edge.a_entity_id==a, Edge.b_entity_id==b).delete()
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unique constraint violation") from e
    db.refresh(ent)
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return ent

@router.delete('/{entity_id}')
async def delete_entity(entity_id: UUID, db: Session = Depends(get_db)):
    ent = db.query(Entity).get(entity_id)
    if not ent:
        raise HTTPException(status_code=404, detail='Not found')
    # delete edges
    db.query(Edge).filter((Edge.a_entity_id==entity_id)|(Edge.b_entity_id==entity_id)).delete(synchronize_session=False)
    db.delete(ent)
    db.commit()
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'deleted': True}
