"""Two independent phones, real app servers, isolated Wrangler relay + WebSocket."""
from pathlib import Path
import json, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8787'
with tempfile.TemporaryDirectory() as temp:
    servers=[]
    try:
        # Only the temporary fixture accepts a loopback HTTP relay. Production
        # keeps its HTTPS allowlist; no real accounts or lanes are touched.
        fixture_server=Path(temp)/'server.py'
        fixture_server.write_text((ROOT/'server.py').read_text(encoding='utf-8').replace("allowed_base = re.fullmatch(", "allowed_base = base == 'http://127.0.0.1:8787' or re.fullmatch(").replace("root = Path(__file__).parent", "root = Path("+repr(str(ROOT))+")").replace("import sys\n", "import sys\nsys.path.insert(0,"+repr(str(ROOT))+")\n"),encoding='utf-8')
        for i in range(2):
            servers.append(subprocess.Popen([sys.executable,str(fixture_server),'--port',str(8890+i),'--data-file',str(Path(temp)/f'{i}.json')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
        from urllib.request import urlopen
        for port in [8890,8891]:
            for attempt in range(50):
                try:urlopen(f'http://127.0.0.1:{port}/api/state',timeout=1).close();break
                except OSError:time.sleep(.15)
            else:raise RuntimeError(f'Test server {port} did not start')
        with sync_playwright() as p:
            browser=p.chromium.launch();pages=[];errors=[]
            for i in range(2):
                page=browser.new_page(viewport={'width':393,'height':852});pages.append(page)
                page.on('pageerror',lambda error:(errors.append(str(error)),print('BROWSER ERROR:',error,flush=True)))
                page.add_init_script("localStorage.setItem('180hitters.club.v1',"+json.dumps(json.dumps({'accessToken':'fixture','member':{'name':['Axel','Leen'][i],'status':'approved'}}))+")")
                page.route('**/online.js',lambda route:route.fulfill(content_type='text/javascript',body=(ROOT/'dist/online.js').read_text(encoding='utf-8').replace('https://180-hitters-online.180-hitters-online.workers.dev',BASE)))
                page.route('https://180-hitters-online.180-hitters-online.workers.dev/club/**',lambda route,request,name=['Axel','Leen'][i]:route.fulfill(json={'invitations':[],'players':[],'member':{'name':name,'status':'approved'}}))
                page.goto(f'http://127.0.0.1:{8890+i}/?remote=1')
                page.locator('[data-menu="online"].navigation-category').click()
            host,guest=pages
            assert not errors,errors
            host.locator('#online-host-open').click();host.locator('#online-game').select_option('killer')
            host.locator('#online-host').click();expect(host.locator('#online-code')).to_have_text(__import__('re').compile('[A-Z2-9]{6}'))
            code=host.locator('#online-code').text_content()
            guest.locator('#online-join-open').click()
            lane=guest.locator('.online-lobby-room').filter(has_text=code)
            expect(lane).to_contain_text('Killer');lane.get_by_role('button',name='Deelnemen',exact=True).click()
            expect(host.locator('#online-starter')).to_be_visible();expect(guest.locator('#online-starter')).to_be_visible()
            guest.locator('#online-starter-options button').nth(1).click()
            for page in pages:expect(page.locator('#online-starter')).to_be_hidden(timeout=6000)
            def turn(actor,history):
                for page in pages:
                    page.wait_for_function("([actor,n])=>document.querySelectorAll('.killer-player')[actor]?.classList.contains('active') && !document.querySelector('#header-menu').open",arg=[actor,history])
                for i,page in enumerate(pages):
                    page.wait_for_function("async n=>(await fetch('/api/state').then(r=>r.json())).match.state.history.length===n",arg=history)
                    assert page.locator('body').evaluate("(e,own)=>e.classList.contains('online-waiting')!==own",i==actor)
            # The guest starts assigning; both receive its number immediately.
            turn(1,0);guest.locator('.killer-sector[data-number="20"]').click();turn(0,1)
            host.locator('.killer-sector[data-number="5"]').click();turn(1,2)
            for history,actor in enumerate([1,0],start=3):
                own=pages[actor];watcher=pages[1-actor]
                for dart in range(3):
                    own.locator('.killer-number').nth(actor).click()
                    if dart<2:
                        expect(own.locator('.sonny-darts .current')).to_have_text(f'Pijl {dart+2}')
                        expect(watcher.locator('.sonny-darts .current')).to_have_text(f'Pijl {dart+2}')
                turn(1-actor,history)
            # Both are Killer. Each single hit removes one life and the third wins.
            for dart in range(3):
                guest.locator('.killer-number').nth(0).click()
                if dart<2:
                    expect(host.locator('.killer-player').first.locator('.killer-lives')).to_have_attribute('aria-label',f'3 van 3 treffers, {2-dart} levens')
            for page in pages:expect(page.locator('#result-dialog')).to_be_visible(timeout=7000)
            for page in pages:expect(page.locator('#result-dialog #result-title')).to_contain_text('Leen')
            assert not errors,errors
            print('PASS: two real phone UIs create/join Killer, agree starter, sync every dart, switch turns and both show winner')
            # Disposable local test lane only.
            session=host.request.get('http://127.0.0.1:8890/api/online/local').json()
            host.request.post(BASE+f'/rooms/{code}/close',data={'key':session['key']})
            browser.close()
    finally:
        for process in servers:process.terminate();process.wait()
