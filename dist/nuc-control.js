const bridge = window.DartsAndroid;
const localNuc = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname) && !bridge?.isTabletShell;
const androidClient = !!bridge;
const open = document.createElement('button');
open.id = 'bluetooth-open';
open.type = 'button';
open.textContent = androidClient ? 'Bluetooth en NUC' : 'Wifi en Bluetooth aan/uit';
document.getElementById('top-actions').append(open);

const dialog = document.createElement('dialog');
dialog.id = 'bluetooth-dialog';
dialog.setAttribute('aria-labelledby', 'bluetooth-title');
dialog.innerHTML = `<h2 id="bluetooth-title">${androidClient?'Bluetooth en NUC':'Wifi en Bluetooth'}</h2>` +
  '<section id="tablet-bluetooth-controls" hidden>' +
    '<p id="tablet-bluetooth-status" role="status">Status ophalen…</p>' +
    '<div class="nuc-control-buttons"><button id="tablet-bluetooth-connect" class="primary" type="button">Verbinden met NUC</button>' +
    '<button id="tablet-bluetooth-disconnect" type="button">Verbinding stoppen</button></div>' +
    '<p class="muted">De tablet zoekt alleen nadat je op verbinden hebt gedrukt.</p>' +
  '</section>' +
  '<section id="nuc-controls" hidden><h3>NUC-verbindingen</h3><p id="nuc-control-status" role="status">Status ophalen…</p>' +
    '<div class="nuc-control-buttons">' + (androidClient?'':'<button id="nuc-wifi-on" type="button">Wifi aan</button><button id="nuc-wifi-off" type="button">Wifi uit</button>') +
    '<button id="nuc-bluetooth-on" type="button">Bluetooth aan</button>' +
    '<button id="nuc-bluetooth-off" type="button">Bluetooth uit</button>' +
    '<button id="nuc-update" type="button">NUC bijwerken</button>' +
    '<button id="nuc-restart" type="button">NUC herstarten</button>' +
    '<button id="nuc-shutdown" type="button">NUC uitzetten</button></div></section>' +
  '<button id="bluetooth-close" class="wide" type="button">Sluiten</button>';
document.body.append(dialog);

const style = document.createElement('style');
style.textContent = '.nuc-control-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}.nuc-control-buttons button{min-height:48px}#nuc-controls{margin-top:1rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.18)}#nuc-control-status{font-weight:750;line-height:1.5}#bluetooth-close{margin-top:1rem}';
document.head.append(style);

const section = document.getElementById('nuc-controls');
const status = document.getElementById('nuc-control-status');
const tabletSection = document.getElementById('tablet-bluetooth-controls');
const tabletStatus = document.getElementById('tablet-bluetooth-status');
const tabletConnect = document.getElementById('tablet-bluetooth-connect');

function token() {
  try { return bridge?.getControlToken?.() || ''; } catch (_) { return ''; }
}

async function request(path, options = {}) {
  const headers = {...(options.headers || {})};
  if (token()) headers['X-Darts-Control'] = token();
  const response = await fetch(path, {...options, headers, signal: AbortSignal.timeout(15000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'NUC-bediening mislukt.');
  return data;
}

async function refreshTablet() {
  if (!bridge?.isTabletShell) return;
  tabletSection.hidden = false;
  try {
    const config = await request('/api/tablet/config', {cache: 'no-store'});
    tabletConnect.disabled = config.mode !== 'bluetooth';
    if (config.mode !== 'bluetooth') tabletStatus.textContent = 'Kies eerst NUC via Bluetooth bij Verbindingsmodus.';
    else if (config.bluetoothConnected) tabletStatus.textContent = 'Bluetooth is verbonden met de NUC.';
    else if (config.bluetoothConnectionEnabled) tabletStatus.textContent = 'Een verbindingspoging is actief.';
    else tabletStatus.textContent = 'Niet verbonden. Automatisch zoeken staat uit.';
  } catch (error) { tabletStatus.textContent = error.message; }
}

async function refreshNuc() {
  if (!localNuc && !token()) { section.hidden = true; return; }
  section.hidden = false;
  try {
    const data = await request('/api/system/status', {cache: 'no-store'});
    const update = await request('/api/update/status', {cache: 'no-store'});
    status.textContent = `Wifi: ${data.wifi ? 'aan' : 'uit'} · Bluetooth: ${data.bluetooth ? 'aan' : 'uit'} · ${update.message}`;
    if(androidClient)status.textContent = `Bluetooth: ${data.bluetooth ? 'aan' : 'uit'} · ${update.message}`;
  } catch (error) {
    status.textContent = error.message;
  }
}

async function tabletAction(action) {
  tabletStatus.textContent = action === 'connect' ? 'Verbinden…' : 'Verbinding stoppen…';
  try {
    const data = await request(`/api/tablet/bluetooth/${action}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'
    });
    tabletStatus.textContent = data.message;
    if (action === 'connect') await refreshNuc();
    else await refreshTablet();
  } catch (error) {
    tabletStatus.textContent = error.message;
    await refreshTablet();
  }
}

async function act(action, question) {
  if (question && !window.confirm(question)) return;
  status.textContent = 'Opdracht uitvoeren…';
  try {
    const data = await request('/api/system/action', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})
    });
    status.textContent = data.message;
    setTimeout(refreshNuc, 2800);
  } catch (error) { status.textContent = error.message; }
}

open.onclick = async () => {
  dialog.showModal();
  await refreshTablet();
  await refreshNuc();
};
document.getElementById('bluetooth-close').onclick = () => dialog.close();
tabletConnect.onclick = () => tabletAction('connect');
document.getElementById('tablet-bluetooth-disconnect').onclick = () => tabletAction('disconnect');
if(!androidClient){
 document.getElementById('nuc-wifi-on').onclick = () => act('wifi-on');
 document.getElementById('nuc-wifi-off').onclick = () => act('wifi-off', 'Wifi op de NUC uitzetten? Bedien de NUC daarna met de muis om wifi weer aan te zetten.');
}
document.getElementById('nuc-bluetooth-on').onclick = () => act('bluetooth-on');
document.getElementById('nuc-bluetooth-off').onclick = () => act('bluetooth-off', 'Bluetooth op de NUC uitzetten? De actieve Bluetooth-verbinding wordt verbroken.');
document.getElementById('nuc-update').onclick = async () => {
  status.textContent = 'NUC-update starten…';
  try {
    const data = await request('/api/update/check', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    status.textContent = data.message + ' De service herstart vanzelf als er een update is.';
  } catch (error) { status.textContent = error.message; }
};
document.getElementById('nuc-restart').onclick = () => act('restart', 'Weet je zeker dat je de NUC opnieuw wilt starten?');
document.getElementById('nuc-shutdown').onclick = () => act('shutdown', 'Weet je zeker dat je de NUC helemaal wilt uitzetten? Je moet hem daarna fysiek weer aanzetten.');
