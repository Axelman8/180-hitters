const bridge = window.DartsAndroid;
const section = document.createElement('section');
section.id = 'nuc-controls';
section.hidden = true;
section.innerHTML = '<h3>NUC bedienen</h3><p id="nuc-control-status">Status ophalen…</p><div class="nuc-control-buttons"><button id="nuc-bluetooth-on" type="button">Bluetooth aan</button><button id="nuc-bluetooth-off" type="button">Bluetooth uit</button><button id="nuc-update" type="button">NUC bijwerken</button><button id="nuc-restart" type="button">NUC herstarten</button><button id="nuc-shutdown" type="button">NUC uitzetten</button></div>';
document.getElementById('network-close').before(section);
const style = document.createElement('style');
style.textContent = '.nuc-control-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem}.nuc-control-buttons button{min-height:48px}#nuc-controls{margin-top:1rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.18)}';
document.head.append(style);
const status = document.getElementById('nuc-control-status');

function token() {
  try { return bridge?.getControlToken?.() || ''; } catch (_) { return ''; }
}

async function request(path, options = {}) {
  const headers = {...(options.headers || {}), 'X-Darts-Control': token()};
  const response = await fetch(path, {...options, headers, signal: AbortSignal.timeout(15000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'NUC-bediening mislukt.');
  return data;
}

async function refresh() {
  if (!token()) return;
  section.hidden = false;
  try {
    const data = await request('/api/system/status');
    const update = await request('/api/update/status');
    status.textContent = `Bluetooth: ${data.bluetooth ? 'aan' : 'uit'} · ${update.message}`;
  } catch (error) { status.textContent = error.message; }
}

async function act(action, question) {
  if (question && !window.confirm(question)) return;
  status.textContent = 'Opdracht versturen…';
  try {
    const data = await request('/api/system/action', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})
    });
    status.textContent = data.message;
  } catch (error) { status.textContent = error.message; }
}

document.getElementById('network-open').addEventListener('click', refresh);
document.getElementById('nuc-bluetooth-on').onclick = () => act('bluetooth-on');
document.getElementById('nuc-bluetooth-off').onclick = () => act('bluetooth-off', 'Bluetooth uitzetten? Een actieve Bluetooth-verbinding met de NUC wordt verbroken. Aanzetten kan daarna via wifi of rechtstreeks op de NUC.');
document.getElementById('nuc-update').onclick = async () => {
  status.textContent = 'NUC-update starten…';
  try {
    const data = await request('/api/update/check', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    status.textContent = data.message + ' De service herstart vanzelf als er een update is.';
  } catch (error) { status.textContent = error.message; }
};
document.getElementById('nuc-restart').onclick = () => act('restart', 'Weet je zeker dat je de NUC opnieuw wilt starten?');
document.getElementById('nuc-shutdown').onclick = () => act('shutdown', 'Weet je zeker dat je de NUC helemaal wilt uitzetten? Je moet hem daarna fysiek weer aanzetten.');
