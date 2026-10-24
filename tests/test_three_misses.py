import subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 server=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8789','--data-file',str(Path(tmp)/'match.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(1)
  with sync_playwright() as p:
   b=p.chromium.launch();phone=b.new_page(viewport={'width':390,'height':844});screen=b.new_page()
   errors=[];phone.on('pageerror',lambda e:errors.append(str(e)))
   url='http://127.0.0.1:8789';phone.goto(url+'/?remote=1');screen.goto(url)
   state=phone.evaluate('''async()=>{
    const {newMatch,applyTurn}=await import('/engine.js');
    const fresh=()=>newMatch(['A','B'],501,'double',3,{game:'tenlives',livesMode:'double'});
    let s=fresh(),t=applyTurn(s,{trainingMisses:3});
    if(t.active!==1||t.players[0].lives!==9||t.players[1].darts!==0||t.history.length!==1||t.history[0].darts!==3||s.players[0].lives!==10)throw Error('batch/immutability');
    s=applyTurn(s,{trainingHit:true});t=applyTurn(s,{trainingMisses:3});
    if(t.active!==0||t.players[0].attempts!==2)throw Error('carry');
    try{applyTurn(t,{trainingMisses:3});throw Error('accepted overflow');}catch(e){if(e.message==='accepted overflow')throw e;}
    t=applyTurn(t,{trainingMisses:2});if(t.active!==1||t.players[0].livesTarget!==20||t.players[0].lives!==10)throw Error('target fallback');
    return fresh();
   }''')
   revision=phone.request.get(url+'/api/state').json()['revision']
   assert phone.request.post(url+'/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
   expect(phone.locator('#lives-miss-three')).to_have_text('3 keer mis')
   phone.locator('#lives-miss-three').click()
   expect(screen.locator('.lives-name')).to_have_text('B')
   phone.locator('#lives-undo').click();expect(screen.locator('.lives-name')).to_have_text('A')
   phone.locator('#lives-hit').click();expect(phone.locator('.lives-attempts')).to_have_text('5 pogingen over')
   phone.locator('#lives-miss-three').click();expect(phone.locator('#lives-miss-three')).to_have_text('2 keer mis')
   phone.locator('#lives-miss-three').click();expect(screen.locator('.lives-name')).to_have_text('B')
   assert not errors,errors
   assert phone.evaluate('document.documentElement.scrollWidth')<=390
   b.close();print('PASS batch, no spillover, carry, mobile/screen synchronization, undo, responsive width')
 finally:server.terminate();server.wait()
