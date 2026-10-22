from pathlib import Path
import subprocess,sys,time,tempfile
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
    expect(page.locator('#header-menu details[open]')).to_have_count(0)
    page.locator('summary',has_text='Spelen').click();expect(page.locator('#settings')).to_be_visible()
    page.locator('summary',has_text='Instellingen').click();expect(page.locator('#settings')).to_be_hidden()
    if query:
     page.locator('#layout-open').click();expect(page.locator('#layout-dialog')).to_be_visible()
     expect(page.locator('#header-menu details[open]')).to_have_count(0)
     page.locator('#layout-close').click()
    else: page.keyboard.press('Escape')
    page.locator('summary',has_text='Spelen').click();page.keyboard.press('Escape')
    expect(page.locator('#header-menu details[open]')).to_have_count(0)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.close()
   native=b.new_page(viewport={'width':393,'height':852})
   native.add_init_script("window.DartsAndroid={chooseMode:()=>window.modeChosen=true,checkForUpdate:()=>window.updateChosen=true}")
   native.goto('http://127.0.0.1:8788/?remote=1')
   native.locator('summary',has_text='Instellingen').click()
   native.locator('#android-update-action').click()
   assert native.evaluate('window.updateChosen===true')
   expect(native.locator('#header-menu details[open]')).to_have_count(0)
   native.locator('summary',has_text='Instellingen').click()
   native.locator('#android-app-action').click()
   assert native.evaluate('window.modeChosen===true')
   b.close();print('PASS: groups, action dialogs, auto-close, Escape and 4 viewport widths')
 finally:server.terminate();server.wait()
