const button = document.getElementById('open-kiosk');
const status = document.getElementById('kiosk-status');
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
