"""Every game shows the same winner splash; special games also expose a report."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8813','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});page.goto('http://127.0.0.1:8813/?remote=1')
            states=page.evaluate("""async()=>{const {newMatch}=await import('/engine.js');const {newSonnyMatch}=await import('/sonny-games.js');const done=s=>({...s,phase:'won',winner:0,completedAt:Date.now()});return [done(newMatch(['Anna','Bert'],0,'single',1,{game:'fourinarow'})),...['scram','killer','bull41','twentyone'].map(game=>done(newSonnyMatch(game==='twentyone'?['Anna']:['Anna','Bert'],game))),done(newMatch(['Anna','Bert'],0,'single',1,{game:'tenlives',livesMode:'double'}))]}""")
            page.evaluate("state=>document.dispatchEvent(new CustomEvent('online-match-finished',{detail:{state,undo:[]}}))",states[0])
            expect(page.locator('#result-dialog')).to_have_class(__import__('re').compile(r'.*winner-party.*'))
            expect(page.locator('#result-dialog #result-title')).to_contain_text('Anna')
            page.locator('#result-dialog').evaluate('(dialog)=>dialog.close()')
            for index,state in enumerate(states):
                current=page.request.get('http://127.0.0.1:8813/api/state').json()
                assert page.request.post('http://127.0.0.1:8813/api/state',data={'revision':current['revision'],'match':{'state':state,'undo':[]}}).ok
                page.reload();expect(page.locator('#result-dialog')).to_have_class(__import__('re').compile(r'.*winner-party.*'))
                expect(page.locator('#result-dialog #result-title')).to_contain_text('Anna')
                if index<5: expect(page.locator('#game-report')).to_be_visible()
                else: expect(page.locator('#lives-summary')).to_be_visible()
            browser.close();print('PASS: winner splash and overview are available on mobile for every special game')
    finally:
        server.terminate();server.wait()
