"""Isolated fake detector: no real cameras or live match are touched."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from autodarts_bridge import AutoDartsBridge, dart


def wait(fn, timeout=10):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        if fn(): return
        time.sleep(.1)
    raise AssertionError('Timed out')


def state(hits):
    return dict(running=True, status='Takeout' if len(hits)==3 else 'Throw', numThrows=len(hits),
                throws=[{'segment':{'number':n,'multiplier':m,'name':('S','D','T')[m-1]+str(n)}} for n,m in hits])


class Mock(BaseHTTPRequestHandler):
    value=state([])
    reset_count=0
    def log_message(self,*a): pass
    def do_GET(self):
        data=json.dumps(self.value if self.path=='/api/state' else {}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
    def do_PUT(self):
        assert self.path=='/api/start'
        Mock.value=state([])
        self.send_response(200);self.end_headers()
    def do_POST(self):
        assert self.path=='/api/reset'
        Mock.reset_count+=1;Mock.value=state([])
        self.send_response(200);self.end_headers()


with tempfile.TemporaryDirectory() as tmp:
    bridge=AutoDartsBridge(threading.Lock(),Path(tmp)/'unit')
    bridge.configure(True,False,0);bridge.observe(state([(20,3)]))
    assert not bridge.pending and not bridge.armed
    bridge.observe(state([]));assert bridge.armed
    bridge.observe(state([(20,3)]));first=bridge.pending[0]['id']
    bridge.observe(state([(20,3)]));assert len(bridge.pending)==1
    bridge.acknowledge(first,1,True);bridge.observe(state([(20,3),(1,1)]));assert not bridge.pending
    bridge.observe(state([]));bridge.acknowledge(bridge.pending[0]['id'],2)
    assert not bridge.closed
    assert dart({'bouncer':True})=={'number':0,'mult':1}
    for n in range(1,21):
        assert dart({'segment':{'bed':'Outside','number':n,'multiplier':0,'name':'M'+str(n)}})=={'number':0,'mult':1}
    bridge.configure(True,False,2);bridge.observe(state([]))
    bridge.observe(state([(20,1),(20,1)])|{'numThrows':3,'throws':state([(20,1),(20,1)])['throws']+[{'segment':{'bed':'Outside','number':20,'multiplier':0,'name':'M20'}}]})
    assert bridge.enabled and bridge.connected and len(bridge.pending)==3
    assert bridge.pending[-1]['hit']=={'number':0,'mult':1}
    bridge.observe(state([(25,3)]));assert bridge.enabled and not bridge.armed and bridge.connected
    assert 'Onbekende camerameting' in bridge.message
    try: dart({'segment':{'number':25,'multiplier':3}});raise AssertionError('Invalid bull accepted')
    except ValueError: pass

    mock=ThreadingHTTPServer(('127.0.0.1',0),Mock)
    threading.Thread(target=mock.serve_forever,daemon=True).start()
    env={**os.environ,'DARTS_AUTODARTS_URL':f'http://127.0.0.1:{mock.server_port}'}
    proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port','8796','--data-file',str(Path(tmp)/'match.json')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            b=p.chromium.launch();page=b.new_page();phone=b.new_page(viewport={'width':393,'height':850})
            errors=[];page.on('pageerror',lambda e:errors.append(getattr(e,'stack',str(e))));phone.on('pageerror',lambda e:errors.append(getattr(e,'stack',str(e))))
            url='http://127.0.0.1:8796';page.goto(url);phone.goto(url+'/?remote=1')
            api=page.request
            get=lambda:api.get(url+'/api/state').json()
            cam=lambda:api.get(url+'/api/autoscoring').json()
            def setup(game='x01',start=501,extra={}):
                Mock.value=state([])
                s=page.evaluate('''async ({game,start,extra})=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],start,'double',3,{game,...extra});}''',dict(game=game,start=start,extra=extra))
                assert api.post(url+'/api/state',data={'revision':get()['revision'],'match':{'state':s,'undo':[]}}).ok
                page.wait_for_timeout(1200)
                wait(lambda:cam()['connected'])
                assert api.post(url+'/api/autoscoring',data={'enabled':True,'recording':False}).ok
                try: wait(lambda:cam()['armed'])
                except AssertionError:
                    print('Camera:',cam(),'Browser errors:',errors,flush=True)
                    raise
                phone.locator('#camera-game-toggle').wait_for(state='attached')
                return s
            def open_camera_menu(view):
                view.evaluate("document.dispatchEvent(new Event('open-main-menu'))")
                view.locator('.navigation-category[data-menu="nuc"]').click()
                view.locator('#camera-game-controls').scroll_into_view_if_needed()
            def click_camera(view,button):
                open_camera_menu(view)
                view.locator(button).click()
            setup()
            page.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'true'")
            phone.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'true'")
            assert page.locator('#camera-game-toggle').get_attribute('aria-label')== 'Camera uitzetten'
            assert phone.locator('#camera-game-toggle').get_attribute('aria-label')== 'Camera uitzetten'
            assert api.post(url+'/api/autoscoring/reset',data={}).ok
            Mock.value=state([]);Mock.value.update(running=False,status='Stopped',event='Manual reset')
            wait(lambda:Mock.reset_count==1 and 'gestopt' not in cam()['message'].lower())
            Mock.value=state([])
            wait(lambda:cam()['armed'])
            Mock.value=state([(20,3)])
            wait(lambda:len((get().get('draft') or {}).get('hits',[]))==1)
            assert get()['match']['state']['players'][0]['remaining']==501
            Mock.value=state([(20,3),(20,3),(20,3)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['remaining']==321
            time.sleep(1);assert len(get()['match']['state']['history'])==1
            phone.wait_for_function("JSON.parse(localStorage.getItem('oche.match.v1')).state.players[0].remaining===321")
            Mock.value=state([]);wait(lambda:not cam()['pending']);time.sleep(.5)
            Mock.value=state([(1,1),(1,1),(1,1)])
            wait(lambda:len(get()['match']['state']['history'])==2)
            assert get()['match']['state']['players'][1]['remaining']==498
            # Manual correction invalidates the camera queue, no next-player spill.
            assert api.post(url+'/api/draft',data={'revision':get()['revision'],'owner':'test','seq':1,'hits':[],'entry':'6'}).ok
            assert cam()['enabled'] and not cam()['armed']
            # Clearing manual entry resumes automatically only after an empty board.
            assert api.post(url+'/api/draft',data={'revision':get()['revision'],'owner':'test','seq':2,'hits':[],'entry':''}).ok
            assert cam()['enabled'] and not cam()['armed']
            Mock.value=state([]);wait(lambda:cam()['armed'])
            Mock.value=state([(20,1),(20,1),(20,1)])
            wait(lambda:len(get()['match']['state']['history'])==3)
            assert get()['match']['state']['players'][0]['remaining']==261
            # Correct the first dart manually; next two camera darts extend that draft.
            setup()
            Mock.value=state([(20,1)])
            wait(lambda:len((get().get('draft') or {}).get('hits',[]))==1)
            assert api.post(url+'/api/draft',data={'revision':get()['revision'],'owner':'correction','seq':1,'hits':[{'number':19,'mult':1}],'entry':''}).ok
            assert cam()['enabled'] and cam()['armed']
            Mock.value=state([(20,1),(20,3),(1,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['remaining']==421
            # Change match state without toggling cameras: intent follows the new revision.
            same=get()['match']
            assert api.post(url+'/api/state',data={'revision':get()['revision'],'match':same}).ok
            assert cam()['enabled'] and not cam()['armed']
            Mock.value=state([]);wait(lambda:cam()['armed'])
            assert json.loads((Path(tmp)/'camera-settings.json').read_text())['enabled'] is True
            # Early finish, extra physical darts are ignored until removal.
            setup(start=40)
            Mock.value=state([(20,2),(20,3),(20,3)])
            wait(lambda:get()['match']['state']['phase']=='leg')
            assert len(get()['match']['state']['history'])==1
            assert get()['match']['state']['players'][0]['legs']==1
            # Real double-in rules, never treat singles before opening as points.
            setup(start=301,extra={'inMode':'double'})
            Mock.value=state([(17,1),(20,2),(20,3)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['remaining']==201
            for game in ('cricket','tactics'):
                setup(game)
                Mock.value=state([(20,3),(20,1),(19,1)])
                wait(lambda:len(get()['match']['state']['history'])==1)
                assert get()['match']['state']['players'][0]['cricketPoints']==20
            setup('tenlives',extra={'livesMode':'double'})
            Mock.value=state([(20,2),(19,2),(18,2)])
            wait(lambda:len(get()['match']['state']['history'])==3)
            s=get()['match']['state'];assert s['active']==0 and s['players'][0]['livesTarget']==17 and s['players'][0]['attempts']==9
            setup('gotcha',301)
            Mock.value=state([(20,3),(20,1),(1,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['remaining']==81
            setup('bobs27')
            Mock.value=state([(1,2),(0,1),(0,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['remaining']==29
            # 4 op een rij must retain the complete live visit: dart two may
            # never replace dart one on either the NUC or the remote controls.
            setup('fourinarow')
            Mock.value=state([(20,1)])
            wait(lambda:len((get().get('draft') or {}).get('hits',[]))==1)
            phone.wait_for_function("document.querySelectorAll('.four-darts span')[1]?.getAttribute('aria-current') === 'step'")
            assert phone.locator('.four-darts span').nth(0).inner_text()=='20'
            Mock.value=state([(20,1),(19,1)])
            wait(lambda:len((get().get('draft') or {}).get('hits',[]))==2)
            phone.wait_for_function("document.querySelectorAll('.four-darts span')[2]?.getAttribute('aria-current') === 'step'")
            assert phone.locator('.four-darts span').nth(0).inner_text()=='20'
            assert phone.locator('.four-darts span').nth(1).inner_text()=='19'
            Mock.value=state([(20,1),(19,1),(18,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            setup(extra={'training121':True})
            Mock.value=state([(20,3),(11,3),(14,2)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['trainingLevel']>121
            # The new games have their own commit rules, independent of X01.
            for game in ('scram','bull41','twentyone'):
                s=setup(game)
                for count in (1,2):
                    Mock.value=state([(20,1),(19,1)][:count])
                    wait(lambda:len((get().get('draft') or {}).get('hits',[]))==count)
                    assert len(get()['match']['state']['history'])==0
                Mock.value=state([(20,1),(19,1),(0,1)])
                wait(lambda:len(get()['match']['state']['history'])==1)
                assert get()['match']['state']['history'][0]['darts']==3
                assert get()['match']['state']['active']!=s['active']
            setup('killer')
            Mock.value=state([(5,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['players'][0]['killerNumber']==5
            Mock.value=state([]);wait(lambda:cam()['armed'] and not cam()['pending']);time.sleep(.5)
            Mock.value=state([(12,1)])
            wait(lambda:len(get()['match']['state']['history'])==2)
            assert get()['match']['state']['killerStage']=='playing'
            setup('fourinarow')
            Mock.value=state([(0,1),(0,1),(0,1)])
            wait(lambda:len(get()['match']['state']['history'])==1)
            assert get()['match']['state']['history'][0]['labels']=='Mis / Mis / Mis'
            # Partial removal never invents missing darts or silently changes player.
            setup()
            Mock.value=state([(20,1)])
            wait(lambda:len((get().get('draft') or {}).get('hits',[]))==1)
            Mock.value=state([])
            wait(lambda:cam()['enabled'] and not cam()['armed'])
            assert 'handmatige' in cam()['message'] or 'Niet alle darts' in cam()['message'],cam()
            assert len(get()['match']['state']['history'])==0
            # Partial camera draft is durable; on/off choice is retained separately.
            saved=json.loads((Path(tmp)/'match.json').read_text())
            assert saved['cameraDraft']['hits']==[{'number':20,'mult':1}]
            # Lost ACK retry returns stored receipt without a second revision.
            receipt=get()['cameraReceipt'];rev=get()['revision']
            r=api.post(url+'/api/autoscoring/apply',data={'event':receipt})
            assert r.ok and get()['revision']==rev
            setup()
            assert api.post(url+'/api/autoscoring',data={'enabled':False,'recording':False}).ok
            Mock.value={'running':False,'numThrows':0,'status':'Stopped'}
            page.wait_for_timeout(400)
            assert api.post(url+'/api/autoscoring',data={'enabled':True,'recording':False}).ok
            wait(lambda:cam()['armed'])
            assert Mock.value['running'] is True
            # Camera controls are grouped under NUC & verbinding, without duplicates.
            assert phone.locator('#autoscoring-open').count()==0
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:not cam()['enabled'])
            phone.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'false'")
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:cam()['enabled'] and cam()['armed'])
            phone.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'true'")
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:not cam()['enabled'])
            phone.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'false'")
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:cam()['enabled'] and cam()['armed'])
            # Menu controls remain usable at narrow widths and show the chosen state.
            for view in (page,phone):
                open_camera_menu(view)
                view.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'true'")
                assert view.locator('#header-menu #camera-game-controls').count()==1
                assert not view.locator('#camera-calibration-open').is_disabled()
                for width in (320,393,768,1080):
                    view.set_viewport_size({'width':width,'height':900})
                    view.wait_for_timeout(250)
                    view.locator('#camera-game-controls').scroll_into_view_if_needed()
                    boxes=[view.locator(selector).bounding_box() for selector in ('#camera-game-toggle','#camera-calibration-open')]
                    assert all(box and box['x']>=0 and box['x']+box['width']<=width+1 for box in boxes),(width,boxes)
                    assert abs((boxes[-1]['y']+boxes[-1]['height']/2)-(boxes[-2]['y']+boxes[-2]['height']/2))<2,(width,boxes)
                colors=view.evaluate("[...document.querySelectorAll('#camera-game-controls button')].map(b=>getComputedStyle(b).backgroundColor)")
                assert colors[0]!=colors[1],colors
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:not cam()['enabled'])
            for view in (page,phone):
                view.wait_for_function("document.querySelector('#camera-game-toggle').getAttribute('aria-pressed') === 'false'")
                assert view.locator('#camera-calibration-open').is_disabled()
            click_camera(phone,'#camera-game-toggle')
            wait(lambda:cam()['enabled'] and cam()['armed'])
            # A service restart preserves ON and resumes from an empty board.
            proc.terminate();proc.wait()
            proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port','8796','--data-file',str(Path(tmp)/'match.json')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            time.sleep(.8)
            wait(lambda:cam()['enabled'] and cam()['armed'])
            # Returning to the latest turn may retain the UI navigation marker.
            result=page.evaluate("""async()=>{
              const {newMatch}=await import('/engine.js');
              const {applyCameraEvent}=await import('/autoscoring-rules.js');
              const m={state:newMatch(['A','B'],501,'double',3,{game:'x01'}),undo:[],future:[],historyNavigation:true};
              const accepted=applyCameraEvent(m,null,{kind:'dart',hit:{number:20,mult:1}});
              m.future=[{state:m.state}];let rejected=false;
              try{applyCameraEvent(m,null,{kind:'dart',hit:{number:20,mult:1}});}catch{rejected=true;}
              return {hits:accepted.hits.length,rejected};
            }""")
            assert result=={'hits':1,'rejected':True},result
            assert not errors,errors
            print('PASS queue idempotency, early finish, camera/phone sync, all new game turn rules, misses, menu camera controls, persistence and manual pause')
            b.close()
    finally:
        proc.terminate();proc.wait();mock.shutdown()
