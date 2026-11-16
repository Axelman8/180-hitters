"""Gotcha bots deliberately reset opponents, on the controller and shared screen."""
from pathlib import Path
import subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];url='http://127.0.0.1:8849'
with tempfile.TemporaryDirectory() as folder:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8849','--data-file',str(Path(folder)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();context=browser.new_context();errors=[]
   # Perfect aimed hits make the strategy test deterministic. Production keeps
   # the original physical scatter; gotcha-bot.mjs tests both real accuracy levels.
   bot=(root/'dist/bot.js').read_text(encoding='utf-8').replace('hit=throwAt(target,botDifficulty(state).level,random)','hit=makeDart(target.number,target.mult)')
   context.route('**/bot.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=bot))
   runner=(root/'dist/bot-runner.js').read_text(encoding='utf-8').replace('await delay(','await fastDelay(').replace(' const timer=setInterval',' const fastDelay=()=>new Promise(resolve=>setTimeout(resolve,350));\n const timer=setInterval')
   context.route('**/bot-runner.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=runner))
   phone=context.new_page();phone.set_viewport_size({'width':393,'height':852});phone.on('pageerror',lambda error:errors.append(str(error)));phone.goto(url+'/?android=1')
   screen=context.new_page();screen.set_viewport_size({'width':1280,'height':800});screen.on('pageerror',lambda error:errors.append(str(error)));screen.goto(url+'/?remote=1')
   def saved():return phone.request.get(url+'/api/state').json()
   for level in [40,50]:
    state=phone.evaluate("async level=>{const e=await import('/engine.js');const s=e.newMatch(['BOT '+level,'Opponent'],301,'double',1,{game:'gotcha',botLevels:[level,0]});s.players[0].remaining=160;s.players[1].remaining=180;return s}",level)
    assert phone.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    for view in [phone,screen]:
     expect(view.locator('#bot-status .bot-strategy')).to_have_text('Richt op S20 · Opponent op 0')
    for width,height in [(320,740),(393,852),(744,900),(1024,600)]:
     phone.set_viewport_size({'width':width,'height':height})
     assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
    phone.set_viewport_size({'width':393,'height':852})
    phone.locator('#navigation-close').click();screen.locator('#navigation-close').click()
    expect(phone.locator('.visual-player').nth(1).locator('.visual-score')).to_have_text('0',timeout=10000)
    expect(screen.locator('.visual-player').nth(1).locator('.visual-score')).to_have_text('0',timeout=10000)
    deadline=time.monotonic()+10
    while len(saved()['match']['state']['history'])!=1 and time.monotonic()<deadline:phone.wait_for_timeout(100)
    result=saved()['match']['state'];assert result['players'][1]['remaining']==0
    assert result['history'][0]['resets']==[1]
    assert result['history'][0]['input']['hits'][0]['number']==20 and result['history'][0]['input']['hits'][0]['mult']==1
    assert result['active']==1 and result['phase']=='playing'
    for view in [phone,screen]:view.locator('#toggle-toolbar').click()
    print(f'PASS BOT {level}: visible S20 attack, automatic opponent reset and synchronized controller/NUC display',flush=True)
   assert not errors,errors;browser.close()
 finally:server.terminate();server.wait()
