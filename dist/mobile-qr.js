// Generate the code locally: no internet service or fixed IP address required.
const link = document.getElementById('mobile-qr-link');
const address = document.getElementById('mobile-address');
const status = document.getElementById('mobile-qr-status');
const note = document.getElementById('mobile-network-note');
let lastUrl = '';
const installUrl = 'https://github.com/Axelman8/180-hitters/releases/latest/download/180-Hitters.apk';

function showInstallCode(){
 const target=document.getElementById('install-app-code');
 const image=window.qrcode(0,'M');image.addData(installUrl);image.make();
 target.innerHTML=image.createSvgTag({cellSize:4,margin:16,scalable:true});
 target.href=installUrl;
 const svg=target.querySelector('svg');
 svg.setAttribute('role','img');svg.setAttribute('aria-label','Installeer de nieuwste 180 Hitters Android-app via GitHub');
}
showInstallCode();

async function refreshMobileCode() {
  try {
    const response = await fetch('/api/network', {signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Network unavailable');
    const {urls} = await response.json();
    const available = urls.filter(value => {
      const url = new URL(value);
      return url.protocol === 'http:' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    });
    const hotspot = available.find(url => new URL(url).hostname === '10.42.0.1');
    const base = hotspot || available.find(url => url === location.origin)
      || available.find(url => new URL(url).hostname === '192.168.1.93') || available[0];
    if (!base) throw new Error('No LAN address');
    const mobileUrl = new URL('/?remote=1', base).href;
    if (mobileUrl !== lastUrl) {
      const code = window.qrcode(0, 'M');
      code.addData(mobileUrl);
      code.make();
      // Four white modules around the code preserve the scanner's quiet zone.
      link.innerHTML = code.createSvgTag({cellSize: 4, margin: 16, scalable: true});
      const svg = link.querySelector('svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'QR-code voor ' + mobileUrl);
      link.href = address.href = mobileUrl;
      address.textContent = mobileUrl;
      lastUrl = mobileUrl;
    }
    note.textContent = hotspot
      ? 'Hotspot actief: verbind met dartscore.'
      : 'Gebruik hetzelfde wifi-netwerk als de NUC.';
    link.hidden = false;
    address.hidden = false;
    status.hidden = true;
  } catch {
    // Do not display a stale code when the network address cannot be verified.
    link.hidden = true;
    address.hidden = true;
    status.hidden = false;
    status.textContent = 'Geen netwerkverbinding. De QR-code verschijnt automatisch zodra de verbinding terug is.';
  }
}
refreshMobileCode();
setInterval(refreshMobileCode, 30000);
window.addEventListener('online', refreshMobileCode);

async function showClubWifi(){
 try{
  const response=await fetch('/club-wifi.json');if(!response.ok)return;
  const {qr}=await response.json();if(typeof qr!=='string'||!qr.startsWith('WIFI:'))return;
  const group=document.createElement('section');group.id='club-wifi';
  const code=document.createElement('div');code.id='club-wifi-code';
  const image=window.qrcode(0,'M');image.addData(qr);image.make();
  code.innerHTML=image.createSvgTag({cellSize:4,margin:16,scalable:true});
  code.querySelector('svg').setAttribute('aria-label','Verbind met de wifi van VTV de Venhoeve');
  code.querySelector('svg').setAttribute('role','img');
  const text=document.createElement('div'),title=document.createElement('strong'),note=document.createElement('p');
  title.textContent='2. Verbind met wifi';note.textContent='VTV de Venhoeve';text.append(title,note);group.append(code,text);
  const dock=document.getElementById('mobile-dock');dock.insertBefore(group,dock.querySelector('.mobile-dock-copy'));
 }catch{}
}
showClubWifi();
