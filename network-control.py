#!/usr/bin/python3
"""Root-owned, narrowly scoped NetworkManager bridge for the local darts app.

Install as /usr/local/sbin/darts-network. Only UUIDs in root-owned config
are accepted. The web process cannot supply a command, password or file path.
"""
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

CONFIG = Path('/etc/darts-network.json')
STATE = Path('/run/darts-network-state.json')
LOCK = Path('/run/darts-network.lock')
UNIT = 'darts-network-switch.service'
HELPER = '/usr/local/sbin/darts-network'


def run(args, timeout=8):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, 'LC_ALL': 'C'})


def config():
    data = json.loads(CONFIG.read_text())
    for profile in data['profiles']:
        if str(uuid.UUID(profile['uuid'])) != profile['uuid']:
            raise ValueError('Invalid configured UUID')
    if not any(p['uuid'] == data['hotspot'] for p in data['profiles']):
        raise ValueError('Missing fallback hotspot')
    return data


def active_ids():
    result = run(['/usr/bin/nmcli', '-t', '-f', 'UUID', 'connection', 'show', '--active'])
    if result.returncode:
        raise RuntimeError('Netwerkstatus kan niet worden gelezen.')
    return result.stdout.splitlines()


def service_busy():
    result = run(['/usr/bin/systemctl', 'show', '--property=ActiveState', '--value', UNIT])
    return result.stdout.strip() in ('active', 'activating', 'deactivating', 'reloading')


def save_state(value):
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(STATE)


def state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def status():
    data = config()
    active = active_ids()
    previous = state()
    busy = service_busy()
    if previous.get('phase') in ('queued', 'switching') and not busy:
        previous = {'phase': 'error', 'message': 'Omschakelen is onderbroken. Controleer de huidige verbinding.'}
    return {'available': True, 'busy': busy, 'hotspot': data['hotspot'],
            'profiles': [{**p, 'active': p['uuid'] in active} for p in data['profiles']],
            'operation': previous}


def activate(target):
    try:
        result = run(['/usr/bin/nmcli', '--wait', '35', 'connection', 'up', 'uuid', target], timeout=42)
        return result.returncode == 0 and target in active_ids()
    except (OSError, subprocess.SubprocessError, RuntimeError):
        return False


def apply(target, data):
    previous = next((p['uuid'] for p in data['profiles'] if p['uuid'] in active_ids()), None)
    save_state({'phase': 'switching', 'target': target, 'message': 'De NUC schakelt van netwerk.'})
    if activate(target):
        result = {'phase': 'done', 'target': target, 'message': 'De netwerkverbinding is actief.'}
    elif activate(data['hotspot']):
        result = {'phase': 'fallback', 'target': data['hotspot'],
                  'message': 'Verbinden is niet gelukt. De NUC zendt weer dartscore uit.'}
    elif previous and previous != data['hotspot'] and activate(previous):
        result = {'phase': 'error', 'target': previous,
                  'message': 'Omschakelen is mislukt. De vorige verbinding is hersteld.'}
    else:
        result = {'phase': 'error', 'message': 'Geen verbinding mogelijk. Controleer wifi op het NUC-bureaublad.'}
    save_state(result)
    return result


def request_switch(target, data):
    if service_busy():
        raise RuntimeError('Er wordt al van netwerk gewisseld. Wacht even.')
    if target in active_ids():
        return {'phase': 'done', 'message': 'Dit netwerk is al actief.'}
    # A fixed unit runs independently of the web connection and web service.
    result = run(['/usr/bin/systemd-run', '--quiet', '--collect', '--unit=' + UNIT,
                  '--property=Type=exec', HELPER, 'apply', target])
    if result.returncode:
        raise RuntimeError('Het omschakelen kon niet worden gestart.')
    queued = {'phase': 'queued', 'target': target, 'message': 'De NUC schakelt over enkele seconden.'}
    save_state(queued)
    return queued


def main():
    args = sys.argv[1:]
    if os.geteuid() != 0:
        raise RuntimeError('Netwerkbeheer is niet geconfigureerd.')
    if args == ['status']:
        return status()
    data = config()
    if len(args) != 2 or args[0] not in ('switch', 'apply') or args[1] not in {p['uuid'] for p in data['profiles']}:
        raise ValueError('Kies een opgeslagen wifi-netwerk.')
    if args[0] == 'apply':
        time.sleep(4)  # Let the mobile receive confirmation before disconnecting.
    with LOCK.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Er wordt al van netwerk gewisseld. Wacht even.')
        return apply(args[1], data) if args[0] == 'apply' else request_switch(args[1], data)


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else 'Netwerkbeheer is tijdelijk niet beschikbaar.'
        print(json.dumps({'error': message}))
        sys.exit(1)
