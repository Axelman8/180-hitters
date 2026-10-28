const button = document.getElementById('open-kiosk');
const status = document.getElementById('kiosk-status');
const localNuc = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname) && !window.DartsAndroid?.isTabletShell;
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'App openen op de NUC…';
  try {
    const response = await fetch('/api/kiosk/open', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: '{}', signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Openen mislukt.');
    status.textContent = result.message;
  } catch (error) {
    status.textContent = error instanceof TypeError || error.name === 'TimeoutError'
      ? 'Geen antwoord van de NUC. Controleer het scherm en je wifi-verbinding.' : error.message;
  } finally {
    button.disabled = false;
  }
});

if (localNuc) {
  // De browser-fullscreenknop vraagt om Escape en is daardoor onbruikbaar op
  // een NUC met alleen een muis. Gebruik de echte kioskbediening hieronder.
  document.getElementById('fullscreen').hidden = true;
  const modeButton = document.createElement('button');
  modeButton.id = 'kiosk-mode-toggle';
  modeButton.type = 'button';
  modeButton.textContent = 'Kioskstatus ophalen…';
  document.getElementById('top-actions').append(modeButton);
  let kiosk = true;
  const refresh = async () => {
    try {
      const response = await fetch('/api/kiosk/status', {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kioskstatus niet beschikbaar.');
      kiosk = data.kiosk;
      modeButton.textContent = kiosk ? 'Kioskmodus verlaten' : 'Kioskmodus starten';
      modeButton.disabled = false;
    } catch (error) {
      modeButton.textContent = error.message;
      modeButton.disabled = true;
    }
  };
  modeButton.onclick = async () => {
    modeButton.disabled = true;
    modeButton.textContent = kiosk ? 'Kioskmodus verlaten…' : 'Kioskmodus starten…';
    try {
      const response = await fetch('/api/kiosk/mode', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kiosk:!kiosk}), signal:AbortSignal.timeout(10000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kioskstand wijzigen is mislukt.');
      modeButton.textContent = data.message;
    } catch (error) {
      modeButton.textContent = error.message;
      modeButton.disabled = false;
    }
  };
  refresh();
}
