// The NUC connection is Bluetooth-only. The screen keeps one QR code solely
// for installing the Android app; wifi is used by the NUC for updates only.
const installUrl = 'https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters.apk';
const install = document.getElementById('install-app');
const target = document.getElementById('install-app-code');
const title = install?.querySelector('strong');
const note = install?.querySelector('p');

if (target) {
  const image = window.qrcode(0, 'M');
  image.addData(installUrl); image.make();
  target.innerHTML = image.createSvgTag({cellSize: 4, margin: 16, scalable: true});
  target.href = installUrl;
  const svg = target.querySelector('svg');
  svg?.setAttribute('role', 'img');
  svg?.setAttribute('aria-label', 'Installeer de nieuwste 180 Hitters Android-app via GitHub');
}
if (title) title.textContent = 'Installeer de app';
if (note) note.textContent = 'Scan voor de nieuwste Android-versie. Verbinden met de NUC gaat uitsluitend via Bluetooth.';

// Remove the former wifi and browser-control codes from older HTML bundles.
document.getElementById('club-wifi')?.remove();
document.querySelector('#mobile-dock .mobile-dock-copy')?.remove();
document.getElementById('mobile-qr-link')?.remove();
document.getElementById('mobile-dock')?.classList.add('bluetooth-only');
