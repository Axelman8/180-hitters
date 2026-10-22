from ui_input import enter_total
from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();phone=b.new_page(viewport={'width':393,'height':750});screen=b.new_page(viewport={'width':1080,'height':1920})
   phone.goto('http://127.0.0.1:8788/?remote=1');screen.goto('http://127.0.0.1:8788/')
   def saved():return phone.request.get('http://127.0.0.1:8788/api/state').json()
   def seed(game):
    s=phone.evaluate("async game=>{const {newMatch}=await import('/engine.js');let s=newMatch(['A','B','C'],301,'double',3,{game});if(game==='gotcha'){s.players[1].remaining=20;s.players[2].remaining=60;}return s}",game)
    phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':s,'undo':[]}})
    for page in [phone,screen]:page.reload();expect(page.locator('#mode-total')).to_have_class('selected')
   for game in ['cricket','tactics']:
    seed(game)
    for n in ['20','20','20']:phone.locator('#board-keys').get_by_role('button',name=n,exact=True).click()
    expect(screen.locator('#dart-slots span').nth(2)).to_have_text('20')
    expect(screen.locator('#mode-total')).to_have_class('selected')
    assert len(saved()['match']['state']['history'])==0
    phone.locator('#submit:visible, #confirm-total:visible, #tactics-confirm:visible').click();expect(phone.locator('#turn-label')).to_have_text('B is aan de beurt')
    assert saved()['match']['state']['players'][0]['marks']['20']==3
    phone.locator('#mode-dart').click();phone.reload();expect(phone.locator('#mode-dart')).to_have_class('selected')
   seed('gotcha')
   phone.locator('#gotcha-reset').click()
   expect(phone.locator('#gotcha-targets')).to_be_visible()
   phone.locator('#gotcha-targets').get_by_role('button',name='B (20) op nul',exact=True).click()
   expect(phone.locator('#message')).to_contain_text('B staat op nul')
   assert saved()['match']['state']['players'][1]['remaining']==0
   assert saved()['match']['state']['active']==0
   assert len(saved()['match']['state']['history'])==0
   expect(screen.locator('#players .remaining').nth(1)).to_have_text('0')
   screen.locator('#undo').click()
   expect(phone.locator('#players .remaining').nth(1)).to_have_text('20')
   screen.locator('#redo').click()
   expect(phone.locator('#players .remaining').nth(1)).to_have_text('0')
   phone.reload()
   expect(phone.locator('#players .remaining').nth(1)).to_have_text('0')
   enter_total(phone, '60');phone.locator('#submit:visible, #confirm-total:visible').click()
   expect(phone.locator('#turn-label')).to_have_text('B is aan de beurt')
   assert [x['remaining'] for x in saved()['match']['state']['players']]==[60,0,0]
   phone.reload();expect(phone.locator('#gotcha-targets')).to_be_hidden()
   expect(screen.locator('#turn-label')).to_have_text('B is aan de beurt')
   screen.locator('#undo').click()
   expect(phone.locator('#turn-label')).to_have_text('A is aan de beurt')
   assert [x['remaining'] for x in saved()['match']['state']['players']]==[0,0,60]
   screen.locator('#undo').click()
   expect(phone.locator('#players .remaining').nth(1)).to_have_text('20')
   assert [x['remaining'] for x in saved()['match']['state']['players']]==[0,20,60]
   seed('gotcha')
   enter_total(phone, '60');phone.locator('#submit:visible, #confirm-total:visible').click()
   expect(phone.locator('#turn-label')).to_have_text('B is aan de beurt')
   assert [x['remaining'] for x in saved()['match']['state']['players']]==[60,20,0]
   phone.locator('#gotcha-reset').click()
   expect(phone.locator('#message')).to_contain_text('A staat op nul')
   assert [x['remaining'] for x in saved()['match']['state']['players']]==[0,20,0]
   assert saved()['match']['state']['active']==1
   # Bob's 27 is dart-only: one D1 scores +2; a blank D2 round scores -4.
   s=phone.evaluate("async()=>{const {newMatch}=await import('/engine.js');return newMatch(['A'],27,'double',1,{game:'bobs27'})}")
   phone.request.post('http://127.0.0.1:8788/api/state',data={'revision':saved()['revision'],'match':{'state':s,'undo':[]}})
   for page in [phone,screen]:page.reload()
   expect(phone.locator('#mode-dart')).to_have_class('selected')
   expect(phone.locator('#training-status')).to_contain_text('Doel D1')
   phone.get_by_role('button',name='Double',exact=True).click()
   phone.locator('#board-keys').get_by_role('button',name='1',exact=True).click()
   phone.locator('#board-keys').get_by_role('button',name='Mis',exact=True).click()
   phone.locator('#board-keys').get_by_role('button',name='Mis',exact=True).click()
   expect(screen.locator('#players .remaining')).to_have_text('29')
   expect(phone.locator('#training-status')).to_contain_text('Doel D2')
   for _ in range(3):phone.locator('#board-keys').get_by_role('button',name='Mis',exact=True).click()
   expect(screen.locator('#players .remaining')).to_have_text('25')
   assert saved()['match']['state']['bobsTarget']==3
   results=phone.evaluate("async()=>{const {runTests}=await import('/tests/engine.test.js');return runTests()}")
   print("PASS: all games, Bob's 27 scoring and sync, cricket/tactics batch submit, Gotcha reset, undo/redo and reload; engine tests:",results['passed'])
   b.close()
 finally:server.terminate();server.wait()
