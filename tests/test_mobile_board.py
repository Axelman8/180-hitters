from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();page=b.new_page();page.add_init_script("document.documentElement.classList.add('tablet-shell')");page.goto('http://127.0.0.1:8788/?android=1')
   for game in ['tactics','cricket']:
    state=page.evaluate("async game=>{const {newMatch}=await import('/engine.js');return newMatch(['Ed','Frank','Remon','Leen'],501,'double',3,{game})}",game)
    revision=page.request.get('http://127.0.0.1:8788/api/state').json()['revision']
    page.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}})
    page.evaluate("localStorage.clear()");page.reload();page.evaluate("document.documentElement.classList.add('tablet-shell')")
    expect(page.locator('body')).to_have_attribute('data-game',game)
    for width,height in [(393,852),(600,1024),(768,900),(852,700),(320,740)]:
     page.set_viewport_size({'width':width,'height':height})
     expect(page.locator('#cricket-panel')).to_be_visible()
     expect(page.locator('#board-keys')).to_be_visible()
     expect(page.locator('.marks-table tbody tr')).to_have_count(12 if game=='tactics' else 7)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
     if game=='tactics' and width==600:
      fit=page.evaluate("()=>{const m=document.querySelector('main'),g=document.querySelector('#game'),p=document.querySelector('.play-grid'),s=document.querySelector('.scoring'),c=document.querySelector('#cricket-panel');return {html:document.documentElement.className,body:document.body.className,gameData:document.body.dataset.game,display:getComputedStyle(p).display,columns:getComputedStyle(p).gridTemplateColumns,main:[m.clientHeight,m.scrollHeight],game:[g.clientHeight,g.scrollHeight],play:[p.clientHeight,p.scrollHeight],scoring:[s.clientHeight,s.scrollHeight],cricket:[c.clientHeight,c.scrollHeight]}}")
      assert fit['main'][1]<=fit['main'][0]+1,fit
      assert page.evaluate("document.querySelector('#cricket-panel').getBoundingClientRect().bottom<=document.querySelector('main').getBoundingClientRect().bottom+1")
      assert page.evaluate("document.querySelector('.scoring').getBoundingClientRect().bottom<=document.querySelector('main').getBoundingClientRect().bottom+1")
      assert page.evaluate("document.querySelector('#toggle-history').getBoundingClientRect().bottom<=document.querySelector('main').getBoundingClientRect().bottom+1")
      assert page.evaluate("document.querySelector('#tactics-remove').getBoundingClientRect().left===document.querySelector('#board-keys').getBoundingClientRect().left")
      assert page.evaluate("document.querySelector('#board-keys').getBoundingClientRect().height>=429")
      assert page.evaluate("document.querySelector('.marks-table').getBoundingClientRect().height>=500")
     if width==768:page.screenshot(path=str(root/'tests/mobile-board-preview.png'))
    page.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
    expect(page.locator('.marks-table [aria-label="Ed: 1 van 3 treffers op 20 (nog bevestigen)"]')).to_be_visible()
   b.close();print('PASS: local Tactics/Cricket board and input visible, four viewport sizes, live marks')
 finally:server.terminate();server.wait()
