from pathlib import Path
import json, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
url='http://127.0.0.1:8788'
with tempfile.TemporaryDirectory() as tmp:
 path=Path(tmp)/'match.json'
 def start():
  process=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8788','--data-file',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  time.sleep(.8);return process
 server=start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch();screen=browser.new_page();screen.goto(url)
   original=screen.evaluate("async()=>{const e=await import('/engine.js');return {state:e.applyTurn(e.newMatch(['Club A','Club B'],501,'double',3),{score:60}),undo:[]}}")
   incoming=screen.evaluate("async()=>{const e=await import('/engine.js');const s=e.newMatch(['Mobiel A','Mobiel B'],301,'double',3);return {state:e.applyTurn(s,{score:45}),undo:[s],future:[],preferredMode:'total',inputPreferenceVersion:1}}")
   def get():return screen.request.get(url+'/api/state').json()
   def post(route,body):return screen.request.post(url+route,data=body)
   assert post('/api/state',{'revision':get()['revision'],'match':original}).ok
   original=get()['match']
   transfer={'match':incoming,'draft':{'hits':[],'entry':'12'},'requestId':'test-transfer-000001'}
   # Disk backup failure must leave the current match intact.
   backupdir=Path(tmp)/'match-backups';backupdir.write_text('blocked',encoding='utf-8')
   assert post('/api/match-transfer',{**transfer,'revision':get()['revision']}).status==500
   assert get()['match']==original
   backupdir.unlink()
   # Invalid source and stale revision must not create a backup or replace anything.
   assert post('/api/match-transfer',{**transfer,'match':{},'revision':get()['revision']}).status==400
   assert post('/api/match-transfer',{**transfer,'revision':-1}).status==409
   assert not backupdir.exists()
   phone=browser.new_page(viewport={'width':393,'height':850})
   phone.add_init_script("window.DartsAndroid={isLocalMode:()=>false,getPendingNucTransfer:()=>window.pending,clearPendingNucTransfer:()=>{window.pending=''},saveSnapshot:()=>{}};window.pending="+json.dumps(json.dumps(transfer)))
   phone.goto(url+'/?remote=1')
   expect(phone.locator('#transfer-dialog')).to_be_visible()
   expect(phone.locator('#transfer-description')).to_contain_text('Club A')
   phone.locator('#transfer-confirm').click()
   expect(phone.locator('#transfer-dialog')).not_to_be_visible()
   expect(phone.locator('#entry')).to_have_text('12')
   assert get()['match']==incoming
   files=list(backupdir.glob('*.json'));assert len(files)==1
   assert json.loads(files[0].read_text(encoding='utf-8'))['match']==original
   rev=get()['revision']
   # Lost success response followed by retry, even after restart, is harmless.
   assert post('/api/match-transfer',{**transfer,'revision':0}).json()['repeated']
   assert get()['revision']==rev
   server.terminate();server.wait();server=start()
   assert post('/api/match-transfer',{**transfer,'revision':0}).json()['repeated']
   assert get()['revision']==rev
   # Restoration from the menu backs up the imported party before restoring.
   screen.reload();screen.get_by_text('Spelen',exact=True).click();screen.locator('#match-backups').click()
   expect(screen.locator('#transfer-items button')).to_have_count(1)
   screen.locator('#transfer-items button').click();screen.locator('#transfer-confirm').click()
   expect(screen.locator('#transfer-dialog')).not_to_be_visible()
   assert get()['match']==original
   assert len(list(backupdir.glob('*.json')))==2
   assert any(json.loads(f.read_text(encoding='utf-8'))['match']==incoming for f in backupdir.glob('*.json'))
   assert post('/api/match-restore',{'revision':get()['revision'],'requestId':'bad-restore-000001','backup':'../match'}).status==400
   print('PASS transfer UI, full match/history, draft, durable backups, disk failure, conflict, restart retry, restore and path validation')
   browser.close()
 finally:server.terminate();server.wait()
