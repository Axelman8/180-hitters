const action = document.getElementById('android-app-action');
const dialog = document.getElementById('android-download-dialog');
const link = document.getElementById('android-download-link');
const code = document.getElementById('android-download-code');
const address = document.getElementById('android-download-address');
const status = document.getElementById('android-download-status');

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
  link.hidden = true;
  status.hidden = false;
  status.textContent = 'Downloadadres bepalen...';
  try {
    const response = await fetch('/api/network', {cache: 'no-store', signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error();
    const base = preferredBase((await response.json()).urls || []);
    if (!base) throw new Error();
    const apk = new URL('/downloads/180-Hitters.apk', base).href;
    const image = window.qrcode(0, 'M');
    image.addData(apk); image.make();
    code.innerHTML = image.createSvgTag({cellSize: 5, margin: 18, scalable: true});
    code.querySelector('svg')?.setAttribute('aria-label', 'QR-code voor de 180 Hitters Android-app');
    link.href = apk;
    address.textContent = apk;
    link.hidden = false;
    status.hidden = true;
  } catch {
    status.textContent = 'De download is nog niet beschikbaar of de NUC heeft geen netwerkadres.';
  }
}

if (window.DartsAndroid) {
  action.textContent = 'Verbindingsmodus';
  action.addEventListener('click', () => window.DartsAndroid.chooseMode());
  const update = document.createElement('button');
  update.id = 'android-update-action'; update.type = 'button'; update.textContent = 'Update';
  update.addEventListener('click', () => window.DartsAndroid.checkForUpdate());
  document.getElementById('top-actions').append(action, update);
  document.getElementById('mobile-dock').hidden = true;
} else {
  action.addEventListener('click', () => { dialog.showModal(); void renderDownload(); });
}
document.getElementById('android-download-close').addEventListener('click', () => dialog.close());
