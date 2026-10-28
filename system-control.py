#!/usr/bin/env python3
"""Small root-only allowlisted helper for NUC power and Bluetooth controls."""
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys


def active(unit):
    return subprocess.run(['systemctl', 'is-active', '--quiet', unit]).returncode == 0


def bluetooth_powered():
    result = subprocess.run(['bluetoothctl', 'show'], capture_output=True, text=True, timeout=5)
    return result.returncode == 0 and any(line.strip() == 'Powered: yes' for line in result.stdout.splitlines())


def wifi_powered():
    result = subprocess.run(['/usr/bin/nmcli', 'radio', 'wifi'], capture_output=True, text=True, timeout=5)
    return result.returncode == 0 and result.stdout.strip() == 'enabled'


def later(*command):
    subprocess.run(['systemd-run', '--quiet', '--on-active=2s', '--collect', *command], check=True)


def user_service(action):
    user = os.environ.get('SUDO_USER', 'autodarts')
    if user == 'dartsapp':
        subprocess.run(['/usr/bin/systemctl', action, 'dartsapp-bluetooth.service'], check=True)
        return
    account = pwd.getpwnam(user)
    subprocess.run(['/usr/sbin/runuser', '-u', user, '--', '/usr/bin/env',
                    f'XDG_RUNTIME_DIR=/run/user/{account.pw_uid}',
                    '/usr/bin/systemctl', '--user', action, 'oche-darts-bluetooth.service'], check=True)


def desktop_session():
    """Return the active local graphical account and its display environment."""
    sessions = subprocess.run(['/usr/bin/loginctl', 'list-sessions', '--no-legend', '--no-pager'],
                              capture_output=True, text=True, timeout=5, check=True)
    for line in sessions.stdout.splitlines():
        session = line.split()[0] if line.split() else ''
        if not session:
            continue
        details = subprocess.run(['/usr/bin/loginctl', 'show-session', session,
                                  '-p', 'Active', '-p', 'Remote', '-p', 'Type',
                                  '-p', 'User', '-p', 'Display'], capture_output=True,
                                 text=True, timeout=5, check=True)
        values = dict(item.partition('=')[::2] for item in details.stdout.splitlines() if '=' in item)
        if values.get('Active') != 'yes' or values.get('Remote') == 'yes' or values.get('Type') not in ('x11', 'wayland'):
            continue
        uid = int(values['User'])
        account = pwd.getpwuid(uid)
        runtime = Path('/run/user') / str(uid)
        display = values.get('Display') or (':0' if Path('/tmp/.X11-unix/X0').exists() else '')
        authorities = [runtime / 'gdm' / 'Xauthority', Path(account.pw_dir) / '.Xauthority']
        authorities.extend(sorted(runtime.glob('.mutter-Xwaylandauth.*')))
        authority = next((path for path in authorities if path.is_file()), None)
        if not display or authority is None:
            continue
        environment = {
            'HOME': account.pw_dir, 'USER': account.pw_name, 'LOGNAME': account.pw_name,
            'DISPLAY': display, 'XAUTHORITY': str(authority), 'XDG_RUNTIME_DIR': str(runtime),
            'DBUS_SESSION_BUS_ADDRESS': f'unix:path={runtime}/bus',
        }
        return account, environment
    raise RuntimeError('Meld de NUC eerst aan op het bureaublad.')


def kiosk_control(mode):
    account, environment = desktop_session()
    state = Path('/var/lib/dartsapp') / f'kiosk-{account.pw_uid}'
    state.mkdir(mode=0o755, parents=True, exist_ok=True)
    state.chmod(0o755)
    os.chown(state, account.pw_uid, account.pw_gid)
    environment['DARTS_KIOSK_STATE'] = str(state)
    helper = '/usr/lib/dartsapp/kiosk-control.py'
    command = ['/usr/sbin/runuser', '-u', account.pw_name, '--', '/usr/bin/env']
    command.extend(f'{key}={value}' for key, value in environment.items())
    command.extend(['/usr/bin/python3', helper, mode])
    if mode == 'launch':
        subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
    else:
        subprocess.run(command, check=True, timeout=10)
    return state


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('status', 'bluetooth-on', 'bluetooth-off', 'wifi-on', 'wifi-off', 'restart', 'shutdown', 'kiosk', 'windowed', 'kiosk-open', 'apply-bluetooth-on', 'apply-bluetooth-off', 'apply-wifi-on', 'apply-wifi-off'):
        raise SystemExit('Ongeldige actie')
    action = sys.argv[1]
    if action == 'apply-bluetooth-off':
        user_service('stop')
        subprocess.run(['bluetoothctl', 'power', 'off'], check=True)
        return
    if action == 'apply-bluetooth-on':
        subprocess.run(['systemctl', 'start', 'bluetooth.service'], check=True)
        subprocess.run(['bluetoothctl', 'power', 'on'], check=True)
        user_service('restart')
        return
    if action == 'apply-wifi-on':
        subprocess.run(['/usr/bin/nmcli', 'radio', 'wifi', 'on'], check=True)
        return
    if action == 'apply-wifi-off':
        subprocess.run(['/usr/bin/nmcli', 'radio', 'wifi', 'off'], check=True)
        return
    if action in ('kiosk', 'windowed', 'kiosk-open'):
        state = kiosk_control('launch' if action == 'kiosk-open' else action)
        print(json.dumps({'message': 'Kioskbediening gestart.',
                          'kiosk': not (state / '.windowed-mode').exists()}))
        return
    if action == 'bluetooth-on':
        later('/usr/local/sbin/darts-system', 'apply-bluetooth-on')
    elif action == 'bluetooth-off':
        later('/usr/local/sbin/darts-system', 'apply-bluetooth-off')
    elif action == 'wifi-on':
        later('/usr/local/sbin/darts-system', 'apply-wifi-on')
    elif action == 'wifi-off':
        later('/usr/local/sbin/darts-system', 'apply-wifi-off')
    elif action == 'restart':
        later('/usr/bin/systemctl', 'reboot')
    elif action == 'shutdown':
        later('/usr/bin/systemctl', 'poweroff')
    messages = {
        'bluetooth-on': 'Bluetooth is aangezet.',
        'bluetooth-off': 'Bluetooth wordt uitgezet.',
        'wifi-on': 'Wifi wordt aangezet.',
        'wifi-off': 'Wifi wordt uitgezet.',
        'restart': 'De NUC wordt opnieuw gestart.',
        'shutdown': 'De NUC wordt uitgezet.',
        'status': 'NUC-bediening beschikbaar.',
    }
    print(json.dumps({'message': messages[action], 'bluetooth': bluetooth_powered(),
                      'wifi': wifi_powered()}))


if __name__ == '__main__':
    main()
