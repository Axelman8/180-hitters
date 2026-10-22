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
   state=phone.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],501,'double',3,{game:'tactics'})}")
   phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[]}})
   for page in [phone,screen]:
    page.reload();expect(page.locator('#tactics-remove')).to_be_visible();expect(page.locator('#tactics-confirm')).to_be_visible()
    expect(page.locator('#submit')).to_be_hidden();expect(page.locator('#remove-dart')).to_be_hidden()
    expect(page.locator('#board-keys button')).to_have_count(16)
   phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
   phone.locator('#tactics-remove').click();expect(phone.locator('#tactics-remove')).to_be_disabled()
   for _ in range(3):phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
   expect(screen.locator('#dart-slots span').nth(2)).to_have_text('20')
   phone.locator('#tactics-confirm').click();expect(screen.locator('#turn-label')).to_have_text('B is aan de beurt')
   assert saved()['match']['state']['players'][0]['marks']['20']==3
   phone.locator('#mode-dart').click()
   for _ in range(3):phone.locator('#board-keys').get_by_role('button',name='19',exact=True).click()
   expect(screen.locator('#turn-label')).to_have_text('A is aan de beurt')
   for width in [320,393,768]:
    phone.set_viewport_size({'width':width,'height':750})
    assert phone.locator('#board-keys').evaluate('e=>e.scrollWidth<=e.clientWidth')
   print('PASS: Tactics tiles, erase, confirm, sync, automatic per-dart advance, narrow/wide layouts')
   b.close();print("Done")
 finally:server.terminate();server.wait()
