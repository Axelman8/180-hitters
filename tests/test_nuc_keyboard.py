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

with tempfile.TemporaryDirectory() as temporary:
    proc=Path(temporary)
    commands={
        101:'chromium --kiosk --user-data-dir=/home/autodarts/snap/chromium/common/180-hitters-profile',
        102:'chromium --kiosk --user-data-dir=/home/autodarts/snap/chromium/common/oche-profile',
        103:'chromium --user-data-dir=/home/autodarts/other-browser',
        104:'chromium --type=renderer --user-data-dir=/home/autodarts/snap/chromium/common/180-hitters-profile',
    }
    for pid,command in commands.items():
        folder=proc/str(pid);folder.mkdir();(folder/'cmdline').write_bytes(command.encode())
    with patch.object(kiosk,'Path',side_effect=lambda value:proc if value=='/proc' else Path(value)):
        assert set(kiosk.browser_processes())=={101,102},'Switching must close both app profiles and preserve unrelated browsers'

with tempfile.TemporaryDirectory() as temporary, patch.object(Path,'home',return_value=Path(temporary)):
    common=Path(temporary)/'snap/chromium/common'
    assert kiosk.profile('/snap/bin/chromium')==common/'oche-profile'
    (common/'180-hitters-profile').mkdir(parents=True)
    assert kiosk.profile('/snap/bin/chromium')==common/'180-hitters-profile','Keep using the profile configured by the NUC autostart'

updater = (root / 'nuc-update.py').read_text(encoding='utf-8')
assert "str(helper), 'install'" in updater
switch_source = (root / 'server.py').read_text(encoding='utf-8').split('def switch_kiosk', 1)[1].split('def open_kiosk', 1)[0]
assert 'not launcher.is_file()' not in switch_source
assert "update.request').touch()" in (root / 'server.py').read_text(encoding='utf-8')
assert 'NoNewPrivileges=false' in (root / 'packaging' / 'build-deb.py').read_text(encoding='utf-8')
assert 'dartsapp.service.d/desktop-control.conf' in (root / 'nuc-update.py').read_text(encoding='utf-8')

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
