"""Offline shared scoreboard. Python standard library only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
import argparse
import json
import os
import shutil
import socket
import subprocess
import time
import uuid

CONTROL_TOKEN = 'd7c87006c31f4da2a4348eeb05b59c8b'
DEFAULT_VENUE = {
    'venueName': '180 Hitters', 'city': '', 'playerListName': 'Clubspelers',
    'slogan': 'Samen aan de oche.', 'screensaverEnabled': True,
    'logoData': '', 'backgroundData': '', 'clubWifiName': '', 'clubWifiQr': '',
    'hotspotName': '180 Hitters wifi', 'hotspotPassword': ''
}


def clean_venue(value):
    """Return a complete, bounded venue profile or reject unsafe input."""
    if not isinstance(value, dict) or set(value) != set(DEFAULT_VENUE):
        raise ValueError('Ongeldig locatieprofiel.')
    limits = {'venueName': 60, 'city': 60, 'playerListName': 40, 'slogan': 100,
              'clubWifiName': 80, 'clubWifiQr': 500,
              'hotspotName': 80, 'hotspotPassword': 100}
    result = {}
    for key, fallback in DEFAULT_VENUE.items():
        incoming = value[key]
        if isinstance(fallback, bool):
            if type(incoming) is not bool: raise ValueError('Ongeldig locatieprofiel.')
            result[key] = incoming
        elif key in ('logoData', 'backgroundData'):
            if not isinstance(incoming, str) or len(incoming) > 2_500_000 or (incoming and not incoming.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,'))):
                raise ValueError('Gebruik een PNG-, JPG- of WebP-afbeelding van maximaal 1,8 MB.')
            result[key] = incoming
        else:
            if not isinstance(incoming, str) or len(incoming.strip()) > limits[key]:
                raise ValueError('Ongeldig locatieprofiel.')
            result[key] = incoming.strip()
    if not result['venueName'] or not result['playerListName'] or not result['hotspotName']:
        raise ValueError('Naam, spelerslijst en hotspotnaam zijn verplicht.')
    if result['clubWifiQr'] and not result['clubWifiQr'].startswith('WIFI:'):
        raise ValueError('De clubwifi-QR moet met WIFI: beginnen.')
    return result


def network_control(action, target=None, payload=None):
    helper = '/usr/local/sbin/darts-network'
    if os.name != 'posix' or not Path(helper).is_file():
        raise RuntimeError('Netwerkkeuze is nog niet ingesteld op deze NUC.')
    args = ['sudo', '-n', helper, action]
    if target is not None:
        if not isinstance(target, str) or str(uuid.UUID(target)) != target:
            raise ValueError('Kies een opgeslagen wifi-netwerk.')
        args.append(target)
    result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                            capture_output=True, text=True, timeout=20)
    try:
        response = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError('Netwerkbeheer is tijdelijk niet beschikbaar.')
    if result.returncode or 'error' in response:
        raise RuntimeError(response.get('error', 'Netwerkbeheer is tijdelijk niet beschikbaar.'))
    return response


def wifi_qr(ssid, password):
    """Build the standard ZXing Wi-Fi QR payload used by Android and iOS."""
    def escape(value):
        return ''.join('\\' + char if char in '\\;,:' else char for char in value)
    return f'WIFI:T:WPA;S:{escape(ssid)};P:{escape(password)};H:false;;'


def system_control(action):
    helper = '/usr/local/sbin/darts-system'
    if os.name != 'posix' or not Path(helper).is_file():
        raise RuntimeError('NUC-bediening is nog niet geïnstalleerd.')
    if action not in ('status', 'bluetooth-on', 'bluetooth-off', 'restart', 'shutdown'):
        raise ValueError('Ongeldige NUC-actie.')
    result = subprocess.run(['sudo', '-n', helper, action], capture_output=True, text=True, timeout=8)
    try:
        response = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError('NUC-bediening is tijdelijk niet beschikbaar.')
    if result.returncode or 'error' in response:
        raise RuntimeError(response.get('error', 'NUC-bediening is tijdelijk niet beschikbaar.'))
    return response


def open_kiosk(root):
    """Open only our local launcher, or raise its existing Chrome window."""
    launcher = root / 'start-kiosk.sh'
    if os.name != 'posix' or not launcher.is_file():
        raise RuntimeError('Deze knop werkt alleen op de NUC.')
    env = os.environ.copy()
    result = subprocess.run(['systemctl', '--user', 'show-environment'],
                            capture_output=True, text=True, timeout=3, check=True)
    for line in result.stdout.splitlines():
        key, _, value = line.partition('=')
        if key in ('DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'):
            env[key] = value
    if not env.get('DISPLAY') or not Path(env.get('XAUTHORITY', '/nonexistent')).is_file():
        raise RuntimeError('Meld de NUC eerst aan op het bureaublad.')
    if not shutil.which('xdotool'):
        raise RuntimeError('Het hulpmiddel om het NUC-scherm te openen ontbreekt.')
    profile = '--user-data-dir=' + str(root / 'browser-profile')
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            # Chrome may rewrite argv into one space-separated process title.
            command = ' ' + (proc / 'cmdline').read_bytes().decode().replace('\0', ' ').strip() + ' '
        except (OSError, UnicodeError):
            continue
        if ' ' + profile + ' ' not in command or ' --type=' in command:
            continue
        windows = subprocess.run(['xdotool', 'search', '--onlyvisible', '--pid', proc.name],
                                 env=env, capture_output=True, text=True, timeout=3)
        for window in windows.stdout.splitlines():
            if window.isdecimal():
                subprocess.run(['xdotool', 'windowactivate', '--sync', window],
                               env=env, capture_output=True, timeout=3, check=True)
                return 'De app staat weer op het NUC-scherm.'
    child = subprocess.Popen(['/bin/bash', str(launcher)], env=env,
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
    time.sleep(.4)
    if child.poll() not in (None, 0):
        raise RuntimeError('De app kon niet starten. Controleer het NUC-scherm.')
    return 'De app wordt geopend op de NUC.'


def serve(host='0.0.0.0', port=8765, data_file=None):
    root = Path(__file__).parent
    path = Path(data_file) if data_file else root / 'match.json'
    roster_path = path.with_name(path.stem + '-players.json')
    roster = json.loads(roster_path.read_text(encoding='utf-8')) if roster_path.exists() else []
    mobile_roster_path = path.with_name(path.stem + '-mobile-players.json')
    mobile_roster = json.loads(mobile_roster_path.read_text(encoding='utf-8')) if mobile_roster_path.exists() else []
    display_path = path.with_name(path.stem + '-display.json')
    display = json.loads(display_path.read_text(encoding='utf-8')) if display_path.exists() else {'inputCollapsed': False}
    venue_path = path.with_name('venue.json')
    try:
        venue = clean_venue({**DEFAULT_VENUE, **json.loads(venue_path.read_text(encoding='utf-8'))}) if venue_path.exists() else dict(DEFAULT_VENUE)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        venue = dict(DEFAULT_VENUE)
    lock = Lock()
    current = {'revision': 0, 'match': None}
    draft = {'value': None, 'time': 0}
    sequences = {}
    shared_setup = {'version': 0, 'value': None}
    kiosk_lock = Lock()
    last_kiosk = 0
    if path.exists():
        current = json.loads(path.read_text(encoding='utf-8'))
        restored = (current.get('match') or {}).get('editTurn') or {}
        if restored.get('hits'):
            draft.update(value={'owner': 'restored-turn', 'hits': restored['hits'], 'revision': current['revision']}, time=time.monotonic())

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                          '.apk': 'application/vnd.android.package-archive'}
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root / 'dist'), **kwargs)

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()

        def reply(self, status, value):
            body = json.dumps(value, allow_nan=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            route = urlsplit(self.path).path
            if route == '/api/network/control':
                try:
                    self.reply(200, network_control('status'))
                except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                    message = str(error) if isinstance(error, RuntimeError) else 'Netwerkbeheer is tijdelijk niet beschikbaar.'
                    self.reply(503, {'error': message})
            elif route == '/api/system/status':
                if self.headers.get('X-Darts-Control') != 'd7c87006c31f4da2a4348eeb05b59c8b':
                    self.reply(403, {'error': 'Alleen beschikbaar vanuit de Android-app.'})
                else:
                    try:
                        self.reply(200, system_control('status'))
                    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                        self.reply(503, {'error': str(error)})
            elif route == '/api/update/status':
                if self.headers.get('X-Darts-Control') != 'd7c87006c31f4da2a4348eeb05b59c8b':
                    self.reply(403, {'error': 'Alleen beschikbaar vanuit de Android-app.'})
                else:
                    status_path = root / 'update-status.json'
                    value = json.loads(status_path.read_text(encoding='utf-8')) if status_path.exists() else {
                        'state': 'idle', 'version': (root / '.version').read_text().strip() if (root / '.version').exists() else 'onbekend',
                        'message': 'Nog niet op updates gecontroleerd.'}
                    self.reply(200, value)
            elif route == '/api/display':
                with lock:
                    self.reply(200, display)
            elif route == '/api/venue':
                with lock:
                    value = dict(venue)
                    # Large background photos are unnecessary on the phone over
                    # Bluetooth; the small logo and all textual branding still sync.
                    if self.headers.get('X-Darts-Transport') == 'bluetooth':
                        value.update(backgroundData='')
                    self.reply(200, value)
            elif route == '/api/setup':
                with lock:
                    self.reply(200, {**shared_setup, 'revision': current['revision']})
            elif route == '/api/players':
                with lock:
                    combined = list(roster)
                    combined.extend(name for name in mobile_roster
                                    if not any(existing.casefold() == name.casefold() for existing in combined))
                    self.reply(200, {'players': combined, 'venuePlayers': roster,
                                     'mobilePlayers': mobile_roster})
            elif route == '/api/state':
                with lock:
                    self.reply(200, {**current, 'draft': draft['value'] if time.monotonic()-draft['time'] < 180 else None})
            elif route == '/api/network':
                addresses = set()
                try:
                    result = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=2)
                    addresses.update(a for a in result.stdout.split() if ':' not in a and not a.startswith('127.'))
                except (OSError, subprocess.SubprocessError):
                    try:
                        addresses.update(socket.gethostbyname_ex(socket.gethostname())[2])
                    except OSError:
                        pass
                self.reply(200, {'urls': [f'http://{a}:{port}' for a in sorted(addresses)]})
            elif route.startswith('/api/'):
                self.reply(404, {'error': 'Onbekend verzoek'})
            else:
                super().do_GET()

        def do_POST(self):
            nonlocal last_kiosk
            if self.path not in ('/api/setup', '/api/display', '/api/venue', '/api/state', '/api/draft', '/api/players', '/api/mobile-players', '/api/kiosk/open', '/api/network/switch', '/api/network/add', '/api/system/action', '/api/update/check'):
                return self.reply(404, {'error': 'Onbekend verzoek'})
            origin = self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                return self.reply(403, {'error': 'Ongeldige herkomst'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.reply(415, {'error': 'JSON nodig'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 10000000:
                    return self.reply(413, {'error': 'Partij te groot'})
                incoming = json.loads(self.rfile.read(length))
                if self.path == '/api/venue':
                    if self.client_address[0] not in ('127.0.0.1', '::1') and self.headers.get('X-Darts-Control') != CONTROL_TOKEN:
                        return self.reply(403, {'error': 'Locatie-instellingen kunnen alleen op de NUC of in de Android-app worden gewijzigd.'})
                    updated = clean_venue(incoming)
                    with lock:
                        temporary = venue_path.with_suffix('.tmp')
                        temporary.write_text(json.dumps(updated, ensure_ascii=False), encoding='utf-8')
                        temporary.replace(venue_path)
                        venue.clear(); venue.update(updated)
                        return self.reply(200, venue)
                if self.path == '/api/update/check':
                    if self.headers.get('X-Darts-Control') != 'd7c87006c31f4da2a4348eeb05b59c8b':
                        return self.reply(403, {'error': 'Alleen beschikbaar vanuit de Android-app.'})
                    if incoming != {}:
                        return self.reply(400, {'error': 'Ongeldig updateverzoek.'})
                    result = subprocess.run(['systemctl', '--user', 'start', '--no-block', 'oche-darts-update.service'],
                                            capture_output=True, text=True, timeout=4)
                    if result.returncode:
                        return self.reply(503, {'error': 'NUC-update kon niet worden gestart.'})
                    return self.reply(202, {'message': 'NUC controleert GitHub op updates.'})
                if self.path == '/api/system/action':
                    if self.headers.get('X-Darts-Control') != 'd7c87006c31f4da2a4348eeb05b59c8b':
                        return self.reply(403, {'error': 'Alleen beschikbaar vanuit de Android-app.'})
                    if not isinstance(incoming, dict) or set(incoming) != {'action'}:
                        return self.reply(400, {'error': 'Ongeldige NUC-actie.'})
                    try:
                        return self.reply(202, system_control(incoming['action']))
                    except ValueError as error:
                        return self.reply(400, {'error': str(error)})
                    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                        return self.reply(503, {'error': str(error)})
                if self.path == '/api/setup':
                    value = incoming.get('value')
                    if value is not None:
                        if not isinstance(value, dict) or value.get('selected') not in ('x01','cricket','tactics','121','gotcha','bobs27','tenlives') or type(value.get('step')) is not int or not 0 <= value['step'] <= 2:
                            raise ValueError()
                        if not isinstance(value.get('names'), list) or not 1 <= len(value['names']) <= 4 or any(not isinstance(n, str) or len(n) > 24 for n in value['names']):
                            raise ValueError()
                        if not isinstance(value.get('values'), dict) or len(value['values']) > 20 or any(not isinstance(v, str) or len(v) > 80 for v in value['values'].values()):
                            raise ValueError()
                    with lock:
                        if incoming.get('revision') != current['revision']:
                            return self.reply(409, {'revision': current['revision']})
                        shared_setup.update(version=shared_setup['version']+1, value=value)
                        self.reply(200, shared_setup)
                    return
                if self.path == '/api/display':
                    if not isinstance(incoming, dict) or not incoming or not set(incoming) <= {'inputCollapsed', 'screensaverActive'} or any(type(value) is not bool for value in incoming.values()):
                        return self.reply(400, {'error': 'Ongeldige scherminstelling'})
                    with lock:
                        temporary = display_path.with_suffix('.tmp')
                        temporary.write_text(json.dumps({**display, **incoming}), encoding='utf-8')
                        temporary.replace(display_path)
                        display.update(incoming)
                        self.reply(200, display)
                    return
                if self.path == '/api/network/switch':
                    if not isinstance(incoming, dict) or set(incoming) != {'uuid'}:
                        return self.reply(400, {'error': 'Kies een opgeslagen wifi-netwerk.'})
                    try:
                        result = network_control('switch', incoming['uuid'])
                    except ValueError:
                        return self.reply(400, {'error': 'Kies een opgeslagen wifi-netwerk.'})
                    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                        message = str(error) if isinstance(error, RuntimeError) else 'Omschakelen kon niet worden gestart.'
                        return self.reply(503, {'error': message})
                    return self.reply(202, result)
                if self.path == '/api/network/add':
                    if self.headers.get('X-Darts-Control') != CONTROL_TOKEN:
                        return self.reply(403, {'error': 'Voeg een netwerk toe vanuit de Android-app.'})
                    if not isinstance(incoming, dict) or set(incoming) != {'ssid', 'password'}:
                        return self.reply(400, {'error': 'Vul een netwerknaam en wachtwoord in.'})
                    try:
                        result = network_control('add-wifi', payload=incoming)
                        with lock:
                            updated = {**venue, 'clubWifiName': result['name'],
                                       'clubWifiQr': wifi_qr(result['name'], incoming['password'])}
                            temporary = venue_path.with_suffix('.tmp')
                            temporary.write_text(json.dumps(updated, ensure_ascii=False), encoding='utf-8')
                            temporary.replace(venue_path)
                            venue.clear(); venue.update(updated)
                    except ValueError as error:
                        return self.reply(400, {'error': str(error)})
                    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                        return self.reply(503, {'error': str(error)})
                    return self.reply(201, result)
                if self.path == '/api/kiosk/open':
                    if incoming != {}:
                        return self.reply(400, {'error': 'Ongeldig startverzoek'})
                    with kiosk_lock:
                        if time.monotonic() - last_kiosk < 5:
                            return self.reply(429, {'error': 'Wacht enkele seconden en probeer opnieuw.'})
                        last_kiosk = time.monotonic()
                        try:
                            message = open_kiosk(root)
                        except (RuntimeError, OSError, subprocess.SubprocessError) as error:
                            message = str(error) if isinstance(error, RuntimeError) else 'De app kon niet worden geopend op de NUC.'
                            return self.reply(503, {'error': message})
                        return self.reply(200, {'message': message})
                if self.path == '/api/players':
                    if self.client_address[0] not in ('127.0.0.1', '::1'):
                        return self.reply(403, {'error': f"De {venue['playerListName']}-lijst kan alleen op de NUC worden gewijzigd."})
                    name = incoming['name']
                    action = incoming['action']
                    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 24 or action not in ('add', 'remove'):
                        raise ValueError()
                    name = name.strip()
                    with lock:
                        updated = list(roster)
                        if action == 'add':
                            if not any(n.casefold() == name.casefold() for n in updated):
                                updated.append(name)
                        else:
                            updated = [n for n in updated if n.casefold() != name.casefold()]
                        updated.sort(key=str.casefold)
                        temporary = roster_path.with_suffix('.tmp')
                        temporary.write_text(json.dumps(updated, ensure_ascii=False), encoding='utf-8')
                        temporary.replace(roster_path)
                        roster[:] = updated
                        combined = list(roster)
                        combined.extend(n for n in mobile_roster
                                        if not any(existing.casefold() == n.casefold() for existing in combined))
                        return self.reply(200, {'players': combined, 'venuePlayers': roster,
                                                'mobilePlayers': mobile_roster})
                if self.path == '/api/mobile-players':
                    names = incoming['players']
                    if not isinstance(names, list) or len(names) > 200:
                        raise ValueError()
                    updated = []
                    for name in names:
                        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 24:
                            raise ValueError()
                        name = name.strip()
                        if not any(existing.casefold() == name.casefold() for existing in updated):
                            updated.append(name)
                    updated.sort(key=str.casefold)
                    with lock:
                        temporary = mobile_roster_path.with_suffix('.tmp')
                        temporary.write_text(json.dumps(updated, ensure_ascii=False), encoding='utf-8')
                        temporary.replace(mobile_roster_path)
                        mobile_roster[:] = updated
                        combined = list(roster)
                        combined.extend(n for n in mobile_roster
                                        if not any(existing.casefold() == n.casefold() for existing in combined))
                        return self.reply(200, {'players': combined, 'venuePlayers': roster,
                                                'mobilePlayers': mobile_roster})
                if self.path == '/api/draft':
                    hits = incoming['hits']
                    entry = incoming.get('entry', '')
                    if not isinstance(entry, str) or len(entry) > 3 or any(c not in '0123456789' for c in entry) or (entry and hits):
                        raise ValueError()
                    owner, seq = incoming['owner'], incoming['seq']
                    if not isinstance(owner, str) or not 1 <= len(owner) <= 80 or type(seq) is not int:
                        raise ValueError()
                    if not isinstance(hits, list) or len(hits) > 3:
                        raise ValueError()
                    for hit in hits:
                        if type(hit['number']) is not int or hit['number'] not in [0, *range(1,21), 25] or type(hit['mult']) is not int or hit['mult'] not in (1,2,3) or (hit['number'] == 25 and hit['mult'] == 3):
                            raise ValueError()
                    with lock:
                        if incoming['revision'] != current['revision']:
                            return self.reply(409, current)
                        state = (current['match'] or {}).get('state', {})
                        if state.get('game') not in ('x01','cricket','tactics','gotcha','bobs27','tenlives') or state.get('phase') != 'playing':
                            return self.reply(409, current)
                        if seq <= sequences.get(owner, -1):
                            return self.reply(200, {'ok': True})
                        sequences[owner] = seq
                        draft['value'] = {'owner': owner, 'hits': hits, 'entry': entry, 'revision': current['revision']}
                        draft['time'] = time.monotonic()
                        return self.reply(200, {'ok': True})
                match = incoming['match']
                if not isinstance(match, dict) or not isinstance(match.get('undo'), list):
                    raise ValueError()
                state = match['state']
                if state.get('version') != 2 or not 1 <= len(state['players']) <= 4:
                    raise ValueError()
                restored = match.get('editTurn')
                if restored is not None:
                    if not isinstance(restored, dict):
                        raise ValueError()
                    if 'hits' in restored:
                        hits = restored['hits']
                        if not isinstance(hits, list) or not 1 <= len(hits) <= 3:
                            raise ValueError()
                        for hit in hits:
                            if type(hit['number']) is not int or hit['number'] not in [0, *range(1,21), 25] or type(hit['mult']) is not int or hit['mult'] not in (1,2,3) or (hit['number'] == 25 and hit['mult'] == 3):
                                raise ValueError()
                    elif type(restored.get('score')) is not int or not 0 <= restored['score'] <= 180:
                        raise ValueError()
                with lock:
                    if incoming['revision'] != current['revision']:
                        return self.reply(409, current)
                    if current['match'] is None and self.client_address[0] not in ('127.0.0.1', '::1'):
                        return self.reply(403, {'error': 'Start de eerste partij op het NUC-scherm'})
                    updated = {'revision': current['revision'] + 1, 'match': match}
                    encoded = json.dumps(updated, allow_nan=False)
                    temporary = path.with_suffix('.tmp')
                    temporary.write_text(encoded, encoding='utf-8')
                    temporary.replace(path)
                    current.update(updated)
                    shared_setup.update(version=shared_setup['version']+1, value=None)
                    restored = match.get('editTurn') or {}
                    hits = restored.get('hits')
                    draft['value'] = {'owner': 'restored-turn', 'hits': hits, 'revision': current['revision']} if hits else None
                    draft['time'] = time.monotonic()
                    sequences.clear()
                    self.reply(200, current)
            except (ValueError, KeyError, TypeError, AttributeError):
                self.reply(400, {'error': 'Ongeldige partij'})
            except OSError:
                self.reply(500, {'error': 'Opslaan op de NUC mislukt'})

    print(f'Oche Darts Touch: http://{host}:{port}', flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--data-file')
    args = parser.parse_args()
    serve(args.host, args.port, args.data_file)
