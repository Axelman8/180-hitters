const $=id=>document.getElementById(id);
const android=window.DartsAndroid&&typeof window.DartsAndroid.getMobilePlayers==='function';
const nucScreen=!android&&['127.0.0.1','localhost','::1'].includes(location.hostname);
let venuePlayers=[],mobilePlayers=[],saving=false;
const venueLabel=()=>window.venueProfile?.playerListName||'Clubspelers';
const sorted=values=>[...new Set((values||[]).map(v=>String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));
function nativePlayers(){try{return sorted(JSON.parse(window.DartsAndroid.getMobilePlayers()));}catch{return [];}}
function storeNative(values){if(android)window.DartsAndroid.saveMobilePlayers(JSON.stringify(sorted(values)));}
function nativeVenuePlayers(){try{return sorted(JSON.parse(window.DartsAndroid.getVenuePlayers()));}catch{return [];}}
function storeNativeVenue(values){if(android&&typeof window.DartsAndroid.saveVenuePlayers==='function')window.DartsAndroid.saveVenuePlayers(JSON.stringify(sorted(values)));}
function lists(data){
 const incomingVenue=sorted(data.venuePlayers??data.players??[]),local=android&&typeof window.DartsAndroid.isLocalMode==='function'&&window.DartsAndroid.isLocalMode();
 if(android&&local)venuePlayers=nativeVenuePlayers();else{venuePlayers=incomingVenue;if(android)storeNativeVenue(venuePlayers);}
 mobilePlayers=android?nativePlayers():sorted(data.mobilePlayers??[]);
 choices();renderLists();
 document.dispatchEvent(new CustomEvent('players-lists-updated',{detail:{venuePlayers,mobilePlayers}}));
}
function choices(){
 for(const label of $('names').children){
  const input=label.querySelector('input');if(!input)continue;
  let select=label.querySelector('select');
  if(!select){select=document.createElement('select');select.setAttribute('aria-label',label.firstChild.textContent+' kiezen uit spelerslijst');label.insertBefore(select,input);select.onchange=()=>{if(select.value){input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));}};}
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=venuePlayers.length||mobilePlayers.length?'Kies een speler of typ een naam':'Spelerslijsten leeg - typ een naam';
  const groups=[];
  for(const [title,values] of [[venueLabel(),venuePlayers],['Mijn spelers',mobilePlayers]])if(values.length){const group=document.createElement('optgroup');group.label=title;group.append(...values.map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;return option;}));groups.push(group);}
  select.replaceChildren(placeholder,...groups);select.value=[...venuePlayers,...mobilePlayers].includes(input.value)?input.value:'';
 }
}
function roster(target,values,editable,empty){
 target.replaceChildren(...values.map(name=>{const li=document.createElement('li'),text=document.createElement('span');text.textContent=name;li.append(text);if(editable){const remove=document.createElement('button');remove.type='button';remove.textContent='Verwijderen';remove.setAttribute('aria-label',name+' verwijderen');remove.onclick=()=>save('remove',name);li.append(remove);}return li;}));
 if(!values.length){const li=document.createElement('li');li.className='roster-empty';li.textContent=empty;target.append(li);}
}
function renderLists(){
 const title=$('roster-list').closest('.roster-group').querySelector('h3');title.firstChild.textContent=venueLabel()+' ';
 roster($('roster-list'),venuePlayers,nucScreen,`Nog geen spelers in ${venueLabel()} opgeslagen.`);
 roster($('mobile-roster-list'),mobilePlayers,android,'Nog geen persoonlijke spelers opgeslagen.');
 $('players-form').hidden=!(android||nucScreen);
 $('players-form-label').textContent=android?'Speler toevoegen aan Mijn spelers':`Speler toevoegen aan ${venueLabel()}`;
 $('players-dialog-note').textContent=android?`${venueLabel()} wordt vanaf de NUC bijgewerkt. Mijn spelers blijft op deze telefoon en synchroniseert naar de NUC.`:nucScreen?`Beheer hier ${venueLabel()}. Mijn spelers is een alleen-lezen kopie van de Android-app.`:'De spelerslijsten zijn hier alleen beschikbaar om te kiezen.';
}
async function refresh(){
 try{
  let response=await fetch('/api/players',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error();let data=await response.json();
  if(android){
   const initialized=typeof window.DartsAndroid.hasMobilePlayers==='function'&&window.DartsAndroid.hasMobilePlayers();
   if(!initialized&&data.mobilePlayers?.length)storeNative(data.mobilePlayers);
   const personal=nativePlayers();
   response=await fetch('/api/mobile-players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players:personal}),signal:AbortSignal.timeout(5000)});
   if(response.ok)data=await response.json();
   else{lists(data);$('players-message').textContent=`${venueLabel()} is bijgewerkt. Mijn spelers blijft op de telefoon en synchroniseert zodra de NUC-software is bijgewerkt.`;return;}
  }
  lists(data);$('players-message').textContent='';
 }catch{$('players-message').textContent=android?'Persoonlijke spelers staan veilig op de telefoon; synchroniseren met de NUC lukt nu niet.':'Spelerslijsten niet bereikbaar. Controleer de verbinding.';renderLists();}
}
async function save(action,name){
 if(saving)return;saving=true;$('players-message').textContent='Opslaan...';
 try{
  let response;
  if(android){
   let updated=nativePlayers();if(action==='add'&&!updated.some(n=>n.localeCompare(name,'nl',{sensitivity:'base'})===0))updated.push(name);if(action==='remove')updated=updated.filter(n=>n.localeCompare(name,'nl',{sensitivity:'base'})!==0);updated=sorted(updated);storeNative(updated);mobilePlayers=updated;
   response=await fetch('/api/mobile-players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players:updated}),signal:AbortSignal.timeout(5000)});
  }else response=await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,name}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error();lists(await response.json());if(action==='add')$('player-name').value='';$('players-message').textContent=action==='add'?'Naam opgeslagen.':'Naam verwijderd. Lopende partijen blijven behouden.';
 }catch{renderLists();$('players-message').textContent=android?'Naam is op de telefoon opgeslagen; synchronisatie met de NUC volgt zodra de verbinding terug is.':'Opslaan is niet bevestigd.';}finally{saving=false;}
}
$('players-list').onclick=()=>{$('players-message').textContent='';$('players-dialog').showModal();refresh();};
$('players-close').onclick=()=>$('players-dialog').close();
$('players-form').onsubmit=e=>{e.preventDefault();const name=$('player-name').value.trim();if(name)save('add',name);};
for(const id of ['category-match','category-training'])$(id).addEventListener('click',refresh);
new MutationObserver(choices).observe($('names'),{childList:true});
document.addEventListener('venue-profile-ready',()=>{choices();renderLists();});
refresh();
