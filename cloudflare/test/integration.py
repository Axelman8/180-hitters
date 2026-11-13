"""End-to-end check for a deployed or local 180 Hitters Worker."""
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import copy, json, os

BASE = os.environ.get('ONLINE_TEST_BASE', 'http://127.0.0.1:8787').rstrip('/')

def request(path, method='GET', value=None):
    data = json.dumps(value).encode() if value is not None else None
    try:
        with urlopen(Request(BASE + path, data=data, method=method,
                             headers={'Content-Type': 'application/json',
                                      'User-Agent': '180-Hitters-integration-test'}), timeout=10) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        raw = error.read()
        try: return error.code, json.loads(raw)
        except json.JSONDecodeError: raise RuntimeError(f'HTTP {error.code}: {raw.decode(errors="replace")}') from error

assert request('/health') == (200, {'ok': True, 'service': '180-hitters-online'})
match = {'undo': [], 'state': {'version': 2, 'game': 'fourinarow', 'phase': 'playing',
    'active': 0, 'winner': None, 'history': [],
    'players': [{'name': 'A'}, {'name': 'B'}, {'name': 'C'}, {'name': 'D'}],
    'fourBoard': ['bb'] * 25, 'fourOwners': [None] * 25}}
status, host = request('/rooms', 'POST', {'name': 'Axel', 'match': match, 'public': True})
assert status == 201 and host['role'] == 0 and host['joined'] == 1 and host['capacity'] == 4
with urlopen(Request(BASE + f"/?dartbaan={host['code']}", headers={'User-Agent': '180-Hitters-integration-test'}), timeout=10) as landing:
    page = landing.read().decode()
assert landing.status == 200 and host['code'] in page and 'hitters180://join' in page
assert any(room['code'] == host['code'] and room['host'] == 'Axel' for room in request('/lobby')[1]['rooms'])
early = copy.deepcopy(host['match'])
early['state']['history'].append({'player': 0, 'darts': 1})
assert request(f"/rooms/{host['code']}/state", 'POST',
               {'key': host['key'], 'revision': host['revision'], 'match': early})[0] == 409
status, private = request('/rooms', 'POST', {'name': 'Privé', 'match': copy.deepcopy(match), 'public': False})
assert status == 201 and all(room['code'] != private['code'] for room in request('/lobby')[1]['rooms'])
assert request(f"/rooms/{private['code']}/close", 'POST', {'key': private['key']})[0] == 200
guests = []
for name in ('Bert', 'Cato', 'Daan'):
    status, guest = request(f"/rooms/{host['code']}/join", 'POST', {'name': name})
    assert status == 200
    guests.append(guest)
assert guests[-1]['starter'] is None and guests[-1]['starterPending'] is True
assert request(f"/rooms/{host['code']}/state", 'POST',
               {'key': host['key'], 'revision': guests[-1]['revision'], 'match': early})[0] == 409
assert request(f"/rooms/{host['code']}/starter", 'POST', {'key': 'ongeldig', 'starter': 2})[0] == 404
status, chosen = request(f"/rooms/{host['code']}/starter", 'POST', {'key': guests[0]['key'], 'starter': 2})
assert status == 200 and chosen['starter'] == 2 and chosen['starterPending'] is False
assert chosen['match']['state']['active'] == 2
assert request(f"/rooms/{host['code']}/starter", 'POST', {'key': host['key'], 'starter': 1})[0] == 409
assert request(f"/rooms/{host['code']}/join", 'POST', {'name': 'Extra'})[0] == 409
assert all(room['code'] != host['code'] for room in request('/lobby')[1]['rooms'])
assert request(f"/rooms/{host['code']}/leave", 'POST', {'key': guests[-1]['key']}) == (200, {'ok': True, 'left': True})
assert any(room['code'] == host['code'] and room['joined'] == 3 for room in request('/lobby')[1]['rooms'])
assert request(f"/rooms/{host['code']}?key={guests[-1]['key']}")[0] == 404
status, replacement = request(f"/rooms/{host['code']}/join", 'POST', {'name': 'Daan opnieuw'})
assert status == 200 and replacement['role'] == 3
guests[-1] = replacement
current = request(f"/rooms/{host['code']}?key={host['key']}")[1]
starter = current['starter']
keys = [host['key'], *[guest['key'] for guest in guests]]
wrong_role = (starter + 1) % 4
assert request(f"/rooms/{host['code']}/draft", 'POST',
               {'key': keys[wrong_role], 'seq': 1, 'hits': []})[0] == 403
status, first_dart = request(f"/rooms/{host['code']}/draft", 'POST',
                             {'key': keys[starter], 'seq': 1,
                              'hits': [{'number': 20, 'mult': 1, 'cell': 3, 'label': '20'}]})
assert status == 200 and first_dart['draft']['role'] == starter and len(first_dart['draft']['hits']) == 1
status, second_dart = request(f"/rooms/{host['code']}/draft", 'POST',
                              {'key': keys[starter], 'seq': 2,
                               'hits': [{'number': 20, 'mult': 1, 'cell': 3, 'label': '20'},
                                        {'number': 5, 'mult': 2, 'cell': 8, 'label': 'D5'}]})
assert status == 200 and len(second_dart['draft']['hits']) == 2
wrong = copy.deepcopy(current['match'])
wrong['state']['history'].append({'player': wrong_role})
wrong['state']['active'] = (wrong_role + 1) % 4
assert request(f"/rooms/{host['code']}/state", 'POST',
               {'key': keys[wrong_role], 'revision': current['revision'], 'match': wrong})[0] == 403
stuck = copy.deepcopy(current['match'])
stuck['state']['history'].append({'player': starter, 'darts': 3})
assert request(f"/rooms/{host['code']}/state", 'POST',
               {'key': keys[starter], 'revision': current['revision'], 'match': stuck})[0] == 400
played = copy.deepcopy(current['match'])
played['state']['history'].append({'player': starter, 'darts': 3})
played['state']['active'] = wrong_role
status, advanced = request(f"/rooms/{host['code']}/state", 'POST',
                           {'key': keys[starter], 'revision': current['revision'], 'match': played})
assert status == 200 and advanced['match']['state']['active'] == wrong_role and advanced['draft'] is None
won = copy.deepcopy(advanced['match'])
won['state']['history'].append({'player': wrong_role, 'darts': 1})
won['state'].update(phase='won', winner=wrong_role)
status, final = request(f"/rooms/{host['code']}/state", 'POST',
                        {'key': keys[wrong_role], 'revision': advanced['revision'], 'match': won})
assert status == 200 and final['match']['state']['phase'] == 'won'
assert request(f"/rooms/{host['code']}/close", 'POST', {'key': guests[0]['key']})[0] == 403
assert request(f"/rooms/{host['code']}/close", 'POST', {'key': host['key']}) == (200, {'ok': True, 'closed': True})
assert request(f"/rooms/{host['code']}?key={host['key']}")[0] == 404
assert all(room['code'] != host['code'] for room in request('/lobby')[1]['rooms'])
print('PASS: lobby, starter, live darts, automatic next turn, ownership and close work')
