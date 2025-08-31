import csv
import io
import zipfile
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.models import Group, Entity, EntityGroup, Edge
from app.core.redis import get_redis

router = APIRouter(prefix="/csv")
CACHE_KEY = 'graph:v1'

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get('/export')
async def export_data(db: Session = Depends(get_db)):
    groups = db.query(Group).all()
    entities = db.query(Entity).all()
    memberships = db.query(EntityGroup).all()
    edges = db.query(Edge).all()

    # Build lookup for memberships
    ent_groups = {}
    for m in memberships:
        ent_groups.setdefault(m.entity_id, []).append(m.group_id)

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # groups.csv
        gbuf = io.StringIO()
        gw = csv.writer(gbuf)
        gw.writerow(['name','description','color_hex','parent_group_name'])
        group_name_by_id = {g.id: g.name for g in groups}
        for g in groups:
            gw.writerow([g.name, g.description or '', g.color_hex or '', group_name_by_id.get(g.parent_group_id,'') if g.parent_group_id else ''])
        zf.writestr('groups.csv', gbuf.getvalue())
        # people.csv
        pbuf = io.StringIO()
        pw = csv.writer(pbuf)
        pw.writerow(['name','contact_email','contact_phone','notes','main_group_name','groups'])
        for e in entities:
            group_names = [group_name_by_id.get(gid,'') for gid in ent_groups.get(e.id, [])]
            pw.writerow([e.name, e.contact_email or '', e.contact_phone or '', (e.notes or '').replace('\n',' '), group_name_by_id.get(e.main_group_id,'') if e.main_group_id else '', ';'.join(group_names)])
        zf.writestr('people.csv', pbuf.getvalue())
        # connections.csv
        cbuf = io.StringIO()
        cw = csv.writer(cbuf)
        cw.writerow(['a_identifier','b_identifier','label'])
        for ed in edges:
            cw.writerow([str(ed.a_entity_id), str(ed.b_entity_id), ed.label or ''])
        zf.writestr('connections.csv', cbuf.getvalue())
    zbuf.seek(0)
    return {
        'filename': 'export.zip',
        'content': zbuf.getvalue().hex()  # client can hex-decode
    }

@router.post('/import')
async def import_data(groups_file: UploadFile = File(...), people_file: UploadFile = File(...), connections_file: UploadFile = File(...), db: Session = Depends(get_db)):
    # parse groups
    text = (await groups_file.read()).decode('utf-8')
    rdr = csv.DictReader(io.StringIO(text))
    name_to_group = {}
    for row in rdr:
        g = Group(name=row['name'], description=row.get('description') or None, color_hex=row.get('color_hex') or None)
        db.add(g)
        db.flush()
        name_to_group[row['name']] = g
    db.commit()
    # second pass for parents (after all groups present)
    # (Not implemented: parent resolution for simplicity)

    text_people = (await people_file.read()).decode('utf-8')
    pr = csv.DictReader(io.StringIO(text_people))
    email_or_name_to_entity = {}
    for row in pr:
        mg_name = row.get('main_group_name') or ''
        mg_id = name_to_group.get(mg_name).id if mg_name and mg_name in name_to_group else None
        ent = Entity(name=row['name'], contact_email=row.get('contact_email') or None, contact_phone=row.get('contact_phone') or None, notes=row.get('notes') or None, main_group_id=mg_id)
        db.add(ent)
        db.flush()
        if ent.contact_email:
            email_or_name_to_entity[ent.contact_email] = ent
        email_or_name_to_entity.setdefault(ent.name, ent)
        groups_field = row.get('groups') or ''
        if groups_field:
            for gname in groups_field.split(';'):
                gname = gname.strip()
                if gname and gname in name_to_group:
                    db.add(EntityGroup(entity_id=ent.id, group_id=name_to_group[gname].id))
    db.commit()

    text_conn = (await connections_file.read()).decode('utf-8')
    cr = csv.DictReader(io.StringIO(text_conn))
    for row in cr:
        a_id = row['a_identifier']
        b_id = row['b_identifier']
        a_ent = email_or_name_to_entity.get(a_id)
        b_ent = email_or_name_to_entity.get(b_id)
        if not a_ent or not b_ent or a_ent.id == b_ent.id:
            continue
        a_c, b_c = sorted([a_ent.id, b_ent.id], key=lambda x: str(x))
        existing = db.query(Edge).filter(Edge.a_entity_id==a_c, Edge.b_entity_id==b_c).first()
        if not existing:
            db.add(Edge(a_entity_id=a_c, b_entity_id=b_c, label=row.get('label') or None))
    db.commit()
    redis = await get_redis()
    await redis.delete(CACHE_KEY)
    return {'imported': True}
