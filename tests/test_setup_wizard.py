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
   def open_setup():
    if page.locator('#toggle-toolbar').get_attribute('aria-expanded')=='false':page.locator('#toggle-toolbar').click()
    if not page.locator('#settings').is_visible():page.locator('#header-menu details[data-menu="play"] summary').click()
    page.locator('#settings').click();page.locator('#new-match-confirm').click()
   videos={'X01':'180-Hitters-X01-uitleg.mp4','Cricket':'180-Hitters-Cricket-uitleg.mp4','Tactics':'180-Hitters-Tactics-uitleg.mp4','4 op een rij':'180-Hitters-4-op-een-rij-uitleg.mp4','Scram':'180-Hitters-Scram-uitleg.mp4','Killer':'180-Hitters-Killer-uitleg.mp4','Bull / 41':'180-Hitters-Bull-41-uitleg.mp4','21':'180-Hitters-21-uitleg.mp4','121':'180-Hitters-121-uitleg.mp4','Gotcha':'180-Hitters-Gotcha-uitleg.mp4',"Bob's 27":'180-Hitters-Bobs-27-uitleg.mp4'}
   descriptions={'X01':'gekozen startscore','Cricket':'15, 16, 17, 18, 19, 20','Tactics':'10 tot en met 20','4 op een rij':'drie marks','Scram':'scoringsfase','Killer':'uniek eigen getal','Bull / 41':'25 bullmarks','21':'Single gaat één stap','121':'maximaal negen darts','Gotcha':'tegenstander','Hitters Challenge':'20 naar 10',"Bob's 27":'Start op 27'}
   for game in ['X01','Cricket','Tactics','4 op een rij','Scram','Killer','Bull / 41','21','121','Gotcha',"Bob's 27"]:
    if game!='X01':
     open_setup()
    page.locator('.wizard-game').filter(has=page.get_by_text(game,exact=True)).click()
    expect(page.locator('#setup-wizard h1')).to_have_text('Maak het jouw partij')
    expect(page.locator('.wizard-game-description')).to_contain_text(descriptions[game])
    assert page.locator('.wizard-game-description').count()==1
    if game in videos:
     video=page.get_by_role('link',name='Bekijk uitlegvideo')
     expect(video).to_have_attribute('href',f'https://github.com/Axelman8/180-hitters/releases/latest/download/{videos[game]}')
     if game=='X01':
      video.click();expect(page.locator('#game-video-dialog')).to_be_visible();expect(page.locator('#game-video-dialog video')).to_have_attribute('src',f'https://github.com/Axelman8/180-hitters/releases/latest/download/{videos[game]}');page.locator('#game-video-dialog').get_by_role('button',name='Sluiten').click()
    else:assert page.locator('.wizard-video-link').count()==0
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
    if game=='4 op een rij':
     page.locator('.wizard-symbol-player').first.get_by_role('button',name='Ed: △',exact=True).click()
    page.get_by_role('group',name='Wie begint?',exact=True).get_by_role('button',name='Frank',exact=True).click()
    page.get_by_role('button',name='← Terug',exact=True).click()
    page.get_by_role('button',name='Kies spelers').click()
    expect(page.locator('.wizard-slots strong')).to_have_text(['Ed','Frank'])
    if game=='X01':page.screenshot(path=str(root.parent/'darts-wizard-players.png'),full_page=True)
    page.locator('.wizard-next').click();expect(page.locator('#setup')).to_be_hidden()
    match=page.request.get('http://127.0.0.1:8788/api/state').json()['match']['state']
    assert [x['name'] for x in match['players']]==['Ed','Frank'] and match['starter']==1,(game,[x['name'] for x in match['players']],match['starter'])
    if game not in ['Scram','Bull / 41']:assert match['active']==1,(game,match['active'])
    assert match['game']==({'X01':'x01','Cricket':'cricket','Tactics':'tactics','4 op een rij':'fourinarow','Scram':'scram','Killer':'killer','Bull / 41':'bull41','21':'twentyone','121':'x01','Gotcha':'gotcha',"Bob's 27":'bobs27'}[game])
    if game=='4 op een rij':assert match['players'][0]['fourSymbol']=='△' and len({player['fourSymbol'] for player in match['players']})==2
    if game=='X01':assert match['start']==301 and match['inMode']=='double'
   open_setup()
   page.locator('.wizard-game').filter(has=page.get_by_text('Hitters Challenge',exact=True)).click()
   expect(page.locator('.wizard-game-description')).to_contain_text(descriptions['Hitters Challenge'])
   expect(page.get_by_role('link',name='Bekijk uitlegvideo')).to_have_attribute('href','https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Hitters-Challenge-uitleg.mp4')
   page.reload();expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
   open_setup()
   page.locator('.wizard-game').filter(has=page.get_by_text('X01',exact=True)).click()
   expect(page.get_by_role('group',name='Startscore',exact=True).get_by_role('button',name='301',exact=True)).to_have_attribute('aria-pressed','true')
   page.request.post('http://127.0.0.1:8788/api/display',data={'inputCollapsed':True})
   desktop=b.new_page(viewport={'width':1080,'height':1920});desktop.goto('http://127.0.0.1:8788/')
   expect(desktop.locator('#connection-status')).to_have_text('Verbonden met NUC')
   if desktop.locator('#toggle-toolbar').get_attribute('aria-expanded')=='false':desktop.locator('#toggle-toolbar').click()
   if not desktop.locator('#settings').is_visible():desktop.locator('#header-menu details[data-menu="play"] summary').click()
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
