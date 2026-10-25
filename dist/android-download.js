const action = document.getElementById('android-app-action');
const dialog = document.getElementById('android-download-dialog');
const link = document.getElementById('android-download-link');
const code = document.getElementById('android-download-code');
const address = document.getElementById('android-download-address');
const status = document.getElementById('android-download-status');
const local = document.getElementById('android-download-local');
const githubApk = 'https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters.apk';

function preferredBase(urls) {
  const lan = urls.filter(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    } catch { return false; }
  });
  return lan.find(value => new URL(value).hostname === '10.42.0.1')
    || lan.find(value => value === location.origin)
    || lan[0];
}

async function renderDownload() {
  const image = window.qrcode(0, 'M');
  image.addData(githubApk); image.make();
  code.innerHTML = image.createSvgTag({cellSize: 5, margin: 18, scalable: true});
  code.querySelector('svg')?.setAttribute('aria-label', 'QR-code voor de nieuwste 180 Hitters Android-app op GitHub');
  link.href = githubApk;
  address.textContent = 'Nieuwste versie via GitHub';
  link.hidden = false;
  status.hidden = true;
  local.hidden = true;
  try {
    const response = await fetch('/api/network', {cache: 'no-store', signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error();
    const base = preferredBase((await response.json()).urls || []);
    if (!base) throw new Error();
    local.href = new URL('/downloads/180-Hitters.apk', base).href;
    local.hidden = false;
  } catch {}
}

if (window.DartsAndroid) {
  action.textContent = 'Verbindingsmodus';
  action.addEventListener('click', () => window.DartsAndroid.chooseMode());
  document.getElementById('top-actions').append(action);
  if (typeof window.DartsAndroid.checkForUpdate === 'function') {
    const update = document.createElement('button');
    update.id = 'android-update-action'; update.type = 'button'; update.textContent = 'Update';
    if (window.DartsAndroid.isTabletShell && typeof window.DartsAndroid.bindAction === 'function') {
      window.DartsAndroid.bindAction(update, () => window.DartsAndroid.checkForUpdate());
    } else {
      update.addEventListener('click', () => window.DartsAndroid.checkForUpdate());
    }
    document.getElementById('top-actions').append(update);
  }
  document.getElementById('mobile-dock').hidden = true;
} else {
  document.body.classList.add('browser-shell');
  action.addEventListener('click', () => { dialog.showModal(); void renderDownload(); });
}
document.getElementById('android-download-close').addEventListener('click', () => dialog.close());
