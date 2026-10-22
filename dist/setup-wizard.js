const $=id=>document.getElementById(id);
const games=[['x01','X01','Van je startscore naar nul.','Wedstrijd'],['cricket','Cricket','Sluit 15 t/m 20 en bull.','Wedstrijd'],['tactics','Tactics','Sluit 10 t/m 20 en bull.','Wedstrijd'],['121','121','Checkouttraining met negen darts.','Training'],['gotcha','Gotcha','Bereik je doel en pak tegenstanders.','Training'],['tenlives','10 levens','20 t/m 10 en Bull. Bewaar je levens.','Training'],['bobs27',"Bob's 27",'Alle dubbels onder druk trainen.','Training']];
const fields=['lives-mode','start','in-mode','out','bull-mode','scoring','match-mode','legs','set-legs','max-rounds','gotcha-target','gotcha-out','count'];
let step=0,slot=0,venueRoster=[],mobileRoster=[],selected='x01';
const venueLabel=()=>window.venueProfile?.playerListName||'Clubspelers';
let applying=false,sendTimer,sendBusy=false,pendingSetup=undefined,seenVersion=-1,mirroring=false,localSetupOwner=false;
const root=document.createElement('section');root.id='setup-wizard';$('setup').append(root);
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,action,cls){const node=el('button',text,cls);node.type='button';node.onclick=action;return node;}
function change(id,value){$(id).value=String(value);$(id).dispatchEvent(new Event('change',{bubbles:true}));}
function remember(){try{localStorage.setItem('darts.setup.preferences',JSON.stringify({selected,values:Object.fromEntries(fields.map(id=>[id,$(id).value]))}));}catch{}}
function chooseGame(id){
 selected=id;const training=['121','gotcha','bobs27','tenlives'].includes(id);
 $(training?'category-training':'category-match').click();
 change('game-type',training?'training':id);$('setup-form').hidden=false;
 if(training)change('training-type',id);else change('game-type',id);
 remember();
}
function move(next){step=next;render();$('setup').scrollIntoView({block:'start'});}
function options(id,title){
 const select=$(id);if(select.closest('label').hidden)return null;
 const group=el('fieldset',undefined,'wizard-option');group.dataset.field=id;group.append(el('legend',title));
 const tiles=el('div',undefined,'wizard-options');
 const friendly=id==='lives-mode'?{}:{single:id==='in-mode'?'Direct beginnen':'Direct uit',double:id==='in-mode'?'Dubbel-in':'Dubbel-uit',master:id==='in-mode'?'Master-in':'Master-uit',legs:'Legs',sets:'Sets',off:'Vrij spelen',standard:'Hoogste score','cut-throat':'Laagste score','no-score':'Alleen sluiten'};
 for(const option of select.options){if(option.hidden)continue;
  const tile=button(friendly[option.value]||option.textContent,()=>{change(id,option.value);remember();render();});
  tile.disabled=option.disabled;tile.setAttribute('aria-pressed',String(select.value===option.value));tiles.append(tile);
 }
 group.append(tiles);return group;
}
function names(){return [...$('names').querySelectorAll('input')];}
function assign(name){const input=names()[slot];if(!input)return;input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}));slot=Math.min(slot+1,names().length-1);render();}
function render(){
 root.replaceChildren();
 const nav=el('nav',undefined,'wizard-steps');nav.setAttribute('aria-label','Partij instellen');
 ['Spel','Instellingen','Spelers'].forEach((name,i)=>{const b=button(`${i+1} ${name}`,()=>move(i));b.disabled=i>step;b.setAttribute('aria-current',i===step?'step':'false');nav.append(b);});root.append(nav);
 const titles=['Wat gaan we spelen?','Maak het jouw partij','Wie doen er mee?'];
 root.append(el('h1',titles[step]));
 const content=el('div',undefined,'wizard-content');root.append(content);
 if(step===0){
  content.append(el('p','Kies een spel om te beginnen.','wizard-hint'));
  for(const category of ['Wedstrijd','Training']){
   content.append(el('h2',category));const tiles=el('div',undefined,'wizard-games');
   for(const [id,name,description,cat] of games.filter(g=>g[3]===category)){
    const tile=button('',()=>{chooseGame(id);move(1);},'wizard-game');tile.setAttribute('aria-pressed',String(selected===id));
    tile.append(el('strong',name),el('span',description),el('small','Kiezen →'));tiles.append(tile);
   }content.append(tiles);
  }
 }else if(step===1){
  content.append(el('p',games.find(g=>g[0]===selected)?.[1]+' · tik op een tegel om te kiezen','wizard-hint'));
  const main=[['lives-mode','Doubles of Triples'],['start','Startscore'],['in-mode','Beginnen'],['out','Uitgooien'],['gotcha-target','Doelscore'],['gotcha-out','Uitgooien'],['scoring','Puntentelling'],['match-mode','Partijvorm'],['legs',$('target-text').textContent],['set-legs','Legs per set']];
  for(const [id,title] of main){const group=options(id,title);if(group)content.append(group);}
  if(selected==='tenlives')content.append(el('p','Iedereen begint met 10 levens en 3 pogingen op 20. Raak: resterende pijlen + 3 naar het volgende doel. Pogingen op: ??n doel terug; alleen op 20 kost dit een leven. Dan wisselt de speler. Bull (50) wint.','wizard-info'));
  if(selected==='121')content.append(el('p','Negen darts om uit te gooien. Je niveau begint bij 121.','wizard-info'));
  if(selected==='bobs27')content.append(el('p',"Start op 27. Gooi drie pijlen op D1 t/m D20 en daarna bull. Treffer: punten erbij; volledig missen: punten eraf.",'wizard-info'));
 }else{
  const count=options('count','Aantal spelers');if(count)content.append(count);slot=Math.min(slot,names().length-1);
  content.append(el('p','Kies een plek en tik daarna op een naam uit de spelerslijst.','wizard-hint'));
  const slots=el('div',undefined,'wizard-slots');
  names().forEach((input,i)=>{const b=button('',()=>{slot=i;render();});b.setAttribute('aria-pressed',String(i===slot));b.append(el('small',`Speler ${i+1}`),el('strong',input.value));slots.append(b);});content.append(slots);
  for(const [title,list,source] of [[venueLabel(),venueRoster,'venue'],['Mijn spelers',mobileRoster,'mobile']]){
   const group=el('section',undefined,'wizard-roster-group');group.dataset.source=source;group.append(el('h3',title));
   const rosterTiles=el('div',undefined,'wizard-roster');
   for(const name of list){const b=button(name,()=>assign(name));b.disabled=names().some((input,i)=>i!==slot&&input.value===name);rosterTiles.append(b);}
   if(!list.length)rosterTiles.append(el('p',source==='venue'?`Geen spelers in ${venueLabel()} beschikbaar.`:'Nog geen persoonlijke spelers.','wizard-roster-empty'));
   group.append(rosterTiles);content.append(group);
  }
  const label=el('label',`Naam speler ${slot+1}`,'wizard-custom'),input=el('input');input.value=names()[slot]?.value||'';input.maxLength=24;input.autocomplete='off';
  input.oninput=()=>{const field=names()[slot];field.value=input.value;field.dispatchEvent(new Event('input',{bubbles:true}));slots.children[slot].querySelector('strong').textContent=input.value;queueSetup();};
  input.onchange=()=>render();label.append(input);content.append(label);
  const starter=options('starter','Wie begint?');if(starter)content.append(starter);
  const summary=el('div',undefined,'wizard-summary');summary.append(el('strong',games.find(g=>g[0]===selected)?.[1]));
  const ids=selected==='tenlives'?['lives-mode']:selected==='x01'?['start','in-mode','out','match-mode','legs']:selected==='gotcha'?['gotcha-target','gotcha-out']:selected==='bobs27'?[]:['scoring','match-mode','legs'];
  summary.append(el('p',ids.filter(id=>!$(id).closest('label').hidden).map(id=>id==='legs'?`Eerste tot ${$(id).value} ${$('match-mode').value==='sets'?'sets':'legs'}`:$(id).selectedOptions[0]?.textContent).join(' · ')),el('p',names().map(i=>i.value).join(' → ')));content.append(summary);
 }
 const actions=el('div',undefined,'wizard-actions');
 actions.append(button(step?'← Terug':'Terug naar partij',()=>step?move(step-1):$('cancel').click(),'wizard-back'));
 if(!step)actions.firstChild.hidden=$('cancel').hidden;
 if(step)actions.append(button(step===2?'Start partij →':'Kies spelers →',()=>{
  if(step===1){move(2);return;}
  if(names().some(i=>!i.value.trim())){root.querySelector('.wizard-custom input')?.focus();return;}
  remember();$('setup-form').requestSubmit();
 },'primary wizard-next'));
 root.append(actions);
 queueSetup();
}
function applyRosters(data){const sort=list=>(list||[]).slice().sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));venueRoster=sort(data.venuePlayers??data.players??[]);mobileRoster=sort(data.mobilePlayers??[]);if(step===2)render();}
async function refreshRoster(){try{const r=await fetch('/api/players',{cache:'no-store'});if(r.ok)applyRosters(await r.json());}catch{}}
document.addEventListener('players-lists-updated',event=>applyRosters(event.detail));
document.addEventListener('venue-profile-ready',()=>{if(step===2)render();});
new MutationObserver(()=>{if(applying)return;if(!$('setup').hidden){step=0;render();refreshRoster();}else{localSetupOwner=false;queueSetup();}}).observe($('setup'),{attributes:true,attributeFilter:['hidden']});
try{const saved=JSON.parse(localStorage.getItem('darts.setup.preferences'));if(saved){for(const id of fields)if(saved.values?.[id]&&[...$(id).options].some(o=>o.value===saved.values[id]))change(id,saved.values[id]);if(games.some(g=>g[0]===saved.selected))chooseGame(saved.selected);}}catch{}
render();refreshRoster();

function queueSetup(){
 if(applying||!document.body.classList.contains('remote-control'))return;
 pendingSetup=$('setup').hidden?null:{selected,step,names:names().map(i=>i.value),values:Object.fromEntries([...fields,'starter'].map(id=>[id,$(id).value]))};
 clearTimeout(sendTimer);sendTimer=setTimeout(sendSetup,120);
}
async function sendSetup(){
 if(sendBusy||pendingSetup===undefined)return;
 sendBusy=true;const value=pendingSetup;pendingSetup=undefined;
 try{
  const current=await fetch('/api/setup',{cache:'no-store'}).then(r=>r.json());
  await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision,value})});
 }catch{}finally{sendBusy=false;if(pendingSetup!==undefined)void sendSetup();}
}
let setupPolling=false;
async function syncSetup(){
 if(document.body.classList.contains('remote-control')||setupPolling)return;setupPolling=true;
 try{
  const response=await fetch('/api/setup',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)return;
  const data=await response.json();if(data.version===seenVersion)return;seenVersion=data.version;
  if(localSetupOwner)return;
  if(!data.value){if(mirroring){mirroring=false;document.dispatchEvent(new Event('close-shared-setup'));}return;}
  applying=true;mirroring=true;
  document.dispatchEvent(new Event('show-shared-setup'));
  const draft=data.value;chooseGame(draft.selected);
  for(const id of fields){const value=draft.values[id];if(value!==undefined&&[...$(id).options].some(o=>o.value===value))change(id,value);}
  names().forEach((input,i)=>{input.value=draft.names[i]??`Speler ${i+1}`;input.dispatchEvent(new Event('input',{bubbles:true}));});
  change('starter',draft.values.starter||'0');step=draft.step;render();
  await Promise.resolve();
 }catch{}finally{applying=false;setupPolling=false;}
}
$('new-match-confirm').addEventListener('click',()=>{if(!document.body.classList.contains('remote-control')){localSetupOwner=true;mirroring=false;step=0;queueMicrotask(()=>{step=0;render();refreshRoster();});}});
syncSetup();setInterval(syncSetup,500);
