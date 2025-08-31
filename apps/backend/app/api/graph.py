from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.session import SessionLocal
from app.models.models import Entity, Edge, Group, EntityGroup
from app.core.redis import get_redis

router = APIRouter()

CACHE_KEY = 'graph:v1'
CACHE_TTL = 10

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def build_graph(db: Session):
    entities = db.query(Entity).all()
    edges = db.query(Edge).all()
    groups = db.query(Group).all()
    memberships = db.query(EntityGroup).all()
    group_members = {}
    for m in memberships:
        group_members.setdefault(str(m.group_id), []).append(str(m.entity_id))

    nodes = []
    for e in entities:
        # collect group ids
        gids = [str(m.group_id) for m in memberships if m.entity_id == e.id]
        nodes.append({
            'id': str(e.id),
            'name': e.name,
            'contact_email': e.contact_email,
            'contact_phone': e.contact_phone,
            'notes': e.notes,
            'groupIds': gids,
            'mainGroupId': str(e.main_group_id) if e.main_group_id else None,
            'isCurrentUser': e.is_current_user,
            'x': e.pos_x,
            'y': e.pos_y,
        })
    links = []
    for ed in edges:
        links.append({
            'id': str(ed.id),
            'source': str(ed.a_entity_id),
            'target': str(ed.b_entity_id),
            'label': ed.label
        })
    group_objs = []
    for g in groups:
        group_objs.append({
            'id': str(g.id),
            'name': g.name,
            'color': g.color_hex or '#888888',
            'parentId': str(g.parent_group_id) if g.parent_group_id else None,
            'memberIds': group_members.get(str(g.id), [])
        })
    return {'nodes': nodes, 'links': links, 'groups': group_objs}

@router.get('/graph')
async def get_graph(db: Session = Depends(get_db)):
    redis = await get_redis()
    cached = await redis.get(CACHE_KEY)
    if cached:
        import json
        return json.loads(cached)
    graph = await build_graph(db)
    import json
    await redis.set(CACHE_KEY, json.dumps(graph), ex=CACHE_TTL)
    return graph

@router.put('/graph/positions')
async def update_positions(payload: list[dict], db: Session = Depends(get_db)):
    # payload: [{id,x,y}]
    ids = {UUID(p['id']): p for p in payload}
    to_update = db.query(Entity).filter(Entity.id.in_(ids.keys())).all()
    for ent in to_update:
        p = ids[ent.id]
        ent.pos_x = p.get('x')
        ent.pos_y = p.get('y')
    db.commit()
    # invalidate cache
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'updated': len(to_update)}
