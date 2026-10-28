import './mouse-control.js';

const actions=document.getElementById('top-actions');
const menu=document.createElement('nav');
menu.id='header-menu';menu.setAttribute('aria-label','Hoofdmenu');
document.getElementById('toggle-toolbar').hidden=true;
document.body.classList.remove('toolbar-collapsed');
actions.before(menu);

const definitions=[
 ['play','Spelen'],
 ['connections','Verbindingen'],
 ['application','Applicatie'],
 ['settings','Instellingen']
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
 connections:['android-app-action','take-control','mouse-control-open','bluetooth-open','network-open'],
 application:['android-app-action','kiosk-mode-toggle','open-kiosk','fullscreen','desktop-update-action','android-update-action','camera-test'],
 settings:['venue-open']
};

function destination(node){
 const id=node.id;
 if(order.play.includes(id))return groups.play;
 if(id==='android-app-action')return window.DartsAndroid?groups.connections:groups.application;
 if(order.connections.includes(id))return groups.connections;
 if(order.application.includes(id))return groups.application;
 return groups.settings;
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

// Alleen tonen op installaties die de hardwaretest aanbieden.
fetch('/api/camera/status').then(response=>{
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
