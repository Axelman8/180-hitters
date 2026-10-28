const tablet = window.DartsAndroid?.isTabletShell === true;

if (tablet) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = 'mouse-control.css';
  document.head.append(stylesheet);

  const open = document.createElement('button');
  open.id = 'mouse-control-open';
  open.type = 'button';
  open.textContent = 'NUC-muisbediening';
  document.getElementById('top-actions').append(open);

  const dialog = document.createElement('dialog');
  dialog.id = 'mouse-control-dialog';
  dialog.innerHTML = `
    <h2>NUC-muisbediening</h2>
    <p>Veeg over het vlak om de aanwijzer op het NUC-scherm te bewegen. Tik voor een linksklik.</p>
    <div id="mouse-touchpad" role="application" aria-label="Touchpad voor de NUC" tabindex="0">
      <span>TOUCHPAD</span><small>Vegen = bewegen · tikken = klikken</small>
    </div>
    <div class="mouse-actions">
      <button type="button" data-mouse="left">Linksklik</button>
      <button type="button" data-mouse="double">Dubbelklik</button>
      <button type="button" data-mouse="right">Rechtsklik</button>
    </div>
    <div class="mouse-scroll">
      <button type="button" data-scroll="-3">Omhoog</button>
      <button type="button" data-scroll="3">Omlaag</button>
    </div>
    <p id="mouse-control-status" role="status" aria-live="polite"></p>
    <button id="mouse-control-close" class="primary wide" type="button">Sluiten</button>`;
  document.body.append(dialog);

  const pad = dialog.querySelector('#mouse-touchpad');
  const status = dialog.querySelector('#mouse-control-status');
  let lastX = 0, lastY = 0, moved = false, pendingX = 0, pendingY = 0, sending = false;

  async function send(body) {
    const response = await fetch('/api/mouse', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    if (!response.ok) {
      const value = await response.json().catch(() => ({}));
      throw new Error(value.error || 'De NUC reageert niet op de muisbediening.');
    }
  }

  async function flushMovement() {
    if (sending || (!pendingX && !pendingY)) return;
    sending = true;
    const dx = Math.max(-240, Math.min(240, Math.round(pendingX)));
    const dy = Math.max(-240, Math.min(240, Math.round(pendingY)));
    pendingX -= dx; pendingY -= dy;
    try { await send({action: 'move', dx, dy}); status.textContent = ''; }
    catch (error) { status.textContent = error.message; pendingX = pendingY = 0; }
    finally { sending = false; if (pendingX || pendingY) void flushMovement(); }
  }

  let tracking = false;
  function start(x, y) {
    lastX = x; lastY = y; moved = false; tracking = true; pad.classList.add('active');
  }
  function move(x, y) {
    if (!tracking) return;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
    pendingX += dx * 1.6; pendingY += dy * 1.6; void flushMovement();
  }
  function end() {
    if (!tracking) return;
    tracking = false; pad.classList.remove('active');
    if (!moved) void send({action: 'click', button: 'left'}).catch(error => { status.textContent = error.message; });
  }
  // De oude Firefox op de Android 4-tablet levert betrouwbare touch-events,
  // maar geen bruikbare pointer-capture. Houd beide paden afzonderlijk.
  if ('ontouchstart' in window) {
    pad.addEventListener('touchstart', event => {
      const touch = event.changedTouches[0]; if (touch) start(touch.clientX, touch.clientY);
      event.preventDefault();
    }, {passive: false});
    pad.addEventListener('touchmove', event => {
      const touch = event.changedTouches[0]; if (touch) move(touch.clientX, touch.clientY);
      event.preventDefault();
    }, {passive: false});
    pad.addEventListener('touchend', event => { end(); event.preventDefault(); }, {passive: false});
    pad.addEventListener('touchcancel', () => { tracking = false; pad.classList.remove('active'); });
  } else {
    pad.addEventListener('pointerdown', event => {
      start(event.clientX, event.clientY); pad.setPointerCapture?.(event.pointerId); event.preventDefault();
    });
    pad.addEventListener('pointermove', event => { move(event.clientX, event.clientY); event.preventDefault(); });
    pad.addEventListener('pointerup', event => {
      pad.releasePointerCapture?.(event.pointerId); end(); event.preventDefault();
    });
    pad.addEventListener('pointercancel', () => { tracking = false; pad.classList.remove('active'); });
  }
  dialog.querySelectorAll('[data-mouse]').forEach(button => button.addEventListener('click', () => {
    void send({action: 'click', button: button.dataset.mouse}).catch(error => { status.textContent = error.message; });
  }));
  dialog.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => {
    void send({action: 'scroll', amount: Number(button.dataset.scroll)}).catch(error => { status.textContent = error.message; });
  }));
  open.addEventListener('click', () => { status.textContent = ''; dialog.showModal(); });
  dialog.querySelector('#mouse-control-close').addEventListener('click', () => dialog.close());
}
