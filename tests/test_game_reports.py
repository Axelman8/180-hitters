"""Check the rich mobile reports for every non-Hitters game."""
from pathlib import Path
import subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
assert '.game-report-share' in (root/'dist'/'app.js').read_text(encoding='utf-8').split("if((!ready||busy)",1)[1].split(')){',1)[0]
assert '.game-report-share' in (root/'dist'/'controller.js').read_text(encoding='utf-8').split("event.target.closest(",1)[1].split('))return',1)[0]

with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen([sys.executable, str(root/'server.py'), '--host', '127.0.0.1', '--port', '8796', '--data-file', str(Path(tmp)/'match.json')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width':393, 'height':852})
            page.add_init_script("""window.sharedReports=null;window.DartsAndroid={images:[],parts:[],beginPngShareCollection(){this.images=[];return true},beginPngSharePart(name){this.parts=[];this.name=name;return true},appendPngShare(chunk){this.parts.push(chunk);return true},finishPngSharePart(){this.images.push({name:this.name,data:this.parts.join('')});return true},finishPngShareCollection(){window.sharedReports=this.images;return true}}""")
            page.goto('http://127.0.0.1:8796/')
            reports = page.evaluate("""async()=>{
              const {buildGameReport,createGameReportImages}=await import('/game-reports.js');
              const base=(game,players,history,extra={})=>({game,players:players.map(name=>({name,remaining:0})),history,starter:0,leg:1,startedAt:Date.now()-60000,numbers:[20,19,18,17,16,15,25],...extra});
              const x=base('x01',['A','B'],[
                {name:'A',leg:1,score:100,darts:3,remaining:401},{name:'B',leg:1,score:60,darts:3,remaining:441},
                {name:'A',leg:1,score:140,darts:3,remaining:261},{name:'B',leg:1,score:0,darts:3,remaining:441,bust:true},
                {name:'A',leg:1,score:180,darts:3,remaining:81},{name:'B',leg:1,score:41,darts:3,remaining:400},
                {name:'A',leg:1,score:81,darts:2,remaining:0}],{players:[{name:'A',remaining:0},{name:'B',remaining:400}]});
              const cricket=base('cricket',['A'],[{name:'A',leg:1,score:20,marks:5,darts:3,remaining:0,labels:'T20 · D20',input:{hits:[{number:20,mult:3},{number:20,mult:2},{number:0,mult:1}]}}]);
              const tactics={...cricket,game:'tactics',numbers:[20,19,18,17,16,15,14,13,12,11,10,25]};
              const bobs=base('bobs27',['A'],[{name:'A',leg:1,target:1,hits:2,darts:3,remaining:31,labels:'D1 / D1 / Mis'},{name:'A',leg:1,target:2,hits:1,darts:3,remaining:35,labels:'D2 / Mis / Mis'}],{players:[{name:'A',remaining:35}]});
              const training=base('x01',['A'],[{name:'A',leg:1,score:60,darts:3,remaining:61},{name:'A',leg:1,score:61,darts:2,remaining:0},{name:'A',leg:2,score:60,darts:3,remaining:66},{name:'A',leg:2,score:60,darts:3,remaining:6},{name:'A',leg:2,score:0,darts:3,remaining:6}],{training121:true,leg:2,players:[{name:'A',remaining:6}]});
              const gotcha=base('gotcha',['A','B'],[{name:'A',leg:1,score:100,darts:3,remaining:100,resets:[1]},{name:'B',leg:1,score:60,darts:3,remaining:60,resets:[]},{name:'A',leg:1,score:201,darts:3,remaining:301,resets:[]}],{start:301,players:[{name:'A',remaining:301},{name:'B',remaining:60}]});
              const four=base('fourinarow',['A','B'],[{name:'A',player:0,leg:1,score:60,darts:1,labels:'T20',captured:[0]}],{players:[{name:'A',remaining:0,fourSymbol:'○'},{name:'B',remaining:0,fourSymbol:'×'}],fourOwners:[0,...Array(24).fill(null)]});
              const scram=base('scram',['A','B'],[{name:'B',player:1,leg:1,score:100,darts:3,role:'scorer',labels:'T20 / D20 / Mis'}],{players:[{name:'A',remaining:0,scramScore:0},{name:'B',remaining:0,scramScore:100}]});
              const killer=base('killer',['A','B'],[{name:'A',player:0,leg:1,score:0,darts:3,role:'killer',labels:'5 / D5 / T5'}],{winner:0,players:[{name:'A',remaining:0,killerNumber:5,killerLetters:6,killerEliminated:false},{name:'B',remaining:0,killerNumber:6,killerLetters:0,killerEliminated:true}]});
              const bull=base('bull41',['A','B'],[{name:'A',player:0,leg:1,score:59,darts:3,role:'score',labels:'T20 / D20 / Mis'}],{players:[{name:'A',remaining:0,bull41Score:59},{name:'B',remaining:0,bull41Score:0}]});
              const twentyone=base('twentyone',['A'],[{name:'A',player:0,leg:1,score:0,darts:2,role:'21',labels:'T20 / Bull'}],{players:[{name:'A',remaining:0,twentyOneAdjusted:2,twentyOneTriples:1}]});
              return [x,cricket,tactics,bobs,training,gotcha,four,scram,killer,bull,twentyone].map(state=>{const report=buildGameReport(state),images=createGameReportImages(state);return {title:report.title,players:report.players.length,bars:report.bars.length,headers:report.headers,rows:report.rows.length,images:images.images.length,width:images.images[0].canvas.width};});
            }""")
            assert [item['title'] for item in reports] == ['X01-partijoverzicht','Cricket-partijoverzicht','Tactics-partijoverzicht',"Bob's 27-overzicht",'121-trainingsoverzicht','Gotcha-partijoverzicht','4-op-een-rij-overzicht','Scram-overzicht','Killer-overzicht','Bull / 41-overzicht','21-overzicht']
            assert all(item['players'] >= 1 and item['bars'] >= 1 and item['rows'] >= 1 for item in reports)
            assert all(item['images'] >= 2 and item['width'] == 1080 for item in reports)
            page.evaluate("""async()=>{const {renderGameReport}=await import('/game-reports.js');const dialog=document.querySelector('#result-dialog'),state={game:'bobs27',players:[{name:'Axel',remaining:31}],history:[{name:'Axel',leg:1,target:1,hits:2,darts:3,remaining:31,labels:'D1 / D1 / Mis'}],starter:0,leg:1,startedAt:Date.now()-10000};renderGameReport(state,dialog);dialog.showModal();}""")
            expect(page.locator('#game-report')).to_be_visible()
            expect(page.locator('.game-report-share')).to_have_text('Delen als afbeeldingen')
            page.locator('.game-report-share').click()
            page.wait_for_function('window.sharedReports && window.sharedReports.length === 2')
            shared = page.evaluate('window.sharedReports')
            assert shared[0]['name'].endswith('-overzicht.png') and shared[1]['name'].endswith('-details-01.png')
            assert all(image['data'].startswith('iVBOR') for image in shared)
            assert page.locator('#result-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
            browser.close()
            print('PASS: shareable reports for every game, image pages and mobile fit')
    finally:
        server.terminate()
        server.wait()
