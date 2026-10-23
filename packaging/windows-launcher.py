"""Bundled Windows entry point; keep data outside installed program files."""
import ctypes
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import webbrowser
import server

URL = 'http://127.0.0.1:8765'


def ready():
    try:
        with urllib.request.urlopen(URL + '/api/state', timeout=1) as response:
            value = json.load(response)
            return isinstance(value, dict) and 'revision' in value and 'match' in value
    except Exception:
        return False


def main():
    data = Path(os.environ['LOCALAPPDATA']) / '180 Hitters'
    data.mkdir(parents=True, exist_ok=True)
    if '--server' in sys.argv:
        import logging
        from logging.handlers import RotatingFileHandler
        log = logging.getLogger('dartsapp')
        log.addHandler(RotatingFileHandler(data / 'server.log', maxBytes=1048576, backupCount=2))
        try:
            server.serve(data_file=str(data / 'match.json'))
        except Exception:
            log.exception('DartsApp kon niet starten')
            raise
        return
    if not ready():
        subprocess.Popen([sys.executable, '--server'], cwd=str(data),
                         creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            if ready(): break
            time.sleep(.1)
        else:
            ctypes.windll.user32.MessageBoxW(None,
                'DartsApp kon niet starten. Controleer of poort 8765 vrij is.\n'
                'Meer informatie: ' + str(data / 'server.log'), 'DartsApp', 16)
            return
    if '--background' not in sys.argv:
        webbrowser.open(URL)


if __name__ == '__main__':
    main()
