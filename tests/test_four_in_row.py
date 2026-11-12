"""4 op een rij: engine, mobile input, NUC board and two-player visual."""
from pathlib import Path
import json, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8802', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            phone = browser.new_page(viewport={'width':393, 'height':852})
            screen = browser.new_page(viewport={'width':1280, 'height':900})
            phone.goto('http://127.0.0.1:8802/?remote=1')
            state = phone.evaluate("""async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Anna','Bert'],0,'single',1,{game:'fourinarow'})}""")
            current = phone.request.get('http://127.0.0.1:8802/api/state').json()
            response = phone.request.post('http://127.0.0.1:8802/api/state', data={'revision':current['revision'],'match':{'state':state,'undo':[]}})
            assert response.ok
            phone.reload();screen.goto('http://127.0.0.1:8802/')
            expect(phone.locator('.four-board')).to_be_visible()
            expect(screen.locator('.four-board')).to_be_visible()
            assert phone.locator('.four-cell').count() == 25
            assert phone.locator('.four-cell[data-kind="sb"]').count() == 4
            assert phone.locator('.four-cell[data-kind="bb"]').count() == 1
            expect(phone.locator('.four-symbol')).to_have_text(['○','×'])
            expect(phone.locator('#turn-label')).to_contain_text('Anna')
            expect(phone.locator('#controller-note')).to_have_text('Scorebediening actief')
            first = phone.locator('.four-cell[data-kind="number"]').first
            for _ in range(3): first.click()
            expect(phone.locator('#turn-label')).to_contain_text('Bert')
            expect(phone.locator('.four-cell.owned.player-0')).to_have_count(1)
            expect(screen.locator('.four-cell.owned.player-0')).to_have_count(1)
            saved = phone.request.get('http://127.0.0.1:8802/api/state').json()['match']['state']
            assert saved['history'][-1]['darts'] == 3 and saved['active'] == 1

            # Make the visual example immediately readable without changing game logic.
            visual = saved
            visual['fourOwners'][1] = visual['fourOwners'][6] = 0
            visual['fourOwners'][3] = visual['fourOwners'][8] = 1
            visual['players'][0]['fourMarks'][11] = 2
            visual['players'][1]['fourMarks'][13] = 1
            latest = phone.request.get('http://127.0.0.1:8802/api/state').json()
            assert phone.request.post('http://127.0.0.1:8802/api/state', data={'revision':latest['revision'],'match':{'state':visual,'undo':[]}}).ok
            screen.reload();expect(screen.locator('.four-board')).to_be_visible()
            screen.screenshot(path=str(root/'tests'/'four-in-row-two-players.png'), full_page=True)
            assert screen.locator('body').evaluate('(e)=>e.scrollWidth<=e.clientWidth')

            won = json.loads(json.dumps(visual))
            won['fourOwners'][0:4] = [0, 0, 0, 0]
            won.update({'phase':'won','winner':0,'reason':'four-in-row','fourWinningCells':[0,1,2,3]})
            latest = phone.request.get('http://127.0.0.1:8802/api/state').json()
            assert phone.request.post('http://127.0.0.1:8802/api/state', data={'revision':latest['revision'],'match':{'state':won,'undo':[]}}).ok
            screen.reload()
            expect(screen.locator('#result-dialog #result-title')).to_contain_text('Anna wint')
            assert screen.locator('#result-dialog #match-summary').count() == 0
            browser.close()
            print('PASS: 5x5 field, symbols, three-mark capture, mobile-to-NUC sync and two-player visual')
    finally:
        server.terminate();server.wait()
