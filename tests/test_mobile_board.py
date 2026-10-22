from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();page=b.new_page();page.goto('http://127.0.0.1:8788/?android=1')
   for game in ['tactics','cricket']:
    state=page.evaluate("async game=>{const {newMatch}=await import('/engine.js');return newMatch(['Ed','Frank','Remon','Leen'],501,'double',3,{game})}",game)
    revision=page.request.get('http://127.0.0.1:8788/api/state').json()['revision']
    page.request.post('http://127.0.0.1:8788/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}})
    page.evaluate("localStorage.clear()");page.reload()
    expect(page.locator('body')).to_have_attribute('data-game',game)
    for width,height in [(393,852),(768,900),(852,700),(320,740)]:
     page.set_viewport_size({'width':width,'height':height})
     expect(page.locator('#cricket-panel')).to_be_visible()
     expect(page.locator('#board-keys')).to_be_visible()
     expect(page.locator('.marks-table tbody tr')).to_have_count(12 if game=='tactics' else 7)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
     if width==768:page.screenshot(path=str(root/'tests/mobile-board-preview.png'))
    page.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
    expect(page.locator('.marks-table [aria-label="Ed: 1 van 3 treffers op 20 (nog bevestigen)"]')).to_be_visible()
   b.close();print('PASS: local Tactics/Cricket board and input visible, four viewport sizes, live marks')
 finally:server.terminate();server.wait()
