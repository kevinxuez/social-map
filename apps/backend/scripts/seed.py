"""Seed script

Creates ~25 entities, 4 groups (one parent with a child), memberships, and 40–60 undirected edges.
Randomizes main group per entity (one of its member groups).
Usage (venv activated):
    python scripts/seed.py
"""
import random
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.models import Group, Entity, EntityGroup, Edge

RND = random.Random(42)

def main():
    db: Session = SessionLocal()
    try:
        # basic clean (non-destructive if empty)
        db.query(Edge).delete()
        db.query(EntityGroup).delete()
        db.query(Entity).delete()
        db.query(Group).delete()
        db.commit()
        # groups
        groups = []
        # Parent: Core Team; Child: Core Team - Sub; plus two siblings
        core = Group(name="Core Team", color_hex="#ff6b6b")
        core_sub = Group(name="Core Team - Sub", color_hex="#ffa94d")  # parent set after flush
        advisors = Group(name="Advisors", color_hex="#4dabf7")
        partners = Group(name="Partners", color_hex="#51cf66")
        for g in (core, core_sub, advisors, partners):
            db.add(g)
            groups.append(g)
        db.commit()
        db.refresh(core)
        db.refresh(core_sub)
        core_sub.parent_group_id = core.id
        db.commit()
        # entities
        entities = []
        for i in range(25):
            e = Entity(name=f"Person {i+1}", contact_email=f"person{i+1}@example.com" if i % 3 == 0 else None,
                       contact_phone=None, notes=None, is_current_user=(i==0))
            db.add(e)
            entities.append(e)
        db.commit()
        for e in entities:
            db.refresh(e)
        # memberships & main groups
        for e in entities:
            member_groups = RND.sample(groups, RND.randint(1, min(3, len(groups))))
            for g in member_groups:
                db.add(EntityGroup(entity_id=e.id, group_id=g.id))
            # random main group from those memberships
            e.main_group_id = RND.choice(member_groups).id
        db.commit()
        # edges (undirected, random)
        edges_added = set()
        target_edges = RND.randint(40,60)
        attempts = 0
        while len(edges_added) < target_edges and attempts < target_edges*5:
            a,b = RND.sample(entities, 2)
            a_id, b_id = sorted([a.id, b.id], key=lambda x: str(x))
            key = (a_id, b_id)
            if a_id == b_id or key in edges_added:
                attempts += 1
                continue
            db.add(Edge(a_entity_id=a_id, b_entity_id=b_id))
            edges_added.add(key)
            attempts += 1
        db.commit()
        print(f"Seeded: {len(groups)} groups, {len(entities)} entities, {len(edges_added)} edges")
    finally:
        db.close()

if __name__ == "__main__":
    main()
