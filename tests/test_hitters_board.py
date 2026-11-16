"""Portrait target guide: correct segments, real available space, scoring and rotation."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,mimetypes,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8895' if ASSETS else '8894';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/hitters-board49';OUT.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for remote in ([True] if ASSETS else [False,True]):
    page=browser.new_page(viewport={'width':393,'height':852});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    if ASSETS:
     def assets(route):
      path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
      if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
      else:route.fallback()
     page.route(URL+'/**',assets)
    page.goto(URL+('/?remote=1' if remote else '/'));page.locator('#navigation-close').click()
    def saved():return page.request.get(URL+'/api/state').json()
    def seed(count,mode='double',target=20):
     state=page.evaluate("""async({count,mode,target})=>{
      const s=(await import('/engine.js')).newMatch(['Anna','Bert','Cato','Daan'].slice(0,count),301,'single',1,{game:'tenlives',livesMode:mode});
      s.players[0].livesTarget=target;return s;
     }""",{'count':count,'mode':mode,'target':target})
     state['startedAt']=int(time.time()*1000)
     assert page.request.post(URL+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
     expect(page.locator('#lives-game')).to_have_attribute('data-match',str(state['startedAt']))
     expect(page.locator('.lives-current')).to_have_text('Bull (50)' if target==25 else ('T' if mode=='triple' else 'D')+str(target))
     page.wait_for_timeout(150)
    for count in [1,2,4]:
     seed(count)
     for collapsed in ([False] if remote else [False,True]):
      assert page.request.post(URL+'/api/display',data={'inputCollapsed':collapsed}).ok
      for width,height in [(393,852),(821,1088),(744,1024),(1080,1920),(1920,1080),(1088,821),(1024,600),(393,450),(320,640)]:
       page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(250)
       assert not page.locator('body').evaluate("e=>e.classList.contains('viewport-game')")
       frame=page.locator('.lives-board-frame');board=page.locator('.lives-dartboard');button=page.locator('#toggle-toolbar').bounding_box()
       assert 0<=button['x'] and button['x']+button['width']<=width
       assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(remote,count,width,height)
       if width>=height:expect(frame).to_be_hidden()
       if frame.is_visible():
        b=board.bounding_box();focus=page.locator('.lives-focus').bounding_box();control=page.locator('.lives-controls').bounding_box();scores=page.locator('.lives-players').bounding_box()
        assert b['width']>=130 and abs(b['width']-b['height'])<=1,(remote,count,width,height,b)
        assert focus['x']<=b['x'] and b['x']+b['width']<=focus['x']+focus['width']+1
        assert b['y']+b['height']<=height+1,(remote,count,width,height,b)
        def separate(a,c):return a['x']+a['width']<=c['x']+1 or c['x']+c['width']<=a['x']+1 or a['y']+a['height']<=c['y']+1 or c['y']+c['height']<=a['y']+1
        assert separate(b,control) and separate(b,scores),(remote,count,width,height,b,control,scores)
        first=b.copy();page.wait_for_timeout(180);later=board.bounding_box()
        assert later and all(abs(first[key]-later[key])<=1 for key in ['x','y','width','height']),('Board fitting must settle without resizing loops',remote,count,collapsed,width,height,first,later)
       if height>width and (height>=1800 or remote and height>=1088 or remote and count<=2 and width>=393 and height>=852):
        if not frame.is_visible():
         print('HIDDEN',remote,count,collapsed,width,height,page.evaluate("""()=>[...document.querySelectorAll('main,#game,#lives-game,.lives-focus,.lives-focus>*,.lives-controls')].map(n=>({tag:n.className||n.id,box:n.getBoundingClientRect().toJSON(),height:n.clientHeight,style:{display:getComputedStyle(n).display,gap:getComputedStyle(n).rowGap,padding:getComputedStyle(n).padding}}))"""),flush=True)
         page.screenshot(path=str(OUT/'hidden.png'))
        expect(frame).to_be_visible()
       if count==4 and (width,height) in [(393,852),(821,1088),(1080,1920),(1920,1080)]:
        page.screenshot(path=str(OUT/f'board-{remote}-{collapsed}-{width}x{height}-{bool(ASSETS)}.png'))
      print('PASS portrait guide, unchanged landscape and no overlap:',count,'players','controller' if remote else 'NUC',collapsed,flush=True)
    page.set_viewport_size({'width':821,'height':1088})
    for mode in ['double','triple']:
     for target in [20,19,10,25]:
      seed(2,mode,target)
      expect(page.locator('.lives-dartboard')).to_have_attribute('data-target',str(target))
      expect(page.locator('.lives-dartboard .target-ring')).to_have_count(1)
      if target==25:expect(page.locator('.lives-board-bull .target-ring')).to_have_attribute('r','11')
      else:expect(page.locator(f'.lives-board-sector[data-number="{target}"] .target-ring')).to_have_attribute('data-ring',mode)
      assert page.locator('.lives-board-sector text').all_text_contents()==['20','1','18','4','13','6','10','15','2','17','3','19','7','16','8','11','14','9','12','5']
    if remote:
     seed(2)
     page.locator('#lives-hit').click();expect(page.locator('.lives-dartboard')).to_have_attribute('data-target','19')
     page.locator('#lives-undo').click();expect(page.locator('.lives-dartboard')).to_have_attribute('data-target','20')
     page.locator('#lives-correction-0').click();page.locator('#lives-miss').click();page.locator('#lives-correction-confirm').click()
     expect(page.locator('.lives-attempt-count')).to_have_text('2');expect(page.locator('.lives-dartboard')).to_have_attribute('data-target','20')
     before=saved();page.locator('.lives-dartboard').evaluate('e=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))');page.wait_for_timeout(100)
     assert saved()['match']==before['match'],'The target guide must not enter a score'
     print('PASS hit/miss and undo follow the target; visual board never submits scores',flush=True)
    assert not errors,errors;page.close()
   browser.close()
 finally:server.terminate();server.wait()
