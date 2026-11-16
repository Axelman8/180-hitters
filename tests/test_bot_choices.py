"""Visible BOT tactics and varied openings, including the bundled tablet client."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'dist'
LEGACY=len(sys.argv)>1
PORT='8899' if LEGACY else '8898';URL='http://127.0.0.1:'+PORT
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':1024,'height':600});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   def assets(route):
    path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
    if path.startswith('/api/') or not file.is_relative_to(ASSETS) or not file.is_file():return route.fallback()
    if file.name=='bot-runner.js' or path=='/legacy/app.js':
     # Speed up only the injected wait; keep real aim, scatter, drafts and API.
     source=file.read_text(encoding='utf-8-sig').replace('await delay(', 'await (async()=>{})(')
     route.fulfill(body=source,content_type='text/javascript')
    else:route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
   page.route(URL+'/**',assets);page.goto(URL+'/?remote=1')
   expect(page.locator('#header-menu')).to_be_visible()
   def saved():return page.request.get(URL+'/api/state').json()
   def seed(game,level):
    state=page.evaluate("""async({game,level})=>{
     const s=(await import('/engine.js')).newMatch(['BOT','Human','Human 2','Human 3'],301,'double',1,
      {game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:[level,0,0,0],maxRounds:0});
     if(game==='seabattle'){
      // Only one enemy target is not confirmed water; the UI must plan 14.
      for(const [index,p] of s.players.entries())if(index){p.seaShots.fill(1);p.seaFleet.fill(0);p.seaShots[13]=0;p.seaFleet[13]=2;p.seaRemaining=2;}
     }
     return s;
    }""",{'game':game,'level':level})
    state['startedAt']=int(time.time()*1000)
    assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(page.locator('body')).to_have_attribute('data-game','x01' if game=='121' else game)
    page.wait_for_timeout(650)
    return state
   for level in [40,50]:
    for game in ['x01','121','gotcha','cricket','tactics','fourinarow','killer','seabattle','scram','bull41','golf','shanghai','twentyone','bobs27','tenlives']:
     if not page.locator('#header-menu').is_visible():page.locator('#toggle-toolbar').click()
     state=seed(game,level)
     if game=='seabattle':expect(page.locator('.bot-strategy')).to_contain_text('D14')
     page.locator('#navigation-close').click()
     page.wait_for_function("async(id)=>{const d=await fetch('/api/state').then(r=>r.json());return d.match.state.startedAt===id&&d.match.state.history.length>0}",arg=state['startedAt'],timeout=12000)
     assert not errors,(game,errors)
     assert not page.locator('#message').inner_text().startswith('BOT kon'),(game,page.locator('#message').inner_text())
    print('PASS visible BOT',level,'all fifteen games with shared live darts and saved turns','legacy tablet' if LEGACY else 'modern',flush=True)
   if not page.locator('#header-menu').is_visible():page.locator('#toggle-toolbar').click()
   for base,average,expected,darts in [(40,49.9,40,9),(40,50,45,9),(40,70,65,9),(50,59.9,50,9),(50,60,55,9),(50,70,65,9),(50,100,50,6)]:
    state=seed('x01',base);state['players'][1]['darts']=darts;state['players'][1]['points']=average*darts/3
    assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(page.locator('#bot-status strong small')).to_have_text(f'Niveau {expected} \u00b7 basis {base}')
   print('PASS visible adaptive level: ten-point threshold, five below player, both bases and minimum sample',flush=True)
   browser.close()
 finally:server.terminate();server.wait()
