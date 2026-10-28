from pathlib import Path
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server as darts_server


with patch.object(darts_server.shutil, 'which', return_value='/usr/bin/xdotool'), \
     patch.object(darts_server, 'desktop_environment', return_value={'DISPLAY': ':0'}), \
     patch.object(darts_server.subprocess, 'run') as run:
    assert darts_server.control_mouse({'action': 'move', 'dx': 12, 'dy': -7}) == {'ok': True}
    assert run.call_args.args[0][-3:] == ['--', '12', '-7']
    with patch.object(darts_server, 'mouse_orientation', return_value='portrait-left'):
        darts_server.control_mouse({'action': 'move', 'dx': 12, 'dy': -7})
        assert run.call_args.args[0][-3:] == ['--', '7', '12']
    with patch.object(darts_server, 'mouse_orientation', return_value='portrait-right'):
        darts_server.control_mouse({'action': 'move', 'dx': 12, 'dy': -7})
        assert run.call_args.args[0][-3:] == ['--', '-7', '-12']
    darts_server.control_mouse({'action': 'click', 'button': 'double'})
    assert '--repeat' in run.call_args.args[0]
    for invalid in ({'action': 'move', 'dx': 999, 'dy': 0}, {'action': 'click', 'button': 'middle'},
                    {'action': 'key', 'value': 'Alt+F4'}):
        try:
            darts_server.control_mouse(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError('onveilige muisopdracht geaccepteerd')

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    process = subprocess.Popen([sys.executable, str(root / 'server.py'), '--host', '127.0.0.1',
                                '--port', '8797', '--data-file', str(Path(tmp) / 'match.json')],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 600, 'height': 1024})
            page.add_init_script("window.DartsAndroid={isTabletShell:true}")
            requests = []

            def mouse_request(route):
                requests.append(route.request.post_data_json)
                route.fulfill(status=200, content_type='application/json', body='{"ok":true}')

            page.route('**/api/mouse', mouse_request)
            page.goto('http://127.0.0.1:8797/?remote=1&android=1&transport=bluetooth')
            expect(page.locator('#mouse-control-open')).to_be_attached()
            assert page.locator('#mouse-control-open').evaluate("e=>e.closest('details').dataset.menu") == 'connections'
            page.locator('#mouse-control-open').evaluate('e=>e.click()')
            expect(page.locator('#mouse-control-dialog')).to_be_visible()
            page.get_by_role('button', name='Dubbelklik').click()
            page.get_by_role('button', name='Omlaag').click()
            assert requests == [{'action': 'click', 'button': 'double'}, {'action': 'scroll', 'amount': 3}]
            page.get_by_role('button', name='Sluiten').click()
            expect(page.locator('#mouse-control-dialog')).to_be_hidden()
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=5)

print('PASS: veilige NUC-muisbediening en tablet-touchpad')
