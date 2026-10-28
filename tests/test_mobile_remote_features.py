from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    process = subprocess.Popen([sys.executable, str(root / 'server.py'), '--host', '127.0.0.1',
                                '--port', '8798', '--data-file', str(Path(tmp) / 'match.json')],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 393, 'height': 852}, has_touch=True)
            page.add_init_script("""
                window.modeChosen=false; window.updateChosen=false; window.repaired=false;
                window.DartsAndroid={
                  isLocalMode:()=>false,getConnectionMode:()=>'bluetooth',getControlToken:()=>'token',
                  getPendingNucTransfer:()=>'',getMobilePlayers:()=>'[]',hasMobilePlayers:()=>true,
                  getVenuePlayers:()=>'[]',saveMobilePlayers:()=>{},saveVenuePlayers:()=>{},
                  getConnectionInfo:()=>JSON.stringify({versionName:'1.8.45',mode:'bluetooth',networkAvailable:true,
                    bluetoothAvailable:true,bluetoothEnabled:true,bluetoothConnected:true,
                    bluetoothName:'Venhoeve NUC BT',nucUrl:'http://10.42.0.1:8765'}),
                  repairConnection:()=>window.repaired=true,chooseMode:()=>window.modeChosen=true,
                  checkForUpdate:()=>window.updateChosen=true,saveSnapshot:()=>{}
                };
            """)
            page.route('**/api/system/status', lambda route: route.fulfill(
                status=200, content_type='application/json', body='{"wifi":true,"bluetooth":true}'))
            page.route('**/api/update/status', lambda route: route.fulfill(
                status=200, content_type='application/json', body='{"message":"NUC is actueel."}'))
            page.route('**/api/mouse', lambda route: route.fulfill(
                status=200, content_type='application/json', body='{"ok":true}'))
            page.route('**/api/kiosk/status', lambda route: route.fulfill(
                status=200, content_type='application/json', body='{"kiosk":true,"message":"Kioskmodus actief."}'))
            page.goto('http://127.0.0.1:8798/?remote=1&android=1&transport=bluetooth')
            expect(page.locator('#mode-status')).to_have_text('MODUS: NUC VIA BLUETOOTH')
            expect(page.locator('#mode-status')).to_have_class('nuc')
            expect(page.locator('#camera-game-on')).to_be_visible()
            expect(page.locator('#camera-game-off')).to_be_visible()

            expected = {
                '#mouse-control-open': 'connections',                 # 1
                '#android-app-action': 'connections',                 # 2
                '#bluetooth-open': 'connections',                     # 3
                '#edit-match': 'play',                                # 5
                '#team-manager': 'play',                              # 6
                '#players-list': 'play',                              # 6
                '#match-backups': 'play',                             # 7
                '#android-update-action': 'application',              # 8
                '#kiosk-mode-toggle': 'application',                  # 3
                '#connection-health': 'connections',                  # 9
            }
            for selector, menu in expected.items():
                expect(page.locator(selector)).to_be_attached()
                assert page.locator(selector).evaluate("e=>e.closest('details').dataset.menu") == menu
            for selector in ('#submit', '#undo', '#redo', '#bust'):   # 4
                expect(page.locator(selector)).to_be_attached()

            page.locator('#mouse-control-open').evaluate('e=>e.click()')
            expect(page.locator('#mouse-control-dialog')).to_be_visible()
            page.locator('#mouse-control-close').click()

            page.locator('#connection-health').evaluate('e=>e.click()')
            expect(page.locator('#connection-health-summary')).to_have_text('Alles is gereed.')
            page.locator('#connection-repair').click()
            page.wait_for_timeout(2500)
            assert page.evaluate('window.repaired===true')
            page.locator('#connection-health-close').click()

            page.locator('#bluetooth-open').evaluate('e=>e.click()')
            expect(page.locator('#nuc-controls')).to_be_visible()
            expect(page.locator('#nuc-control-status')).to_contain_text('Wifi: aan')
            page.locator('#bluetooth-close').click()

            page.locator('#android-app-action').evaluate('e=>e.click()')
            assert page.evaluate('window.modeChosen===true')
            page.locator('#android-update-action').evaluate('e=>e.click()')
            assert page.evaluate('window.updateChosen===true')
            browser.close()
    finally:
        process.terminate(); process.wait(timeout=5)

print('PASS: alle 9 mobiele functies zijn bereikbaar en bruikbaar')
