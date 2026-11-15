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
            expect(page.locator('#matches-dialog .dialog-navigation #matches-close')).to_be_visible()
            expect(page.locator('.saved-game-title')).to_have_text(['X01','X01'])
            expect(page.locator('.saved-game-players').first).to_contain_text('Chris')
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
            # Finger-sized table selection, filtering, cancel and multiple deletion.
            page.locator('#navigation-categories [data-menu="play"]').click();page.locator('#matches-open').click()
            expect(page.locator('.matches-table th').nth(1)).to_have_text('Spel')
            expect(page.locator('.matches-table th').nth(2)).to_have_text('Spelers')
            expect(page.locator('.matches-table th').nth(3)).to_have_text('Datum gespeeld')
            expect(page.locator('.matches-table th').nth(4)).to_have_text('Status')
            for width,height in [(320,740),(393,852),(744,900),(1024,768),(1920,1080)]:
                page.set_viewport_size({'width':width,'height':height})
                assert page.locator('#matches-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),width
                for box in page.locator('.matches-checkbox').all():
                    bounds=box.bounding_box();assert bounds['width']>=48 and bounds['height']>=48,bounds
            page.set_viewport_size({'width':393,'height':852})
            page.locator('#matches-search').fill('Chris');page.locator('#matches-select-all').check()
            expect(page.locator('#matches-selection')).to_have_text('1 partij geselecteerd')
            page.locator('#matches-delete').click();expect(page.locator('#matches-confirm-summary')).to_contain_text('op de NUC')
            page.locator('#matches-close').click();expect(page.locator('#matches-confirm')).not_to_be_visible()
            assert len(get('/api/matches')['matches'])==3
            page.locator('#matches-search').fill('Legacy');page.locator('#matches-select-all').check()
            expect(page.locator('#matches-selection')).to_have_text('2 partijen geselecteerd')
            page.locator('#matches-delete').click();page.locator('#matches-delete-confirm').click()
            expect(page.locator('#matches-status')).to_have_text('2 partijen verwijderd op de NUC.')
            assert [v['id'] for v in get('/api/matches')['matches']]==[aid]
            assert get()['match']==a
            # Validation is all-or-nothing; stale current revisions and online games are protected.
            assert post('/api/matches/delete',{'ids':[aid,'../match'],'revision':get()['revision']}).status==400
            assert post('/api/matches/delete',{'ids':[aid],'revision':-1}).status==409
            old_control=post('/api/controller',{'id':'old-match-controller'}).json()['control']
            post('/api/controller',{'id':'new-match-controller','takeover':True})
            locked=page.request.post(url+'/api/matches/delete',data={'ids':[aid],'revision':get()['revision'],'_controller':{'id':old_control['owner'],'epoch':old_control['epoch']}},headers={'X-Darts-Transport':'bluetooth'})
            assert locked.status==423 and get()['match']==a
            assert post('/api/online/local',{'active':True,'role':0,'code':'ABC234','base':'https://test.trycloudflare.com','key':'t'*24}).ok
            assert post('/api/matches/delete',{'ids':[aid],'revision':get()['revision']}).status==409
            assert post('/api/online/local',{'active':False}).ok
            # Confirming deletion of the current game resets the visible and persisted state.
            page.locator('#matches-search').fill('Anna');page.locator('#matches-select-all').check()
            page.locator('#matches-delete').click();expect(page.locator('#matches-confirm-current')).to_contain_text('ook beëindigd')
            # A newer score arriving during confirmation requires fresh confirmation.
            assert post('/api/state',{'revision':get()['revision'],'match':a}).ok
            page.locator('#matches-delete-confirm').click();expect(page.locator('#matches-status')).to_contain_text('gewijzigd')
            assert get()['match']==a
            page.locator('#matches-delete').click()
            page.locator('#matches-delete-confirm').click();expect(page.locator('#matches-status')).to_have_text('1 partij verwijderd op de NUC.')
            assert get()['match'] is None and get()['draft'] is None and not get('/api/matches')['matches']
            page.evaluate("value=>localStorage.setItem('oche.match.v1',JSON.stringify(value))",a)
            page.reload();page.wait_for_function("JSON.parse(localStorage.getItem('oche.match.v1')).state===null")
            assert get()['match'] is None
            assert post('/api/state',{'revision':get()['revision'],'match':a}).status==400
            assert post('/api/match-transfer',{'match':a}).status==400
            assert page.request.get(url+'/api/matches/'+aid).status==404
            server.terminate();server.wait();server=start()
            assert get()['match'] is None and not get('/api/matches')['matches']
            assert not get('/api/match-backups')['backups']
            # Even an old recovery copy restored by a disk backup cannot resurrect a deleted game.
            (backups/('2'*32+'.json')).write_text(json.dumps({'time':time.time(),'match':a,'draft':None}),encoding='utf-8')
            server.terminate();server.wait();server=start()
            assert not get('/api/matches')['matches'] and not get('/api/match-backups')['backups']
            browser.close();print('PASS: launch menu, newest-first archive, report, resume, partial input, restart and legacy migration')
            print('PASS: responsive table, touch selection, filter, cancel, bulk/current delete, validation, online/revision guards and persistent deletion')
    finally:server.terminate();server.wait()
