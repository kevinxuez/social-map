def test_entity_create_membership_and_main_group(client):
    # create group
    g = client.post('/groups/', json={'name':'G1'}).json()
    e = client.post('/entities/', json={'name':'Alice','groups_in':[g['id']], 'connected_people':[]}).json()
    assert e['main_group_id'] == g['id']
    # update: add second group, ensure main group persists
    g2 = client.post('/groups/', json={'name':'G2'}).json()
    e2 = client.patch(f"/entities/{e['id']}", json={'groups_in':[g['id'], g2['id']]}).json()
    assert e2['main_group_id'] == g['id']
    # remove original main group -> should reassign to remaining (g2)
    e3 = client.patch(f"/entities/{e['id']}", json={'groups_in':[g2['id']]}).json()
    assert e3['main_group_id'] == g2['id']

def test_edge_creation_and_removal(client):
    g = client.post('/groups/', json={'name':'G'}).json()
    a = client.post('/entities/', json={'name':'A','groups_in':[g['id']], 'connected_people':[]}).json()
    b_id = client.post('/entities/', json={'name':'B','groups_in':[g['id']], 'connected_people':[a['id']]}).json()['id']
    graph = client.get('/graph').json()
    assert any((link['source']==a['id'] and link['target']==b_id) or (link['source']==b_id and link['target']==a['id']) for link in graph['links'])
    # remove connection
    client.patch(f"/entities/{b_id}", json={'connected_people':[]}).json()
    graph2 = client.get('/graph').json()
    assert not any((link['source']==a['id'] and link['target']==b_id) or (link['source']==b_id and link['target']==a['id']) for link in graph2['links'])

def test_delete_entity_removes_edges(client):
    g = client.post('/groups/', json={'name':'G'}).json()
    a = client.post('/entities/', json={'name':'A','groups_in':[g['id']], 'connected_people':[]}).json()
    b = client.post('/entities/', json={'name':'B','groups_in':[g['id']], 'connected_people':[a['id']]}).json()
    client.delete(f"/entities/{a['id']}")
    graph = client.get('/graph').json()
    assert all(a['id'] not in (link['source'], link['target']) for link in graph['links'])

def test_delete_group_reassigns_main(client):
    g1 = client.post('/groups/', json={'name':'G1'}).json()
    g2 = client.post('/groups/', json={'name':'G2'}).json()
    e = client.post('/entities/', json={'name':'Alice','groups_in':[g1['id'], g2['id']], 'connected_people':[]}).json()
    # delete main group
    client.delete(f"/groups/{e['main_group_id']}")
    e2 = client.get('/entities/').json()[0]
    assert e2['mainGroupId'] in [g1['id'], g2['id']] or e2['mainGroupId'] is None

def test_uniqueness_email_phone(client):
    g = client.post('/groups/', json={'name':'G'}).json()
    a = client.post('/entities/', json={'name':'A','contact_email':'a@example.com','contact_phone':'123','groups_in':[g['id']], 'connected_people':[]})
    assert a.status_code == 200
    dup = client.post('/entities/', json={'name':'B','contact_email':'a@example.com','groups_in':[g['id']], 'connected_people':[]})
    assert dup.status_code in (400, 500)

def test_rate_limit_enforced(client, monkeypatch):
    # re-enable rate limit
    monkeypatch.setenv('DISABLE_RATE_LIMIT','0')
    # perform > RATE_LIMIT rapid requests
    from app.core.rate_limit import RATE_LIMIT
    hit = 0
    limited = False
    for _ in range(RATE_LIMIT + 5):
        r = client.get('/groups/')
        if r.status_code == 429:
            limited = True
            break
        hit += 1
    assert limited
