"""Established scoring screens, traditional closure marks and reachable menus."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json, mimetypes, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
PORT = '8891' if ASSETS else '8890'
URL = 'http://127.0.0.1:' + PORT
OUT = ROOT / '.repair-check/ui-restore48'
OUT.mkdir(parents=True, exist_ok=True)

with tempfile.TemporaryDirectory() as temp:
    server = subprocess.Popen([sys.executable, str(ROOT/'server.py'), '--host', '127.0.0.1', '--port', PORT,
                               '--data-file', str(Path(temp)/'state.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for remote in ([True] if ASSETS else [False, True]):
                page = browser.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                if ASSETS:
                    def assets(route):
                        path = unquote(urlsplit(route.request.url).path)
                        file = (ASSETS/(path.lstrip('/') or 'index.html')).resolve()
                        if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():
                            route.fulfill(path=file, content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
                        else:
                            route.fallback()
                    page.route(URL+'/**', assets)
                page.goto(URL + ('/?remote=1' if remote else '/'))
                expect(page.locator('#header-menu')).to_be_visible()
                page.locator('#navigation-close').click()
                page.request.post(URL+'/api/display', data={'inputCollapsed': False})

                def seed(game, count=4, marks=False):
                    state = page.evaluate("""async({game,count,marks})=>{
                        const s=(await import('/engine.js')).newMatch(['Remon','Frank','Ed','Leen'].slice(0,count),301,'single',1,
                            {game:game==='121'?'x01':game,training121:game==='121',livesMode:'double'});
                        if(marks)s.players.forEach((p,i)=>p.marks[20]=i);
                        return s;
                    }""", {'game': game, 'count': count, 'marks': marks})
                    state['startedAt'] = int(time.time()*1000)
                    revision = page.request.get(URL+'/api/state').json()['revision']
                    assert page.request.post(URL+'/api/state', data={'revision': revision, 'match': {'state': state, 'undo': []}}).ok
                    expect(page.locator('body')).to_have_attribute('data-game', 'x01' if game == '121' else game)
                    page.wait_for_timeout(300)

                def menu_inside():
                    button = page.locator('#toggle-toolbar').bounding_box()
                    header = page.locator('header').bounding_box()
                    version = page.locator('#app-version').bounding_box()
                    width = page.viewport_size['width']
                    assert button and 0 <= button['x'] and button['x']+button['width'] <= width, (header, button, width)
                    assert header['y'] <= button['y'] and button['y']+button['height'] <= header['y']+header['height']+1
                    assert version['y']+version['height'] <= header['y']+header['height']+1
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')

                for game in ['x01', '121', 'gotcha', 'tenlives']:
                    for count in [2, 4]:
                        seed(game, count)
                        assert not page.locator('body').evaluate("e=>e.classList.contains('viewport-game')")
                        if game == 'gotcha':
                            expect(page.locator('.visual-player .gotcha-track')).to_have_count(count)
                            expect(page.locator('.gotcha-race')).to_have_count(0)
                        sizes = [(320,740),(393,852),(821,1088),(1088,821),(1024,600)] if remote else [(1280,720),(1080,1920),(1920,1080)]
                        for width, height in sizes:
                            page.set_viewport_size({'width': width, 'height': height})
                            page.wait_for_timeout(150)
                            menu_inside()
                            if count == 4 and width in [393,821,1920]:
                                page.screenshot(path=str(OUT/f'restored-{game}-{width}-{remote}-{bool(ASSETS)}.png'))
                    print('PASS restored established scoring screen:', game, 'controller' if remote else 'NUC', flush=True)

                seed('cricket', marks=True)
                cells = page.locator('.graphic-marks>span[data-marks]')
                for i in range(4):
                    cell = cells.nth(i)
                    expect(cell).to_have_attribute('data-marks', str(i))
                    expect(cell.locator('.closure-mark')).to_have_count(1)
                    expect(cell.locator('circle')).to_have_count(1 if i == 3 else 0)
                    expect(cell.locator('path')).to_have_count(2 if i >= 2 else 1)
                assert page.locator('.graphic-sector[data-number="20"] circle').count() == 4
                if remote:
                    page.locator('.graphic-compact-buttons button').filter(has_text='Triple').click()
                    page.locator('.graphic-mark-target').filter(has_text='20').click()
                    expect(page.locator('.graphic-marks>span[data-marks]').first).to_have_attribute('data-marks', '3')
                seed('tactics', marks=True)
                expect(page.locator('.closure-mark')).to_have_count(48)
                print('PASS slash, cross and circled cross; board dots and pending marks retained', flush=True)

                # Exercise the connected Android header, including both direct camera buttons.
                if remote:
                    page.evaluate("""()=>{
                        document.documentElement.classList.add('android-shell');
                        const status=document.createElement('p');status.id='mode-status';status.textContent='NUC';
                        if(!document.getElementById('mode-status'))document.querySelector('header').prepend(status);
                        document.body.classList.add('header-camera-active');
                        let cameras=document.getElementById('camera-game-controls');
                        if(!cameras){
                            cameras=document.createElement('div');cameras.id='camera-game-controls';cameras.className='header-camera-controls';
                            cameras.innerHTML='<button id="camera-game-toggle">Camera aan</button><button id="camera-calibration-open">Kalibreren</button>';
                            document.querySelector('header').append(cameras);
                        }
                        cameras.hidden=false;
                    }""")
                    for width,height in [(320,740),(393,852),(821,1088),(1088,821)]:
                        page.set_viewport_size({'width':width,'height':height})
                        page.wait_for_timeout(100)
                        menu_inside()
                    page.locator('#toggle-toolbar').click()
                    expect(page.locator('#header-menu')).to_be_visible()
                    page.locator('#navigation-close').click()
                    print('PASS connected camera header and working menu at phone/Fold sizes', flush=True)
                assert not errors, errors
                page.close()
            browser.close()
    finally:
        server.terminate()
        server.wait()
