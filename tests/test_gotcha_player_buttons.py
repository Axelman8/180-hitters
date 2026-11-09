from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8794','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   page=browser.new_page(viewport={'width':393,'height':852})
   page.goto('http://127.0.0.1:8794/?remote=1')
   state=page.evaluate("async()=>{const {newMatch}=await import('/engine.js');const s=newMatch(['Anna','Bert','Caro','Dirk'],301,'single',1,{game:'gotcha'});[50,20,40,60].forEach((score,i)=>s.players[i].remaining=score);return s}")
   current=page.request.get('http://127.0.0.1:8794/api/state').json()
   assert page.request.post('http://127.0.0.1:8794/api/state',data={'revision':current['revision'],'match':{'state':state,'undo':[]}}).ok
   page.reload()
   targets=page.locator('#gotcha-targets')
   expect(targets).to_be_visible()
   expect(targets.locator('button')).to_have_count(3)
   expect(targets.get_by_role('button',name='Anna op 0',exact=True)).to_have_count(0)
   for name in ['Bert','Caro','Dirk']:
    expect(targets.get_by_role('button',name=f'{name} op 0',exact=True)).to_be_visible()
   for width,height in [(393,852),(600,1024),(1080,1920)]:
    page.set_viewport_size({'width':width,'height':height})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    for name in ['Bert','Caro','Dirk']:
     box=targets.get_by_role('button',name=f'{name} op 0',exact=True).bounding_box()
     assert box and box['x']>=0 and box['x']+box['width']<=width,(width,name,box)
   page.locator('#mode-dart').click()
   expect(targets).to_be_visible()
   for name in ['Bert','Caro','Dirk']:
    targets.get_by_role('button',name=f'{name} op 0',exact=True).click()
   saved=page.request.get('http://127.0.0.1:8794/api/state').json()['match']['state']
   assert saved['active']==0
   assert [player['remaining'] for player in saved['players']]==[50,0,0,0]
   for name in ['Bert','Caro','Dirk']:
    expect(targets.get_by_role('button',name=f'{name} op 0',exact=True)).to_be_disabled()
   browser.close()
   print('PASS: Gotcha supports four players and shows one persistent reset button per opponent')
 finally:
  server.terminate();server.wait()
