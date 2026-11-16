"""Seven graphical views, four seats, real input, NUC controls and phone layouts."""
from pathlib import Path
import json,mimetypes,subprocess,sys,tempfile,time
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
URL='http://127.0.0.1:8863'
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port','8863','--data-file',str(Path(temp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852},has_touch=True);errors=[]
   page.on('pageerror',lambda error:(errors.append(str(error)),print('JS ERROR',error,flush=True)))
   if ASSETS:
    def assets(route):
     path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
     if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
     else:route.fallback()
    page.route(URL+'/**',assets);page.add_init_script("localStorage.setItem('180hitters.legacy.connectionMode','bluetooth')")
    page.route('**/api/tablet/config',lambda route:route.fulfill(json={'mode':'bluetooth','bluetoothConnected':True,'selectedBluetooth':'fixture'}))
   page.goto(URL+'/?remote=1');expect(page.locator('#header-menu')).to_be_visible();page.locator('#navigation-close').click()
   def saved():return page.request.get(URL+'/api/state').json()
   for game in ['gotcha','cricket','tactics','bobs27','golf','shanghai','seabattle']:
    state=page.evaluate("""async game=>{const {newMatch}=await import('/engine.js');return newMatch(['Alexandra','Bert van Dalen','Christine','Daan'],game==='gotcha'?301:501,'single',1,{game})}""",game)
    if game=='gotcha':state['players'][1]['remaining']=45
    assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    root=page.locator('.party-game' if game in ['golf','shanghai','seabattle'] else '.visual-shell')
    expect(page.locator('body')).to_have_attribute('data-game',game);expect(root).to_be_visible();expect(root).to_have_attribute('data-party' if game in ['golf','shanghai','seabattle'] else 'data-visual',game);page.wait_for_timeout(500)
    for width,height in [(320,640),(393,852),(744,900),(872,736),(1024,600),(1920,1080)]:
     page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(80)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(game,width,height)
     selectors=['.party-arena','.party-controls'] if game in ['golf','shanghai','seabattle'] else ['.visual-arena','.graphic-compact-input'] if game in ['cricket','tactics'] and width<=600 else ['.visual-arena','.visual-shell>.scoring']
     a,b=[page.locator(selector).bounding_box() for selector in selectors]

     if not a or not b:
      page.screenshot(path=str(ROOT/'.repair-check/party-ui-failure.png'),full_page=True)
      print(page.locator('.scoring').evaluate("e=>({parent:e.parentElement.className,hidden:e.hidden,display:getComputedStyle(e).display,body:document.body.className})"),flush=True)
     assert a and b,(game,width,height,selectors)
     assert a['x']+a['width']<=b['x']+1 or b['x']+b['width']<=a['x']+1 or a['y']+a['height']<=b['y']+1 or b['y']+b['height']<=a['y']+1,(game,width,height,a,b)
     if (width,height) in [(393,852),(1920,1080)]:page.screenshot(path=str(ROOT/f'.repair-check/{game}-new-{width}.png'),full_page=True)
    page.set_viewport_size({'width':393,'height':852})
    if game=='gotcha':
     page.locator('.gotcha-lane .gotcha-player-reset').first.click();page.wait_for_timeout(200);assert saved()['match']['state']['players'][1]['remaining']==0
    elif game in ['cricket','tactics']:
     page.locator('.graphic-more-input').click();expect(page.locator('.visual-shell>.scoring')).to_be_visible()
     expect(page.locator('.graphic-more-input')).to_have_attribute('aria-expanded','true')
     page.locator('.graphic-more-input').click();expect(page.locator('.graphic-compact-input')).to_be_visible()
     page.locator('.graphic-mark-target').first.click();expect(page.locator('#dart-slots .current')).to_have_text(__import__('re').compile('2|—|-'))
     expect(page.locator('#graphic-miss')).to_be_visible();page.locator('#graphic-miss').click();page.locator('#graphic-miss').click()
     page.wait_for_function("async()=>(await fetch('/api/state').then(r=>r.json())).match.state.history.length===1")
    elif game=='bobs27':
     page.locator('#bobs-hit').click();page.locator('#miss-dart').click();page.locator('#miss-dart').click()
     page.wait_for_function("async()=>(await fetch('/api/state').then(r=>r.json())).match.state.history.length===1")
    elif game in ['golf','shanghai']:
     for index in [0,1,2]:page.locator('.party-controls .sonny-multipliers button').nth(index).click()
     page.wait_for_function("async()=>(await fetch('/api/state').then(r=>r.json())).match.state.history.length===1")
    else:
     for number in [1,2,3]:
      page.locator(f'.sea-cell[data-number="{number}"]').click();page.wait_for_timeout(180)
     page.wait_for_function("async()=>(await fetch('/api/state').then(r=>r.json())).match.state.history.length===1")
    assert not errors,(game,errors)
    page.wait_for_timeout(500);print('PASS graphical game and score input:',game,flush=True)
   # NUC screen-fit styles must never squeeze these boards into one old grid cell.
   nuc=browser.new_page(viewport={'width':1280,'height':900})
   nuc.goto(URL);nuc.locator('#navigation-close').click();nuc.request.post(URL+'/api/display',data={'inputCollapsed':True})
   expect(nuc.locator('body')).to_have_class(__import__('re').compile('input-collapsed'))
   for game in ['gotcha','cricket','tactics','bobs27','golf','shanghai','seabattle']:
    state=nuc.evaluate("async game=>(await import('/engine.js')).newMatch(['Anna','Bert','Cato','Daan'],301,'single',1,{game})",game)
    assert nuc.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(nuc.locator('body')).to_have_attribute('data-game',game)
    board=nuc.locator('.party-game' if game in ['golf','shanghai','seabattle'] else '.visual-shell')
    expect(board).to_be_visible();nuc.wait_for_timeout(150)
    assert board.bounding_box()['width']>=1200,(game,board.bounding_box())
   nuc.close();print('PASS NUC: all seven boards use the available screen width',flush=True)
   # The game picker explicitly labels exactly the five supported online games.
   picker=browser.new_page(viewport={'width':393,'height':852})
   picker.add_init_script("localStorage.setItem('180hitters.club.v1',JSON.stringify({accessToken:'fixture',member:{name:'Test',status:'approved'}}))")
   picker.route('https://180-hitters-online.180-hitters-online.workers.dev/club/**',lambda route:route.fulfill(json={'member':{'name':'Test','status':'approved'},'invitations':[],'players':[]}))
   picker.goto(URL+'/?remote=1');picker.locator('[data-menu="play"].navigation-category').click();picker.locator('#settings').click();expect(picker.locator('#new-match-dialog')).to_be_visible();picker.locator('#new-match-confirm').click()
   expect(picker.locator('.wizard-game')).to_have_count(15)
   expect(picker.locator('.wizard-game .wizard-online-badge')).to_have_count(5)
   picker.locator('.wizard-game').filter(has=picker.get_by_text('Dartgolf',exact=True)).click()
   expect(picker.locator('#wizard-online-start')).to_be_visible();picker.locator('#wizard-online-start').click()
   expect(picker.locator('#online-dialog')).to_be_visible();expect(picker.locator('#online-game')).to_have_value('golf')
   print('PASS: online badges and direct online entry from the game picker',flush=True)
   browser.close()
 finally:server.terminate();server.wait()
