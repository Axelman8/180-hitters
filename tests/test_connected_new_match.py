"""A connected follower can start a new match without losing the current one early."""
from pathlib import Path
import re,subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
base='http://127.0.0.1:8854'
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8854','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen(base+'/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for device in ['phone','tablet','nuc']:
    page=browser.new_page(viewport={'width':1024 if device!='phone' else 393,'height':852});errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    if device!='nuc':page.add_init_script('window.DartsAndroid={isTabletShell:'+str(device=='tablet').lower()+',isLocalMode:()=>false,getConnectionInfo:()=>JSON.stringify({mode:"bluetooth",bluetoothConnected:true})}')
    page.goto(base)
    state=page.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',1,{game:'fourinarow'});}")
    get=lambda:page.request.get(base+'/api/state').json()
    assert page.request.post(base+'/api/state',data={'revision':get()['revision'],'match':{'state':state,'undo':[]}}).ok
    page.wait_for_timeout(800)
    if device!='nuc':
     assert page.request.post(base+'/api/controller',data={'id':'other-device-0123456789','takeover':True}).ok
     expect(page.locator('body')).to_have_class(re.compile('controller-viewer'))
    def new_party():
     page.evaluate("document.dispatchEvent(new Event('open-main-menu'))")
     page.locator('.navigation-category[data-menu="play"]').click();page.locator('#settings').click()
     expect(page.locator('#new-match-dialog')).to_be_visible()
     expect(page.locator('#new-match-confirm')).to_be_enabled()
    new_party();page.locator('#new-match-cancel').click()
    assert get()['match']['state']==state,'Cancel must keep the existing match'
    new_party();page.locator('#new-match-confirm').click();expect(page.locator('#setup')).to_be_visible()
    expect(page.locator('#new-match-dialog')).not_to_be_visible()
    assert get()['match']['state']==state,'The wizard must not discard the old match'
    page.locator('.wizard-game').filter(has=page.get_by_text('Tactics',exact=True)).click()
    page.locator('.wizard-next').click()
    expect(page.locator('#setup-wizard h1')).to_have_text('Wie doen er mee?')
    page.locator('.wizard-next').click();expect(page.locator('#setup')).to_be_hidden()
    assert get()['match']['state']['game']=='tactics'
    if device!='nuc':assert get()['control']['owner']==page.evaluate("sessionStorage.getItem('darts.controller')")
    assert not errors,errors
    print('PASS connected new match:',device,flush=True);page.close()
   browser.close()
 finally:server.terminate();server.wait()
