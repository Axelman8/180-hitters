"""Check per-leg attribution, weighted averages and the end-screen layout."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8788', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width':1080, 'height':1920})
            page.goto('http://127.0.0.1:8788/')
            result = page.evaluate("""async()=>{
                const {newMatch,applyTurn,nextLeg}=await import('/engine.js');
                const {matchSummary}=await import('/match-summary.js');
                let s=newMatch(['Remon','Ed','Frank','Remon'],40,'double',2),undo=[];
                const play=t=>{undo.push(s);s=applyTurn(s,t)};
                for(const t of [{score:60,forceBust:true},{score:10},{score:20},{score:0},{score:40,darts:1}])play(t);
                s=nextLeg(s);play({score:40,darts:1});s=nextLeg(s);
                for(const t of [{score:0},{score:0},{score:40,darts:1}])play(t);
                return {match:{state:s,undo},summary:matchSummary(s)};
            }""")
            rows = result['summary']['rows']
            assert [cell['finish'] for cell in rows[0]['perLeg']] == [40, None, 40]
            assert [cell['finish'] for cell in rows[1]['perLeg']] == [None, 40, None]
            assert rows[0]['average'] == 48
            assert rows[1]['average'] == 37.5
            assert [cell['average'] for cell in rows[0]['perLeg']] == [30, None, 120]
            assert rows[3]['average'] == 0 and rows[0]['legs'] == 2
            page.request.post('http://127.0.0.1:8788/api/state', data={'revision':0,'match':result['match']})
            page.reload()
            expect(page.locator('.summary-player')).to_have_count(4)
            expect(page.locator('.summary-total small').first).to_have_text('SPELGEMIDDELDE')
            expect(page.locator('.summary-leg-table').first.locator('thead th')).to_have_text(['Leg','Gemiddelde','Finish'])
            expect(page.locator('.summary-leg-table').first.locator('tbody tr').first.locator('td')).to_have_text(['30,00','40'])
            expect(page.locator('#players .player-leg-results').first.locator('thead th')).to_have_text(['Leg','Gemiddelde','Finish'])
            expect(page.locator('.winner-trophy')).to_have_count(0)
            expect(page.locator('.summary-total strong').first).to_have_text('48,00')
            page.set_viewport_size({'width':393,'height':750})
            page.wait_for_timeout(100)
            assert page.locator('#result-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
            page.locator('#result-undo').click()
            expect(page.locator('#match-summary')).to_have_count(0)
            marks = page.evaluate("""async()=>{
                const {matchSummary}=await import('/match-summary.js');
                return matchSummary({game:'tactics',leg:1,starter:0,players:[{name:'A',legs:1}],
                    history:[{leg:1,darts:3,marks:5,score:60},{leg:1,darts:2,marks:3,score:40}]});
            }""")
            assert marks['marks'] and abs(marks['rows'][0]['average']-4.8) < 1e-9
            browser.close()
            print('PASS: four players, duplicate names, per-leg and weighted averages, busts, unplayed legs, MPR, mobile layout and undo')
    finally:
        server.terminate()
        server.wait()
