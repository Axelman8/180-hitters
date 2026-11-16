"""Local preferences, real game rendering, safe layouts and parent navigation."""
from pathlib import Path
import json,mimetypes,subprocess,sys,tempfile,time
from urllib.parse import urlsplit,unquote
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8870' if ASSETS else '8869';URL='http://127.0.0.1:'+PORT
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();context=browser.new_context(viewport={'width':393,'height':852},has_touch=True);page=context.new_page();errors=[]
   page.on('pageerror',lambda error:(errors.append(str(error)),print('JS ERROR',error,flush=True)))
   if ASSETS:
    def assets(route):
     path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
     if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
     else:route.fallback()
    page.route(URL+'/**',assets)
   page.goto(URL+'/?remote=1');expect(page.locator('#header-menu')).to_be_visible();page.locator('#navigation-close').click()
   def saved():return page.request.get(URL+'/api/state').json()
   def seed(game):
    state=page.evaluate("async game=>(await import('/engine.js')).newMatch(['Anna','Bert','Cato','Daan'],301,'single',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double'})",game)
    assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(page.locator('body')).to_have_attribute('data-game','x01' if game=='121' else game);page.wait_for_timeout(250)
   def appearance():
    page.locator('#toggle-toolbar').click();page.locator('[data-menu="app"].navigation-category').click();page.locator('#appearance-open').click();expect(page.locator('#appearance-dialog')).to_be_visible()
    assert page.locator('#appearance-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth'), 'Settings must fit without horizontal scrolling'
   def close():
    page.locator('#appearance-dialog .dialog-back').click();expect(page.locator('#navigation-title')).to_have_text('App-instellingen');page.locator('#navigation-back').click();page.locator('#navigation-close').click()
   seed('cricket');original=saved()['match'];original_draft=saved().get('draft');appearance()
   page.locator('#appearance-score-mode').select_option('custom');page.locator('#appearance-score-average').uncheck();page.locator('#appearance-score-last').uncheck()
   page.locator('#appearance-color-mode').select_option('custom')
   page.locator('#appearance-color-0').evaluate("e=>{e.value='#ffbe55';e.dispatchEvent(new Event('change',{bubbles:true}))}")
   page.locator('#appearance-markers').select_option('shapes');page.locator('#appearance-symbol-0').select_option('triangle');page.locator('#appearance-emphasis').select_option('contrast');page.locator('#appearance-board').select_option('classic');page.locator('#appearance-space').select_option('board');page.locator('#appearance-focus').check()
   prefs=page.evaluate("JSON.parse(localStorage.getItem('180hitters.appearance.v1'))");assert prefs['symbols'][0]=='triangle' and len(set(prefs['symbols']))==4
   close();card=page.locator('.visual-players>.visual-player').first
   expect(card.locator('.appearance-marker')).to_have_count(1);expect(card.locator('[data-score-info=average]')).to_have_count(0);expect(card.locator('[data-score-info=darts]')).to_be_visible()
   assert card.evaluate("e=>getComputedStyle(e).backgroundColor")=='rgb(220, 239, 234)'
   assert '#ffbe55'==card.evaluate("e=>e.style.getPropertyValue('--player-color')")
   expect(page.locator('.visual-heading p')).to_be_hidden();expect(page.locator('#graphic-miss')).to_be_visible();expect(page.locator('#toggle-toolbar')).to_be_visible()
   assert saved()['match']==original and saved().get('draft')==original_draft,'Presentation changes must not modify a match or its pending darts'
   other=browser.new_context();nuc=other.new_page();nuc.goto(URL);expect(nuc.locator('body')).to_have_attribute('data-board-style','standard');assert nuc.evaluate("localStorage.getItem('180hitters.appearance.v1')") is None;other.close()
   page.reload();expect(page.locator('body')).to_have_attribute('data-board-style','classic');page.locator('#navigation-close').click();expect(page.locator('.visual-players .appearance-marker')).to_have_count(4)
   assert page.locator('.graphic-sector[data-number="1"] path').first.get_attribute('fill')=='#ded4b5'
   appearance();page.locator('#appearance-board').select_option('calm');close()
   assert page.locator('.graphic-sector[data-number="1"] path').first.get_attribute('fill')=='#1b2b34'
   # Presentation changes must not dismiss a match-setup or edit form.
   page.locator('#toggle-toolbar').click();page.locator('[data-menu="play"].navigation-category').click();page.locator('#edit-match').click();expect(page.locator('#setup')).to_be_visible()
   before_names=page.locator('#names input').evaluate_all('nodes=>nodes.map(e=>e.value)')
   appearance();page.locator('#appearance-space').select_option('auto');close();expect(page.locator('#setup')).to_be_visible()
   assert page.locator('#names input').evaluate_all('nodes=>nodes.map(e=>e.value)')==before_names
   for step in range(4):
    if page.locator('#game').is_visible():break
    page.locator('.wizard-back').click()
   expect(page.locator('#game')).to_be_visible()
   print('PASS: immediate changes, reload persistence, distinct device preferences, safe symbols, visible controls and no match/draft writes',flush=True)
   # Check both space preferences in real playfields, not just the preview.
   for game in ['x01','fourinarow','killer','cricket','tactics','bobs27','golf','shanghai','seabattle']:
    seed(game)
    for space in ['board','input']:
     appearance();page.locator('#appearance-space').select_option(space);close()
     for width,height in [(320,640),(393,852),(744,900),(872,736),(1024,600),(1920,1080)]:
      page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(90)
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(game,space,width,height)
      pair=['.four-board','.four-controls'] if game=='fourinarow' else ['.killer-arena','.killer-controls'] if game=='killer' else ['.party-arena','.party-controls'] if game in ['golf','shanghai','seabattle'] else ['.visual-display','.visual-shell>.scoring'] if game in ['bobs27'] else ['.visual-arena','.graphic-compact-input' if width<=600 else '.visual-shell>.scoring'] if game in ['cricket','tactics'] else ['#players','.scoring']
      boxes=[page.locator(selector).bounding_box() for selector in pair]
      assert all(boxes),(game,space,width,height,pair)
      a,b=boxes;assert a['x']+a['width']<=b['x']+1 or b['x']+b['width']<=a['x']+1 or a['y']+a['height']<=b['y']+1 or b['y']+b['height']<=a['y']+1,(game,space,width,height,boxes)
     page.set_viewport_size({'width':393,'height':852})
    print('PASS configurable responsive layout:',game,flush=True)
   for game in ['scram','bull41','twentyone','tenlives','gotcha','121']:
    seed(game)
    group='.sonny-players' if game in ['scram','bull41','twentyone'] else '.lives-players' if game=='tenlives' else '.visual-players' if game=='gotcha' else '#players'
    expect(page.locator(group+' .appearance-marker')).to_have_count(4)
    if game=='121':expect(page.locator('#players .match-score').first).to_be_visible()
    for width,height in [(393,852),(1024,600)]:
     page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(game,width,height)
    page.set_viewport_size({'width':393,'height':852})
   # Four in a Row keeps its actual game symbols even with a different local icon.
   seed('fourinarow');assert saved()['match']['state']['players'][0]['fourSymbol']!=prefs['symbols'][0]
   mark=page.locator('.four-legend article').first.locator('.appearance-marker');assert mark.locator('circle').count()==1
   appearance();page.screenshot(path=str(ROOT/'.repair-check/appearance-phone.png'),full_page=True);page.locator('#appearance-reset').click();expect(page.locator('#appearance-board')).to_have_value('standard');expect(page.locator('#appearance-space')).to_have_value('auto');close()
   expect(page.locator('.four-legend .appearance-marker')).to_have_count(0);assert saved()['match']['state']['game']=='fourinarow'
   assert not errors,errors
   print('PASS: all fifteen games, parent Back, Four in a Row identity and restore defaults',flush=True)
   offline_context=browser.new_context();offline=offline_context.new_page();offline.route('**/api/state',lambda route:route.fulfill(status=503,json={'error':'fixture unavailable'}));offline.goto(URL+'/?remote=1');offline.locator('[data-menu="app"].navigation-category').click();offline.locator('#appearance-open').click();offline.locator('#appearance-board').select_option('calm');expect(offline.locator('#appearance-status')).to_have_text('Opgeslagen op dit apparaat.');offline_context.close()
   print('PASS: display settings remain usable while match server is unavailable',flush=True);browser.close()
 finally:server.terminate();server.wait()
