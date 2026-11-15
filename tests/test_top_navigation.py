"""Return controls stay at the top on NUC, phone, Fold and tablet layouts."""
from pathlib import Path
import subprocess,sys,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8852','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(50):
   try:urllib.request.urlopen('http://127.0.0.1:8852/api/state',timeout=1).close();break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   for width,height in [(320,740),(393,852),(744,1133),(1024,768),(1920,1080),(852,393)]:
    page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:8852/')
    page.wait_for_timeout(650);page.evaluate("document.dispatchEvent(new Event('open-main-menu'))")
    expect(page.locator('#navigation-close')).to_be_visible()
    for group in ['play','online','players','nuc','app']:
     page.locator('.navigation-category[data-menu="'+group+'"]').click();back=page.locator('#navigation-back');expect(back).to_be_visible()
     assert back.bounding_box()['y']<page.locator('#navigation-scroll').bounding_box()['y']
     page.locator('#navigation-scroll').evaluate('e=>e.scrollTop=e.scrollHeight');back.click()
    page.evaluate("document.dispatchEvent(new Event('close-navigation'))")
    ids=page.locator('dialog:not(#header-menu)').evaluate_all('ds=>ds.map(d=>d.id)')
    for id in ids:
     page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
     dialog=page.locator('#'+id);dialog.evaluate("d=>{d.showModal();const content=document.createElement('div');content.className='test-long-menu';content.style.height='1200px';d.append(content)}")
     back=dialog.locator(':scope>.dialog-navigation .dialog-back');expect(back).to_be_visible()
     assert dialog.evaluate("d=>d.firstElementChild.classList.contains('dialog-navigation')"),id
     dialog.evaluate('d=>d.scrollTop=d.scrollHeight');page.wait_for_timeout(20)
     box=back.bounding_box();bounds=dialog.bounding_box();assert bounds['y']-2<=box['y']<=bounds['y']+50,(width,id,box,bounds)
     back.click();expect(dialog).not_to_be_visible();dialog.locator('.test-long-menu').evaluate('e=>e.remove()')
    # Dedicated legacy-tablet menus are custom overlays, rather than dialogs.
    page.evaluate("""()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());const root=document.createElement('div');root.id='tablet-mode-overlay';root.style.cssText='position:fixed;inset:0;overflow:auto;z-index:999999;background:#13262f';root.innerHTML='<section><h2>Verbindingsmodus</h2><div style="height:1400px"></div><button id="tablet-mode-close">Sluiten</button></section>';root.querySelector('button').onclick=()=>{window.tabletBackWorked=true;root.remove();};document.body.append(root);}""")
    back=page.locator('#tablet-mode-overlay .dialog-back');expect(back).to_be_visible();page.locator('#tablet-mode-overlay').evaluate('e=>e.scrollTop=e.scrollHeight');back.click();assert page.evaluate('window.tabletBackWorked')
    assert not errors,errors;page.close();print('PASS top return controls:',width,height,len(ids),'dialogs and tablet overlay',flush=True)
   browser.close()
 finally:server.terminate();server.wait()
