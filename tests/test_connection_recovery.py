"""Recovery restores ownership and current state, without changing the saved match."""
from pathlib import Path
import json,re,subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1];base='http://127.0.0.1:8855'
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8855','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen(base+'/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for tablet in [False,True]:
    page=browser.new_page(viewport={'width':1024 if tablet else 393,'height':852});errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    config={'mode':'bluetooth','bluetoothConnected':True,'bluetoothEnabled':True,'bluetoothAddress':'AA:BB:CC:DD:EE:FF','selectedBluetooth':'AA:BB:CC:DD:EE:FF'}
    page.add_init_script('window.testConnection='+json.dumps(config)+';window.repairs=0;window.DartsAndroid={isTabletShell:'+str(tablet).lower()+',isLocalMode:()=>window.testConnection.mode==="local",getConnectionMode:()=>window.testConnection.mode,getConnectionInfo:()=>JSON.stringify(window.testConnection),repairConnection:()=>window.repairs++,chooseMode:()=>window.modeChosen=true};')
    connects=[];offline=[False]
    page.route('**/api/tablet/config',lambda route:route.fulfill(json=config))
    page.route('**/api/tablet/diagnostics',lambda route:route.fulfill(json={'appVersionName':'test'}))
    def connect(route):connects.append(True);offline[0]=False;route.fulfill(json={'ok':True})
    page.route('**/api/tablet/bluetooth/connect',connect)
    def state_request(route):
     if offline[0]:route.fulfill(status=503,json={'error':'NUC offline'})
     else:route.continue_()
    page.route('**/api/state',state_request)
    page.goto(base)
    page.evaluate("async()=>{await import('/controller.js?independent-legacy-entry');}")
    assert page.locator('#take-control').count()==1,'Independent bundles must reuse the controller'
    state=page.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',1,{game:'fourinarow'});}")
    get=lambda:page.request.get(base+'/api/state').json()
    assert page.request.post(base+'/api/state',data={'revision':get()['revision'],'match':{'state':state,'undo':[]}}).ok
    page.wait_for_timeout(800)
    assert page.request.post(base+'/api/controller',data={'id':'other-device-0123456789','takeover':True}).ok
    expect(page.locator('body')).to_have_class(re.compile('controller-viewer'))
    expect(page.locator('#navigation-recovery')).to_be_visible(timeout=5000)
    page.locator('#navigation-recovery button').click()
    expect(page.locator('#navigation-recovery p')).to_contain_text('hersteld',timeout=15000)
    assert not connects and page.evaluate('window.repairs')==0,'Healthy Bluetooth must not be disconnected just to take control'
    assert get()['match']['state']==state
    expect(page.locator('body')).not_to_have_class(re.compile('controller-viewer'))
    page.locator('#navigation-close').click()
    offline[0]=True
    expect(page.locator('#connection-status')).to_have_class(re.compile('offline'))
    expect(page.locator('#nuc-recovery')).to_be_visible()
    expect(page.locator('#mode-status')).to_have_class(re.compile('controller-inactive'))
    page.request.post(base+'/api/controller',data={'id':'other-device-0123456789','takeover':True})
    if not tablet:
     page.expose_function('simulatedRepair',lambda:offline.__setitem__(0,False))
     page.evaluate('()=>{window.DartsAndroid.repairConnection=()=>{window.repairs++;window.simulatedRepair();};}')
    page.locator('#nuc-recovery button').click()
    if not tablet:page.wait_for_function('window.repairs===1')
    else:
     deadline=time.monotonic()+5
     while not connects and time.monotonic()<deadline:page.wait_for_timeout(50)
    expect(page.locator('#nuc-recovery p')).to_contain_text('hersteld',timeout=15000)
    expect(page.locator('#nuc-recovery button')).to_be_enabled()
    assert (bool(connects) if tablet else page.evaluate('window.repairs')==1)
    assert get()['match']['state']==state
    assert get()['control']['owner']==page.evaluate("sessionStorage.getItem('darts.controller')")
    # Bluetooth disabled gives a useful action instead of claiming recovery.
    config['bluetoothEnabled']=False;page.evaluate('window.testConnection.bluetoothEnabled=false')
    page.request.post(base+'/api/controller',data={'id':'other-device-0123456789','takeover':True})
    expect(page.locator('body')).to_have_class(re.compile('controller-viewer'))
    page.locator('#nuc-recovery button').click()
    expect(page.locator('#nuc-recovery p')).to_contain_text('Bluetooth staat uit')
    assert page.evaluate('window.modeChosen===true')
    # An unreachable NUC must keep a helpful retry message, never a false success.
    config['bluetoothEnabled']=True;page.evaluate('window.testConnection.bluetoothEnabled=true')
    page.route('**/api/state',lambda route:route.fulfill(status=503,json={'error':'offline'}))
    expect(page.locator('#connection-status')).to_have_class(re.compile('offline'))
    page.locator('#nuc-recovery button').click()
    expect(page.locator('#nuc-recovery p')).to_contain_text('De NUC reageert niet',timeout=12000)
    expect(page.locator('#nuc-recovery button')).to_be_enabled()
    page.wait_for_timeout(1000)
    expect(page.locator('#nuc-recovery p')).to_contain_text('De NUC reageert niet')
    assert get()['match']['state']==state
    page.evaluate('window.testConnection.mode="local";document.dispatchEvent(new CustomEvent("nuc-connection-status",{detail:{ready:true}}))')
    expect(page.locator('#nuc-recovery')).to_be_hidden()
    assert not errors,errors
    print('PASS recovery:',('legacy tablet' if tablet else 'phone'),flush=True);page.close()
   browser.close()
 finally:server.terminate();server.wait()
