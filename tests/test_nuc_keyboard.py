from pathlib import Path


root = Path(__file__).resolve().parents[1]
helper = (root / 'dist' / 'kiosk-control.py').read_text(encoding='utf-8')
installer = (root / 'install-linux.sh').read_text(encoding='utf-8')

assert "screen-keyboard-enabled', 'false'" in helper
assert "'--disable-virtual-keyboard'" in helper
assert 'screen-keyboard-enabled false' in installer
assert '--disable-virtual-keyboard' in installer
assert 'disable-virtual-keyboard' not in (root / 'android' / 'app' / 'src' / 'main' / 'java' / 'nl' / 'axelman8' / 'darts' / 'MainActivity.java').read_text(encoding='utf-8')

print('PASS: popup keyboard disabled only by the NUC launchers')
