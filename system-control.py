#!/usr/bin/env python3
"""Small root-only allowlisted helper for NUC power and Bluetooth controls."""
import json
import os
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
    account = pwd.getpwnam(user)
    subprocess.run(['/usr/sbin/runuser', '-u', user, '--', '/usr/bin/env',
                    f'XDG_RUNTIME_DIR=/run/user/{account.pw_uid}',
                    '/usr/bin/systemctl', '--user', action, 'oche-darts-bluetooth.service'], check=True)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('status', 'bluetooth-on', 'bluetooth-off', 'wifi-on', 'wifi-off', 'restart', 'shutdown', 'apply-bluetooth-on', 'apply-bluetooth-off', 'apply-wifi-on', 'apply-wifi-off'):
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
