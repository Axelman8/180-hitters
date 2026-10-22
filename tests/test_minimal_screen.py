from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();screen=b.new_page(viewport={'width':1080,'height':1920});phone=b.new_page(viewport={'width':393,'height':750})
   screen.goto('http://127.0.0.1:8788/');phone.goto('http://127.0.0.1:8788/?remote=1')
   def saved():return phone.request.get('http://127.0.0.1:8788/api/state').json()
   for count in [2,3,4]:
    state=phone.evaluate("async count=>{const {newMatch,applyTurn}=await import('/engine.js');let s=newMatch(['Ed','Frank','Remon','Sean'].slice(0,count),501,'double',3);for(let i=0;i<count*9-1;i++)s=applyTurn(s,{score:10+i});return s}",count)
    phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}})
    phone.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':True})
    for page in [screen,phone]:page.reload();expect(page.locator('#mode-total')).to_have_class('selected')
    expect(screen.locator('.scoring')).to_be_hidden();expect(phone.locator('#keypad')).to_be_visible()
    expect(screen.locator('#screen-player-history thead th')).to_have_count(count+1)
    expect(screen.locator('#screen-player-history tbody th')).to_have_text(['9','8','7','6','5'])
    expect(screen.locator('#screen-player-history tbody tr').first.locator('td').last).to_have_text('\u2014')
    expect(screen.locator('#screen-player-history tbody tr').nth(1).locator('td').last).not_to_have_text('\u2014')
    left=screen.locator('.screen-visit').bounding_box();right=screen.locator('#finish-panel').bounding_box()
    assert abs(left['y']-right['y'])<1 and abs(left['height']-right['height'])<1 and abs(left['width']-right['width'])<1
    labels=[screen.locator(q).bounding_box() for q in ['.screen-visit .eyebrow','#finish-panel .eyebrow']]
    assert abs(labels[0]['y']-labels[1]['y'])<2
    assert abs(left['height']-1920*0.12)<2
    phone.locator('#keypad').get_by_role('button',name='6',exact=True).click()
    expect(screen.locator('#screen-visit-score')).to_have_text('6')
    screen.screenshot(path=f'darts-minimal-{count}.png',full_page=True)
    screen.locator('#screen-input-shortcut').click();expect(screen.locator('#keypad')).to_be_visible()
    expect(screen.locator('#screen-player-history')).to_be_hidden()
   state=phone.evaluate("async()=>{const {newMatch,applyTurn,nextLeg}=await import('/engine.js');let s=newMatch(['Ed','Frank'],40,'double',3);s=applyTurn(s,{hits:[{number:20,mult:2}]});s=nextLeg(s);return applyTurn(s,{score:12})}")
   phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}})
   screen.reload();expect(screen.locator('#screen-history-title')).to_have_text('Score per beurt')
   expect(screen.locator('#screen-history-leg')).to_have_text('Leg 2')
   expect(screen.locator('#screen-player-history tbody th')).to_have_text(['1'])
   expect(screen.locator('#screen-player-history tbody td')).to_have_text(['\u2014','12'])
   print('PASS: equal side-by-side panels, 2/3/4 player history, live total, collapse/expand, mobile controls')
   b.close();print("Done")
 finally:server.terminate();server.wait()
