from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();page=b.new_page();page.goto('http://127.0.0.1:8788/?android=1')
   for game in ['x01','cricket','tactics','121','gotcha','bobs27']:
    for count in ([2,4] if game=='gotcha' else [1,4]):
     state=page.evaluate("async ({game,count})=>{const {newMatch}=await import('/engine.js');return newMatch(['Remon','Frank','Ed','Leen'].slice(0,count),501,'double',3,{game:game==='121'?'x01':game,training121:game==='121'})}",{'game':game,'count':count})
     revision=page.request.get('http://127.0.0.1:8788/api/state').json()['revision']
     assert page.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
     page.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':True})
     page.reload();expect(page.locator('#game')).to_be_visible()
     for w,h in [(393,852),(768,900),(852,700),(320,740),(1080,850),(393,852)]:
      page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
      assert page.locator('body').evaluate("e=>e.classList.contains('remote-control')")
      expect(page.locator('#keypad:visible, #board-keys:visible')).to_have_count(1)
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(game,w,'overflow')
      boxes=page.locator('#keypad:visible button, #board-keys:visible button').evaluate_all('es=>es.map(e=>{let r=e.getBoundingClientRect();return {w:r.width,h:r.height}})')
      assert all(r['w']>=40 and r['h']>=44 for r in boxes),(game,w,boxes)
      if w==768:
       page.screenshot(path=str(root/f'tests/mobile-fit-{game}.png'))
       metrics=page.evaluate("({game:document.querySelector('#game').getBoundingClientRect().height,main:document.querySelector('main').clientHeight,scroll:document.querySelector('main').scrollHeight})")
       print(game,count,metrics,flush=True)
     page.set_viewport_size({'width':768,'height':900})
     if page.locator('#mode-dart').is_visible():
      page.locator('#mode-dart').click()
      expect(page.locator('#board-keys')).to_be_visible()
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
      assert page.locator('#board-keys').bounding_box()['y']+page.locator('#board-keys').bounding_box()['height']<=900
     if page.locator('#mode-total').is_visible():page.locator('#mode-total').click()
   screen=b.new_page(viewport={'width':1080,'height':1920});screen.goto('http://127.0.0.1:8788/')
   assert not screen.locator('body').evaluate("e=>e.classList.contains('remote-control')")
   b.close();print('PASS: 6 games, 1/4 players, fold/unfold, collapsed NUC input, touch targets and horizontal fit')
 finally:server.terminate();server.wait()
