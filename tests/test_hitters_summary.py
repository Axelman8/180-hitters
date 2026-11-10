"""Check the complete mobile Hitters Challenge end report."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8794', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 393, 'height': 852})
            page.add_init_script("window.sharedPng=null;window.DartsAndroid={sharePng:(data,name)=>window.sharedPng={data,name}}")
            page.goto('http://127.0.0.1:8794/?android=1')
            result = page.evaluate("""async()=>{
              const {newMatch}=await import('/engine.js');
              const {applyLivesDart,livesSummary}=await import('/ten-lives.js');
              let s=newMatch(['Axel'],501,'double',1,{game:'tenlives',livesMode:'double'});
              s.startedAt=Date.now()-65000;
              s=applyLivesDart(s,{trainingHit:true});
              s=applyLivesDart(s,{trainingHit:false});
              s=applyLivesDart(s,{trainingHit:true});
              s.players[0].livesTarget=25;s.players[0].attempts=3;
              s=applyLivesDart(s,{trainingHit:true});
              return {match:{state:s,undo:[]},summary:livesSummary(s)};
            }""")
            assert result['summary']['totalDarts'] == 4
            assert [row['darts'] for row in result['summary']['rows']] == [1, 2, 1]
            assert [goal['label'] for goal in result['summary']['oneDart']] == ['D20', 'Bull']
            page.request.post('http://127.0.0.1:8794/api/state', data={'revision': 0, 'match': result['match']})
            page.reload()
            expect(page.locator('#lives-summary')).to_be_visible()
            expect(page.locator('#lives-summary h3')).to_have_text('Hitters Challenge - Doubles')
            expect(page.locator('.lives-summary-meta dd')).to_have_count(3)
            expect(page.locator('.lives-summary-table thead th')).to_have_text(['Ronde', 'Doel', 'Aantal darts', 'Darts gegooid'])
            expect(page.locator('.lives-summary-table tbody tr')).to_have_count(3)
            expect(page.locator('.lives-summary-table tbody tr').nth(1).locator('td')).to_have_text(['2', 'D19', '2', 'Mis · Raak'])
            expect(page.locator('.lives-round-timeline')).to_be_visible()
            expect(page.locator('.lives-timeline-grid article')).to_have_count(3)
            expect(page.locator('.lives-timeline-grid article strong')).to_have_text(['D20', 'D19', 'Bull'])
            expect(page.locator('.lives-timeline-grid article b')).to_have_text(['1 dart', '2 darts', '1 dart'])
            expect(page.locator('.lives-timeline-grid article small')).to_have_text(['Start', 'Vooruit', 'Vooruit'])
            expect(page.locator('.lives-summary-ranking li i')).to_have_count(3)
            assert page.locator('.lives-summary-ranking li b').first.evaluate('el=>parseFloat(el.style.width)') == 100
            expect(page.locator('.lives-one-dart-chart>div')).to_have_count(2)
            expect(page.locator('.lives-one-dart-chart strong')).to_have_text(['× 1', '× 1'])
            page.locator('#lives-summary .lives-summary-share').click()
            page.wait_for_function('window.sharedPng && window.sharedPng.data.length > 1000')
            shared = page.evaluate('window.sharedPng')
            assert shared['name'].startswith('hitters-challenge-') and shared['name'].endswith('.png')
            assert shared['data'].startswith('iVBOR')
            assert page.locator('#result-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
            browser.close()
            print('PASS: Hitters Challenge times, total, one-dart ranking, detail table and mobile fit')
    finally:
        server.terminate()
        server.wait()
