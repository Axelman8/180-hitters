"""Real detector queue + NUC/controller UI: choose sB after throwing all darts."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, mimetypes, os, re, subprocess, sys, tempfile, threading, time
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
URL = 'http://127.0.0.1:8857'


def snapshot(hits):
    return {'running': True, 'status': 'Takeout' if len(hits) == 3 else 'Throw',
            'numThrows': len(hits), 'throws': [
                {'segment': {'number': n, 'multiplier': m}} for n, m in hits]}


class Detector(BaseHTTPRequestHandler):
    value = snapshot([])

    def log_message(self, *args): pass

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(self.value if self.path == '/api/state' else {}).encode())


def wait(predicate):
    until = time.monotonic() + 10
    while time.monotonic() < until:
        if predicate(): return
        time.sleep(.08)
    raise AssertionError('Timed out waiting for detector / match state')


mock = ThreadingHTTPServer(('127.0.0.1', 0), Detector)
threading.Thread(target=mock.serve_forever, daemon=True).start()
with tempfile.TemporaryDirectory() as folder:
    process = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), '--host', '127.0.0.1',
                                '--port', '8857', '--data-file', str(Path(folder) / 'match.json')],
                               env={**os.environ, 'DARTS_AUTODARTS_URL': f'http://127.0.0.1:{mock.server_port}'},
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={'width': 393, 'height': 852})
            if ASSETS:
                def legacy(route):
                    path = unquote(urlsplit(route.request.url).path)
                    file = (ASSETS / (path.lstrip('/') or 'index.html')).resolve()
                    if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():
                        route.fulfill(path=file, content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
                    else: route.fallback()
                context.route(URL + '/**', legacy)
            screen = browser.new_page(viewport={'width': 1280, 'height': 900})
            phone = context.new_page()
            errors = []
            for page in [screen, phone]:
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(URL + ('/?remote=1' if page == phone else '/'))
                expect(page.locator('#header-menu')).to_be_visible()
                page.locator('#navigation-close').click()
            api = screen.request
            get = lambda: api.get(URL + '/api/state').json()
            cam = lambda: api.get(URL + '/api/autoscoring').json()
            lost_response = []
            def lose_first_choice_receipt(route):
                data = route.request.post_data_json
                if data.get('bullChoice') and not lost_response:
                    route.fetch().dispose()  # Applied by the NUC; receipt lost over the link.
                    lost_response.append(True)
                    route.abort('failed')
                else: route.continue_()
            phone.route('**/api/draft', lose_first_choice_receipt)

            def setup(owners=None):
                Detector.value = snapshot([])
                state = screen.evaluate("""async()=>{const {newMatch}=await import('/engine.js');
                    return newMatch(['Anna','Bert'],0,'single',1,{game:'fourinarow'});}""")
                for cell, owner in (owners or {}).items(): state['fourOwners'][cell] = owner
                assert api.post(URL + '/api/state', data={'revision': get()['revision'], 'match': {'state': state, 'undo': []}}).ok
                expect(phone.locator('.four-board')).to_be_visible()
                wait(lambda: cam()['connected'])
                assert api.post(URL + '/api/autoscoring', data={'enabled': True, 'recording': False}).ok
                wait(lambda: cam()['armed'])
                return state

            # All three physical darts arrive before any user choice.
            state = setup({0: 1})
            Detector.value = snapshot([(25, 1), (20, 3), (25, 1)])
            wait(lambda: len((get().get('draft') or {}).get('hits', [])) == 3)
            expect(phone.locator('.bull-choice')).to_have_count(3)
            expect(screen.locator('.bull-choice')).to_have_count(3)
            for page in [screen, phone]:
                expect(page.locator('.four-cell[data-cell="0"]')).not_to_have_class(re.compile('bull-choice'))
                expect(page.locator('.four-cell[data-kind="number"]').first).to_be_disabled()
                expect(page.locator('.four-bull-choice-note')).to_contain_text('Pijl 1')
            hits = get()['draft']['hits']
            assert [hit['number'] for hit in hits] == [25, 20, 25]
            assert [bool(hit.get('needsBullCorner')) for hit in hits] == [True, False, True]
            assert not get()['match']['state']['history']
            # Stale clients may resolve a known dart, but never another visit
            # or an occupied corner. Rejection preserves all physical darts.
            for cell, turns in [(0, state['turns']), (4, state['turns'] + 1)]:
                refused = api.post(URL + '/api/draft', data={
                    'revision': 0, 'owner': 'stale-test', 'seq': 1, 'hits': [], 'entry': '',
                    'bullChoice': {'index': 0, 'cell': cell, 'startedAt': state['startedAt'],
                                   'turns': turns, 'active': state['active']}})
                assert refused.status == 409
                assert len(get()['draft']['hits']) == 3
            # Removal may happen before the choices too; it must not reset the detector.
            Detector.value = snapshot([])
            wait(lambda: (cam().get('pending') or {}).get('kind') == 'removed')
            phone.wait_for_timeout(550)
            assert cam()['armed'] and cam()['enabled'], cam()
            assert len(get()['draft']['hits']) == 3
            (ROOT / '.repair-check').mkdir(exist_ok=True)
            screen.screenshot(path=str(ROOT / '.repair-check/bull-choice-nuc.png'))
            phone.screenshot(path=str(ROOT / '.repair-check/bull-choice-controller.png'))
            phone.locator('.four-cell[data-cell="24"]').click()
            expect(phone.locator('.bull-choice')).to_have_count(2)
            assert lost_response == [True]
            expect(phone.locator('.four-bull-choice-note')).to_contain_text('Pijl 3')
            assert cam()['armed'] and cam()['enabled'], cam()
            assert get()['draft']['hits'][0]['cell'] == 24
            assert get()['draft']['hits'][1]['number'] == 20
            phone.locator('.four-cell[data-cell="4"]').click()
            wait(lambda: len(get()['match']['state']['history']) == 1)
            saved = get()['match']['state']
            assert saved['active'] == 1 and saved['history'][0]['darts'] == 3
            assert saved['fourOwners'][0] == 1
            assert saved['fourOwners'][4] == saved['fourOwners'][24] == 0
            assert saved['fourOwners'][state['fourBoard'].index('n20')] == 0
            expect(phone.locator('.bull-choice')).to_have_count(0)

            # Choosing during the visit must also retain the next live darts.
            state = setup()
            Detector.value = snapshot([(25, 1)])
            wait(lambda: len((get().get('draft') or {}).get('hits', [])) == 1)
            expect(phone.locator('.bull-choice')).to_have_count(4)
            phone.locator('.four-cell[data-cell="4"]').click()
            wait(lambda: (get().get('draft') or {}).get('hits', [{}])[0].get('cell') == 4)
            Detector.value = snapshot([(25, 1), (20, 3), (19, 1)])
            wait(lambda: len(get()['match']['state']['history']) == 1)
            assert get()['match']['state']['history'][0]['darts'] == 3
            assert get()['match']['state']['history'][0]['score'] == 104

            # Three separate choices can be made after all three bulls arrived.
            setup()
            Detector.value = snapshot([(25, 1)] * 3)
            wait(lambda: len((get().get('draft') or {}).get('hits', [])) == 3)
            for index, cell in enumerate([24, 20, 4]):
                expect(phone.locator('.bull-choice')).to_have_count(4 - index)
                phone.locator(f'.four-cell[data-cell="{cell}"]').click()
            wait(lambda: len(get()['match']['state']['history']) == 1)
            assert get()['match']['state']['history'][0]['score'] == 75
            assert all(get()['match']['state']['fourOwners'][cell] == 0 for cell in [24, 20, 4])

            # With one corner left, only the first of three bulls needs a choice.
            setup({0: 1, 4: 1, 24: 1})
            Detector.value = snapshot([(25, 1)] * 3)
            wait(lambda: len((get().get('draft') or {}).get('hits', [])) == 3)
            expect(phone.locator('.bull-choice')).to_have_count(1)
            assert get()['match']['state']['fourOwners'][20] is None
            phone.locator('.four-cell[data-cell="20"]').click()
            wait(lambda: len(get()['match']['state']['history']) == 1)
            assert get()['match']['state']['fourOwners'][20] == 0

            # A delayed choice may reveal a one-dart win; later darts are ignored.
            setup({1: 0, 2: 0, 3: 0})
            Detector.value = snapshot([(25, 1), (20, 1), (19, 1)])
            wait(lambda: len((get().get('draft') or {}).get('hits', [])) == 3)
            expect(phone.locator('.bull-choice')).to_have_count(4)
            phone.locator('.four-cell[data-cell="0"]').click()
            wait(lambda: get()['match']['state']['phase'] == 'won')
            assert get()['match']['state']['history'][0]['darts'] == 1
            assert get()['match']['state']['winner'] == 0
            expect(phone.locator('#result-dialog #result-title')).to_contain_text('Anna wint')
            assert not errors, errors
            browser.close()
            print('PASS', 'legacy controller' if ASSETS else 'modern controller',
                  'three live darts before choice, glowing free corners, removal safety, multiple bulls, last corner and winning dart')
    finally:
        process.terminate()
        process.wait()
        mock.shutdown()
