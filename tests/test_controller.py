"""Two independent phones, physical screen, and Bluetooth-equivalent requests."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
url='http://127.0.0.1:8788'
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   screen=browser.new_page(viewport={'width':1080,'height':1920})
   screen.goto(url)
   state=screen.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',3)}")
   def saved():return screen.request.get(url+'/api/state').json()
   assert screen.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
   screen.reload()
   a=browser.new_page(viewport={'width':393,'height':850});a.goto(url+'/?remote=1')
   expect(a.locator('#controller-note')).to_have_text('Scorebediening actief')
   b=browser.new_page(viewport={'width':393,'height':850});b.goto(url+'/?remote=1')
   expect(b.locator('#controller-note')).to_contain_text('Meekijken')
   def digit(page,n):page.locator('#keypad').get_by_role('button',name=str(n),exact=True).click()
   digit(a,6);expect(screen.locator('#entry')).to_have_text('6')
   expect(b.locator('#entry')).to_have_text('6')
   digit(b,9);expect(b.locator('#entry')).to_have_text('6')
   old=saved()['control'];before=saved()['match']
   b.get_by_text('Verbindingen',exact=True).click();b.locator('#take-control').click()
   expect(b.locator('#controller-note')).to_have_text('Scorebediening actief')
   expect(a.locator('#controller-note')).to_contain_text('Meekijken')
   assert saved()['match']==before
   expect(b.locator('#entry')).to_have_text('6')
   digit(b,0);expect(screen.locator('#entry')).to_have_text('60')
   # Stale writes must be rejected even over loopback Bluetooth, all shared mutations.
   ticket={'id':old['owner'],'epoch':old['epoch']}
   payloads={'/api/state':{'revision':saved()['revision'],'match':before},
     '/api/draft':{'revision':saved()['revision'],'owner':'old','seq':99,'hits':[],'entry':'9'},
     '/api/setup':{'revision':saved()['revision'],'value':None},
     '/api/display':{'inputCollapsed':True}}
   for path,body in payloads.items():
    response=screen.request.post(url+path,data={**body,'_controller':ticket},headers={'X-Darts-Transport':'bluetooth'})
    assert response.status==423,(path,response.status,response.text())
   b.locator('#confirm-total').click()
   expect(screen.locator('#entry')).to_have_text('0')
   assert saved()['match']['state']['players'][0]['remaining']==441
   # Physical screen still operates, followers receive its live draft.
   digit(screen,2);expect(b.locator('#entry')).to_have_text('2')
   b.reload();expect(b.locator('#controller-note')).to_have_text('Scorebediening actief')
   # Explicit recovery when the controlling phone disappears.
   b.close();a.get_by_text('Verbindingen',exact=True).click();a.locator('#take-control').click()
   expect(a.locator('#controller-note')).to_have_text('Scorebediening actief')
   expect(a.locator('#entry')).to_have_text('2')
   # Same client, new ownership epoch: original delayed request still rejected.
   assert saved()['control']['owner']==ticket['id']
   assert screen.request.post(url+'/api/state',data={**payloads['/api/state'],'_controller':ticket}).status==423
   # Bluetooth first connection without the new protocol cannot bypass the lock.
   assert screen.request.post(url+'/api/display',data={'inputCollapsed':True},headers={'X-Darts-Transport':'bluetooth'}).status==423
   print('PASS takeover, viewer, pending draft, scores, reload, offline owner, stale epoch and Bluetooth gate')
   browser.close()
 finally:server.terminate();server.wait()
