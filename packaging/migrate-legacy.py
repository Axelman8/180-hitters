"""Retire the earlier per-user server when installing the system package."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import signal
import subprocess
import time
try:
    import pwd
except ImportError:
    pwd = None

UNITS = ('oche-darts-update.timer', 'oche-darts-update.service',
         'oche-darts-bluetooth.service', 'oche-darts.service')
DATA = ('match.json', 'match-players.json', 'match-mobile-players.json',
        'match-display.json', 'venue.json', 'camera-settings.json')


def read_json(path, default=None):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default


def stop_legacy(account, source):
    runtime = Path('/run/user') / str(account.pw_uid)
    if (runtime / 'bus').exists():
        result = subprocess.run(['runuser', '-u', account.pw_name, '--', 'env',
                                 'XDG_RUNTIME_DIR=' + str(runtime),
                                 'DBUS_SESSION_BUS_ADDRESS=unix:path=' + str(runtime / 'bus'),
                                 'systemctl', '--user', '--no-block', 'disable', '--now', *UNITS],
                                capture_output=True, text=True, timeout=25)
        if result.returncode: print('Legacy services: ' + result.stderr.strip())
    # Also cover a manually started legacy server; never terminate another app.
    scripts = {str(source / 'server.py'), str(source / 'bluetooth-bridge.py'), str(source / 'nuc-update.py')}
    for process in Path('/proc').glob('[0-9]*'):
        try:
            if process.stat().st_uid != account.pw_uid: continue
            args = (process / 'cmdline').read_bytes().decode().split('\0')
            if scripts.intersection(args): os.kill(int(process.name), signal.SIGTERM)
        except (OSError, UnicodeError): pass


def copy_missing(source, target):
    """Keep the original snapshots; repeated installation never overwrites them."""
    if source.is_symlink(): return
    if source.is_dir():
        target.mkdir(parents=True, exist_ok=True)
        for child in source.iterdir(): copy_missing(child, target / child.name)
    elif source.is_file() and not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def migrate(account, data, app, stop=stop_legacy):
    home = Path(account.pw_dir);source = home / '.local/share/oche-darts'
    units = home / '.config/systemd/user'
    if not (source / 'server.py').is_file(): return False
    marker = data / ('legacy-migration-' + str(account.pw_uid) + '.json')
    if marker.exists() or not any((units / name).exists() or (units / name).is_symlink() for name in UNITS): return False
    stop(account, source)
    data.mkdir(parents=True, exist_ok=True)
    backup = data / 'legacy-backups' / str(account.pw_uid)
    for name in (*DATA, 'match-games', 'match-backups'):
        copy_missing(source / name, backup / name)
    # Mask only our four legacy units so a later login cannot bind port 8765
    # again, including when the user systemd manager is not running now.
    for name in UNITS:
        unit = units / name
        if not unit.exists() and not unit.is_symlink(): continue
        if unit.is_symlink() and os.readlink(unit) == '/dev/null': continue
        copy_missing(unit, backup / 'units' / name)
        unit.unlink();unit.symlink_to('/dev/null')
    previous = read_json(data / 'match.json') or {}
    adopt = not (previous.get('match') or {}).get('state')
    for name in DATA:
        local = source / name;target = data / name
        if not local.is_file() or local.is_symlink(): continue
        if not target.exists() or (name == 'match.json' and adopt):
            shutil.copy2(local, target)
        elif name.endswith('-players.json'):
            old = read_json(local, []);current = read_json(target, [])
            if isinstance(old, list) and isinstance(current, list):
                merged = list(current)
                for player in old:
                    if player not in merged: merged.append(player)
                target.write_text(json.dumps(merged, ensure_ascii=False), encoding='utf-8')
    for name in ('match-games', 'match-backups'):
        copy_missing(source / name, data / name)
    # If both installations already contain a game, keep the current system
    # game and make the legacy game available in the saved-games library.
    legacy = read_json(source / 'match.json') or {}
    match = legacy.get('match');state = (match or {}).get('state') or {}
    if state.get('players'):
        key = str(state.get('game', 'x01')) + ':' + str(state.get('startedAt') or json.dumps([p.get('name') for p in state['players']]))
        game_id = hashlib.sha256(key.encode()).hexdigest()[:32]
        target = data / 'match-games' / (game_id + '.json');target.parent.mkdir(exist_ok=True)
        if not target.exists():
            target.write_text(json.dumps({'id': game_id, 'time': (source / 'match.json').stat().st_mtime,
                                         'match': match, 'draft': legacy.get('draft')}, ensure_ascii=False), encoding='utf-8')
    art = source / 'dist'
    for local in [art / 'club-wifi.json', art / 'winner-trophy.jpg', *art.glob('winner-stage*.jpg'), *art.glob('winner-stage*.jpeg')]:
        target = app / 'dist' / local.name
        if local.is_file() and not local.is_symlink() and local.stat().st_size and (adopt or not target.exists()):
            target.parent.mkdir(parents=True, exist_ok=True);shutil.copy2(local, target)
    marker.write_text(json.dumps({'source': str(source), 'time': time.time()}), encoding='utf-8')
    print('Legacy installation migrated: ' + account.pw_name)
    return True


def main():
    if os.geteuid() != 0: raise SystemExit('Run this migration through the Linux installer.')
    data = Path('/var/lib/dartsapp');app = Path('/usr/lib/dartsapp')
    for account in pwd.getpwall():
        if account.pw_uid == 0 or 1000 <= account.pw_uid < 65534:
            migrate(account, data, app)
    account = pwd.getpwnam('dartsapp')
    if data.exists():
        for path in [data, *data.rglob('*')]:
            if not path.is_symlink(): os.chown(path, account.pw_uid, account.pw_gid)


if __name__ == '__main__': main()
