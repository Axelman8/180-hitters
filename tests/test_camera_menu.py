"""Fast NUC camera access on connected phones and legacy tablets only."""
from pathlib import Path
import json,subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8853','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen('http://127.0.0.1:8853/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for tablet,width,height in [(False,320,740),(False,393,852),(False,744,1133),(True,1024,768)]:
    for mode,connected in [('local',False),('bluetooth',False),('bluetooth',True)]:
     page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
     connection={'mode':mode,'bluetoothConnected':connected,'versionName':'test'}
     page.add_init_script('window.cameraTestConnection='+json.dumps(connection)+';window.DartsAndroid={isTabletShell:'+str(tablet).lower()+',isLocalMode:()=>window.cameraTestConnection.mode==="local",getConnectionMode:()=>window.cameraTestConnection.mode,bindAction:(el,handler)=>{el.onclick=handler;}};'+('' if tablet else 'window.DartsAndroid.getConnectionInfo=()=>JSON.stringify(window.cameraTestConnection);'))
     page.route('**/api/tablet/config',lambda route:route.fulfill(json=connection))
     page.route('**/api/tablet/diagnostics',lambda route:route.fulfill(json={'appVersionName':'test'}))
     camera={'available':True,'connected':True,'enabled':False,'recording':False,'pending':None,'message':'Gereed'};writes=[];reads=[]
     def camera_request(route):
      if route.request.method=='POST':
       data=route.request.post_data_json;camera['enabled']=data['enabled'];writes.append(('configure',data['enabled']))
      else:reads.append(True)
      route.fulfill(json=camera)
     def reset(route):writes.append(('reset',True));route.fulfill(json=camera)
     page.route('**/api/autoscoring',camera_request);page.route('**/api/autoscoring/reset',reset)
     page.on('dialog',lambda dialog:dialog.accept())
     page.goto('http://127.0.0.1:8853/?android=1');tile=page.locator('.navigation-category[data-menu="cameras"]')
     expect(page.locator('#header-menu')).to_be_visible();page.locator('#navigation-close').click()
     if not connected:
      expect(tile).to_be_hidden();expect(page.locator('#camera-game-controls')).not_to_be_visible();page.wait_for_timeout(450)
      assert not writes
      if mode=='local':assert not reads,'Standalone play must not poll the NUC cameras'
     else:
      expect(tile).to_have_count(0)
      expect(page.locator('body>header>#camera-game-controls')).to_be_visible();assert page.locator('#camera-game-controls').count()==1
      controls=[page.locator(id).bounding_box() for id in ['#mode-status','#camera-game-toggle','#camera-calibration-open','#toggle-toolbar']]
      for box in controls:assert box['x']>=0 and box['x']+box['width']<=width+1,controls
      for a,b in zip(controls,controls[1:]):assert a['x']+a['width']<=b['x']+1,controls
      assert max(box['y'] for box in controls)-min(box['y'] for box in controls)<20,controls
      assert controls[3]['x']-(controls[2]['x']+controls[2]['width'])<20,'Camera buttons belong beside Menu'
      version=page.locator('#app-version').bounding_box()
      for box in controls:assert version['y']>=box['y']+box['height']-1 or version['x']+version['width']<=box['x'] or version['x']>=box['x']+box['width'],(box,version,page.locator('body>header').evaluate('e=>[e.getBoundingClientRect().toJSON(),getComputedStyle(e).padding,getComputedStyle(e).alignItems,getComputedStyle(e).minHeight]'))
      page.screenshot(path=str(root/f'.tools/header-cameras-{width}.png'))
      toggle=page.locator('#camera-game-toggle');calibrate=page.locator('#camera-calibration-open')
      expect(toggle).to_have_text('Camera uit');expect(calibrate).to_be_disabled()
      assert toggle.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(143, 48, 56)'
      assert calibrate.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(38, 50, 59)'
      toggle.click();expect(toggle).to_have_attribute('aria-pressed','true');expect(toggle).to_have_text('Camera aan');expect(calibrate).to_be_enabled()
      assert toggle.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(66, 117, 46)'
      toggle.click();expect(toggle).to_have_attribute('aria-pressed','false');expect(calibrate).to_be_disabled()
      assert writes==[('configure',True),('configure',False)],writes
      connection['bluetoothConnected']=False;page.evaluate('window.cameraTestConnection.bluetoothConnected=false')
      expect(tile).to_be_hidden(timeout=7000);expect(page.locator('#camera-game-controls')).not_to_be_visible()
      expect(page.locator('#header-menu')).not_to_be_visible()
      connection['bluetoothConnected']=True;page.evaluate('window.cameraTestConnection.bluetoothConnected=true')
      expect(page.locator('#camera-game-controls')).to_be_visible(timeout=7000)
     assert not errors,errors
     print('PASS camera menu:',('legacy tablet' if tablet else 'phone'),width,mode,connected,flush=True);page.close()
   # The existing camera section on the NUC remains available.
   page=browser.new_page();page.goto('http://127.0.0.1:8853/');page.wait_for_timeout(650);page.evaluate("document.dispatchEvent(new Event('open-main-menu'))");page.locator('.navigation-category[data-menu="nuc"]').click()
   expect(page.locator('#camera-game-controls')).to_be_visible();expect(page.locator('.navigation-category[data-menu="cameras"]')).to_be_hidden();browser.close()
 finally:server.terminate();server.wait()
