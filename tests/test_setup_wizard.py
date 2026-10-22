from pathlib import Path
import subprocess,sys,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();page=b.new_page(viewport={'width':393,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8788/?remote=1');expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
   for name in ['Frank','Ed']:
    page.request.post('http://127.0.0.1:8788/api/players',data={'action':'add','name':name})
   page.reload();expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
   for game in ['X01','Cricket','Tactics','121','Gotcha',"Bob's 27"]:
    if game!='X01':
     page.locator('#settings').click();page.locator('#new-match-confirm').click()
    page.locator('.wizard-game').filter(has=page.get_by_text(game,exact=True)).click()
    expect(page.locator('#setup-wizard h1')).to_have_text('Maak het jouw partij')
    if game=='X01':
     page.get_by_role('group',name='Startscore',exact=True).get_by_role('button',name='301',exact=True).click()
     page.get_by_role('group',name='Beginnen',exact=True).get_by_role('button',name='Dubbel-in',exact=True).click()
    for width in [320,393,768]:
     page.set_viewport_size({'width':width,'height':835})
     assert page.locator('#setup-wizard').evaluate('e=>e.scrollWidth<=e.clientWidth')
    page.set_viewport_size({'width':393,'height':750})
    if game=='X01':page.screenshot(path=str(root.parent/'darts-wizard-settings.png'),full_page=True)
    page.get_by_role('button',name='Kies spelers').click()
    page.get_by_role('group',name='Aantal spelers',exact=True).get_by_role('button',name='2',exact=True).click()
    page.locator('.wizard-slots button').first.click()
    page.locator('.wizard-roster').get_by_role('button',name='Ed',exact=True).click()
    page.locator('.wizard-roster').get_by_role('button',name='Frank',exact=True).click()
    page.get_by_role('group',name='Wie begint?',exact=True).get_by_role('button',name='Frank',exact=True).click()
    page.get_by_role('button',name='← Terug',exact=True).click()
    page.get_by_role('button',name='Kies spelers').click()
    expect(page.locator('.wizard-slots strong')).to_have_text(['Ed','Frank'])
    if game=='X01':page.screenshot(path=str(root.parent/'darts-wizard-players.png'),full_page=True)
    page.locator('.wizard-next').click();expect(page.locator('#setup')).to_be_hidden()
    match=page.request.get('http://127.0.0.1:8788/api/state').json()['match']['state']
    assert [x['name'] for x in match['players']]==['Ed','Frank'] and match['active']==1
    assert match['game']==({'X01':'x01','Cricket':'cricket','Tactics':'tactics','121':'x01','Gotcha':'gotcha',"Bob's 27":'bobs27'}[game])
    if game=='X01':assert match['start']==301 and match['inMode']=='double'
   page.reload();expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
   page.locator('#settings').click();page.locator('#new-match-confirm').click()
   page.locator('.wizard-game').filter(has=page.get_by_text('X01',exact=True)).click()
   expect(page.get_by_role('group',name='Startscore',exact=True).get_by_role('button',name='301',exact=True)).to_have_attribute('aria-pressed','true')
   page.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':True})
   desktop=b.new_page(viewport={'width':1080,'height':1920});desktop.goto('http://127.0.0.1:8788/')
   expect(desktop.locator('#connection-status')).to_have_text('Verbonden met NUC')
   desktop.locator('#settings').click();desktop.locator('#new-match-confirm').click()
   expect(desktop.locator('#category-match')).to_be_hidden();expect(desktop.locator('#setup-wizard')).to_be_visible()
   expect(desktop.locator('#game')).to_be_hidden()
   desktop.locator('.wizard-game').filter(has=desktop.get_by_text('X01',exact=True)).click()
   desktop.get_by_role('group',name='Startscore',exact=True).get_by_role('button',name='501',exact=True).click()
   desktop.get_by_role('button',name='Kies spelers').click()
   desktop.locator('.wizard-next').click();expect(desktop.locator('#setup')).to_be_hidden()
   assert desktop.request.get('http://127.0.0.1:8788/api/state').json()['match']['state']['start']==501
   assert not errors,errors
   b.close();print('PASS: six games, options, saved roster, order/starter, back navigation, 320/393/768px, no JS errors')
 finally:server.terminate();server.wait()
