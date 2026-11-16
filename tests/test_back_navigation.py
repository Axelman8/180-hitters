"""Back restores the immediate parent, including nested menus and native entry points."""
from pathlib import Path
import json, mimetypes, re, subprocess, sys, tempfile, time
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
URL = 'http://127.0.0.1:8858'

with tempfile.TemporaryDirectory() as folder:
    server = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), '--host', '127.0.0.1',
                               '--port', '8858', '--data-file', str(Path(folder) / 'match.json')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for phone, width, height in [(False, 1280, 900), (True, 393, 852)]:
                if ASSETS and not phone: continue
                page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=phone)
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                if ASSETS:
                    def assets(route):
                        path = unquote(urlsplit(route.request.url).path)
                        file = (ASSETS / (path.lstrip('/') or 'index.html')).resolve()
                        if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():
                            route.fulfill(path=file, content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
                        else: route.fallback()
                    page.route(URL + '/**', assets)
                    page.add_init_script("localStorage.setItem('180hitters.legacy.connectionMode','bluetooth')")
                    page.route('**/api/tablet/config', lambda route: route.fulfill(json={
                        'mode': 'bluetooth', 'bluetoothConnected': True, 'selectedBluetooth': 'fixture'}))
                elif phone:
                    page.add_init_script("""window.modeOpens=0;window.DartsAndroid={
                        isLocalMode:()=>false,getConnectionMode:()=> 'bluetooth',getControlToken:()=> 'fixture',
                        getConnectionInfo:()=>JSON.stringify({mode:'bluetooth',bluetoothAvailable:true,bluetoothEnabled:true,bluetoothConnected:true,bluetoothName:'Test NUC',versionName:'test'}),
                        chooseMode:()=>{window.modeOpens++},getMobilePlayers:()=> '[]',hasMobilePlayers:()=>true,
                        saveMobilePlayers:()=>{},getVenuePlayers:()=> '[]',saveVenuePlayers:()=>{},checkForUpdate:()=>{}}""")
                page.route('**/api/system/status', lambda route: route.fulfill(json={'wifi': True, 'bluetooth': True}))
                page.route('**/api/update/status', lambda route: route.fulfill(json={'message': 'Bijgewerkt', 'version': 'test'}))
                page.route('**/api/network/control', lambda route: route.fulfill(json={'profiles': [], 'busy': False}))
                page.route('**/api/display/orientation', lambda route: route.fulfill(json={'orientation': 'landscape', 'label': 'Landscape'}))
                page.goto(URL + ('/?remote=1&transport=bluetooth' if ASSETS else ''))
                expect(page.locator('#header-menu')).to_be_visible()
                page.locator('[data-menu="nuc"].navigation-category').click()
                page.locator('#navigation-scroll').evaluate('e=>e.scrollTop=100')
                page.locator('#bluetooth-open').click()
                expect(page.locator('#bluetooth-dialog')).to_be_visible()
                expect(page.locator('#bluetooth-dialog')).to_have_class(re.compile('app-dialog'))
                expect(page.locator('#nuc-bluetooth-on')).to_have_attribute('aria-pressed', 'true')
                expect(page.locator('#nuc-bluetooth-off')).to_have_attribute('aria-pressed', 'false')
                # Incoming live match revisions must not dismiss device settings.
                state = page.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Anna','Bert'],501,'double',1,{game:'x01'})}")
                current = page.request.get(URL + '/api/state').json()
                assert page.request.post(URL + '/api/state', data={'revision': current['revision'], 'match': {'state': state, 'undo': []}}).ok
                page.wait_for_timeout(650)
                expect(page.locator('#bluetooth-dialog')).to_be_visible()
                for w, h in [(320, 740), (393, 852), (744, 900), (1024, 600), (1920, 1080)]:
                    page.set_viewport_size({'width': w, 'height': h})
                    assert page.locator('#bluetooth-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
                page.set_viewport_size({'width': width, 'height': height})
                (ROOT / '.repair-check').mkdir(exist_ok=True)
                page.screenshot(path=str(ROOT / f'.repair-check/nuc-menu-{phone}-{bool(ASSETS)}.png'))
                page.locator('#bluetooth-close').click()
                expect(page.locator('#header-menu')).to_be_visible()
                expect(page.locator('#navigation-title')).to_have_text('NUC & verbinding')
                if phone and not ASSETS:
                    page.locator('#connection-health').click()
                    expect(page.locator('#connection-health-dialog')).to_be_visible()
                    page.locator('#connection-change').click()
                    assert page.evaluate('window.modeOpens') == 1
                    page.evaluate("document.dispatchEvent(new Event('native-navigation-back'))")
                    expect(page.locator('#connection-health-dialog')).to_be_visible()
                    page.locator('#connection-health-close').click()
                    expect(page.locator('#navigation-title')).to_have_text('NUC & verbinding')
                    page.locator('#android-app-action').click()
                    expect(page.locator('#header-menu')).not_to_be_visible()
                    page.evaluate("document.dispatchEvent(new Event('native-navigation-back'))")
                    expect(page.locator('#navigation-title')).to_have_text('NUC & verbinding')
                if ASSETS:
                    page.locator('#android-app-action').click()
                    expect(page.locator('#tablet-mode-overlay')).to_be_visible()
                    page.locator('#tablet-mode-close').dispatch_event('touchend')
                    expect(page.locator('#tablet-mode-overlay')).not_to_be_visible()
                    expect(page.locator('#header-menu')).to_be_visible()
                    expect(page.locator('#navigation-title')).to_have_text('NUC & verbinding')
                page.locator('#navigation-back').click()
                expect(page.locator('#navigation-overview')).to_be_visible()
                # Three levels: Online -> friends list -> access. No skips.
                page.locator('[data-menu="online"].navigation-category').click()
                page.locator('#club-open').click()
                expect(page.locator('#players-dialog h2')).to_have_text('Online vrienden')
                page.locator('#friends-roster-access').click()
                expect(page.locator('#club-dialog')).to_be_visible()
                page.locator('#club-close').click()
                expect(page.locator('#players-dialog')).to_be_visible()
                expect(page.locator('#players-dialog h2')).to_have_text('Online vrienden')
                expect(page.locator('#header-menu')).not_to_be_visible()
                # Back restores the same list instead of rerunning its open action.
                page.locator('#players-close').click()
                expect(page.locator('#header-menu')).to_be_visible()
                expect(page.locator('#navigation-title')).to_have_text('Online darten')
                page.locator('#navigation-back').click()
                expect(page.locator('#navigation-overview')).to_be_visible()
                # Escape and Android Back obey the same single-step behavior.
                page.locator('[data-menu="nuc"].navigation-category').click()
                page.keyboard.press('Escape')
                expect(page.locator('#navigation-overview')).to_be_visible()
                page.locator('[data-menu="nuc"].navigation-category').click()
                page.locator('#bluetooth-open').click()
                assert page.evaluate('window.__hittersNavigation.back()')
                expect(page.locator('#navigation-title')).to_have_text('NUC & verbinding')
                assert not errors, errors
                page.close()
                print('PASS immediate-parent Back, nested friends/access, NUC settings, native return, touch and Escape:',
                      'legacy tablet' if ASSETS else 'phone' if phone else 'NUC', flush=True)
            browser.close()
    finally:
        server.terminate()
        server.wait()
