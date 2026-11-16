"""Killer's real score input and four player layout, from phone to NUC."""
from pathlib import Path
import json, mimetypes, os, subprocess, sys, tempfile, time
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
URL='http://127.0.0.1:8861'
with tempfile.TemporaryDirectory() as temp:
    server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port','8861','--data-file',str(Path(temp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852},has_touch=True)
            errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            if ASSETS:
                def assets(route):
                    path=unquote(urlsplit(route.request.url).path)
                    file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
                    if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
                    else:route.fallback()
                page.route(URL+'/**',assets)
                page.add_init_script("localStorage.setItem('180hitters.legacy.connectionMode','bluetooth')")
                page.route('**/api/tablet/config',lambda route:route.fulfill(json={'mode':'bluetooth','bluetoothConnected':True,'selectedBluetooth':'fixture'}))
            page.goto(URL+'/?remote=1');expect(page.locator('#header-menu')).to_be_visible();page.locator('#navigation-close').click()
            def saved():return page.request.get(URL+'/api/state').json()
            state=page.evaluate("""async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Alexandra','Bert van Dalen','Christine','Daan'],0,'single',1,{game:'killer',starter:2})}""")
            def put(state):
                assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
            put(state);expect(page.locator('.killer-sector')).to_have_count(20)
            # Choose numbers from the dartboard; each choice ends the assigning visit.
            for actor,number in [(2,3),(3,4),(0,1),(1,2)]:
                expect(page.locator('.killer-player.active .killer-player-name')).to_have_text(state['players'][actor]['name'])
                page.locator(f'.killer-sector[data-number="{number}"]').click()
                page.wait_for_function("n=>document.querySelectorAll('.killer-player-status')[n].textContent!=='KIES JE GETAL'",arg=actor)
            assert saved()['match']['state']['killerStage']=='playing'
            expect(page.locator('.killer-player.active .killer-player-name')).to_have_text('Christine')
            # A card's number is a large alternative to its narrow dartboard sector.
            page.locator('.killer-number').nth(2).click();expect(page.locator('.sonny-darts .current')).to_have_text('Pijl 2')
            expect(page.locator('.killer-player').nth(2).locator('.killer-lives .filled')).to_have_count(1)
            page.locator('.killer-number').nth(2).click();expect(page.locator('.sonny-darts .current')).to_have_text('Pijl 3')
            page.locator('.killer-number').nth(2).click();expect(page.locator('.killer-player.active .killer-player-name')).to_have_text('Daan')
            assert saved()['match']['state']['players'][2]['killerLetters']==3
            # Check each element's position, not only whether the page fits horizontally.
            for width,height in [(320,640),(320,740),(393,852),(744,900),(872,736),(1024,600),(1920,1080)]:
                page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(120)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,height)
                boxes=[page.locator(selector).bounding_box() for selector in ['.killer-players','.killer-arena','.killer-controls']]
                assert boxes[2]['y']+boxes[2]['height']<=height+1,(width,height,boxes)
                for a,b in [(boxes[0],boxes[1]),(boxes[1],boxes[2]),(boxes[0],boxes[2])]:
                    assert a and b
                    assert a['x']+a['width']<=b['x']+1 or b['x']+b['width']<=a['x']+1 or a['y']+a['height']<=b['y']+1 or b['y']+b['height']<=a['y']+1,(width,height,boxes)
                page.screenshot(path=str(ROOT/f'.repair-check/killer-{width}x{height}.png'),full_page=True)
            # A bot's live-dart panel takes vertical space too (Fold inner display).
            page.set_viewport_size({'width':1088,'height':800})
            page.evaluate("document.body.dataset.mobileLayout='landscape';document.body.classList.add('toolbar-collapsed');const bot=document.createElement('div');bot.id='bot-status';bot.style.height='80px';document.querySelector('#game').prepend(bot);dispatchEvent(new Event('resize'))")
            page.wait_for_timeout(100)
            board=page.locator('.killer-arena').bounding_box()
            assert board['y']+board['height']<=800
            page.screenshot(path=str(ROOT/'.repair-check/killer-fold-bot.png'))
            # NUC is a large, dedicated display; input belongs to the controller.
            screen=browser.new_page(viewport={'width':1920,'height':1080});screen.goto(URL);screen.locator('#navigation-close').click()
            expect(screen.locator('.killer-controls')).to_be_hidden();expect(screen.locator('.killer-player')).to_have_count(4)
            screen.screenshot(path=str(ROOT/'.repair-check/killer-nuc.png'))
            assert not errors,errors
            browser.close()
            print('PASS: four-player Killer, assignment, automatic darts 1/2/3, live progress and non-overlapping phone/Fold/tablet/NUC layouts')
    finally:server.terminate();server.wait()
