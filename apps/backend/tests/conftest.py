import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text, inspect
from app.models.base import Base
from app.main import app
from app.core.redis import close_redis
from app.db.session import ENGINE

def _ensure_schema():
    insp = inspect(ENGINE)
    # if one core table missing, create all
    if not insp.has_table('entities') or not insp.has_table('groups'):
        Base.metadata.create_all(bind=ENGINE)

TABLES = ['entity_groups','graph_edges','entities','groups']

def _drop_and_create():
    # drop existing tables (ignore missing) then create fresh schema
    with ENGINE.begin() as conn:
        for tbl in TABLES:
            conn.execute(text(f'DROP TABLE IF EXISTS {tbl} CASCADE'))
    Base.metadata.create_all(bind=ENGINE)

def _truncate():
    with ENGINE.begin() as conn:
        for tbl in TABLES:
            conn.execute(text(f'TRUNCATE TABLE {tbl} CASCADE'))

@pytest.fixture(scope='session', autouse=True)
def _prepare_schema():
    _drop_and_create()
    yield

@pytest.fixture(autouse=True)
def _clear_db():
    _truncate()
    yield
    _truncate()

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('DISABLE_RATE_LIMIT','1')
    with TestClient(app) as c:
        yield c
    # ensure redis connection closed to prevent event loop closed errors
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(close_redis())
    except RuntimeError:
        # if loop closed, open a new loop just to close redis
        new_loop = asyncio.new_event_loop()
        new_loop.run_until_complete(close_redis())
        new_loop.close()
