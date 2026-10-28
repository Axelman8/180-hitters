from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    process = subprocess.Popen(
        [sys.executable, str(root / 'server.py'), '--host', '127.0.0.1', '--port', '8800',
         '--data-file', str(Path(tmp) / 'match.json')],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(.8)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1080, 'height': 1920})
            chosen = []
            page.route('**/api/display/orientation', lambda route: route.fulfill(
                status=200, content_type='application/json',
                body='{"orientation":"portrait-left","label":"Portrait linksom","output":"HDMI-1"}')
                if route.request.method == 'GET' else (
                    chosen.append(route.request.post_data_json['orientation']) or route.fulfill(
                        status=200, content_type='application/json',
                        body='{"orientation":"portrait-right","label":"Portrait rechtsom","output":"HDMI-1"}')))
            page.goto('http://127.0.0.1:8800/')
            page.get_by_text('Applicatie', exact=True).click()
            expect(page.locator('#screen-orientation')).to_be_visible()
            page.locator('#screen-orientation').click()
            expect(page.locator('#screen-orientation-dialog')).to_be_visible()
            expect(page.locator('#screen-orientation-current')).to_have_text('Actief: Portrait linksom')
            page.get_by_role('button', name='Portrait rechtsom').click()
            expect(page.locator('#screen-orientation-status')).to_have_text('Portrait rechtsom is ingesteld.')
            assert chosen == ['portrait-right']

            android = browser.new_page(viewport={'width': 393, 'height': 852})
            android.add_init_script("window.DartsAndroid={isLocalMode:()=>true,saveSnapshot:()=>{}}")
            android.goto('http://127.0.0.1:8800/?android=1')
            expect(android.locator('#screen-orientation')).to_have_count(0)
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=5)

print('PASS: three NUC screen orientations; Android orientation remains untouched')
