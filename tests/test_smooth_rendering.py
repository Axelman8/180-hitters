"""Per-frame regression for playfield jumps, focus loss and retained input handlers."""
from pathlib import Path
from urllib.parse import unquote,urlsplit
import json,mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8873' if ASSETS else '8872';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/smooth56';OUT.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.7)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   if ASSETS:
    def assets(route):
     path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
     if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
     else:route.fallback()
    page.route(URL+'/**',assets)
   page.goto(URL+'/?remote=1');page.wait_for_timeout(450)
   if page.locator('#header-menu').is_visible():page.locator('#navigation-close').click()
   def saved():return page.request.get(URL+'/api/state').json()
   for width,height in [(393,852),(744,900),(1024,600)]:
    page.set_viewport_size({'width':width,'height':height})
    for game in ['x01','121','gotcha','cricket','tactics','fourinarow','killer','seabattle','scram','bull41','golf','shanghai','twentyone','bobs27','tenlives']:
     state=page.evaluate("async g=>(await import('/engine.js')).newMatch(['Test A','Test B'],301,'double',1,{game:g==='121'?'x01':g,training121:g==='121',livesMode:'double'})",game)
     state['startedAt']=int(time.time()*1000)
     match={'state':state,'undo':[],'inputPreferenceVersion':1,'preferredMode':'dart','modeOverride':'dart'}
     assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':match}).ok
     page.wait_for_function("id=>JSON.parse(localStorage.getItem('oche.match.v1')||'null')?.state?.startedAt===id",arg=state['startedAt'])
     if game in ['cricket','tactics'] and not page.locator('.visual-display .graphic-dartboard').is_visible():page.locator('.graphic-view-toggle').click()
     page.wait_for_timeout(140)
     selector=('.four-board' if game=='fourinarow' else '.killer-dartboard' if game=='killer' else '.sea-grid' if game=='seabattle' else '.golf-course' if game=='golf' else '#sonny-root .graphic-dartboard' if game=='shanghai' else '.visual-display .graphic-dartboard' if game in ['cricket','tactics','bobs27'] else '.sonny-board' if game in ['scram','bull41','twentyone'] else '.lives-focus' if game=='tenlives' else '.visual-players,#players')
     page.evaluate("""selector=>{
      const find=()=>[...document.querySelectorAll(selector)].find(e=>e.getBoundingClientRect().width>0);
      window.smoothNode=find();if(!window.smoothNode)throw Error('No visible board for '+selector);
      window.smoothTrace=[];window.smoothRun=true;
      function frame(){const b=find(),r=b?.getBoundingClientRect();if(r)window.smoothTrace.push({same:b===window.smoothNode,x:r.x,y:r.y,w:r.width,h:r.height});if(window.smoothRun)requestAnimationFrame(frame);}frame();
     }""",selector)
     for number in [1,2,3]:
      hit={'number':number,'mult':1,'label':str(number)}
      if game=='fourinarow':hit['cell']=number
      response=page.request.post(URL+'/api/draft',data={'revision':saved()['revision'],'owner':'smooth-probe','seq':int(time.time()*1000),'hits':[hit],'entry':''});assert response.ok,response.text()
      page.wait_for_function("label=>[...document.querySelectorAll('.game-player-action')].some(e=>e.getClientRects().length&&e.textContent.includes('Deze beurt: '+label))",arg=str(number))
      page.wait_for_timeout(80)
     trace=page.evaluate('window.smoothRun=false;window.smoothTrace')
     assert len(trace)>3,(game,width,'No frame samples')
     assert all(row['same'] for row in trace),(game,width,'Playfield replaced')
     spread={key:max(row[key] for row in trace)-min(row[key] for row in trace) for key in ['x','y','w','h']}
     assert max(spread.values())<=1.1,(game,width,'Layout jumped',spread)
     if game=='fourinarow':assert all(abs(row['w']-row['h'])<=1 for row in trace)
     (OUT/f'trace-{game}-{width}-{bool(ASSETS)}.json').write_text(json.dumps(trace))
     assert not errors,(game,errors)
    print('PASS all15 games:',width,height,'no per-dart board replacements or position/size jumps','legacy' if ASSETS else 'modern',flush=True)
   # Retaining a node must also retain focus, while changing its live callback
   # and disabled/selected state; otherwise smooth visuals could hide stale input.
   result=page.evaluate("""async()=>{
    const {patchView}=await import('/render-view.js'),host=document.createElement('div');document.body.append(host);
    const old=document.createElement('button');old.textContent='Old';old.onclick=()=>window.clickValue=1;host.append(old);old.focus();
    const draft=host.cloneNode(false),fresh=document.createElement('button');fresh.textContent='New';fresh.onclick=()=>window.clickValue=2;draft.append(fresh);
    patchView(host,draft);old.click();const ok=host.firstChild===old&&document.activeElement===old&&window.clickValue===2&&old.textContent==='New';host.remove();return ok;
   }""");assert result
   print('PASS retained focus and updated input callbacks',flush=True);browser.close()
 finally:server.terminate();server.wait()
