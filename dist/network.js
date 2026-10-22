const $ = id => document.getElementById(id);
import './nuc-control.js';
const dialog = $('network-dialog');
let info = null, chosen = null, pending = false, polling = false;
const controlToken = (() => { try { return window.DartsAndroid?.getControlToken?.() || ''; } catch { return ''; } })();

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
    $('network-add-section').hidden = !controlToken;
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
      ? 'De verbinding is weg tijdens het omschakelen. Verbind je telefoon met het gekozen netwerk. Bij mislukken van wifi probeert de NUC automatisch 180 Hitters wifi.'
      : (error.name === 'TimeoutError' || error instanceof TypeError ? 'De NUC is niet bereikbaar. Controleer je wifi-verbinding.' : error.message);
    if (!pending) { info = null; setBusy(true); }
  } finally { polling = false; }
}

function choose(target) {
  chosen = info?.profiles.find(p => p.uuid === target);
  if (!chosen) return;
  $('network-target').textContent = chosen.name;
  const profile=window.venueProfile||{},hotspot=profile.hotspotName||'180 Hitters wifi',password=profile.hotspotPassword?` Wachtwoord: ${profile.hotspotPassword}.`:'';
  $('network-instructions').textContent = chosen.mode === 'hotspot'
    ? `Verbind daarna je telefoon met ${chosen.name}.${password} Open vervolgens http://10.42.0.1:8765/?remote=1.`
    : `Verbind daarna je telefoon met ${chosen.name}. Scan de QR-code op het NUC-scherm voor het nieuwe adres. Lukt verbinden niet, dan gaat de NUC terug naar ${hotspot}.${password}`;
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
    const response = await fetch('/api/network/add', {method:'POST', headers:{'Content-Type':'application/json','X-Darts-Control':controlToken}, body:JSON.stringify({ssid,password}), signal:AbortSignal.timeout(25000)});
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
