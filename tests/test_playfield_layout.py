"""All games: score at top, maximum board size, no input overlap, responsive resize."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8884' if ASSETS else '8883';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/playfields47';OUT.mkdir(exist_ok=True)
GAMES=['killer','fourinarow','seabattle','golf','shanghai','cricket','tactics','bobs27','gotcha','scram','bull41','twentyone','tenlives','x01','121']
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for remote,expanded in ([(True,True)] if ASSETS else [(False,False),(False,True),(True,True)]):
    context=browser.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda error:(errors.append(str(error)),print('JS ERROR',error,flush=True)))
    if ASSETS:
     def assets(route):
      path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
      if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
      else:route.fallback()
     page.route(URL+'/**',assets)
    page.set_viewport_size({'width':1920 if not remote else 393,'height':1080 if not remote else 852})
    page.goto(URL+('/?remote=1' if remote else '/'));page.wait_for_timeout(600)
    if page.locator('#header-menu').is_visible():page.locator('#navigation-close').click()
    assert page.request.post(URL+'/api/display',data={'inputCollapsed':not expanded}).ok
    for index,game in enumerate(GAMES):
     sample=page.evaluate("async game=>(await import('/engine.js')).newMatch(['Anna de Vries','Bert','Cato','Daan'],301,'single',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double'})",game)
     sample['startedAt']=int(time.time()*1000)+index
     current=page.request.get(URL+'/api/state').json();assert page.request.post(URL+'/api/state',data={'revision':current['revision'],'match':{'state':sample,'undo':[]}}).ok
     expect(page.locator('#game')).to_have_attribute('data-layout-ready',str(sample['startedAt']));page.wait_for_timeout(100)
     views=[(1920,1080),(1280,720),(1080,1920)] if not remote else [(320,640),(393,852),(744,900),(872,736),(1024,600)]
     for width,height in views:
      page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(160)
      # A tablet/phone remains a controller even on a large internal Fold screen.
      if remote:assert 'remote-control' in page.locator('body').get_attribute('class')
      kind=page.locator('body').get_attribute('data-playfield')
      if kind!='lives':expect(page.locator('#lives-game')).to_be_hidden()
      selectors={'killer':('.killer-players','.killer-arena','.killer-controls'),'party':('.party-players','.party-arena','.party-controls'),'four':('.four-legend','.four-board-frame','.four-controls'),'sonny':('.sonny-players','.sonny-board','.sonny-layout>.sonny-controls'),'lives':('.lives-players','.lives-focus','.lives-controls')}
      if kind=='visual':
       control='.graphic-compact-input' if game in ['cricket','tactics'] else '.visual-shell>.scoring';selectors['visual']=('.visual-players','.visual-arena',control)
      if kind=='x01':selectors['x01']=('#players','#finish-panel' if remote else '#screen-overview','.scoring')
      scores,field,control=selectors[kind];a=page.locator(scores).bounding_box();b=page.locator(field).bounding_box();c=page.locator(control).bounding_box() if control else None
      def failure(reason):
       page.screenshot(path=str(OUT/'failure.png'),full_page=True);raise AssertionError((reason,game,remote,width,height,a,b,c))
      if not a or not b:failure('missing scores/playfield')
      if a['y']+a['height']>b['y']+1:failure('scores must be above playfield')
      if c and not(a['y']+a['height']<=c['y']+1):failure('scores must be above input')
      if c and c['y']+c['height']>b['y']+1:failure('input must be between scores and playfield')
      if c and not(b['x']+b['width']<=c['x']+1 or c['x']+c['width']<=b['x']+1 or b['y']+b['height']<=c['y']+1 or c['y']+c['height']<=b['y']+1):failure('field/input overlap')
      if not page.evaluate('document.querySelector("main").scrollWidth<=document.querySelector("main").clientWidth+1'):failure('horizontal overflow')
      if c:
       for widget in page.locator(control).locator('button,output,.section-heading').all():
        if not widget.is_visible():continue
        box=widget.bounding_box()
        if box['x']<c['x']-2 or box['y']<c['y']-2 or box['x']+box['width']>c['x']+c['width']+2 or box['y']+box['height']>c['y']+c['height']+2:failure(('input widget escapes its band',widget.get_attribute('id'),widget.inner_text(),box,widget.evaluate('e=>({height:getComputedStyle(e).height,min:getComputedStyle(e).minHeight,max:getComputedStyle(e).maxHeight,align:getComputedStyle(e).alignSelf})')))
      for svg in page.locator('.stage-board-frame svg').all():
       if not svg.is_visible():continue
       dims=svg.bounding_box();frame=svg.locator('..').bounding_box();ratio=svg.evaluate('e=>e.viewBox.baseVal.width/e.viewBox.baseVal.height')
       maximum=min(frame['width'],frame['height']*ratio)
       if dims['width']<maximum-3 or dims['width']>maximum+3:failure(('board does not fill frame',dims,frame))
       if dims['height']<60:failure(('board too small',dims,frame))
      if expanded and not remote and game=='killer' and height>width:
       if page.locator('.killer-dartboard').bounding_box()['width']<width*.94:failure('portrait board must use the full width below input')
      if not remote and not expanded and game=='killer':
       board=page.locator('.killer-dartboard').bounding_box();maximum=min(width-40,height-(a['y']+a['height'])-48)
       if board['width']<maximum*.9:failure(('Killer leaves unused viewport',board,maximum))
      if (width,height) in [(1920,1080),(1080,1920),(393,852),(1024,600)]:page.screenshot(path=str(OUT/f'{game}-{width}x{height}-{remote}-{expanded}.png'))
     if expanded:
      page.set_viewport_size({'width':393 if remote else 1080,'height':852 if remote else 1920})
      def check_open_input(control,field):
       page.wait_for_timeout(160);root=page.locator(control).bounding_box();arena=page.locator(field).bounding_box()
       assert root and arena and root['y']+root['height']<=arena['y']+1,(game,control,root,arena)
       for button in page.locator(control).locator('button').all():
        if not button.is_visible():continue
        box=button.bounding_box();assert root['x']-2<=box['x'] and box['x']+box['width']<=root['x']+root['width']+2,(game,button.get_attribute('id'),root,box)
      if game in ['gotcha','x01','121']:
       page.locator('#mode-dart').click();expect(page.locator('#dart-input')).to_be_visible()
       check_open_input('.scoring','.visual-arena' if game=='gotcha' else '#finish-panel' if remote else '#screen-overview')
       page.locator('#mode-total').click();expect(page.locator('#total-input')).to_be_visible()
      if game in ['cricket','tactics']:
       page.locator('.graphic-more-input').click();expect(page.locator('.visual-shell>.scoring')).to_be_visible()
       check_open_input('.visual-shell>.scoring','.visual-arena')
       page.locator('.graphic-more-input').click();expect(page.locator('.graphic-compact-input')).to_be_visible()
      if game=='bobs27':
       page.locator('#toggle-history').click();expect(page.locator('#turn-controls')).to_be_visible()
       check_open_input('.visual-shell>.scoring','.visual-arena')
       page.locator('#toggle-history').click();expect(page.locator('#turn-controls')).to_be_hidden()
     assert not errors,errors;print('PASS maximum playfield, top scores and separate input:',game,'controller' if remote else 'NUC input' if expanded else 'NUC display',flush=True)
    # A two-player NUC also keeps expanded input between players and board.
    if not remote and expanded:
     for game,group,field,control in [('killer','.killer-players','.killer-arena','.killer-controls'),('fourinarow','.four-legend','.four-board-frame','.four-controls'),('bobs27','.visual-players','.visual-arena','.visual-shell>.scoring'),('golf','.party-players','.party-arena','.party-controls')]:
      sample=page.evaluate("async game=>(await import('/engine.js')).newMatch(['Anna','Bert'],301,'single',1,{game})",game)
      sample['startedAt']=int(time.time()*1000)
      current=page.request.get(URL+'/api/state').json();assert page.request.post(URL+'/api/state',data={'revision':current['revision'],'match':{'state':sample,'undo':[]}}).ok
      expect(page.locator('#game')).to_have_attribute('data-layout-ready',str(sample['startedAt']))
      page.set_viewport_size({'width':1280,'height':720});page.request.post(URL+'/api/display',data={'inputCollapsed':False})
      expect(page.locator(control)).to_be_visible();page.wait_for_timeout(160)
      a=page.locator(field).bounding_box();b=page.locator(control).bounding_box();scores=page.locator(group).bounding_box()
      assert scores['y']+scores['height']<=min(a['y'],b['y'])+1
      assert b['y']+b['height']<=a['y']+1,(game,a,b)
     print('PASS two-player displays and NUC expanded scoring controls',flush=True)
    assert not errors,errors
    context.close()
   browser.close()
 finally:server.terminate();server.wait()
