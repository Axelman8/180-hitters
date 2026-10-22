"""Correction replay preserves incompatible future turns for explicit review."""
from pathlib import Path
import subprocess,tempfile,time,sys
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser=p.chromium.launch()
            page=browser.new_page(viewport={'width':393,'height':852})
            page.add_init_script("localStorage.setItem('axelman8.historyOpen','true')")
            page.goto('http://127.0.0.1:8788/?remote=1')
            match=page.evaluate("""async()=>{
              const {newMatch,applyTurn,nextLeg}=await import('/engine.js');
              let state=newMatch(['A','B'],101),undo=[];
              for(const turn of [{score:60},{score:60},{score:41,darts:2}]){undo.push(state);state=applyTurn(state,turn);}
              state=nextLeg(state);
              for(const turn of [{score:60},{score:26}]){undo.push(state);state=applyTurn(state,turn);}
              return {state,undo};
            }""")
            page.request.post('http://127.0.0.1:8788/api/state',data={'revision':0,'match':match})
            page.reload()
            expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
            for n in [4,3,2,1,0]:
                page.locator('#undo').click()
                expect(page.locator('#history-position')).to_contain_text(f'{n} van 5')
            page.locator('#keypad').get_by_role('button',name='Wis',exact=True).click()
            for digit in '40':page.locator('#keypad').get_by_role('button',name=digit,exact=True).click()
            page.locator('#submit:visible, #confirm-total:visible').click()
            expect(page.locator('#pending-turns')).to_be_visible()
            expect(page.locator('#pending-list li')).to_have_count(3)
            saved=page.request.get('http://127.0.0.1:8788/api/state').json()['match']
            assert len(saved['state']['history'])==1
            assert len(saved['future'])==1
            assert saved['pendingTurns'][0]['input']=={'score':41,'darts':2}
            page.reload()
            expect(page.locator('#pending-list li')).to_have_count(3)
            page.locator('#history-latest').click()
            page.locator('#pending-load').click()
            expect(page.locator('#entry')).to_have_text('41')
            page.locator('#keypad').get_by_role('button',name='Wis',exact=True).click()
            for digit in '61':page.locator('#keypad').get_by_role('button',name=digit,exact=True).click()
            page.locator('#submit:visible, #confirm-total:visible').click()
            expect(page.locator('#finish-dialog')).to_be_visible()
            page.locator('[data-darts="2"]').click()
            expect(page.locator('#pending-turns')).to_be_hidden()
            expect(page.locator('#history-position')).to_have_text('5 beurten gespeeld')
            final=page.request.get('http://127.0.0.1:8788/api/state').json()['match']
            assert final['state']['leg']==2
            assert [p['remaining'] for p in final['state']['players']]==[75,41]
            assert [h['score'] for h in final['state']['history']]==[40,60,61,60,26]
            assert not final['pendingTurns']
            # Replay double-in using exact darts, including darts before opening.
            result=page.evaluate("""async()=>{
                const {newMatch,applyTurn,makeDart}=await import('/engine.js');
                const {replayTurns}=await import('/replay.js');
                let s=newMatch(['A','B'],301,'double',3,{inMode:'double'});
                s=applyTurn(s,{hits:[makeDart(17),makeDart(20,2),makeDart(20)]});
                return replayTurns(s,[{player:1,leg:1,input:{hits:[makeDart(17),makeDart(10,2),makeDart(5)]}}]);
            }""")
            assert [p['remaining'] for p in result['state']['players']]==[241,276]
            assert not result['pending']
            print('PASS: invalid finish retained across reload, corrected, later leg inputs replayed, double-in darts preserved')
            browser.close()
    finally:
        server.terminate();server.wait(timeout=10)
