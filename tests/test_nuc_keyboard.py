from pathlib import Path
import importlib.util
import os
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
helper = (root / 'dist' / 'kiosk-control.py').read_text(encoding='utf-8')
installer = (root / 'install-linux.sh').read_text(encoding='utf-8')

assert "screen-keyboard-enabled', 'false'" in helper
assert "'--disable-virtual-keyboard'" in helper
assert 'screen-keyboard-enabled false' in installer
assert '--disable-virtual-keyboard' in installer
assert 'disable-virtual-keyboard' not in (root / 'android' / 'app' / 'src' / 'main' / 'java' / 'nl' / 'axelman8' / 'darts' / 'MainActivity.java').read_text(encoding='utf-8')

if os.name == 'nt': sys.modules['fcntl'] = SimpleNamespace()
spec = importlib.util.spec_from_file_location('kiosk_control', root / 'dist' / 'kiosk-control.py')
kiosk = importlib.util.module_from_spec(spec); spec.loader.exec_module(kiosk)
with tempfile.TemporaryDirectory() as temporary:
    kiosk.ROOT = Path(temporary)
    kiosk.LAUNCHER = kiosk.ROOT / 'start-kiosk.sh'
    kiosk.install_launcher()
    assert kiosk.LAUNCHER.is_file()
    assert 'kiosk-control.py' in kiosk.LAUNCHER.read_text(encoding='utf-8')

updater = (root / 'nuc-update.py').read_text(encoding='utf-8')
assert "str(helper), 'install'" in updater
switch_source = (root / 'server.py').read_text(encoding='utf-8').split('def switch_kiosk', 1)[1].split('def open_kiosk', 1)[0]
assert 'not launcher.is_file()' not in switch_source
assert "update.request').touch()" in (root / 'server.py').read_text(encoding='utf-8')

with tempfile.TemporaryDirectory() as temporary:
    authority = Path(temporary) / 'Xauthority'
    authority.write_text('test', encoding='utf-8')
    failed = SimpleNamespace(returncode=1, stdout='', stderr='no user manager')
    with patch.dict(os.environ, {'DISPLAY': ':0', 'XAUTHORITY': str(authority)}, clear=True), \
         patch.object(__import__('server').subprocess, 'run', return_value=failed):
        recovered = __import__('server').desktop_environment()
    assert recovered['DISPLAY'] == ':0'
    assert recovered['XAUTHORITY'] == str(authority)

print('PASS: popup keyboard disabled only by NUC launchers and missing kiosk launcher repairs itself')
