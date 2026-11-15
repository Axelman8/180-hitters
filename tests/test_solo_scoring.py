"""Solo points preview/commit syncs to the screen and appears in the report."""
from pathlib import Path
import re,subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8844','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.8)
  with sync_playwright() as p:
   browser=p.chromium.launch();phone=browser.new_page(viewport={'width':393,'height':852});screen=browser.new_page(viewport={'width':1280,'height':800});errors=[]
   for view in [phone,screen]:view.on('pageerror',lambda e:errors.append(str(e)));view.goto('http://127.0.0.1:8844/');view.evaluate("document.dispatchEvent(new Event('close-navigation'))")
   url='http://127.0.0.1:8844';saved=lambda:phone.request.get(url+'/api/state').json()
   assert phone.request.post(url+'/api/display',data={'inputCollapsed':False}).ok
   for game in ['cricket','tactics']:
    for scoring in ['standard','cut-throat','no-score']:
     phone.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");screen.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
     state=phone.evaluate("""async ({game,scoring})=>{const {newMatch}=await import('/engine.js');const s=newMatch(['Solo'],501,'double',1,{game,scoring,maxRounds:0});s.players[0].marks[20]=3;return s}""",{'game':game,'scoring':scoring})
     assert phone.request.post(url+'/api/state',data={'revision':saved()['revision'],'match':{'state':state,'undo':[],'inputPreferenceVersion':1,'preferredMode':'dart'}}).ok
     expect(phone.locator('body')).to_have_attribute('data-game',game)
     expect(phone.locator('#players .remaining')).to_have_text('0')
     phone.locator('#multipliers [data-multiplier="3"]').click()
     points=0 if scoring=='no-score' else 60
     phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
     for view in [phone,screen]:expect(view.locator('#players .remaining')).to_have_text(str(points))
     phone.locator('#multipliers [data-multiplier="3"]').click()
     phone.locator('#board-keys').get_by_role('button',name='20',exact=True).click()
     phone.locator('#board-keys').get_by_role('button',name='Mis',exact=True).click()
     deadline=time.monotonic()+5
     while not saved()['match']['state']['history'] and time.monotonic()<deadline:phone.wait_for_timeout(80)
     current=saved();assert current['match']['state']['players'][0]['cricketPoints']==2*points
     if scoring=='standard':
      current['match']['state'].update(phase='leg',winner=0)
      assert phone.request.post(url+'/api/state',data={'revision':current['revision'],'match':current['match']}).ok
      for view in [phone,screen]:expect(view.locator('#result-text')).to_contain_text('120 punten')
      current=saved()
     current['match']['state'].update(phase='won',winner=0,completedAt=int(time.time()*1000))
     assert phone.request.post(url+'/api/state',data={'revision':current['revision'],'match':current['match']}).ok
     for view in [phone,screen]:
      expect(view.locator('#game-report')).to_be_visible(timeout=10000)
      if scoring!='no-score':
       expect(view.locator('.game-report-players dt').filter(has_text=re.compile('^Eindscore$')).locator('xpath=following-sibling::dd[1]')).to_have_text('120')
       expect(view.locator('.game-report-table tbody tr').first.locator('td').nth(3)).to_have_text('120')
      else:expect(view.locator('.game-report-subtitle')).to_contain_text('puntentelling staat uit')
     assert not errors,errors
     print('PASS: solo',game,scoring,'live points, shared screen and end report',flush=True)
   browser.close()
 finally:server.terminate();server.wait()
