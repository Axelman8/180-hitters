const $ = id => document.getElementById(id);
import './nuc-control.js';
const dialog = $('network-dialog');
let info = null, chosen = null, pending = false, polling = false;
const controlToken = (() => { try { return window.DartsAndroid?.getControlToken?.() || ''; } catch { return ''; } })();
const localNuc = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname) && !window.DartsAndroid?.isTabletShell;
const canControl = localNuc || !!controlToken;
if(localNuc)document.body.classList.add('local-nuc');
if(window.DartsAndroid){$('network-open').hidden=true;$('network-open').style.display='none';}
const addNote = document.querySelector('#network-add-section > p');
const switchNote = document.querySelector('#network-confirmation > p');
if(addNote)addNote.textContent='Voeg een netwerk toe voor internet en GitHub-updates. De bediening blijft via Bluetooth werken.';
if(switchNote)switchNote.textContent='Wifi wordt alleen voor internet en updates gebruikt. De Bluetooth-bediening blijft actief.';

function setBusy(busy) {
  $('network-hotspot').disabled = busy || !info;
  $('network-wifi').disabled = busy || !info || !$('network-select').value;
  $('network-select').disabled = busy || !info;
}

async function loadNetwork() {
  if (polling) return;
  polling = true;
  try {
    const response = await fetch('/api/network/control', {signal: AbortSignal.timeout(15000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Netwerkkeuze niet beschikbaar.');
    info = data;
    $('network-add-section').hidden = !canControl;
    const active = data.profiles.filter(p => p.active).map(p => p.name).join(', ');
    $('network-current').textContent = 'Huidige verbinding: ' + (active || 'geen opgeslagen wifi actief');
    const selected = $('network-select').value;
    $('network-select').replaceChildren(...data.profiles.filter(p => p.mode === 'wifi').map(p => {
      const option = document.createElement('option');
      option.value = p.uuid;
      option.textContent = p.name + (p.active ? ' (verbonden)' : '');
      return option;
    }));
    if ([...$('network-select').options].some(o => o.value === selected)) $('network-select').value = selected;
    if (!data.busy) pending = false;
    setBusy(data.busy || pending);
    $('network-status').textContent = data.busy ? 'De NUC schakelt van netwerk. Dit kan ongeveer een minuut duren.' : (data.operation?.message || '');
  } catch (error) {
    $('network-status').textContent = pending
      ? 'De NUC schakelt het internetnetwerk om. De Bluetooth-bediening blijft beschikbaar.'
      : (error.name === 'TimeoutError' || error instanceof TypeError ? 'De NUC reageert niet. Controleer de Bluetooth-verbinding.' : error.message);
    if (!pending) { info = null; setBusy(true); }
  } finally { polling = false; }
}

function choose(target) {
  chosen = info?.profiles.find(p => p.uuid === target);
  if (!chosen) return;
  $('network-target').textContent = chosen.name;
  $('network-instructions').textContent = chosen.mode === 'hotspot'
    ? 'Deze hotspot is alleen beschikbaar voor onderhoud. Scorebediening blijft via Bluetooth lopen.'
    : 'Dit netwerk wordt alleen gebruikt voor internet en updates. Scorebediening blijft via Bluetooth lopen.';
  $('network-confirmation').hidden = false;
  $('network-confirm').disabled = false;
  $('network-back').hidden = false;
  setBusy(true);
}

$('network-open').onclick = () => {
  dialog.showModal();
  $('network-confirmation').hidden = true;
  $('network-status').textContent = 'Netwerken ophalen…';
  setBusy(true);
  loadNetwork();
};
$('network-close').onclick = () => dialog.close();
$('network-select').onchange = () => setBusy(pending || info?.busy);
$('network-hotspot').onclick = () => choose(info.hotspot);
$('network-wifi').onclick = () => choose($('network-select').value);
$('network-back').onclick = () => { $('network-confirmation').hidden = true; chosen = null; setBusy(pending || info?.busy); };
$('network-refresh').onclick = loadNetwork;
$('network-add-form').onsubmit = async event => {
  event.preventDefault();
  const ssid = $('network-ssid').value.trim(), password = $('network-password').value;
  $('network-status').textContent = 'Netwerk veilig opslaan…';
  try {
    const headers={'Content-Type':'application/json'};if(controlToken)headers['X-Darts-Control']=controlToken;
    const response = await fetch('/api/network/add', {method:'POST', headers, body:JSON.stringify({ssid,password}), signal:AbortSignal.timeout(25000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Netwerk opslaan is niet gelukt.');
    $('network-password').value = '';
    $('network-status').textContent = data.message;
    await loadNetwork();
  } catch (error) { $('network-status').textContent = error.name === 'TimeoutError' ? 'De NUC reageerde niet op tijd.' : error.message; }
};
$('network-confirm').onclick = async () => {
  if (!chosen || pending) return;
  pending = true;
  $('network-confirm').disabled = true;
  $('network-back').hidden = true;
  setBusy(true);
  $('network-status').textContent = 'Omschakelen aanvragen…';
  try {
    const response = await fetch('/api/network/switch', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({uuid: chosen.uuid}), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) {
      pending = false;
      $('network-confirm').disabled = false;
      $('network-back').hidden = false;
      throw new Error(data.error || 'Omschakelen kon niet worden gestart.');
    }
    $('network-status').textContent = data.message;
    if (data.phase === 'done') { pending = false; $('network-confirmation').hidden = true; loadNetwork(); }
  } catch (error) {
    $('network-status').textContent = pending
      ? 'Geen bevestiging ontvangen. De NUC kan al omschakelen; controleer het gekozen netwerk voordat je opnieuw probeert.' : error.message;
  }
};
setInterval(() => { if (dialog.open && (pending || $('network-confirmation').hidden)) loadNetwork(); }, 10000);
