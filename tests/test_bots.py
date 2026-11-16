"""Real UI, shared per-dart progress, lease conflicts and reconnect recovery."""
from pathlib import Path
import json,os,subprocess,sys,tempfile,time,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
(root/'.repair-check').mkdir(exist_ok=True)
class Detector(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  body=json.dumps({'running':True,'status':'Throw','numThrows':0,'throws':[]}).encode()
  self.send_response(200);self.end_headers();self.wfile.write(body)
mock=ThreadingHTTPServer(('127.0.0.1',0),Detector);threading.Thread(target=mock.serve_forever,daemon=True).start()
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8842','--data-file',str(Path(temp)/'match.json')],env={**os.environ,'DARTS_AUTODARTS_URL':f'http://127.0.0.1:{mock.server_port}'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   browser=p.chromium.launch();phone=browser.new_page(viewport={'width':393,'height':852});errors=[];phone.on('pageerror',lambda error:errors.append(str(error)))
   url='http://127.0.0.1:8842';phone.goto(url);expect(phone.locator('#header-menu')).to_be_visible()
   phone.locator('#navigation-categories [data-menu="play"]').click();phone.locator('#settings').click()
   phone.locator('.wizard-game').filter(has=phone.get_by_text('X01',exact=True)).click();phone.locator('.wizard-next').click()
   phone.get_by_role('group',name='Aantal spelers',exact=True).get_by_role('button',name='4',exact=True).click()
   phone.locator('.wizard-player-select').nth(1).click();phone.get_by_role('button',name='BOT 40',exact=True).click()
   phone.locator('.wizard-player-select').nth(3).click();phone.get_by_role('button',name='BOT 50',exact=True).click()
   phone.get_by_role('group',name='Wie begint?',exact=True).get_by_role('button',name='BOT 40 #2',exact=True).click()
   phone.locator('.wizard-next').click();expect(phone.locator('#setup')).to_be_hidden();expect(phone.locator('#bot-status')).to_be_visible()
   def saved():return phone.request.get(url+'/api/state').json()
   assert [player['botLevel'] for player in saved()['match']['state']['players']]==[0,40,0,50]
   phone.screenshot(path=str(root/'.repair-check/bot-mobile-ui.png'))
   # Physical screen and phone compete for the same visit, never double throw.
   screen=browser.new_page(viewport={'width':1280,'height':800});screen.goto(url);screen.locator('#navigation-close').click()
   lengths=[];revisions=[];start=time.monotonic();draft_time=None
   while time.monotonic()-start<13:
    value=saved();hits=(value.get('draft') or {}).get('hits',[])
    if hits:
     if not lengths or lengths[-1]!=len(hits):lengths.append(len(hits))
     if draft_time is None:draft_time=time.monotonic()
    if value['match']['state']['active']==2:break
    phone.wait_for_timeout(100)
   assert lengths==[1,2,3],lengths
   assert len(saved()['match']['state']['history'])==1
   assert time.monotonic()-start>3
   expect(phone.locator('#bot-status')).to_be_hidden();expect(screen.locator('#bot-status')).to_be_hidden()
   assert not errors,errors
   # Explicit claim: only owner can publish/commit; a changed match invalidates
   # an in-flight ticket. A new executor resumes the already saved dart.
   phone.locator('#toggle-toolbar').click();screen.locator('#toggle-toolbar').click()
   state=saved();game=state['match']['state'];game['active']=1;game['players'][0]['points']=150;game['players'][0]['darts']=9
   assert phone.request.post(url+'/api/state',data={'revision':state['revision'],'match':{'state':game,'undo':[]}}).ok
   for view in [phone,screen]:expect(view.locator('#bot-status strong small')).to_have_text('Niveau 45 · basis 40')
   revision=saved()['revision']
   claim=lambda owner:phone.request.post(url+'/api/bot/claim',data={'revision':revision,'owner':owner}).json()
   assert claim('executor-A')['granted'] and not claim('executor-B')['granted']
   body={'revision':revision,'owner':'executor-A','seq':1,'_bot':'executor-A','hits':[{'number':20,'mult':1,'label':'20'}]}
   assert phone.request.post(url+'/api/draft',data=body).ok
   assert phone.request.post(url+'/api/draft',data={**body,'owner':'executor-B','_bot':'executor-B','hits':[]}).status==409
   assert len(claim('executor-A')['draft']['hits'])==1
   # Reload while a BOT visit has two darts. Keep the lease briefly, then let
   # the app recover it after expiry; only the third dart may be appended.
   body['seq']=2;body['hits'].append({'number':20,'mult':1,'label':'20'});assert phone.request.post(url+'/api/draft',data=body).ok
   phone.reload();phone.locator('#navigation-close').click();phone.wait_for_timeout(900)
   expect(phone.locator('#bot-status .thrown')).to_have_count(2)
   expect(phone.locator('#bot-status .thrown')).to_have_text(['20','20'])
   expect(phone.locator('#bot-status strong small')).to_have_text('Niveau 45 · basis 40')
   deadline=time.monotonic()+15
   while saved()['match']['state']['active']!=2 and time.monotonic()<deadline:phone.wait_for_timeout(100)
   result=saved()['match']['state'];assert len(result['history'])==2,(result['active'],[(h['name'],h.get('labels')) for h in result['history']])
   assert [hit['number'] for hit in result['history'][-1]['input']['hits'][:2]]==[20,20]
   assert phone.request.post(url+'/api/draft',data=body).status==409
   # Layout stays inside narrow/folded/landscape displays during a bot visit.
   current=saved();current['match']['state']['active']=1
   assert phone.request.post(url+'/api/state',data={'revision':current['revision'],'match':current['match']}).ok
   phone.locator('#toggle-toolbar').click()
   for width,height in [(320,640),(393,852),(736,872),(872,736),(1024,600)]:
    phone.set_viewport_size({'width':width,'height':height});phone.wait_for_timeout(100)
    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # Every game uses the same real application driver. Speed up its injected
   # clock only here, while the earlier test checks the actual human pacing.
   screen.close()
   phone.route('**/bot-runner.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=(root/'dist/bot-runner.js').read_text(encoding='utf-8').replace('await delay(','await fastDelay(').replace(' const timer=setInterval', ' const fastDelay=()=>new Promise(resolve=>setTimeout(resolve,15));\n const timer=setInterval')))
   for game in ['fourinarow','cricket','tactics','scram','killer','bull41','twentyone','seabattle','golf','shanghai','gotcha','tenlives','bobs27','121']:
    phone.reload();expect(phone.locator('#header-menu')).to_be_visible()
    sample=phone.evaluate("""async game=>{const e=await import('/engine.js');let s=e.newMatch(['Human','BOT 50'],game==='gotcha'?301:501,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',maxRounds:0});s.players[s.active].bot=true;s.players[s.active].botLevel=50;if(game==='121'){s.players[s.active].trainingDarts=6;s.trainingDarts=6;s.players[s.active].remaining=501;}return s}""",game)
    assert phone.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':sample,'undo':[]}}).ok
    phone.wait_for_timeout(850);phone.locator('#navigation-close').click()
    deadline=time.monotonic()+5
    while len(saved()['match']['state']['history'])==0 and time.monotonic()<deadline:phone.wait_for_timeout(80)
    observed=saved()['match']['state'];assert len(observed['history'])>=1,(game,phone.locator('#message').text_content())
    assert not errors,(game,errors)
    if game=='121':assert observed['phase']=='playing' and observed['active']==1
    print('PASS: timed application driver:',game,flush=True)
   if not phone.locator('#header-menu').is_visible():phone.locator('#toggle-toolbar').click()
   first=browser.new_page();second=browser.new_page();first.goto(url+'/?remote=1');second.goto(url+'/?remote=1')
   expect(first.locator('#controller-note')).to_have_text('Scorebediening actief')
   expect(second.locator('#controller-note')).to_contain_text('Meekijken')
   data=saved();data['match']['state']['active']=0
   assert phone.request.post(url+'/api/state',data={'revision':data['revision'],'match':data['match']}).ok
   for view in [first,second]:view.wait_for_timeout(800)
   request="""async()=>{const state=await fetch('/api/state').then(r=>r.json());const r=await fetch('/api/bot/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,owner:'remote-test'})});return {status:r.status,body:await r.json()}}"""
   assert first.evaluate(request)['body']['granted']
   assert second.evaluate(request)['status']==423
   second.evaluate("async()=>{const c=await import('/controller.js');return c.takeControl()}")
   expect(first.locator('#controller-note')).to_contain_text('Meekijken')
   assert first.evaluate(request)['status']==423
   # A fresh lease is still exclusive even after a controller handover.
   assert phone.request.post(url+'/api/autoscoring',data={'enabled':True,'recording':False}).ok
   ticket=phone.request.get(url+'/api/autoscoring').json()
   assert 'BOT' in ticket['message'] and not ticket['armed'],ticket
   camera=first.evaluate("""async()=>{const {applyCameraEvent}=await import('/autoscoring-rules.js');const data=await fetch('/api/state').then(r=>r.json());try{applyCameraEvent(data.match,null,{kind:'dart',hit:{number:20,mult:3}});return false;}catch{return true;}}""")
   assert camera
   data=saved();data['match']['state']['active']=1
   assert phone.request.post(url+'/api/state',data={'revision':data['revision'],'match':data['match']}).ok
   deadline=time.monotonic()+4
   while not phone.request.get(url+'/api/autoscoring').json()['armed'] and time.monotonic()<deadline:phone.wait_for_timeout(100)
   assert phone.request.get(url+'/api/autoscoring').json()['armed']
   print('PASS: controller takeover invalidates bot writes; camera pauses for BOT and resumes for human',flush=True)
   browser.close();print('PASS: four-player BOT choices, timed live darts, single executor, reconnect at dart 3, stale ticket rejection and responsive UI')
 finally:server.terminate();server.wait();mock.shutdown()
