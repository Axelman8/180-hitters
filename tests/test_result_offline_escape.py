from pathlib import Path
import subprocess,sys,time,tempfile
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]

def start_server(data_file):
 return subprocess.Popen(
  [sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8795','--data-file',str(data_file)],
  stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
 )

with tempfile.TemporaryDirectory() as tmp:
 data_file=Path(tmp)/'match.json'
 server=start_server(data_file)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   browser=p.chromium.launch()
   page=browser.new_page(viewport={'width':393,'height':852})
   page.goto('http://127.0.0.1:8795/?remote=1')
   state=page.evaluate("async()=>{const {newMatch,applyTurn}=await import('/engine.js');let s=newMatch(['A','B'],1,'single',2,{game:'x01'});return applyTurn(s,{score:1,darts:1})}")
   current=page.request.get('http://127.0.0.1:8795/api/state').json()
   assert page.request.post('http://127.0.0.1:8795/api/state',data={'revision':current['revision'],'match':{'state':state,'undo':[]}}).ok
   page.reload()
   expect(page.locator('#result-dialog')).to_be_visible()
   expect(page.locator('#result-later')).to_be_hidden()
   server.terminate();server.wait();server=None
   expect(page.locator('#connection-status')).to_contain_text('Geen verbinding',timeout=7000)
   expect(page.locator('#result-later')).to_be_visible()
   page.locator('#result-later').click()
   expect(page.locator('#result-dialog')).to_be_hidden()
   expect(page.locator('#message')).to_contain_text('opent opnieuw')
   server=start_server(data_file);time.sleep(1)
   expect(page.locator('#connection-status')).to_contain_text('Verbonden met NUC',timeout=7000)
   expect(page.locator('#result-dialog')).to_be_visible()
   expect(page.locator('#result-later')).to_be_hidden()
   expect(page.locator('#continue')).to_contain_text('Volgende leg')
   browser.close()
   print('PASS: leg result can close offline and reopens safely after NUC reconnect')
 finally:
  if server is not None:
   server.terminate();server.wait()
