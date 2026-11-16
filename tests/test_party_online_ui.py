"""Two independent apps play new games over the isolated relay."""
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
            game=sys.argv[1] if len(sys.argv)>1 else 'seabattle'
            host.locator('#online-host-open').click();host.locator('#online-game').select_option(game);host.locator('#online-host').click()
            expect(host.locator('#online-code')).to_have_text(__import__('re').compile('[A-Z2-9]{6}'));code=host.locator('#online-code').text_content()
            guest.locator('#online-join-open').click();guest.locator('.online-lobby-room').filter(has_text=code).get_by_role('button',name='Deelnemen',exact=True).click()
            expect(host.locator('#online-starter')).to_be_visible();guest.locator('#online-starter-options button').nth(1).click()
            for view in pages:expect(view.locator('#online-starter')).to_be_hidden(timeout=6000)
            def data(view):return view.request.get(f'http://127.0.0.1:{8890+pages.index(view)}/api/state').json()
            if game=='shanghai':
                for i in [0,1,2]:guest.locator('.party-controls .sonny-multipliers button').nth(i).click()
                for view in pages:expect(view.locator('#result-dialog')).to_be_visible(timeout=8000)
            elif game=='golf':
                for dart in range(3):
                    guest.locator('.party-controls .sonny-multipliers button').nth(1).click()
                    if dart<2:
                        for view in pages:expect(view.locator('.sonny-darts .current')).to_have_text(f'Pijl {dart+2}')
                for view in pages:expect(view.locator('.party-player.active strong')).to_have_text('Axel')
                assert data(host)['match']['state']['players'][1]['golfStrokes']==1
            else:
                for dart,number in enumerate([1,2,3]):
                    guest.locator(f'.sea-cell[data-number="{number}"]').click()
                    if dart<2:
                        for view in pages:expect(view.locator('.sonny-darts .current')).to_have_text(f'Pijl {dart+2}')
                for view in pages:expect(view.locator('.party-player.active strong')).to_have_text('Axel')
                for view in pages:
                    assert data(view)['match']['state']['history'][0]['input']['hits'][0]['seaShips']
                # The defender can now take a whole visit too.
                for number in [4,5,6]:host.locator(f'.sea-cell[data-number="{number}"]').click();host.wait_for_timeout(100)
                for view in pages:expect(view.locator('.party-player.active strong')).to_have_text('Leen')
            assert not errors,errors
            print('PASS: two independent app UIs, online',game,'live darts, next player and outcome')
            session=host.request.get('http://127.0.0.1:8890/api/online/local').json();host.request.post(BASE+f'/rooms/{code}/close',data={'key':session['key']})
            browser.close()
    finally:
        for process in servers:process.terminate();process.wait()
