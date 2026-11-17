"""Full calibration wizard against a fake native detector; no live NUC touched."""
from pathlib import Path
from urllib.parse import unquote,urlsplit
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json,mimetypes,os,subprocess,sys,tempfile,threading,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8879' if ASSETS else '8878';URL='http://127.0.0.1:'+PORT
sys.path.insert(0,str(ROOT))
from test_camera_calibration import native

class Detector(BaseHTTPRequestHandler):
 value=native([]);calibrations=0;resets=0;starts=0
 def log_message(self,*args):pass
 def do_GET(self):
  value=self.value if self.path=='/api/state' else {'calibrated':bool(self.value['running']),'numCams':3 if self.value['running'] else 0,'cams':[]} if self.path.endswith('/geometry') else {'0':{},'1':{},'2':{}}
  self.send_response(200);self.end_headers();self.wfile.write(json.dumps(value).encode())
 def do_POST(self):
  if self.path=='/api/reset':Detector.resets+=1
  else:
   assert self.path=='/api/config/calibration/auto' and self.headers.get('Content-Type') is None
   assert not self.rfile.read(int(self.headers.get('Content-Length','0')))
   Detector.calibrations+=1;time.sleep(.3)
  self.send_response(204);self.end_headers()
 def do_PUT(self):
  assert self.path=='/api/start';Detector.starts+=1;Detector.value=native([])
  self.send_response(204);self.end_headers()

def wait(fn):
 deadline=time.monotonic()+10
 while time.monotonic()<deadline:
  if fn():return
  time.sleep(.05)
 raise AssertionError('Expected detector/server condition not reached')

mock=ThreadingHTTPServer(('127.0.0.1',0),Detector);threading.Thread(target=mock.serve_forever,daemon=True).start()
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'DARTS_AUTODARTS_URL':'http://127.0.0.1:'+str(mock.server_port)}
 proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(tmp)/'match.json')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.7)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("window.DartsAndroid={isLocalMode:()=>false,getConnectionInfo:()=>JSON.stringify({mode:'bluetooth',bluetoothConnected:true})}")
   if ASSETS:
    def assets(route):
     path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
     if path=='/api/tablet/config':route.fulfill(json={'mode':'bluetooth','bluetoothConnected':True,'devices':[]})
     elif not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
     else:route.fallback()
    page.route(URL+'/**',assets)
   page.goto(URL+'/?remote=1&transport=bluetooth');expect(page.locator('#header-menu')).to_be_visible()
   api=page.request;get=lambda:api.get(URL+'/api/state').json();cam=lambda:api.get(URL+'/api/autoscoring').json()
   state=page.evaluate("async()=>(await import('/engine.js')).newMatch(['Axel','Leen'],501,'double',3,{game:'x01'})")
   assert api.post(URL+'/api/state',data={'revision':get()['revision'],'match':{'state':state,'undo':[]}}).ok
   page.wait_for_function('id=>JSON.parse(localStorage.getItem("oche.match.v1")||"null")?.state?.startedAt===id',arg=state['startedAt'])
   wait(lambda:cam()['connected']);assert api.post(URL+'/api/autoscoring',data={'enabled':True,'recording':False}).ok
   wait(lambda:cam()['armed']);before=get()['match'];archive=api.get(URL+'/api/matches').json()
   # Reset and startup reuse the saved calibration; only the new action runs it.
   assert api.post(URL+'/api/autoscoring/reset',data={}).ok;assert Detector.resets==1 and Detector.calibrations==0
   assert api.post(URL+'/api/autoscoring/calibrate',data={'revision':get()['revision']}).status==400
   assert api.post(URL+'/api/autoscoring/calibrate',data={'revision':-1,'emptyBoardConfirmed':True}).status==409
   assert api.post(URL+'/api/autoscoring/calibrate',data={'revision':get()['revision'],'emptyBoardConfirmed':True,'_controller':{'id':'wrong','epoch':0}}).status==423
   assert api.post(URL+'/api/draft',data={'revision':get()['revision'],'owner':'cal-test','seq':1,'hits':[{'number':1,'mult':1}],'entry':''}).ok
   assert api.post(URL+'/api/autoscoring/calibrate',data={'revision':get()['revision'],'emptyBoardConfirmed':True}).status==409
   assert api.post(URL+'/api/draft',data={'revision':get()['revision'],'owner':'cal-test','seq':2,'hits':[],'entry':''}).ok
   page.locator('#navigation-close').click()
   toggle=page.locator('#camera-game-toggle');calibrate=page.locator('#camera-calibration-open')
   expect(toggle).to_have_text('Camera aan');expect(calibrate).to_be_enabled()
   assert calibrate.evaluate('e=>e.previousElementSibling.id')=='camera-game-toggle'
   for w,h in [(320,740),(393,852),(1024,600),(1920,1080)]:
    page.set_viewport_size({'width':w,'height':h})
    boxes=[page.locator(selector).bounding_box() for selector in ['#mode-status','#camera-game-toggle','#camera-calibration-open','#toggle-toolbar']]
    assert all(box and box['x']>=0 and box['x']+box['width']<=w+1 for box in boxes),(w,boxes)
    assert all(a['x']+a['width']<=b['x']+1 for a,b in zip(boxes,boxes[1:])),(w,boxes)
   toggle.click();expect(toggle).to_have_text('Camera uit');expect(calibrate).to_be_disabled()
   assert toggle.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(143, 48, 56)'
   assert calibrate.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(38, 50, 59)'
   # Even legacy bindAction handlers must not open a disabled calibration entry.
   calibrate.evaluate('e=>e.dispatchEvent(new Event("click"))');expect(page.locator('#camera-calibration-dialog')).not_to_be_visible()
   toggle.click();expect(toggle).to_have_text('Camera aan');expect(calibrate).to_be_enabled()
   assert Detector.calibrations==0
   # A transport error disables calibration instead of displaying stale ON.
   page.route(URL+'/api/autoscoring',lambda route:route.fulfill(status=503,json={'error':'Offline'}))
   expect(toggle).to_be_disabled(timeout=8000);expect(toggle).to_have_text('Camera uit');expect(calibrate).to_be_disabled()
   page.unroute(URL+'/api/autoscoring');expect(toggle).to_be_enabled(timeout=8000);expect(toggle).to_have_text('Camera aan')
   Detector.value={**native([]),'running':False,'status':'stopped'};wait(lambda:not cam()['calibration']['running'])
   expect(toggle).to_have_text('Camera uit',timeout=8000);expect(calibrate).to_be_disabled()
   page.on('dialog',lambda dialog:dialog.accept());toggle.click()
   wait(lambda:cam()['calibration']['running'] and cam()['calibration']['calibrated'] is True)
   assert Detector.starts==1 and Detector.calibrations==0
   expect(toggle).to_have_text('Camera aan',timeout=8000);expect(calibrate).to_be_enabled()
   assert toggle.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(66, 117, 46)'
   calibrate.click();expect(page.locator('#camera-calibration-dialog')).to_be_visible();expect(page.locator('#camera-calibration-current')).to_contain_text('3 camera')
   page.locator('#camera-calibration-restart').click();wait(lambda:Detector.resets==2);assert Detector.calibrations==0
   expect(page.locator('#camera-calibration-dialog .dialog-back')).to_have_text('TERUG')
   expect(page.locator('#camera-calibration-start')).to_be_disabled();assert Detector.calibrations==0
   before=get()['match'];draft_before=get().get('draft')
   page.locator('#camera-calibration-empty').check();page.locator('#camera-calibration-start').click()
   wait(lambda:cam()['calibration']['stage']=='testing');expect(page.locator('#camera-calibration-test')).to_be_visible();assert Detector.calibrations==1
   assert not cam()['enabled'] and not json.loads((Path(tmp)/'camera-settings.json').read_text())['enabled']
   expect(calibrate).to_be_disabled();expect(toggle).to_have_text('Camera uit')
   expect(page.locator('#camera-calibration-resume')).to_be_disabled()
   Detector.value=native([(20,1),(19,3),(25,2)])
   expect(page.locator('#camera-calibration-darts span')).to_have_text(['20','T19','BB'],timeout=8000)
   assert get()['match']==before and get().get('draft')==draft_before
   assert {m['id'] for m in api.get(URL+'/api/matches').json()['matches']}=={m['id'] for m in archive['matches']}
   for w,h in [(320,740),(393,852),(1024,600),(1920,1080)]:
    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
    assert page.locator('#camera-calibration-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
    assert page.locator('#camera-calibration-dialog .dialog-navigation').bounding_box()['y']>=0
   out=ROOT/'.repair-check/calibration58';out.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out/('wizard-legacy.png' if ASSETS else 'wizard-modern.png')))
   page.locator('#camera-calibration-verified').check();page.locator('#camera-calibration-resume').click()
   expect(page.locator('#camera-calibration-dialog')).to_be_hidden();wait(lambda:cam()['enabled']);assert not cam()['armed']
   expect(toggle).to_have_text('Camera aan');expect(calibrate).to_be_enabled()
   Detector.value=native([]);wait(lambda:cam()['armed']);Detector.value=native([(20,1),(19,3),(25,2)])
   wait(lambda:len(get()['match']['state']['history'])==1)
   assert get()['match']['state']['players'][0]['remaining']==374
   time.sleep(.7);assert len(get()['match']['state']['history'])==1
   if not ASSETS:
    saved=get()['match']
    nuc=browser.new_page(viewport={'width':1920,'height':1080});nuc.goto(URL)
    nuc.locator('.navigation-category[data-menu="nuc"]').click();nuc.locator('#camera-calibration-open').click()
    expect(nuc.locator('#camera-calibration-current')).to_contain_text('3 camera');expect(nuc.locator('#camera-calibration-start')).to_be_disabled()
    assert get()['match']==saved and Detector.calibrations==1
    # Exercise the local-mode entry directly, without pretending this desktop
    # browser implements all of the unrelated native Android shell methods.
    local=browser.new_page();local.goto(URL+'/camera-calibration.css')
    local.evaluate("async()=>{window.DartsAndroid={isLocalMode:()=>true};(await import('/autoscoring.js')).cameraControls(()=>{});}")
    expect(local.locator('#camera-calibration-open')).to_have_count(0)
    assert get()['match']==saved
    nuc.close();local.close()
   assert not errors,errors
   print('PASS adjacent red/green camera toggle, gray disabled calibration when off/stopped/offline, restart separation, native Detection, ownership/draft guards, read-only test darts, explicit resume and responsive header/Back','legacy' if ASSETS else 'modern')
   browser.close()
 finally:proc.terminate();proc.wait();mock.shutdown();mock.server_close()
