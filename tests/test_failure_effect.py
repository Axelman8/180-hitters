import subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8791','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();phone=b.new_page(viewport={'width':390,'height':844});screen=b.new_page();url='http://127.0.0.1:8791'
   errors=[]
   for page,query in [(phone,'/?remote=1'),(screen,'/')]:
    page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url+query)
    page.evaluate("window.effects=0;new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.id==='lives-fail-effect')window.effects++}).observe(document.body,{childList:true})")
   state=phone.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',3,{game:'tenlives',livesMode:'double'})}")
   rev=phone.request.get(url+'/api/state').json()['revision'];assert phone.request.post(url+'/api/state',data={'revision':rev,'match':{'state':state,'undo':[]}}).ok
   expect(phone.locator('#lives-miss')).to_be_visible();phone.locator('#lives-miss').click();expect(phone.locator('.lives-attempt-count')).to_have_text('2')
   assert phone.evaluate('window.effects')==0
   phone.locator('#lives-miss-three').click()
   expect(phone.locator('#lives-fail-effect')).to_be_visible()
   assert phone.locator('#lives-fail-effect').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
   expect(screen.locator('.lives-name')).to_have_text('B')
   phone.wait_for_timeout(1600)
   for page in (phone,screen):
    assert page.evaluate('window.effects')==1
    expect(page.locator('#lives-fail-effect')).to_have_count(0)
   phone.locator('#lives-undo').click();expect(screen.locator('.lives-name')).to_have_text('A')
   phone.wait_for_timeout(900)
   for page in (phone,screen):assert page.evaluate('window.effects')==1
   assert not errors,errors
   b.close();print('PASS only exhausted attempts trigger; synced once on mobile/NUC; nonblocking; cleanup; no undo replay')
 finally:server.terminate();server.wait()
