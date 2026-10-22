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
   s=phone.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',3)}")
   phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':s,'undo':[]}})
   for page in [phone,screen]:
    page.reload();expect(page.locator('#mode-total')).to_have_class('selected')
   for digit,value in [('1','1'),('2','12'),('0','120')]:
    phone.locator('#keypad').get_by_role('button',name=digit,exact=True).click()
    expect(screen.locator('#entry')).to_have_text(value)
   assert len(saved()['match']['state']['history'])==0
   screen.locator('#backspace').click();expect(phone.locator('#entry')).to_have_text('12')
   phone.locator('#keypad').get_by_role('button',name='Wis',exact=True).click();expect(screen.locator('#entry')).to_have_text('0')
   phone.keyboard.type('180');expect(screen.locator('#entry')).to_have_text('180')
   screen.reload();expect(screen.locator('#entry')).to_have_text('180')
   phone.locator('#confirm-total').click();expect(screen.locator('#turn-label')).to_have_text('B is aan de beurt');expect(screen.locator('#entry')).to_have_text('0')
   assert len(saved()['match']['state']['history'])==1
   screen.locator('#undo').click();expect(phone.locator('#entry')).to_have_text('180')
   phone.locator('#keypad').get_by_role('button',name='Wis',exact=True).click();expect(screen.locator('#entry')).to_have_text('0')
   phone.wait_for_timeout(1600);expect(phone.locator('#entry')).to_have_text('0')
   phone.keyboard.type('60');expect(screen.locator('#entry')).to_have_text('60')
   phone.locator('#mode-dart').click();expect(screen.locator('#mode-dart')).to_have_class('selected')
   phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click();expect(screen.locator('#dart-slots span').first).to_have_text('20')
   print('PASS live total: each digit, bidirectional delete/clear, fast typing, reload, confirm, historical edits, per-dart regression')
   b.close();print("Done")
 finally:server.terminate();server.wait()
