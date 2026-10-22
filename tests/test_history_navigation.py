from ui_input import enter_total
"""Browser regression for shared undo/redo. Requires Playwright Chromium."""
from pathlib import Path
import subprocess, tempfile, time, sys
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8788', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            screen = browser.new_page(viewport={'width':1080,'height':1920})
            phone = browser.new_page(viewport={'width':390,'height':844})
            screen.goto('http://127.0.0.1:8788/')
            phone.add_init_script("localStorage.setItem('axelman8.historyOpen','true')")
            phone.goto('http://127.0.0.1:8788/?remote=1')
            def saved():
                return screen.request.get('http://127.0.0.1:8788/api/state').json()['match']
            state = screen.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501)}")
            screen.request.post('http://127.0.0.1:8788/api/state', data={'revision':0,'match':{'state':state,'undo':[]}})
            for page in [screen,phone]:
                page.reload()
                expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
            for index,score in enumerate([60,100,26],1):
                enter_total(phone, str(score))
                phone.locator('#submit:visible, #confirm-total:visible').click()
                expect(phone.locator('#history-position')).to_have_text(f'{index} beurten gespeeld')
            original = saved()['state']
            for remaining in [2,1,0]:
                phone.locator('#undo').click()
                for page in [screen,phone]:
                    expect(page.locator('#history-position')).to_contain_text(f'{remaining} van 3')
            expect(phone.locator('#undo')).to_be_disabled()
            expect(phone.locator('#entry')).to_have_text('60')
            for page in [screen,phone]:
                page.reload()
                expect(page.locator('#history-position')).to_contain_text('0 van 3')
            phone.locator('#redo').click()
            expect(phone.locator('#history-position')).to_contain_text('1 van 3')
            expect(screen.locator('#entry')).to_have_text('100')
            phone.locator('#submit:visible, #confirm-total:visible').click()
            expect(phone.locator('#history-position')).to_contain_text('2 van 3')
            assert len(saved()['future']) == 1
            phone.locator('#history-latest').click()
            expect(phone.locator('#history-position')).to_have_text('3 beurten gespeeld')
            assert saved()['state'] == original
            expect(phone.locator('#redo')).to_be_disabled()
            expect(screen.locator('#score-celebration')).to_have_count(0)
            phone.locator('#undo').click()
            expect(phone.locator('#entry')).to_have_text('26')
            phone.locator('#undo').click()
            expect(phone.locator('#entry')).to_have_text('100')
            enter_total(phone, '85')
            phone.locator('#submit:visible, #confirm-total:visible').click()
            expect(phone.locator('#history-position')).to_contain_text('2 van 3')
            assert len(saved()['future']) == 1
            assert saved()['state']['players'][0]['remaining']==441
            phone.reload()
            expect(phone.locator('#entry')).to_have_text('26')
            phone.locator('#redo').click()
            expect(phone.locator('#history-position')).to_have_text('3 beurten gespeeld')
            assert not saved()['future']
            assert saved()['state']['players'][1]['remaining']==416
            assert saved()['state']['players'][0]['remaining']==415
            assert saved()['state']['history'][-1]['score']==26
            expect(screen.locator('#redo')).to_be_disabled()
            print('PASS: shared back/forward, reload, exact latest state, recovered input and correction with preserved later turns')
            # Cross a leg boundary, then return exactly to the new leg.
            state = screen.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],40)}")
            revision = screen.request.get('http://127.0.0.1:8788/api/state').json()['revision']
            screen.request.post('http://127.0.0.1:8788/api/state', data={'revision':revision,'match':{'state':state,'undo':[]}})
            for page in [screen,phone]:
                page.reload()
                expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
            phone.locator('#mode-dart').click()
            phone.locator('[data-multiplier="2"]').click()
            phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
            expect(phone.locator('#result-dialog')).to_be_visible()
            phone.locator('#continue').click()
            expect(phone.locator('#result-dialog')).to_be_hidden()
            expect(phone.locator('.match-score').first).to_contain_text('1')
            expect(phone.locator('.match-score').first).to_be_visible()
            phone.locator('#toggle-history').click()
            expect(phone.locator('#undo')).to_be_hidden()
            expect(screen.locator('#undo')).to_be_visible()
            phone.locator('#toggle-history').click()
            latest = saved()['state']
            assert latest['leg'] == 2
            phone.locator('#undo').click()
            expect(phone.locator('#dart-slots span').first).to_have_text('D20')
            phone.locator('#redo').click()
            expect(phone.locator('#history-position')).to_have_text('1 beurten gespeeld')
            assert saved()['state'] == latest
            print('PASS: unchanged confirmation preserves future, dart input and leg boundary round-trip')
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)

