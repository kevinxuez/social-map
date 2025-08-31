import io
import zipfile

def _mk_basic(client):
    g = client.post('/groups/', json={'name':'G'}).json()
    a = client.post('/entities/', json={'name':'A','groups_in':[g['id']], 'connected_people':[]}).json()
    b = client.post('/entities/', json={'name':'B','groups_in':[g['id']], 'connected_people':[a['id']]}).json()
    return g,a,b

def test_graph_happy_path(client):
    g,a,b = _mk_basic(client)
    graph = client.get('/graph').json()
    assert any(n['id']==a['id'] for n in graph['nodes'])
    assert any(n['id']==b['id'] for n in graph['nodes'])
    assert len(graph['groups']) >= 1
    assert any((link['source']==a['id'] and link['target']==b['id']) or (link['source']==b['id'] and link['target']==a['id']) for link in graph['links'])

def test_positions_persist(client):
    g,a,b = _mk_basic(client)
    client.put('/graph/positions', json=[{'id':a['id'],'x':10,'y':20},{'id':b['id'],'x':30,'y':40}])
    graph = client.get('/graph').json()
    node_a = next(n for n in graph['nodes'] if n['id']==a['id'])
    assert node_a['x'] == 10 and node_a['y'] == 20

def test_csv_round_trip(client):
    # seed some data
    g,a,b = _mk_basic(client)
    exported = client.get('/csv/export').json()
    zbytes = bytes.fromhex(exported['content'])
    # reset handled automatically by fixture between tests
    # unzip
    zf = zipfile.ZipFile(io.BytesIO(zbytes))
    groups_csv = zf.read('groups.csv')
    people_csv = zf.read('people.csv')
    connections_csv = zf.read('connections.csv')
    # import
    files = {
        'groups_file': ('groups.csv', groups_csv, 'text/csv'),
        'people_file': ('people.csv', people_csv, 'text/csv'),
        'connections_file': ('connections.csv', connections_csv, 'text/csv')
    }
    r = client.post('/csv/import', files=files)
    assert r.status_code == 200
    graph2 = client.get('/graph').json()
    assert len(graph2['nodes']) >= 2
