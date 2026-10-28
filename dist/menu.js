import './mouse-control.js';
import './mobile-diagnostics.js';

const actions=document.getElementById('top-actions');
const menu=document.createElement('nav');
menu.id='header-menu';menu.setAttribute('aria-label','Hoofdmenu');
const menuToggle=document.getElementById('toggle-toolbar');
menuToggle.hidden=false;menuToggle.setAttribute('aria-controls','header-menu');
let menuCollapsed=false;
try{menuCollapsed=localStorage.getItem('180hitters.menuCollapsed')==='true';}catch{}
function renderMenuToggle(){
 document.body.classList.toggle('toolbar-collapsed',menuCollapsed);
 menuToggle.setAttribute('aria-expanded',String(!menuCollapsed));
 menuToggle.textContent=menuCollapsed?'Menu openen':'Menu inklappen';
 if(menuCollapsed)for(const group of menu.children)group.open=false;
}
menuToggle.onclick=()=>{
 menuCollapsed=!menuCollapsed;
 try{localStorage.setItem('180hitters.menuCollapsed',String(menuCollapsed));}catch{}
 renderMenuToggle();
};
actions.before(menu);
renderMenuToggle();

const definitions=[
 ['play','Spelen'],
 ['connections','Verbindingen'],
 ['application','Applicatie']
];
const groups={};
for(const [key,label] of definitions){
 const group=document.createElement('details');group.dataset.menu=key;
 const title=document.createElement('summary');title.textContent=label;
 const panel=document.createElement('div');panel.className='menu-panel';
 group.append(title,panel);menu.append(group);groups[key]=panel;
 title.addEventListener('click',()=>{
  for(const other of menu.children)if(other!==group)other.open=false;
 });
 panel.addEventListener('click',event=>{
  if(event.target.closest('button,a'))group.open=false;
 });
}

const order={
 play:['settings','edit-match','team-manager','players-list','transfer-to-nuc','match-backups','screen-input-shortcut'],
 connections:['android-app-action','take-control','connection-health','mouse-control-open','bluetooth-open','network-open'],
 application:['android-app-action','kiosk-mode-toggle','open-kiosk','fullscreen','screen-orientation','desktop-update-action','android-update-action','camera-test','venue-open']
};

function destination(node){
 const id=node.id;
 if(order.play.includes(id))return groups.play;
 if(id==='android-app-action')return window.DartsAndroid?groups.connections:groups.application;
 if(order.connections.includes(id))return groups.connections;
 if(order.application.includes(id))return groups.application;
 return groups.application;
}

function arrange(panel,ids){
 let previous=null;
 for(const id of ids){
  const node=document.getElementById(id);
  if(!node||node.parentElement!==panel)continue;
  const expected=previous?previous.nextElementSibling:panel.firstElementChild;
  if(expected!==node)panel.insertBefore(node,expected);
  previous=node;
 }
}

function collect(){
 const camera=document.getElementById('camera-game-controls');
 if(camera&&camera.parentElement!==menu)menu.append(camera);
 for(const node of [...actions.children]){
  if(node.matches('button,a'))destination(node).append(node);
 }
 const android=document.getElementById('android-app-action');
 if(android&&!menu.contains(android))destination(android).append(android);
 for(const [key] of definitions)arrange(groups[key],order[key]);
 const venue=document.getElementById('venue-open');if(venue)venue.textContent='Locatie-instellingen';
 const network=document.getElementById('network-open');if(network)network.textContent='Wifi-netwerken / hotspot';
 const fullscreen=document.getElementById('fullscreen');if(fullscreen)fullscreen.textContent='Volledig scherm';
 const kiosk=document.getElementById('open-kiosk');if(kiosk)kiosk.textContent='App op NUC openen';
 if(android&&!window.DartsAndroid)android.textContent='Android-app installeren';
}
collect();
new MutationObserver(collect).observe(actions,{childList:true});

// De uitgebreide hardwaretest hoort alleen op het fysieke NUC-scherm. Mobiel
// gebruikt de compacte knoppen Camera aan/herstart en Camera uit.
const localNuc=['127.0.0.1','localhost','::1'].includes(location.hostname)&&!window.DartsAndroid;
if(localNuc){
 const orientationButton=document.createElement('button');orientationButton.id='screen-orientation';orientationButton.type='button';orientationButton.textContent='Schermstand';
 const dialog=document.createElement('dialog');dialog.id='screen-orientation-dialog';dialog.innerHTML='<h2>Schermstand NUC</h2><p id="screen-orientation-current">Schermstand ophalen...</p><button class="wide" data-orientation="landscape">Landscape</button><button class="wide" data-orientation="portrait-left">Portrait linksom</button><button class="wide" data-orientation="portrait-right">Portrait rechtsom</button><p id="screen-orientation-status" role="status"></p><button id="screen-orientation-close" class="wide" type="button">Sluiten</button>';
 document.body.append(dialog);groups.application.append(orientationButton);arrange(groups.application,order.application);
 const current=dialog.querySelector('#screen-orientation-current'),status=dialog.querySelector('#screen-orientation-status');
 async function refreshOrientation(){
  try{const response=await fetch('/api/display/orientation',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error);current.textContent='Actief: '+data.label;for(const choice of dialog.querySelectorAll('[data-orientation]'))choice.classList.toggle('primary',choice.dataset.orientation===data.orientation);}
  catch(error){current.textContent=error.message||'Schermstand kon niet worden opgehaald.';}
 }
 orientationButton.onclick=()=>{status.textContent='';dialog.showModal();void refreshOrientation();};
 dialog.querySelector('#screen-orientation-close').onclick=()=>dialog.close();
 for(const choice of dialog.querySelectorAll('[data-orientation]'))choice.onclick=async()=>{
  status.textContent='Scherm draaien...';
  try{const response=await fetch('/api/display/orientation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orientation:choice.dataset.orientation})}),data=await response.json();if(!response.ok)throw Error(data.error);status.textContent=data.label+' is ingesteld.';await refreshOrientation();}
  catch(error){status.textContent=error.message||'Schermstand wijzigen is mislukt.';}
 };
}
if(localNuc)fetch('/api/camera/status').then(response=>{
 if(!response.ok)return;
 const button=document.createElement('button');button.id='camera-test';
 button.textContent='Camera-test';button.onclick=()=>{location.href='camera.html';};
 groups.application.append(button);arrange(groups.application,order.application);
}).catch(()=>{});

document.addEventListener('click',event=>{
 if(!menu.contains(event.target))for(const group of menu.children)group.open=false;
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')for(const group of menu.children)if(group.open){group.open=false;group.querySelector('summary').focus();}
});
