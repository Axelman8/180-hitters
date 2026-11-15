"""Changing games must remove stale standard panels from the NUC stage."""
from pathlib import Path
import subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8846','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':1920,'height':1080});page.goto('http://127.0.0.1:8846/')
   page.evaluate("document.dispatchEvent(new Event('close-navigation'))")
   def put(game,bot=False):
    state=page.evaluate("""async ({game,bot})=>{const {newMatch}=await import('/engine.js');return newMatch(['Anna','Bert'],501,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:[bot?50:0,0]})}""",{'game':game,'bot':bot})
    current=page.request.get('http://127.0.0.1:8846/api/state').json()
    assert page.request.post('http://127.0.0.1:8846/api/state',data={'revision':current['revision'],'match':{'state':state,'undo':[]}}).ok
    expect(page.locator('body')).to_have_attribute('data-game','x01' if game=='121' else game)
   for previous in ['x01','121','bobs27']:
    for game in ['fourinarow','scram','killer','bull41','twentyone','tenlives']:
     put(previous);put(game)
     active='#fourinarow-root' if game=='fourinarow' else '#lives-game' if game=='tenlives' else '#sonny-root'
     expect(page.locator(active)).to_be_visible()
     expect(page.locator('#game>.play-grid')).to_be_hidden()
     expect(page.locator('#training-status')).to_be_hidden()
     for w,h in [(1920,1080),(1080,1920)]:
      page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
      size=page.evaluate("({available:document.querySelector('main').clientHeight,content:document.querySelector('main').scrollHeight,width:document.documentElement.scrollWidth})")
      assert size['width']<=w and size['content']<=size['available']+2,(previous,game,w,h,size)
   page.evaluate("document.dispatchEvent(new Event('open-main-menu'))")
   put('tenlives',True);expect(page.locator('#bot-status')).to_be_visible()
   browser.close();print('PASS: 18 game transitions, landscape/portrait NUC fit, stale panel removal and Hitters BOT indicator')
 finally:server.terminate();server.wait()
