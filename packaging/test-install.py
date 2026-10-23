"""Release-runner smoke tests: install, serve, persist, upgrade, uninstall."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

URL = 'http://127.0.0.1:8765'


def request(path, body=None):
    req = urllib.request.Request(URL + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=3) as response:
        return response.read()


def wait():
    for _ in range(60):
        try:
            state = json.loads(request('/api/state'))
            assert 'revision' in state and 'match' in state
            assert b'Hitters Challenge' in request('/')
            return
        except Exception:
            time.sleep(.5)
    raise RuntimeError('Installed application did not become ready')


def write_and_check():
    installed = json.loads(request('/api/desktop-installation'))
    assert installed['platform'] == sys.argv[1], installed
    assert installed['version'] == os.environ['GITHUB_REF_NAME'].lstrip('v'), installed
    assert b'Update controleren' in request('/desktop-update.js')
    request('/api/players', {'action': 'add', 'name': 'Installer Test'})
    assert b'Installer Test' in request('/api/players')


if sys.argv[1] == 'windows':
    target = Path(os.environ['LOCALAPPDATA']) / 'Programs/DartsApp'
    data = Path(os.environ['LOCALAPPDATA']) / '180 Hitters/match-players.json'
    setup = str(Path('installer-output/DartsApp-Setup-Windows-x64.exe').resolve())
    args = [setup, '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-']
    subprocess.run(args, check=True)
    assert (target / 'DartsApp.exe').is_file()
    def start():
        return subprocess.Popen([str(target / 'DartsApp.exe'), '--server'],
                                creationflags=subprocess.CREATE_NO_WINDOW)
    process = start()
    try:
        wait()
        write_and_check()
    finally:
        process.terminate()
        process.wait(timeout=15)
    subprocess.run(args, check=True)
    process = start()
    try:
        wait()
        assert b'Installer Test' in request('/api/players')
    finally:
        process.terminate()
        process.wait(timeout=15)
    subprocess.run([str(target / 'unins000.exe'), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], check=True)
    assert data.is_file() and 'Installer Test' in data.read_text()
    assert not (target / 'DartsApp.exe').exists()
else:
    package = './DartsApp-Ubuntu-Debian-amd64.deb'
    subprocess.run(['sudo', 'apt-get', 'install', '-y', package], check=True)
    wait()
    write_and_check()
    subprocess.run(['sudo', 'dpkg', '-i', package], check=True)
    wait()
    assert b'Installer Test' in request('/api/players')
    subprocess.run(['sudo', 'apt-get', 'remove', '-y', 'dartsapp'], check=True)
    subprocess.run(['sudo', 'test', '-f', '/var/lib/dartsapp/match-players.json'], check=True)
    assert subprocess.run(['systemctl', 'is-active', '--quiet', 'dartsapp']).returncode != 0
print('Installer, server, upgrade, retained data and uninstall verified.')
