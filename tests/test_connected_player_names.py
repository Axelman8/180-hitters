"""Every connected game accepts typed and roster names, including human + BOT."""
from pathlib import Path
import json,subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1];base='http://127.0.0.1:8857'
games=['X01','Cricket','Tactics','4 op een rij','Scram','Killer','Bull / 41','21','121','Gotcha','Hitters Challenge',"Bob's 27"]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8857','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen(base+'/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for width,height,tablet in [(393,852,False),(744,1133,False),(1024,768,True)]:
    page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script('window.personalPlayers=["Mobiele speler"];window.DartsAndroid={isTabletShell:'+str(tablet).lower()+',isLocalMode:()=>false,getConnectionInfo:()=>JSON.stringify({mode:"bluetooth",bluetoothConnected:true}),getMobilePlayers:()=>JSON.stringify(window.personalPlayers),hasMobilePlayers:()=>true,saveMobilePlayers:json=>{window.personalPlayers=JSON.parse(json);},getVenuePlayers:()=>"[]",saveVenuePlayers:()=>{},bindAction:(el,handler)=>el.onclick=handler};')
    page.route('**/api/tablet/config',lambda route:route.fulfill(json={'mode':'bluetooth','bluetoothConnected':True}))
    page.route('**/api/tablet/diagnostics',lambda route:route.fulfill(json={'appVersionName':'test'}))
    for name in ['Clubspeler A','Clubspeler B']:
     page.request.post(base+'/api/players',data={'action':'add','name':name})
    page.goto(base+'/?remote=1&transport=bluetooth');expect(page.locator('#connection-status')).to_have_text('Verbonden met NUC')
    def setup(game):
     page.evaluate("document.dispatchEvent(new Event('open-main-menu'))");page.locator('[data-menu="play"].navigation-category').click();page.locator('#settings').click()
     page.wait_for_function("()=>!document.getElementById('setup').hidden||document.getElementById('new-match-dialog').open")
     if page.locator('#new-match-dialog').is_visible():page.locator('#new-match-confirm').click()
     expect(page.locator('#setup')).to_be_visible()
     page.locator('.wizard-game').filter(has=page.get_by_text(game,exact=True)).click();page.locator('.wizard-next').click()
     page.locator('.wizard-option[data-field="count"] button').filter(has_text='2').click()
    for game in games:
     setup(game)
     first=page.locator('.wizard-player-card').nth(0);second=page.locator('.wizard-player-card').nth(1)
     expect(first.locator('.wizard-custom input')).to_be_visible()
     first.locator('.wizard-custom input').fill('Zelf getypt')
     expect(first.locator('strong')).to_have_text('Zelf getypt')
     # A delayed list/profile refresh must not remove the focused input or keyboard.
     first.locator('.wizard-custom input').focus()
     page.evaluate("document.dispatchEvent(new CustomEvent('players-lists-updated',{detail:{venuePlayers:['Clubspeler A','Clubspeler B'],mobilePlayers:['Ander toestel']}}));document.dispatchEvent(new Event('venue-profile-ready'))")
     expect(first.locator('.wizard-custom input')).to_be_focused();expect(first.locator('.wizard-custom input')).to_have_value('Zelf getypt')
     assert first.locator('select option').filter(has_text='Mobiele speler').count()==1
     assert first.locator('select option').filter(has_text='Ander toestel').count()==0
     first.locator('select').select_option(label='Mobiele speler')
     expect(first.locator('.wizard-custom input')).to_have_value('Mobiele speler')
     first.locator('.wizard-custom input').fill('Zelf getypt')
     second.locator('select').select_option(label='Clubspeler B')
     expect(second.locator('.wizard-custom input')).to_have_value('Clubspeler B')
     expect(page.locator('.wizard-option[data-field="starter"] button')).to_have_text(['Zelf getypt','Clubspeler B'])
     # Selecting a BOT must leave the other human player's name editor available.
     second.locator('.wizard-player-select').click();page.locator('.wizard-bot-choice').get_by_role('button',name='BOT 50',exact=True).click()
     expect(first.locator('.wizard-custom input')).to_be_visible();expect(first.locator('select')).to_be_visible()
     first.locator('.wizard-custom input').fill('Mens naast BOT')
     second.get_by_role('button',name='Menselijke speler',exact=True).click()
     expect(second.locator('.wizard-custom input')).to_have_value('Clubspeler B')
     first.locator('.wizard-custom input').fill('Zelf getypt')
     # Blurring the input by pressing Start must submit on the first click.
     first.locator('.wizard-custom input').focus();page.locator('.wizard-next').click()
     expect(page.locator('#setup')).to_be_hidden()
     saved=page.request.get(base+'/api/state').json()['match']['state']
     assert [x['name'] for x in saved['players']]==['Zelf getypt','Clubspeler B'],(game,saved['players'])
     assert not any(player.get('bot') for player in saved['players'])
     assert not page.locator('body').evaluate('el=>el.scrollWidth>innerWidth'),(width,game)
     print('PASS player names:',width,'tablet' if tablet else 'phone',game,flush=True)
    # Four player games keep all human name fields even when the BOT is selected.
    setup('4 op een rij');page.locator('.wizard-option[data-field="count"] button').filter(has_text='4').click()
    page.locator('.wizard-player-select').nth(3).click();page.locator('.wizard-bot-choice').get_by_role('button',name='BOT 40',exact=True).click()
    expect(page.locator('.wizard-player-card .wizard-custom input')).to_have_count(3)
    for i in range(3):page.locator('.wizard-player-card .wizard-custom input').nth(i).fill('Speler '+str(i+1)+' eigen')
    page.locator('.wizard-next').click();expect(page.locator('#setup')).to_be_hidden()
    saved=page.request.get(base+'/api/state').json()['match']['state']
    assert [x['name'] for x in saved['players'][:3]]==['Speler 1 eigen','Speler 2 eigen','Speler 3 eigen']
    assert saved['players'][3]['bot'] and saved['players'][3]['botLevel']==40
    # Teams use the same roster and typing controls for the selected member.
    setup('Tactics');page.locator('.wizard-option[data-field="participant-mode"]').get_by_role('button',name='Teams',exact=True).click()
    page.locator('.wizard-team-name input').nth(0).fill('Team rood');page.locator('.wizard-team-name input').nth(1).fill('Team blauw')
    team=page.locator('.wizard-team').nth(0);team.locator('.wizard-team-slots button').nth(0).click()
    page.locator('.wizard-name-picker select').select_option(label='Clubspeler A')
    expect(team.locator('.wizard-team-slots strong').nth(0)).to_have_text('Clubspeler A')
    team.locator('.wizard-team-slots button').nth(1).click();page.locator('.wizard-name-picker input').fill('Eigen teamlid')
    expect(team.locator('.wizard-team-slots strong').nth(1)).to_have_text('Eigen teamlid')
    team=page.locator('.wizard-team').nth(1);team.locator('.wizard-team-slots button').nth(0).click();page.locator('.wizard-name-picker select').select_option(label='Clubspeler B')
    team.locator('.wizard-team-slots button').nth(1).click();page.locator('.wizard-name-picker select').select_option(label='Mobiele speler')
    page.locator('.wizard-next').click();expect(page.locator('#setup')).to_be_hidden()
    saved=page.request.get(base+'/api/state').json()['match']['state']
    assert [x['members'] for x in saved['players']]==[['Clubspeler A','Eigen teamlid'],['Clubspeler B','Mobiele speler']]
    print('PASS typed and roster team names:',width,flush=True)
    assert not errors,errors
    page.close()
   browser.close()
 finally:server.terminate();server.wait()
