#!/usr/bin/env python3
"""Relaunch the dedicated browser in kiosk or mouse-friendly windowed mode."""
from pathlib import Path
import fcntl
import os
import shutil
import signal
import subprocess
import sys
import time


SCRIPT = Path(__file__).resolve()
ROOT = SCRIPT.parent.parent if SCRIPT.parent.name == 'dist' else SCRIPT.parent
MARKER = ROOT / '.windowed-mode'
LOCK = ROOT / '.kiosk-switch.lock'
LAUNCHER = ROOT / 'start-kiosk.sh'


def browser():
    for name in ('google-chrome', 'chromium', 'chromium-browser', 'firefox'):
        found = shutil.which(name)
        if found: return found
    raise RuntimeError('Geen geschikte browser gevonden.')


def profile(executable):
    if 'chromium' in executable and (executable.startswith('/snap/') or shutil.which('snap')):
        return Path.home() / 'snap/chromium/common/oche-profile'
    return ROOT / 'browser-profile'


def disable_desktop_keyboard():
    """Keep the dedicated NUC screen free of the GNOME popup keyboard."""
    executable = shutil.which('gsettings')
    if not executable:
        return
    subprocess.run([executable, 'set', 'org.gnome.desktop.a11y.applications',
                    'screen-keyboard-enabled', 'false'], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)


def browser_processes():
    profile_markers = ('oche-darts/browser-profile', 'snap/chromium/common/oche-profile')
    for process in Path('/proc').glob('[0-9]*'):
        try:
            command = (process / 'cmdline').read_bytes().decode().replace('\0', ' ')
        except (OSError, UnicodeError):
            continue
        if '--type=' in command or not any(marker in command for marker in profile_markers):
            continue
        if 'chrome' in command or 'chromium' in command or 'firefox' in command:
            yield int(process.name)


def install_launcher():
    helper = ROOT / 'kiosk-control.py'
    if not helper.is_file(): helper = SCRIPT
    content = '#!/usr/bin/env bash\nexec /usr/bin/python3 ' + repr(str(helper)) + ' launch\n'
    temporary = LAUNCHER.with_suffix('.next')
    temporary.write_text(content, encoding='utf-8')
    temporary.chmod(0o755)
    temporary.replace(LAUNCHER)


def launch():
    executable = browser()
    disable_desktop_keyboard()
    for _ in range(30):
        try:
            from urllib.request import urlopen
            urlopen('http://127.0.0.1:8765', timeout=1).close()
            break
        except OSError:
            time.sleep(1)
    if 'firefox' in executable:
        arguments = [executable, '--new-window' if MARKER.exists() else '--kiosk',
                     'http://127.0.0.1:8765']
    else:
        browser_profile = profile(executable)
        browser_profile.mkdir(parents=True, exist_ok=True)
        arguments = [executable, '--start-maximized' if MARKER.exists() else '--kiosk',
                     '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
                     '--disable-virtual-keyboard',
                     '--lang=nl', '--password-store=basic',
                     '--user-data-dir=' + str(browser_profile), 'http://127.0.0.1:8765']
    os.execvpe(executable, arguments, os.environ.copy())


def switch(mode):
    with LOCK.open('w') as lock:
        # Een tweede muisklik wacht kort op de lopende herstart in plaats van
        # stil te mislukken terwijl Chrome nog afsluit.
        fcntl.flock(lock, fcntl.LOCK_EX)
        if mode == 'windowed': MARKER.write_text('Bediening met muis\n', encoding='utf-8')
        else: MARKER.unlink(missing_ok=True)
        install_launcher()
        time.sleep(1.2)
        processes = list(browser_processes())
        for pid in processes:
            try: os.kill(pid, signal.SIGTERM)
            except ProcessLookupError: pass
        deadline = time.monotonic() + 5
        while any(Path('/proc', str(pid)).exists() for pid in processes) and time.monotonic() < deadline:
            time.sleep(.15)
        helper = ROOT / 'kiosk-control.py'
        if not helper.is_file(): helper = SCRIPT
        with (ROOT / 'kiosk-switch.log').open('ab') as log:
            subprocess.Popen([sys.executable, str(helper), 'launch'], stdin=subprocess.DEVNULL,
                             stdout=log, stderr=log, start_new_session=True, env=os.environ.copy())


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('kiosk', 'windowed', 'launch'):
        raise SystemExit('Gebruik kiosk, windowed of launch.')
    launch() if sys.argv[1] == 'launch' else switch(sys.argv[1])
