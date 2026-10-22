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
   for options in [{},{'inMode':'double'},{'game':'gotcha'},{'training121':True},{'game':'tactics'},{'game':'cricket'}]:
    s=phone.evaluate("async o=>{const {newMatch}=await import('/engine.js');return newMatch(['A','B'],301,'double',3,o)}",options)
    phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':s,'undo':[]}})
    for page in [screen,phone]:
     page.reload();expect(page.locator('#mode-total')).to_have_class('selected');expect(page.locator('#quick')).to_have_count(0)
     if options.get('game') in ['tactics','cricket']:
      expect(page.locator('#submit')).to_be_visible();expect(page.locator('#confirm-total')).to_be_hidden()
     else:
      expect(page.locator('#submit')).to_be_hidden();expect(page.locator('#confirm-total')).to_be_visible()
      expect(page.locator('#keypad button').last).to_have_attribute('id','confirm-total')
      expect(page.locator('#keypad button')).to_have_count(12)
      assert page.locator('#confirm-total').evaluate('e=>getComputedStyle(e).backgroundColor')==page.locator('body').evaluate("()=>{const e=document.createElement('button');e.className='primary';document.body.append(e);const color=getComputedStyle(e).backgroundColor;e.remove();return color}")
    if options.get('game') not in ['tactics','cricket']:
     for digit in '60':phone.locator('#keypad').get_by_role('button',name=digit,exact=True).click()
     phone.locator('#confirm-total').click();expect(phone.locator('#entry')).to_have_text('0')
     assert len(saved()['match']['state']['history'])==1
     before=saved()['match']['state']
     phone.locator('#keypad').get_by_role('button',name='1',exact=True).click()
     phone.locator('#keypad-bust').click()
     expect(phone.locator('#entry')).to_have_text('0')
     after=saved()['match']['state']
     assert len(after['history'])==2 and after['history'][-1]['bust']
     assert after['players'][before['active']]['remaining']==before['players'][before['active']]['remaining']
     assert phone.locator('#keypad-bust').evaluate('e=>getComputedStyle(e).backgroundColor')!=phone.locator('#keypad button').first.evaluate('e=>getComputedStyle(e).backgroundColor')
     expect(phone.locator('#keypad').get_by_role('button',name='Wis',exact=True)).to_have_count(0)
     expect(screen.locator('#turn-label')).to_have_text(phone.locator('#turn-label').inner_text())
     screen.locator('#undo').click()
     expect(screen.locator('#turn-label')).to_have_text(before['players'][before['active']]['name']+' is aan de beurt')
     assert len(saved()['match']['state']['history'])==1
   b.close();print('PASS: six modes, screen/mobile keypad placement, green confirm, removed shortcuts, cricket/tactics exception, scoring')
 finally:server.terminate();server.wait()
