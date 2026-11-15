import './mouse-control.js';
import './mobile-diagnostics.js';

const $=id=>document.getElementById(id),actions=$('top-actions'),android=window.DartsAndroid;
const localNuc=['127.0.0.1','localhost','::1'].includes(location.hostname)&&!android;
const versionLabel=document.createElement('span');versionLabel.id='app-version';versionLabel.setAttribute('aria-label','Geïnstalleerde versie');
versionLabel.textContent=android?.isTabletShell===true?'Tablet v…':android?'Mobiel v…':'NUC v…';document.querySelector('header').append(versionLabel);
async function showVersion(){
 let version='';
 if(android){
  try{version=JSON.parse(android.getConnectionInfo?.()||'{}').versionName||'';}catch{}
  if(!version&&android.isTabletShell===true)try{const r=await fetch('/api/tablet/diagnostics',{cache:'no-store'});if(r.ok)version=(await r.json()).appVersionName||'';}catch{}
 }else{
  try{const r=await fetch('/api/desktop-installation',{cache:'no-store'});if(r.ok)version=(await r.json()).version||'';}catch{}
  if(!version)try{const r=await fetch('/api/update/status',{cache:'no-store'});if(r.ok)version=(await r.json()).version||'';}catch{}
 }
 const device=android?.isTabletShell===true?'Tablet':android?'Mobiel':'NUC';versionLabel.textContent=`${device} v${version||'onbekend'}`;
}
void showVersion();

// One surface: overview -> section -> action. Preserve the actual action
// elements, their handlers and their device-specific availability.
const definitions=[
 {key:'play',title:'Spelen',hint:'Een partij starten, aanpassen of terugkijken.',icon:'M6 4l14 8-14 8z',sections:[['new','Nieuwe partij'],['current','Tijdens je partij'],['saved','Bewaarde partijen']]},
 {key:'online',title:'Online darten',hint:'Een dartbaan maken, deelnemen en uitnodigingen bekijken.',icon:'M8 12h8M12 8v8M3 12a9 9 0 1018 0 9 9 0 00-18 0',sections:[['lanes','Dartbanen'],['invites','Uitnodigingen'],['club','Mijn club']]},
 {key:'players',title:'Spelers & teams',hint:'Je spelerslijst bijhouden en teams tijdens de partij beheren.',icon:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M16 3a4 4 0 010 8M22 21v-2a4 4 0 00-3-3.87M5 7a4 4 0 108 0 4 4 0 00-8 0',sections:[['roster','Spelerslijsten'],['teams','Teams in deze partij']]},
 {key:'nuc',title:'NUC & verbinding',hint:'Verbinden, bediening overnemen en je dartopstelling beheren.',icon:'M3 3h18v14H3zM8 21h8M12 17v4',sections:[['connect','Verbinding & bediening'],['match','Partij overzetten'],['display','NUC-scherm'],['system','NUC-beheer'],['camera','Camera’s']]},
 {key:'app',title:'App-instellingen',hint:'Weergave, app-updates en informatie over 180 Hitters.',icon:'M12 8a4 4 0 100 8 4 4 0 000-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',sections:[['display','Weergave'],['updates','App bijwerken'],['about','Over 180 Hitters']]}
];
const routes={
 'settings':['play','new','Kies een spel, spelregels en spelers.'],
 'edit-match':['play','current','Pas de instellingen van de lopende partij aan.'],
 'screen-input-shortcut':['play','current','Toon de scoreknoppen op het speelscherm.'],
 'match-backups':['play','saved','Open een bewaarde partij of bekijk het rapport.'],
 'players-list':['players','roster','Beheer de spelers op dit apparaat en de clubspelers op de NUC.'],
 'team-manager':['players','teams','Verander de volgorde, voeg een invaller toe of vervang een speler.'],
 'online-host-open':['online','lanes','Maak een nieuwe dartbaan of open je actieve dartbaan.'],
 'online-new-open':['online','lanes','Begin met een nieuwe online dartbaan.'],
 'online-join-open':['online','lanes','Kies een beschikbare dartbaan of gebruik een uitnodiging.'],
 'online-invitations-open':['online','invites','Bekijk wie jou heeft uitgenodigd en doe mee.'],
 'online-leave-open':['online','lanes','Verlaat je dartbaan en ga terug naar een nieuwe partij.'],
 'club-open':['online','club','Je clubregistratie, toegang en clubmeldingen.'],
 'android-app-action':android?['nuc','connect','Kies lokaal spelen of verbinden met een NUC via Bluetooth.']:['app','updates','Installeer de Android-app op een telefoon of tablet.'],
 'take-control':['nuc','connect','Laat dit apparaat de scores op de NUC bedienen.'],
 'connection-health':['nuc','connect','Controleer de verbinding of herstel deze bij een probleem.'],
 'mouse-control-open':['nuc','connect','Gebruik je telefoon of tablet als muis voor het NUC-scherm.'],
 'bluetooth-open':['nuc','system','Bluetooth, NUC-update, opnieuw opstarten en uitschakelen.'],
 'network-open':['nuc','system','Beheer het wifi-netwerk en de hotspot van de NUC.'],
 'transfer-to-nuc':['nuc','match','Neem een lokale partij mee naar de NUC.'],
 'kiosk-mode-toggle':['nuc','display','Schakel de kioskweergave van het NUC-scherm om.'],
 'open-kiosk':['nuc','display','Open het speelscherm op de aangesloten NUC.'],
 'screen-orientation':['nuc','display','Zet het NUC-scherm horizontaal of verticaal.'],
 'venue-open':['nuc','system','Naam en presentatie van de locatie op de NUC.'],
 'camera-game-controls':['nuc','camera','Zet cameradetectie aan, herstart deze of schakel haar uit.'],
 'camera-test':['nuc','camera','Controleer de camera’s van je dartbord.'],
 'fullscreen':['app','display','Toon 180 Hitters over het volledige scherm.'],
 'layout-open':['app','display','Pas de weergave op dit apparaat aan.'],
 'desktop-update-action':['app','updates','Controleer en installeer een nieuwe versie voor deze NUC.'],
 'android-update-action':['app','updates','Controleer en installeer een nieuwe versie voor dit apparaat.']
};
const menu=document.createElement('dialog');menu.id='header-menu';menu.setAttribute('aria-labelledby','navigation-title');
menu.innerHTML='<div class="navigation-head"><div><p class="eyebrow">180 HITTERS</p><h2 id="navigation-title">Wat wil je doen?</h2></div><button id="navigation-close" type="button" aria-label="Menu sluiten">Sluiten ×</button></div><p id="navigation-context" class="navigation-context"></p><div id="navigation-scroll"><div id="navigation-overview"><p class="navigation-intro">Alles voor je partij en je dartopstelling, op één plek.</p><nav id="navigation-categories" aria-label="Onderdelen"></nav></div><div id="navigation-detail" hidden><button id="navigation-back" type="button">TERUG</button><p id="navigation-description"></p><div id="navigation-panels"></div></div></div><div class="navigation-foot"><span id="navigation-version"></span><button id="navigation-resume" type="button">Terug naar spel</button></div>';
document.body.append(menu);
const groups={},sections={};
for(const definition of definitions){
 const tile=document.createElement('button');tile.type='button';tile.className='navigation-category';tile.dataset.menu=definition.key;
 tile.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${definition.icon}"/></svg><span><strong>${definition.title}</strong><small>${definition.hint}</small></span><b aria-hidden="true">›</b>`;
 tile.onclick=()=>selectSection(definition.key);$('navigation-categories').append(tile);
 const panel=document.createElement('section');panel.dataset.menu=definition.key;panel.hidden=true;panel.className='navigation-panel';groups[definition.key]=panel;sections[definition.key]={};
 for(const [key,title] of definition.sections){const section=document.createElement('section');section.className='navigation-section';section.innerHTML=`<h3>${title}</h3><div class="navigation-action-list"></div>`;panel.append(section);sections[definition.key][key]=section.querySelector('div');}
 $('navigation-panels').append(panel);
}
sections.app.about.innerHTML='<article class="navigation-about"><img src="avatar.jpg" alt="Avatar van Axelman8"><div><strong>180 Hitters</strong><p>Ontwikkeld door Axelman8</p><a href="https://github.com/Axelman8/180-hitters" target="_blank" rel="noopener">Project en versies op GitHub ↗</a></div></article>';
const menuToggle=$('toggle-toolbar');menuToggle.hidden=false;menuToggle.textContent='Menu';menuToggle.setAttribute('aria-controls','header-menu');menuToggle.setAttribute('aria-haspopup','dialog');menuToggle.setAttribute('aria-expanded','false');
document.body.classList.add('toolbar-collapsed');
function hide(node,value){if(node.hidden!==value)node.hidden=value;}
function selectSection(key){
 const definition=definitions.find(item=>item.key===key);if(!definition)return;
 for(const [name,panel] of Object.entries(groups))hide(panel,name!==key);
 hide($('navigation-overview'),true);hide($('navigation-detail'),false);$('navigation-title').textContent=definition.title;$('navigation-description').textContent=definition.hint;
 $('navigation-scroll').scrollTop=0;$('navigation-back').focus();refreshSections();
}
function overview(){hide($('navigation-overview'),false);hide($('navigation-detail'),true);$('navigation-title').textContent='Wat wil je doen?';$('navigation-scroll').scrollTop=0;if(menu.open)$('navigation-categories').querySelector('button').focus();}
function refreshContext(){
 let text='Spelen op de NUC';
 if(android){try{const info=JSON.parse(android.getConnectionInfo?.()||'{}');text=info.mode==='bluetooth'?(info.bluetoothConnected?'NUC via Bluetooth verbonden':'NUC via Bluetooth · verbinding controleren'):'Lokaal spelen op dit apparaat';}catch{text=android.isLocalMode?.()?'Lokaal spelen op dit apparaat':'Bediening van de NUC';}}
 $('navigation-context').textContent=text;$('navigation-version').textContent=versionLabel.textContent;
}
function openMenu(section=null){collect();refreshContext();overview();if(!menu.open)menu.showModal();menuToggle.setAttribute('aria-expanded','true');if(section)selectSection(section);}
function closeMenu(){if(menu.open)menu.close();menuToggle.setAttribute('aria-expanded','false');}
menuToggle.onclick=()=>menu.open?closeMenu():openMenu();
$('navigation-close').onclick=closeMenu;$('navigation-resume').onclick=closeMenu;$('navigation-back').onclick=overview;
menu.addEventListener('close',()=>menuToggle.setAttribute('aria-expanded','false'));
// Close before an existing action opens its own dialog, including async actions.
menu.addEventListener('click',event=>{if(event.target.closest('.navigation-action-list button,.navigation-action-list a'))closeMenu();},true);
menu.addEventListener('click',event=>{if(event.target===menu)closeMenu();});
document.addEventListener('open-play-menu',()=>openMenu('play'));

function visible(node){return !!node&&!node.hidden&&getComputedStyle(node).display!=='none';}
function refreshSections(){
 for(const definition of definitions){
  for(const list of Object.values(sections[definition.key])){
   let available=definition.key==='app'&&list===sections.app.about;
   for(const card of list.querySelectorAll('.navigation-action')){hide(card,!visible(card.firstElementChild));if(!card.hidden)available=true;}
   hide(list.parentElement,!available);
  }
  const panel=groups[definition.key],empty=panel.querySelector('.navigation-empty');
  const hasActions=[...panel.children].some(section=>section.classList.contains('navigation-section')&&!section.hidden);
  if(empty)hide(empty,hasActions);
  else if(!hasActions){const note=document.createElement('p');note.className='navigation-empty';note.textContent='Deze functies komen beschikbaar zodra er een partij of verbinding actief is.';panel.append(note);}
 }
}
function collect(){
 const candidates=[...actions.children],install=$('android-app-action');if(install&&!menu.contains(install))candidates.push(install);
 for(const node of new Set(candidates)){
  if(!node.matches('button,a,#camera-game-controls'))continue;
  const [group,section,description]=routes[node.id]||['app','display','Extra weergaveopties voor 180 Hitters.'];
  const card=document.createElement('div');card.className='navigation-action';const hint=document.createElement('p');hint.textContent=description;card.append(node,hint);sections[group][section].append(card);
 }
 for(const [id,[group,section]] of Object.entries(routes)){const node=$(id);if(node?.parentElement?.classList.contains('navigation-action'))sections[group][section].append(node.parentElement);}
 if($('players-list'))$('players-list').textContent='Spelerslijst beheren';
 if(install)install.textContent=android?'Lokaal spelen of NUC verbinden':'Android-app installeren';
 if($('bluetooth-open'))$('bluetooth-open').textContent='NUC beheren';
 if($('open-kiosk'))$('open-kiosk').textContent='Speelscherm op NUC openen';
 if($('android-update-action'))$('android-update-action').textContent='App bijwerken';
 if($('fullscreen'))$('fullscreen').textContent='Volledig scherm';
 if($('venue-open'))$('venue-open').textContent='Locatie & presentatie';
 if(android?.isLocalMode?.()===true)for(const id of ['bluetooth-open','open-kiosk','kiosk-mode-toggle','venue-open'])if($(id))hide($(id),true);
 refreshSections();
}
collect();new MutationObserver(collect).observe(actions,{childList:true});
new MutationObserver(()=>{if(menu.open)refreshSections();}).observe(menu,{subtree:true,attributes:true,attributeFilter:['hidden','disabled']});

if(localNuc){
 const orientationButton=document.createElement('button');orientationButton.id='screen-orientation';orientationButton.type='button';orientationButton.textContent='Schermstand van de NUC';
 const dialog=document.createElement('dialog');dialog.id='screen-orientation-dialog';dialog.innerHTML='<h2>Schermstand NUC</h2><p id="screen-orientation-current">Schermstand ophalen...</p><button class="wide" data-orientation="landscape">Landscape</button><button class="wide" data-orientation="portrait-left">Portrait linksom</button><button class="wide" data-orientation="portrait-right">Portrait rechtsom</button><p id="screen-orientation-status" role="status"></p><button id="screen-orientation-close" class="wide" type="button">Sluiten</button>';
 document.body.append(dialog);actions.append(orientationButton);
 const current=dialog.querySelector('#screen-orientation-current'),status=dialog.querySelector('#screen-orientation-status');
 async function refreshOrientation(){try{const r=await fetch('/api/display/orientation',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error);current.textContent='Actief: '+data.label;for(const choice of dialog.querySelectorAll('[data-orientation]'))choice.classList.toggle('primary',choice.dataset.orientation===data.orientation);}catch(error){current.textContent=error.message||'Schermstand kon niet worden opgehaald.';}}
 orientationButton.onclick=()=>{status.textContent='';dialog.showModal();void refreshOrientation();};dialog.querySelector('#screen-orientation-close').onclick=()=>dialog.close();
 for(const choice of dialog.querySelectorAll('[data-orientation]'))choice.onclick=async()=>{status.textContent='Scherm draaien...';try{const r=await fetch('/api/display/orientation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orientation:choice.dataset.orientation})}),data=await r.json();if(!r.ok)throw Error(data.error);status.textContent=data.label+' is ingesteld.';await refreshOrientation();}catch(error){status.textContent=error.message||'Schermstand wijzigen is mislukt.';}};
 fetch('/api/camera/status').then(response=>{if(!response.ok)return;const button=document.createElement('button');button.id='camera-test';button.textContent='Camera-test';button.onclick=()=>{location.href='camera.html';};actions.append(button);}).catch(()=>{});
}
