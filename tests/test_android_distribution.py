"""Smoke checks for the shared NUC/Android web bundle and APK download."""
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import sync_playwright, expect


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen(
        [sys.executable, str(root / 'server.py'), '--host', '127.0.0.1', '--port', '8791',
         '--data-file', str(Path(tmp) / 'match.json')],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={'width': 393, 'height': 750}, is_mobile=True, has_touch=True)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:8791/')
            expect(page.locator('#android-app-action')).to_be_visible()
            page.locator('#android-app-action').click()
            expect(page.locator('#android-download-dialog')).to_be_visible()
            expect(page.locator('#android-download-title')).to_have_text('180 Hitters voor Android')
            assert not errors, errors

            android = browser.new_page(viewport={'width': 980, 'height': 2050}, is_mobile=True, has_touch=True)
            android.add_init_script("""window.DartsAndroid={
                isLocalMode:()=>true, saveSnapshot:()=>{}, chooseMode:()=>{window.modeChooserOpened=true}
            };""")
            android.goto('http://127.0.0.1:8791/?android=1')
            expect(android.locator('#android-app-action')).to_have_text('Verbindingsmodus')
            expect(android.locator('#top-actions > #android-app-action')).to_have_count(1)
            expect(android.locator('#top-actions > #android-update-action')).to_have_count(1)
            expect(android.locator('#connection-status')).to_have_text('Lokaal op deze telefoon')
            android.locator('#android-app-action').click()
            assert android.evaluate('window.modeChooserOpened===true')
            assert android.evaluate('document.documentElement.scrollWidth<=innerWidth')
            browser.close()
            print('PASS: APK dialog, Android bridge, local status and Fold viewport')
    finally:
        server.terminate()
        server.wait(timeout=10)
