from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch()
   for query in ['', '?android=1', '?remote=1']:
    page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.request.post('http://127.0.0.1:8788/api/display',data={'screensaverActive':True})
    page.goto('http://127.0.0.1:8788/'+query)
    page.locator('summary',has_text='Spelen').click()
    expect(page.get_by_role('button',name='Screensaver',exact=True)).to_have_count(0)
    expect(page.locator('#club-saver')).to_have_count(0)
    page.locator('summary',has_text='Instellingen').click();page.locator('#venue-open').click()
    expect(page.locator('[name="screensaverEnabled"]')).to_have_count(0)
    page.locator('#venue-form button[type="submit"]').click()
    expect(page.locator('#venue-message')).to_have_text('Locatieprofiel opgeslagen.')
    page.locator('#venue-close').click()
    page.evaluate("async()=>{const {newMatch}=await import('/engine.js');const {showWinner}=await import('/winner.js');let s=newMatch(['Ed','Frank'],501,'double',1);s.phase='match';s.winner=0;showWinner(s)}")
    expect(page.locator('#winner-club-saver')).to_have_count(0)
    assert not errors,errors
    page.close()
   b.close();print('PASS: no screensaver on desktop, Android or remote; saved active flag ignored; venue save works')
 finally:server.terminate();server.wait()
