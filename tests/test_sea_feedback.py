"""Saved cell-7 regression, fleet following, queued moments and winning hits."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8895' if ASSETS else '8894';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/sea52';OUT.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.7)
  with sync_playwright() as p:
   browser=p.chromium.launch();phone=browser.new_page(viewport={'width':393,'height':852});screen=browser.new_page(viewport={'width':1920,'height':1080});errors=[]
   for page,remote in [(phone,True),(screen,False)]:
    page.on('pageerror',lambda error:errors.append(str(error)))
    if ASSETS and remote:
     def assets(route):
      path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
      if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
      else:route.fallback()
     page.route(URL+'/**',assets)
    page.goto(URL+('/?remote=1' if remote else '/'))
    page.wait_for_timeout(600)
    if page.locator('#header-menu').is_visible():page.locator('#navigation-close').click()
    page.evaluate("window.moments=[];new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.id==='score-celebration')window.moments.push(n.textContent)}).observe(document.body,{childList:true})")
   def saved():return phone.request.get(URL+'/api/state').json()
   def post(state):
    assert phone.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    for page in [phone,screen]:page.wait_for_function("wanted=>{const s=JSON.parse(localStorage.getItem('oche.match.v1')||'null')?.state;return s&&s.startedAt===wanted.startedAt&&s.phase===wanted.phase&&s.active===wanted.active&&s.turns===wanted.turns&&JSON.stringify(s.players)===JSON.stringify(wanted.players)}",arg=state)
    phone.wait_for_timeout(180)
   def seed(game='seabattle',count=2):
    state=phone.evaluate("""async({game,count})=>{
     const s=(await import('/engine.js')).newMatch(['BOT 50 #1','BOT 40 #2','Cato','Daan'].slice(0,count),301,'single',1,{game,livesMode:'double'});
     if(game==='seabattle')for(const p of s.players){p.seaFleet=Array(20).fill(0);[0,5,10].forEach(i=>p.seaFleet[i]=1);[1,6].forEach(i=>p.seaFleet[i]=2);[7,8].forEach(i=>p.seaFleet[i]=3);}
     return s;
    }""",{'game':game,'count':count})
    state['startedAt']=int(time.time()*1000);post(state);return state
   def turn(state,hits):return phone.evaluate("async({s,h})=>(await import('/engine.js')).applyTurn(s,{hits:h})",{'s':state,'h':hits})
   def draft(hits):
    assert phone.request.post(URL+'/api/draft',data={'revision':saved()['revision'],'owner':'test-sea-feedback','seq':int(time.time()*1000),'hits':hits,'entry':''}).ok
    phone.wait_for_timeout(180)
   miss={'number':0,'mult':1}
   state=seed();state['active']=1;post(state)
   draft([{'number':7,'mult':1},{'number':7,'mult':1}])
   for page in [phone,screen]:
    expect(page.locator('.sea-grid')).to_have_attribute('data-fleet-player','0')
    expect(page.locator('.sea-cell[data-number="7"] .sea-cell-status')).to_have_text('VERNIETIGD')
    expect(page.locator('.sea-cell[data-number="7"] .sea-cell-credit')).to_have_text('Door BOT 40 #2')
    expect(page.locator('.sea-last-action')).to_contain_text('BOT 40 #2')
    expect(page.locator('#score-celebration .moment-detail')).to_contain_text('BOT 40 #2')
    expect(page.locator('.sea-cell-status')).to_have_count(20)
    assert all(text.strip() for text in page.locator('.sea-cell-status').all_text_contents())
   state=turn(state,[{'number':7,'mult':1},{'number':7,'mult':1},miss]);post(state)
   # Select the other fleet explicitly, then return to automatic shot following.
   phone.locator('.sea-fleet-tabs button').filter(has_text='Vloot BOT 40 #2').click()
   expect(phone.locator('.sea-cell[data-number="7"] .sea-cell-status')).to_have_text('ONBEKEND')
   phone.locator('.sea-follow').click();expect(phone.locator('.sea-grid')).to_have_attribute('data-fleet-player','0')
   for width,height in [(393,852),(744,900),(1024,600),(1920,1080),(1080,1920)]:
    screen.set_viewport_size({'width':width,'height':height});screen.wait_for_timeout(150)
    bounds=screen.locator('.sea-grid').bounding_box();assert bounds['y']+bounds['height']<=height+1,(width,height,bounds)
    minimum=12 if screen.locator('body').evaluate("e=>e.classList.contains('remote-control')") else 18
    assert screen.locator('.sea-cell-status').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=minimum
    screen.screenshot(path=str(OUT/f'sea-feedback-{width}x{height}.png'))
   screen.set_viewport_size({'width':1920,'height':1080})
   print('PASS saved cell 7: attacker/victim, explicit fleet selection, automatic follow, all20 labels and large display text',flush=True)
   state=seed(count=4);victim=state['players'][1]
   for cell,damage in [(0,1),(6,2),(7,2),(8,2),(19,0)]:victim['seaShots'][cell]=1;victim['seaHull'][cell]=damage
   post(state)
   for number,label in [(1,'RAAK'),(7,'VERNIETIGD'),(8,'GEZONKEN'),(20,'WATER'),(19,'ONBEKEND')]:
    expect(phone.locator(f'.sea-cell[data-number="{number}"] .sea-cell-status')).to_have_text(label)
   for width,height in [(393,852),(744,900),(1024,600),(1920,1080)]:
    screen.set_viewport_size({'width':width,'height':height});screen.wait_for_timeout(180)
    screen.screenshot(path=str(OUT/f'sea-four-players-{width}x{height}.png'))
    bad=screen.locator('.sea-cell-status').evaluate_all('els=>els.map(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return {text:e.textContent,top:a.top,bottom:a.bottom,tileTop:b.top,tileBottom:b.bottom,width:a.width,tileWidth:b.width}}).filter(a=>a.top<a.tileTop||a.bottom>a.tileBottom+1||a.width>a.tileWidth)')
    assert not bad,(width,height,bad)
   print('PASS all five tile labels and four-player viewport legibility',flush=True)
   # Two different destruction moments must queue, not erase each other.
   state=seed();state['active']=1;post(state)
   for page in [phone,screen]:page.evaluate('window.moments=[]')
   draft([{'number':7,'mult':2}])
   for page in [phone,screen]:expect(page.locator('#score-celebration .moment-detail')).to_contain_text('vernietigt 7')
   draft([{'number':7,'mult':2},{'number':8,'mult':2}])
   for page in [phone,screen]:
    page.wait_for_function('window.moments.length>=2',timeout=7000)
    text=page.evaluate('window.moments');assert 'vernietigt 7' in text[0] and 'vernietigt 8' in text[1],text
   print('PASS consecutive moments queue without replacement, with named shooter on controller and display',flush=True)
   # The game-winning hit used to be cleared by showWinner().
   for game in ['seabattle','killer','gotcha','fourinarow']:
    state=seed(game)
    if game=='seabattle':
     for pstate in state['players']:
      pstate['seaHull']=[2 if ship else 0 for ship in pstate['seaFleet']]
      pstate['seaShots']=[1]*20
     state['players'][1]['seaHull'][6]=0;state['players'][1]['seaRemaining']=2
     hits=[{'number':7,'mult':2}]
    elif game=='killer':
     state['killerStage']='playing';state['players'][0].update(killerNumber=20,killerActivated=True,killerLetters=3)
     state['players'][1].update(killerNumber=18,killerLives=1);hits=[{'number':18,'mult':1}]
    elif game=='gotcha':
     state['players'][0]['remaining']=281;state['players'][1]['remaining']=301;hits=[{'number':20,'mult':1}]
    else:
     state['fourOwners'][:3]=[0,0,0];hits=[{'cell':3,'mult':3}]
    post(state);finished=turn(state,hits);assert finished['phase']=='won';post(finished)
    for page in [phone,screen]:
     expect(page.locator('#result-dialog')).to_be_visible()
     expect(page.locator('#score-celebration.game-moment')).to_be_visible()
     expect(page.locator('#score-celebration .moment-detail')).to_contain_text('BOT 50 #1')
     assert page.locator('#score-celebration').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
    print('PASS winning moment survives winner screen:',game,flush=True)
   state=seed('fourinarow');state['fourOwners'][:3]=[0,0,0];post(state)
   finished=turn(state,[{'cell':3,'mult':3}])
   for page in [phone,screen]:
    page.evaluate("state=>document.dispatchEvent(new CustomEvent('online-match-finished',{detail:{state,undo:[]}}))",finished)
    expect(page.locator('#result-dialog')).to_be_visible()
    expect(page.locator('#score-celebration.game-moment')).to_be_visible()
    expect(page.locator('#score-celebration .moment-detail')).to_contain_text('BOT 50 #1')
   print('PASS online winner announcement retains the final claim impact on both devices',flush=True)
   phone.set_viewport_size({'width':744,'height':900})
   for game in ['cricket','tactics']:
    state=seed(game);phone.wait_for_timeout(200)
    phone.evaluate("window.keptBoard=document.querySelector('.visual-display .graphic-dartboard');window.keptFrame=window.keptBoard.parentElement")
    for number in [20,19,18]:
     draft([{'number':number,'mult':2}])
     expect(phone.locator('.graphic-marks [data-marks="2"]').first).to_be_visible()
     assert phone.evaluate("document.querySelector('.visual-display .graphic-dartboard')===window.keptBoard&&window.keptBoard.parentElement===window.keptFrame")
    print('PASS stable measured board/frame while marks update:',game,flush=True)
   assert not errors,errors;browser.close()
 finally:server.terminate();server.wait()
