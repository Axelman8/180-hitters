from pathlib import Path
import json
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]


def request(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'} if data else {}
    with urlopen(Request(url, data=data, headers=headers), timeout=3) as response:
        return json.load(response)


with tempfile.TemporaryDirectory() as tmp:
    data_file = Path(tmp) / 'match.json'
    server = subprocess.Popen([
        sys.executable, str(root / 'server.py'), '--host', '127.0.0.1', '--port', '8794',
        '--data-file', str(data_file)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.5)
        base = 'http://127.0.0.1:8794/api/venue'
        profile = request(base)
        assert profile['venueName'] == '180 Hitters'
        assert profile['playerListName'] == 'Clubspelers'
        profile.update(venueName='Testvereniging', city='Utrecht', playerListName='Leden',
                       slogan='Gooi raak', clubWifiName='Club wifi',
                       clubWifiQr='WIFI:T:WPA;S:Club wifi;P:test;;')
        saved = request(base, profile)
        assert saved['venueName'] == 'Testvereniging'
        assert request(base) == saved
        assert json.loads((Path(tmp) / 'venue.json').read_text(encoding='utf-8')) == saved
        print('PASS: neutraal locatieprofiel wordt gevalideerd en blijvend opgeslagen')
    finally:
        server.terminate()
        server.wait(timeout=10)
