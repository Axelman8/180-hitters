"""Shared online-friends roster, player/team selection and offline account isolation.

Uses a disposable local match store and intercepted cloud requests only.
"""
from pathlib import Path
import json
import mimetypes
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8856'
ACCOUNT = '180hitters.club.v1'
CACHE = '180hitters.onlineFriends.v1'
ASSETS = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None

with tempfile.TemporaryDirectory() as folder:
    server = subprocess.Popen(
        [sys.executable, str(ROOT / 'server.py'), '--host', '127.0.0.1',
         '--port', '8856', '--data-file', str(Path(folder) / 'match.json')],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(.8)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={'width': 393, 'height': 852})
            initial = {'member': {'id': 'self', 'name': 'Test User', 'status': 'approved'},
                       'accessToken': 'fake-token-for-test-only'}
            context.add_init_script("if (!sessionStorage.initialized) { localStorage.setItem("
                                    + json.dumps(ACCOUNT) + ',' + json.dumps(json.dumps(initial))
                                    + ");sessionStorage.initialized='1';}")
            if ASSETS:
                context.add_init_script("localStorage.setItem('180hitters.legacy.venuePlayers','[\"NUC Test\"]');localStorage.setItem('180hitters.legacy.players','[\"Personal Test\"]');")
            page = context.new_page()
            if ASSETS:
                def legacy_assets(route):
                    path = unquote(urlsplit(route.request.url).path)
                    if path.startswith('/api/'):
                        route.fallback()
                        return
                    file = (ASSETS / (path.lstrip('/') or 'index.html')).resolve()
                    if file.is_relative_to(ASSETS) and file.is_file():
                        route.fulfill(path=file, content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
                    else:
                        route.fallback()
                page.route(URL + '/**', legacy_assets)
            errors, calls = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            mode = {'value': 'ready'}

            def cloud(route):
                path = route.request.url.split('.workers.dev')[-1]
                calls.append(path)
                if path == '/club/players':
                    if mode['value'] == 'offline':
                        route.abort('internetdisconnected')
                        return
                    if mode['value'] == 'denied':
                        route.fulfill(status=403, json={'error': 'Toegang geweigerd'})
                        return
                    route.fulfill(json={'players': [{'id': 'z', 'name': 'Zoe'},
                                                    {'id': 'a', 'name': 'Anna'},
                                                    {'id': 'bad', 'name': 'Blocked', 'status': 'blocked'},
                                                    {'id': 'duplicate', 'name': 'anna'}]})
                elif path == '/club/status':
                    route.fulfill(json={**initial})
                elif path == '/club/invitations':
                    route.fulfill(json={'invitations': []})
                elif path == '/lobby':
                    route.fulfill(json={'rooms': [{'host': 'Leen', 'code': 'ABC234', 'joined': 1, 'capacity': 2}]})
                else:
                    route.fulfill(status=400, json={'error': 'Unexpected test request'})

            page.route('https://180-hitters-online.180-hitters-online.workers.dev/**', cloud)
            local_data = {'players': ['NUC Test'], 'venuePlayers': ['NUC Test'],
                          'mobilePlayers': ['Personal Test']}
            page.route('**/api/players', lambda route: route.fulfill(json=local_data))
            page.goto(URL)
            expect(page.locator('#header-menu')).to_be_visible()
            page.wait_for_function("window.__hittersOnlineFriends?.snapshot().phase==='ready'")
            expect(page.locator('#club-dialog')).to_have_count(1)
            assert calls.count('/club/players') == 1, calls  # Both consumers share one request.
            page.locator('#navigation-categories [data-menu="players"]').click()
            page.locator('#players-list').click()
            expect(page.locator('#roster-list li span')).to_have_text(['NUC Test'])
            expect(page.locator('#mobile-roster-list li span')).to_have_text(['Personal Test'])
            expect(page.locator('#friends-roster-list li span')).to_have_text(['Anna', 'Zoe'])
            expect(page.locator('#friends-roster-list button')).to_have_count(0)
            expect(page.locator('#players-dialog > .roster-group')).to_have_count(3)
            expect(page.locator('#players-dialog > .dialog-navigation')).to_have_count(1)
            expect(page.locator('#players-dialog .dialog-navigation .roster-group')).to_have_count(0)
            (ROOT / '.repair-check').mkdir(exist_ok=True)
            page.screenshot(path=str(ROOT / '.repair-check/friends-rosters-phone.png'))
            # Shared CSS and renderer, no bullet/list appearance divergence.
            for width, height in [(320, 740), (393, 852), (744, 900), (1024, 600), (1920, 1080)]:
                page.set_viewport_size({'width': width, 'height': height})
                styles = page.evaluate("""() => ['roster-list','mobile-roster-list','friends-roster-list'].map(id=>{
                    const ul=document.getElementById(id),li=ul.querySelector('li'),s=getComputedStyle(li);
                    return [getComputedStyle(ul).listStyleType,s.display,s.padding,s.borderBottom];})""")
                assert styles[0] == styles[1] == styles[2], styles
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.set_viewport_size({'width': 393, 'height': 852})
            page.locator('#players-close').click()
            page.locator('#toggle-toolbar').click()
            page.locator('#navigation-categories [data-menu="online"]').click()
            expect(page.locator('#club-open')).to_have_text('Online vrienden')
            page.locator('#club-open').click()
            expect(page.locator('#players-dialog h2')).to_have_text('Online vrienden')
            expect(page.locator('#roster-list')).not_to_be_visible()
            expect(page.locator('#friends-roster-list li span')).to_have_text(['Anna', 'Zoe'])
            page.screenshot(path=str(ROOT / '.repair-check/friends-online-phone.png'))
            page.locator('#friends-roster-access').click()
            expect(page.locator('#club-dialog')).to_be_visible()
            expect(page.locator('#club-dialog h2')).to_have_text('Toegang tot online vrienden')
            page.locator('#club-close').click()
            # Online forms use the same navigation and remain usable on narrow,
            # folded, tablet and desktop displays. No real lane is created.
            def open_online(button):
                page.evaluate("document.dispatchEvent(new Event('open-main-menu'))")
                page.locator('#navigation-categories [data-menu="online"]').click()
                page.locator(button).click()
                expect(page.locator('#online-dialog')).to_be_visible()
            open_online('#online-host-open')
            expect(page.locator('#online-host-symbol')).to_be_visible()
            page.locator('#online-host-name').fill('Test User')
            page.locator('#online-capacity').select_option('4')
            page.locator('#online-host-symbol').select_option(index=2)
            for width, height in [(320, 740), (393, 852), (744, 900), (1024, 600), (1920, 1080)]:
                page.set_viewport_size({'width': width, 'height': height})
                box = page.locator('#online-dialog').bounding_box()
                assert box['x'] >= 0 and box['x'] + box['width'] <= width
                assert box['y'] >= 0 and box['y'] + box['height'] <= height
                assert page.locator('#online-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
            page.set_viewport_size({'width': 393, 'height': 852})
            page.locator('#online-dialog').evaluate('e=>e.scrollTop=0')
            page.screenshot(path=str(ROOT / '.repair-check/online-host-uniform.png'))
            expect(page.locator('#online-dialog > .dialog-navigation')).to_have_count(1)
            page.locator('#online-close').click()
            open_online('#online-join-open')
            expect(page.locator('#online-guest-symbol')).to_be_visible()
            expect(page.locator('.online-lobby-room')).to_contain_text('Leen')
            page.screenshot(path=str(ROOT / '.repair-check/online-join-uniform.png'))
            page.locator('#online-dialog details').filter(has=page.locator('#online-invite-input')).locator('summary').click()
            expect(page.locator('#online-invite-input')).to_be_visible()
            page.locator('#online-close').click()
            page.locator('#toggle-toolbar').click()
            page.locator('#navigation-categories [data-menu="play"]').click()
            page.locator('#settings').click()
            page.locator('.wizard-game').filter(has=page.get_by_text('X01', exact=True)).click()
            page.locator('.wizard-next').click()
            select = page.locator('.wizard-roster-select').first
            assert select.locator('optgroup').evaluate_all('(items)=>items.map(e=>e.label)') == [
                'NUC-spelers', 'Mijn spelers', 'Online vrienden']
            select.select_option('Anna')
            expect(page.locator('.wizard-name-picker input').first).to_have_value('Anna')
            input_field = page.locator('.wizard-name-picker input').first
            input_field.fill('Typed name')
            input_field.focus()
            page.evaluate("document.dispatchEvent(new Event('online-friends-refresh'))")
            expect(page.locator('#friends-roster-status')).to_contain_text('Automatisch opgehaald')
            expect(input_field).to_be_focused()
            expect(input_field).to_have_value('Typed name')
            # Reuse the same picker for members of temporary teams.
            page.locator('[data-field="participant-mode"]').get_by_role('button', name='Teams', exact=True).click()
            expect(page.locator('.wizard-team')).to_have_count(2)
            page.locator('.wizard-roster-select').select_option('Zoe')
            expect(page.locator('.wizard-name-picker input')).to_have_value('Zoe')
            assert page.locator('#names input[data-member-name]').first.input_value() == 'Zoe'
            cache = page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', CACHE)
            assert cache['members'] == [{'id': 'a', 'name': 'Anna'}, {'id': 'z', 'name': 'Zoe'}]
            assert 'fake-token' not in json.dumps(cache)
            # Reload offline: names remain usable locally, approval grants no extra access.
            mode['value'] = 'offline'
            page.reload()
            page.wait_for_function("window.__hittersOnlineFriends?.snapshot().phase==='offline'")
            assert page.evaluate('window.__hittersOnlineFriends.snapshot().members.map(m=>m.name)') == ['Anna', 'Zoe']
            # An explicit rejection clears stale names and their cache.
            mode['value'] = 'denied'
            page.evaluate("document.dispatchEvent(new Event('online-friends-refresh'))")
            page.wait_for_function("window.__hittersOnlineFriends.snapshot().phase==='denied'")
            assert page.evaluate('window.__hittersOnlineFriends.snapshot().members') == []
            assert page.evaluate('(key)=>localStorage.getItem(key)', CACHE) is None
            # Registration/account changes cannot leak another account's cached friends.
            page.evaluate("""([account,cache])=>{localStorage.setItem(cache,JSON.stringify({accountId:'old',members:[{id:'oldfriend',name:'Old Friend'}]}));
                localStorage.setItem(account,JSON.stringify({member:{id:'new',status:'pending'}}));
                document.dispatchEvent(new Event('club-account-updated'));}""", [ACCOUNT, CACHE])
            assert page.evaluate('window.__hittersOnlineFriends.snapshot().phase') == 'registration'
            assert page.evaluate('(key)=>localStorage.getItem(key)', CACHE) is None
            assert page.evaluate('window.__hittersOnlineFriends.snapshot().members') == []
            assert not errors, errors
            browser.close()
            print('PASS', 'legacy tablet' if ASSETS else 'modern client',
                  'shared roster layout, three name sources, player/team choice, focus, offline cache, rejection and account isolation')
    finally:
        server.terminate()
        server.wait()
