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
    req = Request(url, data=data, headers={'Content-Type': 'application/json'} if data else {})
    with urlopen(req, timeout=3) as response:
        return json.load(response)

with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([
        sys.executable, str(root / 'server.py'), '--host', '127.0.0.1', '--port', '8792',
        '--data-file', str(Path(tmp) / 'match.json')
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.5)
        request('http://127.0.0.1:8792/api/players', {'action': 'add', 'name': 'Venue speler'})
        request('http://127.0.0.1:8792/api/mobile-players', {'players': ['Mobiele speler', 'mobiele speler', ' Tweede ']})
        result = request('http://127.0.0.1:8792/api/players')
        assert result['venuePlayers'] == ['Venue speler']
        assert result['mobilePlayers'] == ['Mobiele speler', 'Tweede']
        assert result['players'] == ['Venue speler', 'Mobiele speler', 'Tweede']
        print('PASS: gescheiden Venhoeve- en mobiele spelerslijsten met mobiele synchronisatie')
    finally:
        server.terminate()
        server.wait()
