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
status, host = request('/rooms', 'POST', {'name': 'Axel', 'match': match})
assert status == 201 and host['role'] == 0 and host['joined'] == 1 and host['capacity'] == 4
guests = []
for name in ('Bert', 'Cato', 'Daan'):
    status, guest = request(f"/rooms/{host['code']}/join", 'POST', {'name': name})
    assert status == 200
    guests.append(guest)
assert request(f"/rooms/{host['code']}/join", 'POST', {'name': 'Extra'})[0] == 409
current = request(f"/rooms/{host['code']}?key={host['key']}")[1]
wrong = copy.deepcopy(current['match'])
wrong['state']['history'].append({'player': 1})
wrong['state']['active'] = 2
assert request(f"/rooms/{host['code']}/state", 'POST',
               {'key': guests[0]['key'], 'revision': current['revision'], 'match': wrong})[0] == 403
won = copy.deepcopy(current['match'])
won['state']['history'].append({'player': 0, 'darts': 1})
won['state'].update(phase='won', winner=0)
status, final = request(f"/rooms/{host['code']}/state", 'POST',
                        {'key': host['key'], 'revision': current['revision'], 'match': won})
assert status == 200 and final['match']['state']['phase'] == 'won'
print('PASS: Cloudflare dartbaan supports four players, turn ownership and a winning final dart')
