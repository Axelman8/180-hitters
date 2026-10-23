"""Desktop update selection, unavailable assets, errors and non-desktop hiding."""
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    process = subprocess.Popen([sys.executable, str(root / 'server.py'), '--port', '8789',
                                '--data-file', str(Path(tmp) / 'match.json')],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for platform in ('windows', 'linux'):
                page = browser.new_page()
                page.route('**/api/desktop-installation', lambda route: route.fulfill(json={'platform': platform, 'version': '1.8.12'}))
                asset = 'DartsApp-Setup-Windows-x64.exe' if platform == 'windows' else 'DartsApp-Ubuntu-Debian-amd64.deb'
                release = {'tag_name': 'v1.8.13', 'assets': [{'name': asset, 'state': 'uploaded'}]}
                page.route('https://api.github.com/**', lambda route: route.fulfill(json=release))
                page.goto('http://127.0.0.1:8789/')
                def open_update():
                    page.get_by_text('Instellingen', exact=True).click()
                    page.locator('#desktop-update-action').click()
                open_update()
                dialog = page.locator('#desktop-update-dialog')
                expect(dialog).to_be_visible()
                expect(dialog.locator('a')).to_have_attribute('href', f'https://github.com/Axelman8/180-hitters/releases/download/v1.8.13/{asset}')
                expect(dialog.locator('a')).to_be_visible()
                dialog.get_by_text('Sluiten', exact=True).click()
                release['tag_name'] = 'v1.8.12'
                open_update()
                expect(dialog).to_contain_text('up-to-date')
                expect(dialog.locator('a')).to_be_hidden()
                dialog.get_by_text('Sluiten', exact=True).click()
                release['tag_name'] = 'v1.8.13'
                release['assets'] = []
                open_update()
                expect(dialog).to_contain_text('niet gelukt')
                expect(dialog.locator('a')).to_be_hidden()
                dialog.get_by_text('Sluiten', exact=True).click()
                page.unroute('https://api.github.com/**')
                page.route('https://api.github.com/**', lambda route: route.abort())
                open_update()
                expect(dialog).to_contain_text('niet gelukt')
                page.close()
            page = browser.new_page()
            page.goto('http://127.0.0.1:8789/')
            page.wait_for_timeout(300)
            expect(page.locator('#desktop-update-action')).to_have_count(0)
            browser.close()
        print('Desktop updater UI: both platforms, up-to-date, missing asset, offline and NUC hiding passed.')
    finally:
        process.terminate()
        process.wait(timeout=5)
