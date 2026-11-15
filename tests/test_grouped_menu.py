"""Navigation keeps each task in one place and opens actions without modal stacks."""
from pathlib import Path
import json, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser=p.chromium.launch()
            for width,height in [(320,740),(393,852),(600,960),(852,393),(1080,1920)]:
                page=browser.new_page(viewport={'width':width,'height':height})
                errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                page.add_init_script("""window.DartsAndroid={isLocalMode:()=>true,getConnectionInfo:()=>JSON.stringify({mode:'local',versionName:'test'}),chooseMode:()=>window.modeChosen=true,checkForUpdate:()=>window.updateChosen=true};localStorage.setItem('180hitters.club.v1',JSON.stringify({accessToken:'test-access',member:{name:'Axel',status:'approved'}}));""")
                page.route('**/club/status',lambda route:route.fulfill(json={'member':{'name':'Axel','status':'approved'},'accessToken':'test-access'},headers={'Access-Control-Allow-Origin':'*'}))
                page.route('**/club/invitations',lambda route:route.fulfill(json={'invitations':[]},headers={'Access-Control-Allow-Origin':'*'}))
                page.route('**/lobby',lambda route:route.fulfill(json={'rooms':[]},headers={'Access-Control-Allow-Origin':'*'}))
                page.goto('http://127.0.0.1:8788/?android=1')
                expect(page.locator('#header-menu')).not_to_be_visible()
                page.locator('#toggle-toolbar').click()
                expect(page.locator('#navigation-categories button strong')).to_have_text(['Spelen','Online darten','Spelers & teams','NUC & verbinding','App-instellingen'])
                assert page.locator('#header-menu details').count()==0
                assert page.locator('.navigation-action').evaluate_all('(cards)=>cards.every(card=>card.querySelector("button,a,#camera-game-controls"))')
                # Every screen stays inside the menu; scrolling never affects its close controls.
                for key in ['play','online','players','nuc','app']:
                    page.locator(f'#navigation-categories [data-menu="{key}"]').click()
                    expect(page.locator(f'.navigation-panel[data-menu="{key}"]')).to_be_visible()
                    expect(page.locator('#navigation-categories')).to_be_hidden()
                    assert page.locator('#header-menu').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
                    assert page.locator('#header-menu').bounding_box()['x']>=0
                    assert page.locator('#navigation-close').bounding_box()['y']>=0
                    page.locator('#navigation-back').click()
                # NUC pairing and app updating have distinct destinations.
                page.locator('#navigation-categories [data-menu="app"]').click()
                expect(page.locator('#android-app-action')).to_be_hidden()
                expect(page.locator('#android-update-action')).to_be_visible()
                page.locator('#android-update-action').click()
                assert page.evaluate('window.updateChosen===true')
                expect(page.locator('#header-menu')).not_to_be_visible()
                page.locator('#toggle-toolbar').click();page.locator('#navigation-categories [data-menu="nuc"]').click()
                page.locator('#android-app-action').click()
                assert page.evaluate('window.modeChosen===true')
                expect(page.locator('#header-menu')).not_to_be_visible()
                # An action dialog replaces navigation rather than opening over it.
                page.locator('#toggle-toolbar').click();page.locator('#navigation-categories [data-menu="players"]').click()
                page.locator('#players-list').click()
                expect(page.locator('#players-dialog')).to_be_visible()
                assert page.locator('dialog[open]').count()==1
                page.locator('#players-close').click()
                page.locator('#toggle-toolbar').click();page.locator('#navigation-categories [data-menu="online"]').click()
                page.locator('#online-join-open').click()
                expect(page.locator('#online-dialog')).to_be_visible()
                assert page.locator('dialog[open]').count()==1
                page.locator('#online-close').click()
                # Offline users can still navigate and close the menu.
                page.route('**/api/state',lambda route:route.abort())
                page.wait_for_timeout(1500)
                page.locator('#toggle-toolbar').click();page.locator('#navigation-categories [data-menu="app"]').click()
                page.locator('#navigation-back').click();page.keyboard.press('Escape')
                expect(page.locator('#header-menu')).not_to_be_visible()
                assert not errors,errors
                if width==393:
                    page.locator('#toggle-toolbar').click();page.screenshot(path=str(root/'.tools/navigation-overview.png'))
                    page.locator('#navigation-categories [data-menu="nuc"]').click();page.screenshot(path=str(root/'.tools/navigation-nuc.png'))
                page.close()
            browser.close()
            print('PASS: task navigation, action dialogs, offline close, and 5 viewport sizes')
    finally:
        server.terminate();server.wait()
