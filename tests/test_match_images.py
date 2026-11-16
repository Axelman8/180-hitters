"""Saved final boards are visible and included in the actual PNG share for all games."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import base64, io, json, mimetypes, subprocess, sys, tempfile, time
from PIL import Image
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
ASSETS=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
PORT='8875' if ASSETS else '8874';URL='http://127.0.0.1:'+PORT
OUT=ROOT/'.repair-check/smooth56/images';OUT.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
 server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--host','127.0.0.1','--port',PORT,'--data-file',str(Path(temp)/'state.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  time.sleep(.7)
  with sync_playwright() as p:
   browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.sharedBoards=null;window.DartsAndroid={images:[],chunks:[],beginPngShareCollection(){this.images=[];return true},beginPngSharePart(name){this.name=name;this.chunks=[];return true},appendPngShare(chunk){this.chunks.push(chunk);return chunk.length<=196608},finishPngSharePart(){this.images.push({name:this.name,data:this.chunks.join('')});return true},finishPngShareCollection(){window.sharedBoards=this.images;return true}}""")
   if ASSETS:
    def assets(route):
     path=unquote(urlsplit(route.request.url).path);file=(ASSETS/(path.lstrip('/') or 'index.html')).resolve()
     if not path.startswith('/api/') and file.is_relative_to(ASSETS) and file.is_file():route.fulfill(path=file,content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
     else:route.fallback()
    page.route(URL+'/**',assets)
   page.goto(URL+'/?remote=1');expect(page.locator('#header-menu')).to_be_visible();page.locator('#navigation-close').click()
   if ASSETS:page.evaluate("Object.assign(window.DartsAndroid,{images:[],chunks:[],beginPngShareCollection(){this.images=[];return true},beginPngSharePart(name){this.name=name;this.chunks=[];return true},appendPngShare(chunk){this.chunks.push(chunk);return chunk.length<=196608},finishPngSharePart(){this.images.push({name:this.name,data:this.chunks.join('')});return true},finishPngShareCollection(){window.sharedBoards=this.images;return true}});CanvasRenderingContext2D.prototype.roundRect=undefined")
   for game in ['x01','121','gotcha','cricket','tactics','fourinarow','killer','seabattle','scram','bull41','golf','shanghai','twentyone','bobs27','tenlives']:
    state=page.evaluate("""async game=>{
     const s=(await import('/engine.js')).newMatch(['Axel','Leen','Remon','Frank'],301,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double'});
     s.phase='won';s.winner=1;s.startedAt=Date.now()-60000;s.completedAt=Date.now();
     if(game==='fourinarow'){s.fourOwners=[1,1,1,1,...Array(21).fill(null)];s.fourWinningCells=[0,1,2,3];s.players[1].fourSymbol=String.fromCharCode(65533);}
     if(game==='killer'){s.killerStage='playing';s.players.forEach((p,i)=>Object.assign(p,{killerNumber:5+i,killerEliminated:i!==1,killerLives:i===1?2:0,killerLetters:3,killerActivated:true}));}
     if(['cricket','tactics'].includes(game))s.players.forEach((p,i)=>{p.cricketPoints=i*20;for(const n of s.numbers)p.marks[n]=i;});
     if(game==='golf')s.players.forEach((p,i)=>{p.golfScores=Array(9).fill(i+1);p.golfStrokes=(i+1)*9;});
     if(game==='shanghai')s.players.forEach((p,i)=>{p.shanghaiScores=Array(7).fill(i+1);p.shanghaiPoints=(i+1)*7;});
     s.history=[{name:'Axel',player:0,leg:1,score:20,darts:3,remaining:281,target:20,labels:'20 / Mis / Mis',input:{hits:[{number:20,mult:1},{number:0,mult:1},{number:0,mult:1}]}}];return s;
    }""",game)
    if page.locator('#result-dialog').is_visible():page.locator('#result-dialog').evaluate('e=>e.close()')
    revision=page.request.get(URL+'/api/state').json()['revision']
    assert page.request.post(URL+'/api/state',data={'revision':revision,'match':{'state':state,'undo':[]}}).ok
    page.wait_for_function('id=>JSON.parse(localStorage.getItem("oche.match.v1")||"null")?.state?.startedAt===id',arg=state['startedAt'])
    picture=page.locator('#result-dialog .match-final-image>svg');expect(picture).to_be_visible()
    assert all(name in picture.text_content() for name in ['Axel','Leen','Remon','Frank'])
    assert 'Gewonnen door Leen' in picture.text_content()
    assert chr(65533) not in picture.text_content(),'Broken saved symbol leaked into snapshot'
    for width,height in [(393,852),(1024,600),(1920,1080)]:
     page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(40)
     assert page.locator('#result-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth'),(game,width)
    page.evaluate('window.sharedBoards=null');page.locator('#result-dialog .game-report-share,#result-dialog .lives-summary-share').click()
    page.wait_for_function('window.sharedBoards?.length>=3');shared=page.evaluate('window.sharedBoards');assert shared[0]['name'].endswith('-eindstand.png')
    raw=base64.b64decode(shared[0]['data']);image=Image.open(io.BytesIO(raw));assert image.width==1080 and 400<image.height<2200
    assert len(image.getcolors(image.width*image.height))>50,'Empty snapshot'
    (OUT/(game+('-legacy' if ASSETS else '')+'.png')).write_bytes(raw)
    assert page.request.get(URL+'/api/state').json()['match']['state']==state,'Sharing changed the saved match'
    assert not errors,(game,errors)
    print('PASS final board preview + shared PNG + unchanged saved match:',game,'legacy' if ASSETS else 'modern',flush=True)
   browser.close()
 finally:server.terminate();server.wait()
