from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();screen=b.new_page(viewport={'width':1080,'height':1920});screen.goto('http://127.0.0.1:8788/')
   state=screen.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Ed','Frank'],501,'double',3)}")
   screen.request.post('http://127.0.0.1:8788/api/state',data={'revision':0,'match':{'state':state,'undo':[]}})
   phone=b.new_page(viewport={'width':393,'height':750});phone.goto('http://127.0.0.1:8788/?remote=1');expect(phone.locator('#connection-status')).to_have_text('Verbonden met NUC')
   phone.locator('#settings').click();phone.locator('#new-match-confirm').click()
   expect(screen.locator('#setup')).to_be_visible();expect(screen.locator('#club-saver')).to_be_hidden();expect(phone.locator('#club-saver')).to_be_hidden()
   phone.locator('.wizard-game').filter(has=phone.get_by_text('X01',exact=True)).click()
   phone.locator('[data-field="start"]').get_by_role('button',name='301',exact=True).click()
   expect(screen.locator('#start')).to_have_value('301')
   phone.get_by_role('button',name='Kies spelers').click()
   phone.locator('.wizard-custom input').fill('Remon')
   phone.locator('.wizard-custom input').press('Tab')
   expect(screen.locator('.wizard-slots strong').first).to_have_text('Remon')
   expect(screen.locator('#setup-wizard h1')).to_have_text('Wie doen er mee?')
   phone.locator('.wizard-next').click()
   expect(phone.locator('#setup')).to_be_hidden();expect(screen.locator('#club-saver')).to_be_hidden();expect(screen.locator('#game')).to_be_visible()
   phone.locator('#settings').click();phone.locator('#new-match-confirm').click();expect(screen.locator('#setup')).to_be_visible()
   phone.locator('.wizard-back').click();expect(screen.locator('#setup')).to_be_hidden()
   b.close();print('PASS: live setup steps, options, names; start and cancel restore scoreboard')
 finally:server.terminate();server.wait()
