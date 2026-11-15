import {repairNucConnection} from './connection-recovery.js';
const android = window.DartsAndroid;
const phone = !!android && android.isTabletShell !== true;
let hasControl=false;
document.addEventListener('nuc-control-status',event=>{hasControl=event.detail.own;});

if (phone) {
  const open = document.createElement('button');
  open.id = 'connection-health'; open.type = 'button'; open.textContent = 'Verbindingsstatus en herstel';
  document.getElementById('top-actions').append(open);

  const dialog = document.createElement('dialog');
  dialog.id = 'connection-health-dialog';
  dialog.innerHTML = `<h2>Verbindingsstatus en herstel</h2>
    <p id="connection-health-summary" role="status">Status controleren…</p>
    <dl id="connection-health-details"></dl>
    <button id="connection-selftest" class="primary wide" type="button">Zelftest uitvoeren</button>
    <button id="connection-repair" class="wide" type="button">Verbinding en bediening herstellen</button>
    <button id="connection-change" class="wide" type="button">Verbindingsmodus wijzigen</button>
    <button id="connection-health-close" class="wide" type="button">Sluiten</button>`;
  document.body.append(dialog);

  const style = document.createElement('style');
  style.textContent = '#connection-health-details{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;padding:12px;border:1px solid var(--line);border-radius:12px}#connection-health-details dt{color:var(--muted)}#connection-health-details dd{margin:0;font-weight:750;overflow-wrap:anywhere}#connection-health-dialog>button{margin-top:9px}';
  document.head.append(style);

  const summary = dialog.querySelector('#connection-health-summary');
  const details = dialog.querySelector('#connection-health-details');

  function nativeInfo() {
    try { return JSON.parse(android.getConnectionInfo?.() || '{}'); } catch { return {}; }
  }
  function label(mode) {
    return mode === 'bluetooth' ? 'NUC via Bluetooth' : 'Lokaal op mobiel';
  }
  function render(info, nucReachable) {
    const connected = info.mode === 'local' ? true : nucReachable;
    summary.textContent = !connected ? 'De NUC is nog niet bereikbaar. Kies Verbinding en bediening herstellen.' : info.mode==='local' ? 'Lokaal spelen is gereed.' : hasControl ? 'Verbinding en scorebediening zijn gereed.' : 'De NUC is bereikbaar, maar dit apparaat heeft de bediening nog niet. Kies Verbinding en bediening herstellen.';
    summary.style.color = connected ? 'var(--accent)' : '#ffc38c';
    const rows = [
      ['Appversie', info.versionName || 'onbekend'],
      ['Modus', label(info.mode)],
      ['Bluetooth', info.bluetoothAvailable === false ? 'niet aanwezig' : info.bluetoothEnabled === false ? 'uit' : info.bluetoothConnected ? 'verbonden' : 'gereed voor verbinding'],
      ['Gekozen NUC', info.bluetoothName || info.bluetoothAddress || 'niet gekozen'],
      ['NUC', info.mode==='local' ? 'niet in gebruik' : connected ? 'bereikbaar' : 'niet bereikbaar'],
      ['Bediening', info.mode==='local' ? 'lokaal' : connected&&hasControl ? 'actief op dit apparaat' : 'nog herstellen']
    ];
    details.replaceChildren(...rows.flatMap(([key, value]) => {
      const term = document.createElement('dt'), description = document.createElement('dd');
      term.textContent = key; description.textContent = value; return [term, description];
    }));
  }
  async function probe() {
    summary.textContent = 'Zelftest uitvoeren…';
    let info = nativeInfo();
    let reachable = info.mode === 'local';
    if (!reachable) {
      try {
        const response = await fetch('/api/state', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
        reachable = response.ok;
      } catch { reachable = false; }
    }
    try { localStorage.setItem('hitters.selftest', String(Date.now())); localStorage.removeItem('hitters.selftest'); }
    catch { summary.textContent = 'Browseropslag is niet schrijfbaar.'; }
    info = nativeInfo(); render(info, reachable);
    return reachable;
  }

  open.onclick = async () => { dialog.showModal(); await probe(); };
  dialog.querySelector('#connection-selftest').onclick = () => probe();
  dialog.querySelector('#connection-repair').onclick = () => repairNucConnection();
  document.addEventListener('nuc-recovery-status',event=>{
    summary.textContent=event.detail.text;
    dialog.querySelector('#connection-repair').disabled=event.detail.busy;
  });
  dialog.querySelector('#connection-change').onclick = () => android.chooseMode?.();
  dialog.querySelector('#connection-health-close').onclick = () => dialog.close();
}
