"""Actual per-dart effects on controllers/displays, deduplication and click-through."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8897' if ASSETS else '8896';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/game-moments49';OUT.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();phone=browser.new_page(viewport={'width':393,'height':852});screen=browser.new_page(viewport={'width':1280,'height':720});errors=[]
   for page,remote in [(phone,True),(screen,False)]:
    page.on('pageerror',lambda e:errors.append(str(e)))
    if ASSETS and remote:
     def assets(route):
      path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
      if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
      else:route.fallback()
     page.route(URL+'/**',assets)
    page.goto(URL+('/?remote=1' if remote else '/'))
    if page.locator('#header-menu').is_visible():page.locator('#navigation-close').click()
    page.evaluate("window.effects=[];new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.id==='score-celebration')window.effects.push(n.dataset.moment||'score')}).observe(document.body,{childList:true})")
   def saved():return phone.request.get(URL+'/api/state').json()
   def seed(game):
    state=phone.evaluate("""async game=>{
     const s=(await import('/engine.js')).newMatch(['Anna','Bert','Cato','Daan'],301,'single',1,{game,livesMode:'double'});
     if(game==='seabattle'){
      s.players.forEach(p=>p.seaFleet=Array(20).fill(0));const p=s.players[1];
      [0,1,2].forEach(i=>p.seaFleet[i]=1);[5,6].forEach(i=>p.seaFleet[i]=2);[10,11].forEach(i=>p.seaFleet[i]=3);
      p.seaHull[0]=p.seaHull[1]=2;p.seaRemaining=10;
     }
     if(game==='killer'){s.killerStage='playing';s.players.forEach((p,i)=>p.killerNumber=[20,18,16,14][i]);s.players[0].killerActivated=true;s.players[0].killerLetters=3;s.players[1].killerLives=1;}
     if(game==='gotcha'){s.players[0].remaining=10;s.players[1].remaining=30;}
     if(game==='bobs27')s.players[0].remaining=1;
     if(game==='tenlives')s.players[0].lives=1;
     return s;
    }""",game)
    state['startedAt']=int(time.time()*1000)
    assert phone.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(phone.locator('body')).to_have_attribute('data-game',game);expect(screen.locator('body')).to_have_attribute('data-game',game)
    phone.wait_for_timeout(150)
    for page in [phone,screen]:page.evaluate('window.effects=[]')
    return state
   seed('seabattle')
   phone.locator('.sonny-multipliers button').filter(has_text='Dubbel').click()
   phone.locator('.sea-cell[data-number="3"]').click()
   for page in [phone,screen]:
    expect(page.locator('#score-celebration.game-moment')).to_be_visible();expect(page.locator('#score-celebration')).to_have_attribute('data-moment','ship')
    expect(page.locator('#score-celebration .moment-detail')).to_contain_text('Bert')
    assert page.locator('#score-celebration').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
   assert saved()['match']['state']['history']==[],'Show sinking on the first dart, before confirming the visit'
   phone.screenshot(path=str(OUT/f'ship-phone-{bool(ASSETS)}.png'));screen.screenshot(path=str(OUT/f'ship-nuc-{bool(ASSETS)}.png'))
   # Click through the effect; completing the visit must not play sinking twice.
   phone.locator('.sonny-actions button').filter(has_text='MIS').click();phone.locator('.sonny-actions button').filter(has_text='MIS').click()
   expect(phone.locator('.party-players strong').first).to_have_text('Anna');phone.wait_for_timeout(500)
   for page in [phone,screen]:assert page.evaluate("window.effects.filter(k=>k==='ship').length")==1
   print('PASS ship sinking on first dart, synchronized once, controls usable during the effect',flush=True)
   for game,selector,kind in [('killer','.killer-sector[data-number="18"]','killer'),('fourinarow','.four-cell[data-cell="0"]','four')]:
    seed(game)
    phone.locator(selector).click()
    for page in [phone,screen]:expect(page.locator('#score-celebration')).to_have_attribute('data-moment',kind)
    print('PASS immediate graphical moment:',game,flush=True)
   seed('gotcha')
   phone.locator('.visual-player .gotcha-player-reset').filter(has_text='op 0').first.click()
   for page in [phone,screen]:expect(page.locator('#score-celebration')).to_have_attribute('data-moment','gotcha')
   print('PASS Gotcha manual reset without a new history row',flush=True)
   for game in ['bobs27','tenlives']:
    for page in [phone,screen]:page.emulate_media(reduced_motion='reduce')
    seed(game)
    if game=='tenlives':phone.locator('#lives-miss-three').click()
    else:
     for i in range(3):phone.locator('#miss-dart').click()
    for page in [phone,screen]:
     expect(page.locator('#score-celebration')).to_have_attribute('data-moment','out')
     expect(page.locator('#score-celebration .score-fragments')).to_have_count(0)
    print('PASS player elimination:',game,flush=True)
   # Changing to another match cleans up an old effect instead of replaying it.
   seed('x01')
   for page in [phone,screen]:expect(page.locator('#score-celebration')).to_have_count(0)
   value=saved();after=phone.evaluate("async state=>(await import('/engine.js')).applyTurn(state,{hits:Array.from({length:3},()=>({number:20,mult:3}))})",value['match']['state'])
   assert phone.request.post(URL+'/api/state',data={'revision':value['revision'],'match':{'state':after,'undo':[value['match']['state']]}}).ok
   expect(screen.locator('#score-celebration.score-impact')).to_be_visible();expect(phone.locator('#score-celebration')).to_have_count(0)
   print('PASS reduced motion and original X01 score impact retained',flush=True)
   assert not errors,errors;browser.close()
 finally:server.terminate();server.wait()
