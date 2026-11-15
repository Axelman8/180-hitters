"""Saved games survive replacement/restart, including manual pending darts."""
from pathlib import Path
import copy, importlib.util, json, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('library_server',root/'server.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as temp:
    base=Path(temp);path=base/'match.json'
    def start():
        process=subprocess.Popen([sys.executable,str(root/'server.py'),'--host','127.0.0.1','--port','8840','--data-file',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        time.sleep(.8);return process
    server=start();url='http://127.0.0.1:8840'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch();page=browser.new_page(viewport={'width':393,'height':852});page.goto(url)
            expect(page.locator('#header-menu')).to_be_visible()
            a=page.evaluate("""async()=>{const e=await import('/engine.js');return {state:e.applyTurn(e.newMatch(['Anna','Bert'],501,'double',3),{score:60}),undo:[]}}""")
            b=copy.deepcopy(a);b['state'].update(startedAt=a['state']['startedAt']+1,phase='won',winner=0);b['state']['players'][0]['name']='Chris'
            def get(route='/api/state'):return page.request.get(url+route).json()
            def post(route,body):return page.request.post(url+route,data=body)
            assert post('/api/state',{'revision':get()['revision'],'match':a}).ok
            assert post('/api/draft',{'revision':get()['revision'],'owner':'test-draft','seq':1,'hits':[],'entry':'12'}).ok
            aid=get('/api/matches')['matches'][0]['id']
            time.sleep(.03)
            assert post('/api/state',{'revision':get()['revision'],'match':b}).ok
            items=get('/api/matches')['matches'];assert len(items)==2 and items[0]['players'][0]=='Chris' and items[1]['players'][0]=='Anna'
            bid=items[0]['id'];assert post('/api/matches/resume',{'id':aid,'revision':-1}).status==409
            assert post('/api/matches/resume',{'id':bid,'revision':get()['revision']}).status==400
            assert page.request.get(url+'/api/matches/'+'a'*32).status==404
            assert page.request.get(url+'/api/matches/invalid').status==400
            # The launch menu survives receipt of the current game from the server.
            page.wait_for_timeout(900);expect(page.locator('#header-menu')).to_be_visible()
            page.locator('#navigation-categories [data-menu="play"]').click();page.locator('#matches-open').click()
            expect(page.locator('.saved-game h3')).to_have_text(['X01','X01'])
            expect(page.locator('.saved-game>strong').first).to_contain_text('Chris')
            page.locator('.saved-game').first.get_by_role('button',name='Rapport bekijken').click()
            expect(page.locator('#matches-report-dialog #game-report')).to_be_visible()
            page.locator('#matches-report-close').click()
            page.locator('.saved-game').filter(has_text='Anna / Bert').get_by_role('button',name='Verder spelen').click()
            expect(page.locator('#matches-dialog')).not_to_be_visible()
            expect(page.locator('#game')).to_be_visible();expect(page.locator('#entry')).to_have_text('12')
            assert get()['match']==a
            server.terminate();server.wait();server=start()
            assert get()['match']==a and get()['draft']['entry']=='12'
            # Legacy recovery copies are imported into the independent archive.
            legacy=copy.deepcopy(a);legacy['state']['startedAt']-=10000;legacy['state']['players'][0]['name']='Legacy'
            backups=base/'match-backups';backups.mkdir(exist_ok=True)
            (backups/('1'*32+'.json')).write_text(json.dumps({'time':time.time()-1000,'match':legacy,'draft':None}),encoding='utf-8')
            server.terminate();server.wait();server=start()
            assert len(get('/api/matches')['matches'])==3
            # Archive entries are not subject to the 30-recovery-copy retention limit.
            library=module.MatchLibrary(base/'extra-library')
            for index in range(35):
                saved=copy.deepcopy(a);saved['state']['startedAt']+=index;library.record(saved)
            assert len(library.items())==35
            # Reopening always starts at the menu, without losing the resumed match.
            page.reload();expect(page.locator('#header-menu')).to_be_visible()
            assert get()['match']==a
            browser.close();print('PASS: launch menu, newest-first archive, report, resume, partial input, restart and legacy migration')
    finally:server.terminate();server.wait()
