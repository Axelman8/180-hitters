from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as pw:
   browser=pw.chromium.launch()
   phone=browser.new_page(viewport={'width':390,'height':844});screen=browser.new_page(viewport={'width':1080,'height':1920})
   errors=[]
   for page in [phone,screen]:page.on('pageerror',lambda e:errors.append(str(e)))
   phone.goto('http://127.0.0.1:8788/?remote=1');screen.goto('http://127.0.0.1:8788/')
   result=phone.evaluate('''async()=>{
    const {newMatch,applyTurn}=await import('/engine.js');
    const check=(ok,msg)=>{if(!ok)throw Error(msg);};
    const fresh=(n=2,mode='double')=>newMatch(['A','B','C','D'].slice(0,n),501,'double',3,{game:'tenlives',livesMode:mode});
    const hit=s=>applyTurn(s,{trainingHit:true}),miss=s=>applyTurn(s,{trainingHit:false});
    for(const mode of ['double','triple']){
     let s=fresh(2,mode),old=structuredClone(s);
     s=hit(s);check(s.players[0].livesTarget===19&&s.players[0].attempts===5,'20 first dart carries 2+3');
     s=hit(s);check(s.players[0].livesTarget===18&&s.players[0].attempts===7,'19 first dart carries 4+3');
     for(let i=0;i<6;i++)s=miss(s);
     check(s.active===0&&s.players[0].attempts===1,'Never switch after only three darts');
     s=miss(s);check(s.active===1&&s.players[0].livesTarget===19&&s.players[0].lives===10&&s.players[0].attempts===3,'Fail 18 returns 19 without life loss');
     for(let i=0;i<3;i++)s=miss(s);
     check(s.active===0&&s.players[1].lives===9&&s.players[0].livesTarget===19,'Resume saved target');
     check(old.players[0].attempts===3&&old.history.length===0,'Immutable snapshots for undo');
     s=fresh(1,mode);for(let i=0;i<7;i++)s=hit(s);for(let i=0;i<9;i++)s=miss(s);
     check(s.players[0].livesTarget===13&&s.players[0].attempts===8,'T13 with eight attempts');
     s=hit(s);check(s.players[0].livesTarget===12&&s.players[0].attempts===10,'Continue after T13');
     s=fresh(1,mode);for(let i=0;i<11;i++)s=hit(s);
     check(s.players[0].livesTarget===25&&s.phase==='playing','Route ends 10 then Bull');
     let failed=structuredClone(s);while(failed.players[0].livesTarget===25)failed=miss(failed);
     check(failed.players[0].livesTarget===10&&failed.players[0].lives===10,'Bull failure returns 10');
     s=hit(s);check(s.phase==='won'&&s.winner===0,'Bull wins');
     s=fresh(1,mode);for(let i=0;i<30;i++)s=miss(s);
     check(s.phase==='won'&&s.winner===null&&s.players[0].lives===0,'Ten failed attempts eliminate solo');
     s=fresh(3,mode);s.players[1].lives=0;s.players[0].lives=1;
     s=miss(miss(miss(s)));check(s.active===2&&s.players[0].lives===0&&s.phase==='playing','Skip eliminated; last player must still reach Bull');
    }
    return 'PASS engine: carry, failure, resume, elimination, bull and both variants';
   }''');print(result,flush=True)
   phone.get_by_role('button',name='10 levens',exact=False).click()
   phone.get_by_role('button',name='Triples',exact=True).click()
   phone.locator('.wizard-next').click();phone.locator('.wizard-next').click()
   expect(phone.locator('#lives-game')).to_be_visible();expect(screen.locator('#lives-game')).to_be_visible()
   expect(phone.locator('.life-marks').first.locator('i')).to_have_text([str(i) for i in range(1,11)])
   expect(phone.locator('.lives-current')).to_have_text('T20')
   phone.locator('#lives-hit').click();expect(screen.locator('.lives-current')).to_have_text('T19');expect(screen.locator('.lives-attempts')).to_have_text('5 pogingen over')
   phone.locator('#lives-undo').click();expect(screen.locator('.lives-current')).to_have_text('T20')
   phone.locator('#lives-redo').click();expect(screen.locator('.lives-current')).to_have_text('T19')
   for i in range(5):
    phone.locator('#lives-miss').click();expect(phone.locator('.lives-attempts')).to_have_text(f'{4-i} '+('poging over' if 4-i==1 else 'pogingen over') if i<4 else '3 pogingen over')
   expect(screen.locator('.lives-current')).to_have_text('T20')
   phone.reload();expect(phone.locator('#lives-game')).to_be_visible()
   for page in [phone,screen]:
    for w,h in [(390,844),(740,900),(1080,1920),(1920,1080)]:
     page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(150)
     assert page.evaluate('document.documentElement.scrollWidth')<=w
     expect(page.locator('#lives-hit')).to_be_visible()
   screen.set_viewport_size({'width':1080,'height':1920});screen.screenshot(path=str(root/'tests/ten-lives-screen.png'))
   phone.set_viewport_size({'width':390,'height':844});phone.screenshot(path=str(root/'tests/ten-lives-phone.png'))
   screen.locator('#lives-toggle').click();expect(screen.locator('#lives-hit')).to_be_hidden();expect(phone.locator('#lives-hit')).to_be_visible();expect(screen.locator('#lives-undo')).to_be_visible()
   screen.locator('#lives-toggle').click();expect(screen.locator('#lives-hit')).to_be_visible()
   state=phone.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B','C','D'],501,'double',3,{game:'tenlives',livesMode:'double'})}")
   revision=phone.request.get('http://127.0.0.1:8788/api/state').json()['revision']
   assert phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
   expect(phone.locator('.lives-player')).to_have_count(4);expect(screen.locator('.lives-player')).to_have_count(4)
   assert phone.evaluate('document.documentElement.scrollWidth')<=390
   state['players'][0]['livesTarget']=25
   revision=phone.request.get('http://127.0.0.1:8788/api/state').json()['revision']
   assert phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
   expect(phone.locator('.lives-current')).to_have_text('Bull (50)');phone.locator('#lives-hit').click()
   expect(phone.locator('#result-dialog')).to_be_visible();expect(phone.locator('#result-title')).to_have_text('A wint!')
   phone.locator('#result-undo').click();expect(phone.locator('#result-dialog')).to_be_hidden();expect(phone.locator('.lives-current')).to_have_text('Bull (50)')
   phone.locator('#lives-hit').click();expect(phone.locator('#result-dialog')).to_be_visible();phone.locator('#continue').click()
   phone.get_by_role('button',name='X01',exact=False).click();phone.locator('.wizard-next').click();phone.locator('.wizard-next').click()
   expect(phone.locator('#players')).to_be_visible();expect(phone.locator('#lives-game')).to_be_hidden()
   phone.set_viewport_size({'width':740,'height':900});expect(phone.locator('#lives-game')).to_be_hidden()
   assert not errors,errors
   browser.close();print('PASS UI: setup, sync, undo/redo, reload, responsive layouts and collapsed display')
 finally:server.terminate();server.wait()
