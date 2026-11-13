"""4 op een rij: engine, mobile input, NUC board and two-player visual."""
from pathlib import Path
import json, re, subprocess, sys, tempfile, time
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
            camera_progress = phone.evaluate("""async state=>{const {applyCameraEvent}=await import('/autoscoring-rules.js');let match={state,undo:[]},draft=null,lengths=[];for(let i=0;i<3;i++){const result=applyCameraEvent(match,draft,{kind:'dart',hit:{number:20,mult:1}});lengths.push(result.hits.length);match=result.match;draft={hits:result.hits};}return {lengths,claimed:match.state.fourOwners[match.state.fourBoard.indexOf('n20')]};}""",state)
            assert camera_progress == {'lengths':[1,2,0],'claimed':0}, camera_progress
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
            for width, height in [(320,640),(360,740),(393,852),(600,800),(736,872),(872,736),(884,1104),(1104,884),(768,1024),(1024,600)]:
                phone.set_viewport_size({'width':width,'height':height})
                assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width,height)
                for selector in ['.four-board','.four-controls']:
                    box = phone.locator(selector).bounding_box()
                    assert box and box['x'] >= 0 and box['x'] + box['width'] <= width + 1, (selector,width,height,box)
                board=phone.locator('.four-board').bounding_box();controls=phone.locator('.four-controls').bounding_box()
                separated=board['x']+board['width']<=controls['x']+.5 or controls['x']+controls['width']<=board['x']+.5 or board['y']+board['height']<=controls['y']+.5 or controls['y']+controls['height']<=board['y']+.5
                assert separated,('board/control overlap',width,height,board,controls)
                if (width,height)==(736,872):phone.screenshot(path=str(root/'tests'/'four-in-row-fold-inner.png'),full_page=True)
                cell = phone.locator('.four-cell').first.bounding_box()
                assert cell['width'] >= 42 and cell['height'] >= 42, (width,height,cell)
            phone.set_viewport_size({'width':393,'height':852})
            phone.screenshot(path=str(root/'tests'/'four-in-row-mobile-portrait.png'))
            phone.set_viewport_size({'width':852,'height':393})
            phone.screenshot(path=str(root/'tests'/'four-in-row-mobile-landscape.png'))
            phone.set_viewport_size({'width':393,'height':852})
            first = phone.locator('.four-cell[data-kind="number"]').first
            first_cell = first.get_attribute('data-cell')
            expect(phone.locator('.four-darts span').nth(0)).to_have_attribute('aria-current','step')
            first.click()
            expect(screen.locator(f'.four-cell[data-cell="{first_cell}"] .four-progress .player-0')).to_have_text('\u25cb')
            expect(phone.locator('.four-darts span').nth(1)).to_have_attribute('aria-current','step')
            first.click()
            expect(screen.locator(f'.four-cell[data-cell="{first_cell}"] .four-progress .player-0')).to_have_text('\u25cb\u25cb')
            expect(phone.locator('.four-darts span').nth(2)).to_have_attribute('aria-current','step')
            first.click()
            expect(phone.locator('#turn-label')).to_contain_text('Bert')
            expect(phone.locator('.four-cell.owned.player-0')).to_have_count(1)
            expect(screen.locator('.four-cell.owned.player-0')).to_have_count(1)
            saved = phone.request.get('http://127.0.0.1:8802/api/state').json()['match']['state']
            assert saved['history'][-1]['darts'] == 3 and saved['active'] == 1

            bull = phone.locator('.four-cell[data-kind="sb"]').first
            bull.click()
            expect(bull).to_have_class(re.compile(r'.*pending-owned.*'))
            expect(screen.locator('.four-cell.pending-owned.player-1')).to_have_count(1)
            phone.get_by_role('button', name='Mis', exact=True).click()
            phone.get_by_role('button', name='Mis', exact=True).click()
            expect(phone.locator('.four-cell.owned.player-1')).to_have_count(1)

            # Make the visual example immediately readable without changing game logic.
            visual = saved
            visual['fourOwners'][1] = visual['fourOwners'][6] = 0
            visual['fourOwners'][3] = visual['fourOwners'][8] = 1
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
            expect(screen.locator('#result-dialog')).to_have_class(re.compile(r'.*winner-party.*'))
            expect(screen.locator('#result-dialog #game-report')).to_be_visible()
            expect(screen.locator('#result-dialog .game-report-share')).to_have_text('Delen als afbeeldingen')
            assert screen.locator('#result-dialog #match-summary').count() == 0
            browser.close()
            print('PASS: 5x5 field, symbols, three-mark capture, mobile-to-NUC sync and two-player visual')
    finally:
        server.terminate();server.wait()
