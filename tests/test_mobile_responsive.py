"""Responsive mobile UI checks using real browser layout and isolated match data."""
from pathlib import Path
import subprocess, tempfile, time, sys
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser=p.chromium.launch()
            page=browser.new_page(viewport={'width':393,'height':750},is_mobile=True,has_touch=True)
            page.goto('http://127.0.0.1:8788/?remote=1')
            for game in ['x01','tactics','cricket','gotcha','training']:
                state=page.evaluate("async game=>{const {newMatch}=await import('/engine.js');return newMatch(['Ed','Frank','Sean','Remon'],301,'double',3,game==='training'?{training121:true}:{game});}",game)
                rev=page.request.get('http://127.0.0.1:8788/api/state').json()['revision']
                assert page.request.post('http://127.0.0.1:8788/api/state',data={'revision':rev,'match':{'state':state,'undo':[]}}).ok
                page.reload()
                expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
                if page.locator('#toggle-toolbar').inner_text()=='Menu inklappen':
                    page.locator('#toggle-toolbar').click()
                modes=['total','dart'] if game=='x01' else ['dart']
                for mode in modes:
                    page.locator('#mode-'+mode).click()
                    expect(page.locator('#'+mode+'-input')).to_be_visible()
                    if mode=='dart':
                        page.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
                    for width,height in [(320,640),(393,750),(430,932),(600,800),(768,835),(835,768),(980,2050),(393,750)]:
                        page.set_viewport_size({'width':width,'height':height})
                        page.wait_for_timeout(30)
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                        assert page.locator('#players strong').first.evaluate('el=>getComputedStyle(el).fontSize')=='18px'
                        for card in page.locator('#players .player').all():
                            expect(card).to_be_visible()
                        if width>=600:
                            boxes=[el.bounding_box() for el in page.locator('#players .player').all()]
                            assert len({round(box['y']) for box in boxes})==1
                        for button in page.locator('#board-keys button' if mode=='dart' else '#keypad button').all():
                            box=button.bounding_box()
                            assert box['height']>=44 and box['width']>=39
                        if mode=='dart':
                            expect(page.locator('#dart-slots span').first).to_have_text('20')
                        main=page.locator('main').bounding_box()
                        panel=page.locator('.scoring').bounding_box()
                        assert panel['y']+panel['height']>=main['y']+main['height']-20
            # User's larger-button preference still works and survives refresh.
            page.locator('#layout-open').click()
            page.locator('[data-layout="large"]').click()
            page.locator('#layout-close').click()
            assert page.locator('#board-keys button').first.bounding_box()['height']>=58
            page.reload()
            expect(page.locator('body')).to_have_attribute('data-mobile-layout','large')
            # The NUC display is unaffected by the mobile stylesheet.
            screen=browser.new_page(viewport={'width':1080,'height':1920})
            screen.goto('http://127.0.0.1:8788/')
            expect(screen.locator('#players .player')).to_have_count(4)
            metrics="()=>['#players','.scoring','#finish-panel'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})"
            before=screen.evaluate(metrics)
            screen.locator('link[href="mobile-shell.css"]').evaluate('el=>el.disabled=true')
            assert screen.evaluate(metrics)==before
            print('PASS: five games, eight viewport sizes, stable typography, flexible grids, retained input, touch sizes, preferences, NUC unchanged')
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
