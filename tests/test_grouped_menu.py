from pathlib import Path
import subprocess,sys,time,tempfile,json
from playwright.sync_api import sync_playwright,expect
root=Path.cwd()
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch()
   for width,height,query in [(320,740,'?remote=1'),(393,852,'?remote=1'),(768,850,'?remote=1'),(1080,1920,'')]:
    print('Testing',width,flush=True)
    page=b.new_page(viewport={'width':width,'height':height});page.goto('http://127.0.0.1:8788/'+query)
    expect(page.locator('#header-menu')).to_be_visible()
    expect(page.locator('#toggle-toolbar')).to_be_visible()
    expect(page.locator('#toggle-toolbar')).to_have_text('Menu inklappen')
    page.locator('#toggle-toolbar').click();expect(page.locator('#header-menu')).to_be_hidden()
    expect(page.locator('#toggle-toolbar')).to_have_text('Menu openen')
    page.locator('#toggle-toolbar').click();expect(page.locator('#header-menu')).to_be_visible()
    expect(page.locator('#header-menu summary')).to_have_text(['Spelen','Online darten','Verbindingen','Applicatie'])
    expect(page.locator('#header-menu details[open]')).to_have_count(0)
    page.locator('summary',has_text='Spelen').click();expect(page.locator('#settings')).to_be_visible()
    assert page.locator('#edit-match').evaluate("e=>e.closest('details').dataset.menu")=='play'
    assert page.locator('#team-manager').evaluate("e=>e.closest('details').dataset.menu")=='play'
    page.locator('summary',has_text='Online darten').click()
    expect(page.locator('#online-host-open')).to_have_text('Dartbaan aanmaken')
    expect(page.locator('#online-join-open')).to_have_text('Deelnemen aan online dartbaan')
    assert page.locator('#online-host-open').evaluate("e=>e.closest('details').dataset.menu")=='online'
    page.locator('#online-host-open').click();expect(page.locator('#online-dialog')).to_be_visible()
    expect(page.locator('#online-host-section')).to_be_visible();expect(page.locator('#online-join-section')).to_be_hidden()
    expect(page.locator('#online-public')).to_be_checked()
    expect(page.locator('#online-share')).to_be_hidden()
    page.locator('#online-close').click()
    page.locator('summary',has_text='Online darten').click();page.locator('#online-join-open').click()
    expect(page.locator('#online-host-section')).to_be_hidden();expect(page.locator('#online-join-section')).to_be_visible()
    expect(page.locator('#online-lobby-refresh')).to_be_visible()
    expect(page.locator('#online-lobby')).to_be_visible()
    page.locator('#online-close').click()
    page.locator('summary',has_text='Verbindingen').click();expect(page.locator('#network-open')).to_be_visible()
    assert page.locator('#bluetooth-open').evaluate("e=>e.closest('details').dataset.menu")=='connections'
    page.locator('summary',has_text='Applicatie').click();expect(page.locator('#android-app-action')).to_be_visible()
    assert page.locator('#kiosk-mode-toggle').evaluate("e=>e.closest('details').dataset.menu")=='application'
    expect(page.locator('#venue-open')).to_be_visible()
    assert page.locator('#venue-open').evaluate("e=>e.closest('details').dataset.menu")=='application'
    expect(page.locator('#settings')).to_be_hidden()
    expect(page.locator('#layout-open')).to_have_count(0)
    page.keyboard.press('Escape')
    assert page.locator('body').get_attribute('data-mobile-layout')=='adaptive'
    assert page.locator('#settings').evaluate("e=>getComputedStyle(e).color")=='rgb(255, 173, 102)'
    page.locator('summary',has_text='Spelen').click();page.keyboard.press('Escape')
    expect(page.locator('#header-menu details[open]')).to_have_count(0)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.close()
   active=b.new_page(viewport={'width':393,'height':852});active.goto('http://127.0.0.1:8788/?remote=1')
   active.evaluate("""async()=>fetch('/api/online/local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:true,ready:false,role:0,code:'ABC234',base:'https://180-hitters-online.180-hitters-online.workers.dev',key:'12345678901234567890',remoteRevision:1})})""")
   remote={'code':'ABC234','revision':1,'joined':1,'capacity':2,'public':True,'match':{'undo':[],'state':{'version':2,'game':'fourinarow','phase':'playing','active':0,'history':[],'players':[{'name':'Axel'},{'name':'Wachten op speler 2'}],'fourBoard':['bb']*25,'fourOwners':[None]*25}}}
   active.route('https://180-hitters-online.180-hitters-online.workers.dev/rooms/ABC234*',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(remote)))
   active.reload();active.locator('summary',has_text='Online darten').click()
   expect(active.locator('#online-host-open')).to_have_text('Actieve dartbaan openen')
   expect(active.locator('#online-join-open')).to_be_hidden();expect(active.locator('#online-new-open')).to_be_visible();active.locator('#online-host-open').click()
   expect(active.locator('#online-host-section')).to_be_hidden();expect(active.locator('#online-join-section')).to_be_hidden()
   expect(active.locator('#online-code')).to_have_text('ABC234');expect(active.locator('#online-share')).to_be_visible()
   assert 'http' not in active.locator('#online-active').inner_text().lower()
   active.locator('#online-close').click();active.locator('summary',has_text='Online darten').click();active.locator('#online-new-open').click()
   expect(active.locator('#online-new')).to_be_visible();expect(active.locator('#online-title')).to_have_text('Nieuwe dartbaan aanmaken')
   active.close()
   native=b.new_page(viewport={'width':393,'height':852})
   native.add_init_script("window.DartsAndroid={chooseMode:()=>window.modeChosen=true,checkForUpdate:()=>window.updateChosen=true}")
   native.goto('http://127.0.0.1:8788/?remote=1')
   native.locator('summary',has_text='Applicatie').click()
   assert native.locator('#android-update-action').evaluate("e=>getComputedStyle(e).color")=='rgb(255, 119, 119)'
   native.locator('#android-update-action').click()
   assert native.evaluate('window.updateChosen===true')
   expect(native.locator('#header-menu details[open]')).to_have_count(0)
   native.locator('summary',has_text='Verbindingen').click()
   native.locator('#android-app-action').click()
   assert native.evaluate('window.modeChosen===true')
   b.close();print('PASS: groups, action dialogs, auto-close, Escape and 4 viewport widths')
 finally:server.terminate();server.wait()
