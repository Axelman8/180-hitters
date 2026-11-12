from playwright.sync_api import sync_playwright

url='https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters-Scram-uitleg.mp4'
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page()
 page.set_content(f'<video controls src="{url}"></video>')
 page.locator('video').evaluate("video=>new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',()=>resolve(),{once:true});video.addEventListener('error',()=>reject(new Error(video.error?.message||video.error?.code)),{once:true});video.load();setTimeout(()=>reject(new Error('timeout')),20000)})")
 duration=page.locator('video').evaluate('video=>video.duration')
 assert duration>0,duration
 browser.close();print('PASS',duration)
