import json
import uuid
from urllib.request import Request, urlopen

BASE = 'http://127.0.0.1:8787'
CLIENT_IP = 'test-' + uuid.uuid4().hex


def post(path, value):
    request = Request(BASE + path, data=json.dumps(value).encode(),
                      headers={'Content-Type': 'application/json', 'CF-Connecting-IP': CLIENT_IP}, method='POST')
    with urlopen(request, timeout=10) as response:
        return response.status, json.load(response)


_, admin = post('/club/admin/activate', {'name': 'Axelman8', 'adminCode': 'testadmin'})
player_name = 'Test ' + uuid.uuid4().hex[:8]
_, registration = post('/club/register', {'name': player_name, 'clubCode': '010RTD'})
_, approved = post('/club/admin/action', {'adminToken': admin['adminToken'],
                                           'id': registration['member']['id'], 'action': 'approve'})
assert approved['pending'] == 0
_, status = post('/club/status', {'requestToken': registration['requestToken']})
leen_token = status['accessToken']
_, players = post('/club/players', {'accessToken': admin['accessToken']})
assert any(player == {'id': registration['member']['id'], 'name': player_name} for player in players['players'])
assert all(player['name'] != 'Axelman8' for player in players['players'])
_, sent = post('/club/invite', {'accessToken': admin['accessToken'],
                                'recipientId': registration['member']['id'], 'code': 'ABC234'})
assert sent['ok'] is True and sent['invite']['fromName'] == admin['member']['name']
_, inbox = post('/club/invitations', {'accessToken': leen_token})
assert len(inbox['invitations']) == 1 and inbox['invitations'][0]['code'] == 'ABC234'
assert post('/club/invite/dismiss', {'accessToken': leen_token,
                                     'id': inbox['invitations'][0]['id']})[1] == {'ok': True}
assert post('/club/invitations', {'accessToken': leen_token})[1] == {'invitations': []}
print('PASS: approved club player list, invitation delivery and dismissal')
