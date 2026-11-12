"""Scram, Killer, Bull/41 and 21: UI, responsive layout and NUC draft sync."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8806', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            phone = browser.new_page(viewport={'width':393,'height':852}, is_mobile=True, has_touch=True)
            screen = browser.new_page(viewport={'width':1280,'height':900})
            phone.goto('http://127.0.0.1:8806/?remote=1'); screen.goto('http://127.0.0.1:8806/')

            def start(game):
                state = phone.evaluate("""async game=>{const {newMatch}=await import('/engine.js');return newMatch(['Anna','Bert'],0,'single',1,{game})}""", game)
                current = phone.request.get('http://127.0.0.1:8806/api/state').json()
                assert phone.request.post('http://127.0.0.1:8806/api/state', data={'revision':current['revision'],'match':{'state':state,'undo':[]}}).ok
                phone.reload(); screen.reload(); expect(phone.locator('#sonny-root')).to_be_visible(); expect(screen.locator('#sonny-root')).to_be_visible()
                assert phone.locator('.sonny-target').count() == 21
                for width,height in [(320,640),(393,852),(600,800),(852,393),(1024,600)]:
                    phone.set_viewport_size({'width':width,'height':height})
                    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth'), (game,width,height)
                phone.set_viewport_size({'width':393,'height':852})

            start('scram')
            phone.locator('.sonny-target[data-number="20"]').click()
            expect(screen.locator('.sonny-darts span').first).to_have_text('20')
            phone.get_by_role('button',name='Mis',exact=True).click(); phone.get_by_role('button',name='Mis',exact=True).click()
            expect(screen.locator('.sonny-target[data-number="20"]')).to_have_class('sonny-target closed')
            screen.screenshot(path=str(root/'tests'/'sonny-scram.png'))

            start('killer')
            phone.locator('.sonny-target[data-number="5"]').click(); phone.locator('.sonny-target[data-number="6"]').click()
            expect(screen.locator('.sonny-target.assigned')).to_have_count(2)
            screen.screenshot(path=str(root/'tests'/'sonny-killer.png'))

            start('bull41')
            phone.locator('.sonny-target[data-number="25"]').click()
            expect(phone.locator('.sonny-darts span').first).to_have_text('25')
            phone.get_by_role('button',name='Double',exact=True).click(); phone.locator('.sonny-target[data-number="25"]').click()
            expect(phone.locator('.sonny-darts span').nth(1)).to_have_text('Bull')
            phone.get_by_role('button',name='Mis',exact=True).click()
            expect(phone.locator('.sonny-heading p')).to_contain_text('3/25 bullmarks')
            expect(screen.locator('.sonny-heading p')).to_contain_text('3/25 bullmarks')
            screen.screenshot(path=str(root/'tests'/'sonny-bull41.png'))

            start('twentyone')
            for number in [1,2,3]: phone.locator(f'.sonny-target[data-number="{number}"]').click()
            expect(screen.locator('.sonny-players article').first).to_contain_text('Doel: 4')
            screen.screenshot(path=str(root/'tests'/'sonny-21.png'))
            phone.screenshot(path=str(root/'tests'/'sonny-phone.png'), full_page=True)

            browser.close(); print('PASS: four Sonny games, direct NUC draft sync, rules UI and 320-1024px responsiveness')
    finally:
        server.terminate(); server.wait(timeout=10)
