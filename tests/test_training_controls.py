"""Miss/hit-only Bob's input, visible BOT darts and Gotcha BOT resets."""
from pathlib import Path
import subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];url='http://127.0.0.1:8848'
with tempfile.TemporaryDirectory() as folder:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8848','--data-file',str(Path(folder)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.goto(url+'/?android=1')
   expect(page.locator('#header-menu')).to_be_visible()
   def saved():return page.request.get(url+'/api/state').json()
   def wait_state(predicate):
    deadline=time.monotonic()+5
    while time.monotonic()<deadline:
     value=saved()
     if predicate(value):return value
     page.wait_for_timeout(50)
    page.screenshot(path=str(root/'.repair-check/training33-failed.png'))
    raise AssertionError({'saved':saved(),'message':page.locator('#message').text_content(),'slots':page.locator('#dart-slots').text_content(),'errors':errors,'body':page.locator('body').get_attribute('class')})
   def fixture(game,names,**options):
    return page.evaluate("async data=>{const e=await import('/engine.js');return e.newMatch(data.names,data.game==='gotcha'?301:501,'single',1,{game:data.game,...data.options})}",{'game':game,'names':names,'options':options})
   def load(state):
    assert page.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    page.wait_for_timeout(850)
    if page.locator('#header-menu').is_visible():page.locator('#navigation-close').click()
   load(fixture('bobs27',['Anna','Bert']))
   for width,height in [(320,740),(393,852),(744,900),(1024,600),(1920,1080)]:
    page.set_viewport_size({'width':width,'height':height})
    expect(page.locator('#board-keys button:visible')).to_have_text(['MIS','RAAK'])
    expect(page.locator('#multipliers')).not_to_be_visible();expect(page.locator('#mode-total')).not_to_be_visible();expect(page.locator('#bust')).not_to_be_visible()
    for control in page.locator('#board-keys button').all():assert control.bounding_box()['height']>=72
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.set_viewport_size({'width':393,'height':852})
   page.locator('#bobs-hit').click();page.locator('#miss-dart').click()
   expect(page.locator('#dart-slots')).to_contain_text('RAAK');expect(page.locator('#dart-slots')).to_contain_text('MIS')
   page.locator('#bobs-hit').click();wait_state(lambda d:len(d['match']['state']['history'])==1)
   assert saved()['match']['state']['players'][0]['remaining']==31
   assert saved()['match']['state']['active']==1
   # Restoring a visit keeps all three throws and edits only the selected one.
   page.evaluate("document.getElementById('undo').click()")
   expect(page.locator('#dart-slots button')).to_have_count(3)
   page.locator('#dart-slots button').first.click();page.locator('#miss-dart').click();page.locator('#submit').click()
   wait_state(lambda d:d['match']['state']['players'][0]['remaining']==29)
   bull=fixture('bobs27',['Solo']);bull['bobsTarget']=25;bull['round']=21;load(bull)
   page.locator('#bobs-hit').click();page.locator('#miss-dart').click();page.locator('#miss-dart').click()
   wait_state(lambda d:d['match']['state']['phase']=='won')
   assert saved()['match']['state']['players'][0]['remaining']==77,saved()['match']['state']
   if page.locator('#result-dialog').is_visible():page.locator('#result-later').evaluate('(e)=>e.click()')
   print('PASS Bob\'s 27: MIS/RAAK only, responsive touch buttons, three-dart commit, selected-dart correction and Bull',flush=True)
   gotcha=fixture('gotcha',['Human','BOT 50','Other','BOT 40'],botLevels=[0,50,0,40]);gotcha['players'][0]['remaining']=40;gotcha['players'][1]['remaining']=120;gotcha['players'][2]['remaining']=90;gotcha['players'][3]['remaining']=60;load(gotcha)
   for width,height in [(393,852),(744,900),(1024,600),(1920,1080)]:
    page.set_viewport_size({'width':width,'height':height});expect(page.locator('.gotcha-player-reset')).to_have_count(3)
    expect(page.locator('#players>.player').first.locator('.gotcha-player-reset')).to_have_count(0)
    page.evaluate("document.body.classList.add('input-collapsed')")
    reset=page.locator('.gotcha-player-reset[data-player-index="1"]');expect(reset).to_be_enabled()
    reset.click();wait_state(lambda d:d['match']['state']['players'][1]['remaining']==0)
    assert saved()['match']['state']['players'][2]['remaining']==90 and saved()['match']['state']['players'][0]['remaining']==40
    load(gotcha)
   page.evaluate("document.body.classList.remove('input-collapsed')")
   page.set_viewport_size({'width':393,'height':852});page.locator('#mode-dart').click()
   page.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
   page.locator('.gotcha-player-reset[data-player-index="1"]').click()
   wait_state(lambda d:d['match']['state']['players'][1]['remaining']==0 and len((d.get('draft') or {}).get('hits',[]))==1)
   assert saved()['draft']['hits'][0]['number']==20
   assert saved()['match']['state']['active']==0
   print('PASS Gotcha: BOT reset on opponent card, own player protected, other scores preserved, collapsed input and pending dart retained',flush=True)
   # Hitters commits every dart independently; the display must retain slots
   # across those revisions, both locally and on a second connected display.
   page.route('**/bot-runner.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=(root/'dist/bot-runner.js').read_text(encoding='utf-8').replace('await delay(','await fastDelay(').replace(' const timer=setInterval',' const fastDelay=()=>new Promise(resolve=>setTimeout(resolve,100));\n const timer=setInterval')))
   page.route('**/bot.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=(root/'dist/bot.js').read_text(encoding='utf-8').replace('export function botDart(state,hits=[],random=Math.random){','export function botDart(state,hits=[],random=Math.random){return makeDart(0);')))
   for levels in [[50],[40,50]]:
    page.reload();expect(page.locator('#header-menu')).to_be_visible()
    state=fixture('tenlives',['BOT '+str(i+1) for i in range(len(levels))],botLevels=levels,livesMode='double')
    assert page.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}}).ok
    page.wait_for_timeout(850)
    page.evaluate("window.botSlotLengths=[];new MutationObserver(()=>{const n=document.querySelectorAll('#bot-status .thrown').length;if(window.botSlotLengths.at(-1)!==n)window.botSlotLengths.push(n)}).observe(document.getElementById('bot-status'),{childList:true,subtree:true})")
    page.locator('#navigation-close').click();page.wait_for_function('window.botSlotLengths.includes(3)',timeout=10000)
    counts=page.evaluate('window.botSlotLengths');assert counts.index(1)<counts.index(2)<counts.index(3),counts
    # Pause before replacing the test state. No bot may continue behind a menu.
    page.locator('#toggle-toolbar').click()
    print('PASS Hitters Challenge real UI:',len(levels),'BOT seats, slots',counts,flush=True)
   assert not errors,errors
   browser.close()
 finally:server.terminate();server.wait()
