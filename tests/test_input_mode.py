from ui_input import enter_total
"""Two real browser clients against an isolated server. Requires Python Playwright/Chromium."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect


def main():
    root = Path(__file__).resolve().parents[1]
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory() as temporary:
        server = subprocess.Popen([sys.executable, str(root / 'server.py'), '--host',
                                   '127.0.0.1', '--port', str(port), '--data-file',
                                   str(Path(temporary) / 'match.json')],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    with urlopen(url + '/api/state', timeout=1):
                        break
                except OSError:
                    time.sleep(.1)
            with sync_playwright() as p:
                browser = p.chromium.launch()
                desktop = browser.new_page(viewport={'width': 1080, 'height': 1920})
                phone = browser.new_page(viewport={'width': 390, 'height': 844})
                errors = []
                for page in (desktop, phone):
                    page.on('pageerror', lambda error: errors.append(str(error)))
                desktop.goto(url)
                phone.goto(url + '/?remote=1')

                def saved():
                    return desktop.request.get(url + '/api/state').json()

                def seed(start=501, options=None):
                    state = desktop.evaluate('''async ({start,options}) => {
                        const {newMatch}=await import('/engine.js');
                        return newMatch(['Axel','Remon'],start,'double',3,options);
                    }''', {'start': start, 'options': options or {}})
                    response = desktop.request.post(url + '/api/state', data={
                        'revision': saved()['revision'], 'match': {'state': state, 'undo': []}})
                    assert response.ok
                    for page in (desktop, phone):
                        page.reload()
                        expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
                    return state

                def check(mode):
                    for page in (desktop, phone):
                        expect(page.locator('#mode-' + mode)).to_have_class('selected')
                        expect(page.locator('#' + mode + '-input')).to_be_visible()

                original = seed()
                check('total')
                phone.locator('#mode-dart').click()
                check('dart')
                assert saved()['match']['state'] == original
                assert saved()['match']['undo'] == []
                desktop.locator('#mode-total').click()
                check('total')
                phone.reload()
                check('total')
                phone.locator('#mode-dart').click()
                check('dart')
                desktop.reload()
                check('dart')
                phone.locator('#board-keys').get_by_role('button', name='17', exact=True).click()
                expect(desktop.locator('#dart-slots span').first).to_have_text('17')
                desktop.locator('#mode-total').click()
                check('total')
                assert saved()['draft'] is None
                assert saved()['match']['state'] == original

                # The chosen mode stays selected near checkout and across turns.
                seed(170)
                check('total')
                phone.locator('#keypad').get_by_role('button', name='0', exact=True).click()
                phone.locator('#submit:visible, #confirm-total:visible').click()
                check('total')
                assert saved()['match']['state']['active'] == 1
                for start in (101,301,501,701,1001):
                    for options in ({}, {'inMode':'double'}, {'inMode':'master'}, {'bull':'50/50'}):
                        seed(start, options)
                        check('total')
                        enter_total(phone, '60')
                        phone.locator('#submit:visible, #confirm-total:visible').click()
                        expect(phone.locator('#entry')).to_have_text('0')
                        assert saved()['match']['state']['players'][0]['remaining']==start-60
                seed(301, {'training121':True})
                check('total')
                for options in ({'game':'tactics'}, {'game':'cricket'}, {'game':'gotcha'}):
                    seed(301, options)
                    expect(phone.locator('#mode-total')).to_have_class('selected')
                    expect(desktop.locator('#mode-total')).to_have_class('selected')
                seed(301)
                phone.locator('#mode-dart').click()
                check('dart')
                # Start a new X01 match through the real setup form.
                phone.locator('#settings').click()
                phone.locator('#new-match-confirm').click()
                phone.locator('.wizard-game').filter(has=phone.get_by_text('X01', exact=True)).click()
                phone.locator('.wizard-next').click()
                phone.locator('.wizard-next').click()
                check('dart')
                phone.reload()
                check('dart')
                phone.locator('#mode-total').click()
                check('total')
                engine_results=desktop.evaluate("async()=>{const {runTests}=await import('/tests/engine.test.js');return runTests()}")
                print('Engine tests:',engine_results['passed'])
                assert not errors, errors
                browser.close()
                print('PASS: bidirectional mode sync, reload, dart sync, unchanged scores, all X01 totals, saved preference, new match, and segment-based games')
        finally:
            server.terminate()
            server.wait(timeout=10)


if __name__ == '__main__':
    main()
