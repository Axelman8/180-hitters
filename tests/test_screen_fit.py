from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();page=b.new_page();page.on('pageerror',lambda e:print('JS ERROR:',str(e),flush=True));page.goto('http://127.0.0.1:8788/')
   for game in ['x01','cricket','tactics','121','gotcha','bobs27']:
    print('Testing',game,flush=True)
    for count in ([2,4] if game=='gotcha' else [1,4]):
     state=page.evaluate("async ({game,count})=>{const {newMatch}=await import('/engine.js');return newMatch(['Remon','Frank','Ed','Leen'].slice(0,count),501,'double',3,{game:game==='121'?'x01':game,training121:game==='121'})}",{'game':game,'count':count})
     revision=page.request.get('http://127.0.0.1:8788/api/state').json()['revision']
     assert page.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
     page.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':False})
     page.evaluate("localStorage.removeItem('oche.match.v1')")
     page.reload();expect(page.locator('#game')).to_be_visible()
     expect(page.locator('body')).to_have_attribute('data-game','x01' if game=='121' else game)
     expect(page.locator('#players .player')).to_have_count(count)
     page.wait_for_timeout(900)
     for collapsed in [False,True]:
      page.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':collapsed})
      page.wait_for_timeout(850)
      for w,h in [(1080,1920),(900,1600),(800,1280),(1920,1080),(1280,720)]:
       page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(120)
       metrics=page.evaluate("({main:document.querySelector('main').clientHeight,scroll:document.querySelector('main').scrollHeight,width:document.documentElement.scrollWidth})")
       assert metrics['width']<=w,(game,count,collapsed,w,metrics)
       if metrics['scroll']>metrics['main']+2:
        print(page.locator('#game, #game>*').evaluate_all("es=>es.map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON(),height:getComputedStyle(e).height,min:getComputedStyle(e).minHeight}))"),flush=True)
       assert metrics['scroll']<=metrics['main']+2,(game,count,collapsed,w,metrics)
       if w==1080 and count==4:page.screenshot(path=str(root/f'tests/screen-fit-{game}-{collapsed}.png'))
   b.close();print('PASS: screen layout for 6 games, 1/4 players, 5 resolutions, expanded/collapsed input')
 finally:server.terminate();server.wait()
