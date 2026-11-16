import {fourSymbols} from './four-in-row.js';
import {onlineFriendsState,refreshOnlineFriends,nucRosterLabel} from './player-rosters.js';
const $=id=>document.getElementById(id);
const games=[
 ['x01','X01','Van je startscore naar nul.','Wedstrijd','Begin op de gekozen startscore en speel precies naar nul. Kies zelf de beginregel, uitgooiregel, bullwaarde en partijvorm.'],
 ['cricket','Cricket','Sluit 15 t/m 20 en bull.','Wedstrijd','Raak 15, 16, 17, 18, 19, 20 en bull elk drie keer. Op een gesloten doel scoor je punten zolang een tegenstander dat doel nog niet heeft gesloten. Solo leveren extra treffers na het sluiten punten voor jezelf op, ook bij Cut Throat. Met No Score tel je alleen marks.'],
 ['tactics','Tactics','Sluit 10 t/m 20 en bull.','Wedstrijd','Raak 10 tot en met 20 en bull elk drie keer. Op een gesloten doel scoor je punten zolang een tegenstander dat doel nog niet heeft gesloten. Solo leveren extra treffers na het sluiten punten voor jezelf op, ook bij Cut Throat. Met No Score tel je alleen marks.'],
 ['fourinarow','4 op een rij','Verover vier vakken op rij.','Wedstrijd','Verover een getalvak met drie marks binnen dezelfde beurt: single telt 1, dubbel 2 en triple 3. Losse marks vervallen na de beurt. sB en BB claim je met één raak pijl. Maak als eerste vier vakken horizontaal, verticaal of diagonaal.'],
 ['seabattle','Zeeslag Darts','Breng de verborgen vloten tot zinken.','Wedstrijd','Iedere speler heeft drie verborgen schepen met samen 14 levens op een raster van 1 tot 20. Elke pijl op een getal valt alle tegenstanders aan. Single doet 1 schade; dubbel en triple doen maximaal 2 schade aan een scheepsvak. Water en bull geven geen schade. De laatste vloot wint. De vlootknoppen bepalen alleen welk bord je bekijkt.'],
 ['golf','Dartgolf','Zo weinig mogelijk slagen op 9 of 18 holes.','Wedstrijd','Hole 1 is getal 1, enzovoort. Dubbel telt als 1 slag, triple als 2, single als 3 en een ander getal als 5. Kies beste pijl of laatste pijl. Bij laatste pijl mag je eerder stoppen. De laagste totaalscore wint; een gelijke stand blijft gelijkspel.'],
 ['shanghai','Shanghai','Scoor op het rondegetal of gooi Shanghai.','Wedstrijd','Iedere ronde richt iedereen op hetzelfde getal: 1 tot en met 7 of 20. Alleen dat getal scoort: single een keer, dubbel twee keer en triple drie keer. Single, dubbel en triple van het doel in dezelfde beurt wint direct. Anders wint de hoogste totaalscore; gelijkspel is mogelijk.'],
 ['scram','Scram','Stop doelen of scoor op open vakken.','Wedstrijd','Iedere speler krijgt een scoringsfase. De andere spelers stoppen om beurten doelen van 1 tot en met 20 en Bull; de scoorder krijgt alleen punten op doelen die nog open zijn. Hoogste totaalscore wint.'],
 ['killer','Killer','Word KILLER en schakel tegenstanders uit.','Wedstrijd','Kies eerst met één pijl een uniek eigen getal. Drie treffers op jouw getal maken je KILLER. Single telt 1, dubbel 2 en triple 3. Daarna ontneem je tegenstanders hun drie levens door hun getal te raken. De laatste speler wint direct.'],
 ['bull41','Bull / 41','Bullmarks tegen punten boven 41.','Wedstrijd','Iedere speler krijgt een puntenscoringsfase. De anderen gooien om beurten op Bull tot 25 bullmarks; de scoorder krijgt per beurt alleen het gedeelte boven 41 als punten. Hoogste totaal wint.'],
 ['twentyone','21','Race van 1 naar Bull.','Wedstrijd','Raak jouw actuele doel. Single gaat één stap, dubbel twee en triple drie. Bereik zo snel mogelijk Bull; bij gelijkstand geven de meeste triples de doorslag.'],
 ['121','121','Checkouttraining met negen darts.','Training','Gooi jouw niveau binnen maximaal negen darts uit met dubbel-uit. Bij meerdere spelers wisselt de beurt na iedere drie darts en behoudt iedereen zijn eigen poging.'],
 ['gotcha','Gotcha','Bereik je doel en pak tegenstanders.','Training','Bouw je score op tot de gekozen doelscore. Kom je precies gelijk met een tegenstander, dan zet je die speler terug op nul.'],
 ['tenlives','Hitters Challenge','20 t/m 10 en Bull. Bewaar je levens.','Training','Speel Doubles of Triples van 20 naar 10 en daarna Bull. Een treffer geeft extra pogingen; mis je het doel, dan ga je terug of verlies je een leven.'],
 ['bobs27',"Bob's 27",'Alle dubbels onder druk trainen.','Training','Start op 27 en gooi drie pijlen op iedere dubbel van D1 tot en met D20 en daarna Bull. Treffers tellen erbij; volledig missen trekt de dubbelwaarde af.']
];
const onlineGames=new Set(['fourinarow','killer','seabattle','golf','shanghai']);
const gameVideos={
 seabattle:'180-Hitters-Zeeslag-Darts-uitleg.mp4',golf:'180-Hitters-Dartgolf-uitleg.mp4',shanghai:'180-Hitters-Shanghai-uitleg.mp4',
 x01:'180-Hitters-X01-uitleg.mp4',
 cricket:'180-Hitters-Cricket-uitleg.mp4',
 tactics:'180-Hitters-Tactics-uitleg.mp4',
 fourinarow:'180-Hitters-4-op-een-rij-uitleg.mp4',
 scram:'180-Hitters-Scram-uitleg.mp4',
 killer:'180-Hitters-Killer-uitleg.mp4',
 bull41:'180-Hitters-Bull-41-uitleg.mp4',
 twentyone:'180-Hitters-21-uitleg.mp4',
 '121':'180-Hitters-121-uitleg.mp4',
 gotcha:'180-Hitters-Gotcha-uitleg.mp4',
 tenlives:'180-Hitters-Hitters-Challenge-uitleg.mp4',
 bobs27:'180-Hitters-Bobs-27-uitleg.mp4'
};
const fields=['golf-holes','golf-scoring','shanghai-rounds','lives-mode','four-bot','start','in-mode','out','bull-mode','scoring','match-mode','legs','set-legs','max-rounds','gotcha-target','gotcha-out','participant-mode','count'];
let step=0,slot=0,teamSlot=0,memberSlot=0,venueRoster=[],mobileRoster=[],selected='x01',fourSymbolChoices=[...fourSymbols];
const venueLabel=nucRosterLabel;
let applying=false,sendTimer,sendBusy=false,pendingSetup=undefined,seenVersion=-1,mirroring=false,localSetupOwner=false;
const root=document.createElement('section');root.id='setup-wizard';$('setup').append(root);
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,action,cls){const node=el('button',text,cls);node.type='button';node.onclick=action;return node;}
function openGameVideo(url,title){
 let dialog=$('game-video-dialog');
 if(!dialog){dialog=el('dialog',undefined,'game-video-dialog');dialog.id='game-video-dialog';const heading=el('h2'),video=el('video');video.controls=true;video.playsInline=true;video.preload='metadata';const note=el('p','De video wordt rechtstreeks vanaf GitHub afgespeeld.','wizard-hint'),close=button('Sluiten',()=>dialog.close(),'wide');dialog.append(heading,video,note,close);dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();});document.body.append(dialog);}
 dialog.querySelector('h2').textContent=`Uitleg: ${title}`;const video=dialog.querySelector('video');video.src=url;dialog.showModal();video.play().catch(()=>{});
}
function change(id,value){$(id).value=String(value);$(id).dispatchEvent(new Event('change',{bubbles:true}));}
function isTeams(){return $('participant-mode').value==='teams'&&!['121','gotcha','bobs27','tenlives','fourinarow','scram','killer','bull41','twentyone','seabattle','golf','shanghai'].includes(selected);}
function teamEditors(){return [...$('names').querySelectorAll('.team-editor')];}
function names(){return isTeams()?[...$('names').querySelectorAll('input[data-team-name]')]:[...$('names').children].filter(node=>node.tagName==='LABEL').map(label=>label.querySelector('input'));}
function memberInputs(index=teamSlot){return [...(teamEditors()[index]?.querySelectorAll('input[data-member-name]')||[])];}
function allMembers(){return teamEditors().flatMap((team,index)=>memberInputs(index));}
function teamDraft(){return teamEditors().map(team=>({name:team.querySelector('input[data-team-name]').value,members:[...team.querySelectorAll('input[data-member-name]')].map(input=>input.value)}));}
function remember(){try{localStorage.setItem('darts.setup.preferences',JSON.stringify({selected,fourSymbols:fourSymbolChoices,values:Object.fromEntries(fields.map(id=>[id,$(id).value]))}));}catch{}}
function chooseGame(id){
 selected=id;const training=['121','gotcha','bobs27','tenlives'].includes(id);
 $(training?'category-training':'category-match').click();
 selected=id;
 change('game-type',training?'training':id);$('setup-form').hidden=false;
 if(training)change('training-type',id);else change('game-type',id);
 remember();
}
function move(next){step=next;render();$('setup').scrollIntoView({block:'start'});}
function options(id,title){
 const select=$(id);if(select.closest('label').hidden)return null;
 const group=el('fieldset',undefined,'wizard-option');group.dataset.field=id;group.append(el('legend',title));
 const tiles=el('div',undefined,'wizard-options');
 const friendly=id==='lives-mode'?{}:{individual:'Individuele spelers',teams:'Teams',single:id==='in-mode'?'Direct beginnen':'Direct uit',double:id==='in-mode'?'Dubbel-in':'Dubbel-uit',master:id==='in-mode'?'Master-in':'Master-uit',legs:'Legs',sets:'Sets',off:'Vrij spelen',standard:'Hoogste score','cut-throat':'Laagste score','no-score':'Alleen sluiten'};
 for(const option of select.options){if(option.hidden)continue;
  const tile=button(friendly[option.value]||option.textContent,()=>{change(id,option.value);remember();render();});
  tile.disabled=option.disabled;tile.setAttribute('aria-pressed',String(select.value===option.value));tiles.append(tile);
 }
 group.append(tiles);return group;
}
function applyFourSymbols(){if(selected!=='fourinarow')return;names().forEach((input,index)=>input.dataset.fourSymbol=fourSymbolChoices[index]);}
function syncFourSymbolsFromInputs(){
 if(selected!=='fourinarow')return;
 const supplied=names().map(input=>input.dataset.fourSymbol);
 if(supplied.length&&supplied.every(symbol=>fourSymbols.includes(symbol))&&new Set(supplied).size===supplied.length){
  const used=new Set(supplied);fourSymbolChoices=[...supplied,...fourSymbols.filter(symbol=>!used.has(symbol))];
 }
 applyFourSymbols();
}
function selectFourSymbol(index,symbol){
 const other=fourSymbolChoices.indexOf(symbol);if(other!==index)[fourSymbolChoices[index],fourSymbolChoices[other]]=[fourSymbolChoices[other],fourSymbolChoices[index]];
 applyFourSymbols();remember();render();
}
function renderFourSymbols(content){
 const section=el('section',undefined,'wizard-four-symbols');section.append(el('h3','Kies het symbool van iedere speler'),el('p','Ieder symbool kan maar één keer worden gebruikt.','wizard-hint'));
 names().forEach((input,index)=>{const row=el('div',undefined,'wizard-symbol-player');row.append(el('strong',input.value||`Speler ${index+1}`));const choices=el('div',undefined,'wizard-symbol-choices');for(const symbol of fourSymbols){const choice=button(symbol,()=>selectFourSymbol(index,symbol));choice.setAttribute('aria-label',`${input.value||`Speler ${index+1}`}: ${symbol}`);choice.setAttribute('aria-pressed',String(fourSymbolChoices[index]===symbol));choices.append(choice);}row.append(choices);section.append(row);});
 content.append(section);applyFourSymbols();
}
function refreshNameLabels(){
 root.querySelectorAll('.wizard-player-card').forEach((card,index)=>{card.querySelector('strong').textContent=names()[index]?.value||`Speler ${index+1}`;});
 root.querySelectorAll('.wizard-team').forEach((team,index)=>team.querySelectorAll('.wizard-team-slots strong').forEach((name,i)=>{name.textContent=memberInputs(index)[i]?.value||'Kies naam';}));
 root.querySelectorAll('.wizard-symbol-player').forEach((row,index)=>{
  const name=names()[index]?.value||`Speler ${index+1}`;row.querySelector('strong').textContent=name;
  row.querySelectorAll('button').forEach((choice,i)=>choice.setAttribute('aria-label',`${name}: ${fourSymbols[i]}`));
 });
 root.querySelectorAll('.wizard-option[data-field="starter"] button').forEach((choice,i)=>{choice.textContent=$('starter').options[i]?.textContent||'';});
 const summary=root.querySelector('.wizard-summary');
 if(summary)summary.lastElementChild.textContent=isTeams()?teamDraft().map(team=>`${team.name}: ${team.members.filter(Boolean).join(', ')}`).join(' | '):names().map(input=>input.value).join(' → ');
}
function updateRosterPickers(){
 const friends=onlineFriendsState().members.map(member=>member.name);
 for(const select of root.querySelectorAll('.wizard-roster-select')){
  const source=select.nameSource,placeholder=el('option',venueRoster.length||mobileRoster.length||friends.length?'Kies uit spelerslijst':'Geen opgeslagen spelers - typ een naam');placeholder.value='';
  const groups=[];
  for(const [title,list] of [[venueLabel(),venueRoster],['Mijn spelers',mobileRoster],['Online vrienden',friends]]){
   if(!list.length)continue;
   const group=el('optgroup');group.label=title;
   for(const name of list){const option=el('option',name);option.value=name;option.disabled=allMembers().concat(isTeams()?[]:names()).some(input=>input!==source&&input.value===name);group.append(option);}
   groups.push(group);
  }
  select.replaceChildren(placeholder,...groups);select.value=[...venueRoster,...mobileRoster,...friends].includes(source.value)?source.value:'';select.disabled=!groups.length;
 }
}
function namePicker(source,title,pickerTitle){
 const section=el('section',undefined,'wizard-name-picker');
 const label=el('label',title,'wizard-custom'),input=el('input');input.value=source?.value||'';input.maxLength=24;input.autocomplete='off';input.placeholder='Typ een naam';input.spellcheck=false;input.enterKeyHint='done';
 const apply=value=>{
  if(!source)return;source.value=value;source.dispatchEvent(new Event('input',{bubbles:true}));
  if(input.value!==value)input.value=value;refreshNameLabels();updateRosterPickers();queueSetup();
 };
 input.oninput=()=>apply(input.value);
 input.onfocus=()=>{if(/^Speler [1-4]$/.test(input.value))input.select();};
 label.append(input);section.append(label);
 const rosterLabel=el('label',pickerTitle,'wizard-roster-label'),select=el('select',undefined,'wizard-roster-select');select.nameSource=source;
 select.onchange=()=>{if(select.value)apply(select.value);};rosterLabel.append(select);section.append(rosterLabel);
 return section;
}
function setBotLevel(index,level){
 const field=names()[index],old=Number(field.dataset.botLevel)||0;field.dataset.botLevel=String(level);
 if(level){if(!old)field.dataset.humanName=field.value;field.value=`BOT ${level} #${index+1}`;}
 else if(old)field.value=field.dataset.humanName||`Speler ${index+1}`;
 field.dispatchEvent(new Event('input',{bubbles:true}));render();
}
function renderIndividuals(content){
 syncFourSymbolsFromInputs();slot=Math.min(slot,names().length-1);
 content.append(el('p','Vul bij iedere speler een naam in of kies iemand uit de spelerslijst.','wizard-hint'));
 const slots=el('div',undefined,'wizard-slots wizard-player-cards');
 names().forEach((input,index)=>{
  const card=el('section',undefined,'wizard-player-card');card.dataset.player=String(index);
  const choose=button('',()=>{slot=index;render();},'wizard-player-select');choose.setAttribute('aria-pressed',String(index===slot));choose.append(el('small',`Speler ${index+1}`),el('strong',input.value));
  if(selected==='fourinarow')choose.append(el('span',fourSymbolChoices[index],'wizard-slot-symbol'));card.append(choose);
  if(Number(input.dataset.botLevel)){
   card.append(el('p','Dit is een BOT. Kies hieronder voor een menselijke speler om zelf een naam in te voeren.','wizard-hint'),button('Menselijke speler',()=>setBotLevel(index,0),'wizard-human-switch'));
  }else card.append(namePicker(input,`Naam speler ${index+1}`,`Kies speler ${index+1} uit spelerslijst`));
  slots.append(card);
 });content.append(slots);
 const type=el('fieldset',undefined,'wizard-option wizard-bot-choice');type.append(el('legend',`Speler ${slot+1}: mens of BOT`));
 const types=el('div',undefined,'wizard-options');
 for(const [level,label] of [[0,'Speler'],[40,'BOT 40'],[50,'BOT 50']]){const choice=button(label,()=>setBotLevel(slot,level));choice.setAttribute('aria-pressed',String((Number(names()[slot]?.dataset.botLevel)||0)===level));types.append(choice);}
 type.append(types);
 const explanation=el('details',undefined,'wizard-bot-explanation');explanation.append(el('summary','Uitleg BOT-niveaus'),el('p','40 en 50 zijn basisgemiddelden per drie darts bij 501, dubbel-uit. Na minstens negen menselijke darts stijgt de BOT alleen als jouw gemiddelde minstens 10 boven de basis ligt. Hij richt zich dan op 5 onder jouw gemiddelde, tot niveau 100. Cricket/Tactics gebruiken marks als maatstaf. Bij andere trainingen blijft het basisniveau gelden. Een BOT neemt één spelersplek in, ook met vier spelers.','wizard-hint'));type.append(explanation);content.append(type);
 if(selected==='fourinarow')renderFourSymbols(content);
}
function renderTeams(content){
 const editors=teamEditors();teamSlot=Math.min(teamSlot,editors.length-1);memberSlot=Math.min(memberSlot,memberInputs().length-1);
 content.append(el('p','Maak per wedstrijd nieuwe teams. Selecteer een naam om die te wijzigen of weg te halen.','wizard-hint'));
 editors.forEach((team,index)=>{
  const panel=el('fieldset',undefined,'wizard-team');panel.append(el('legend',`Team ${index+1}`));
  const sourceName=team.querySelector('input[data-team-name]');
  const nameLabel=el('label','Teamnaam','wizard-team-name'),nameInput=el('input');nameInput.value=sourceName.value;nameInput.maxLength=24;nameInput.oninput=()=>{sourceName.value=nameInput.value;sourceName.dispatchEvent(new Event('input',{bubbles:true}));queueSetup();};nameLabel.append(nameInput);panel.append(nameLabel);
  const slots=el('div',undefined,'wizard-slots wizard-team-slots');
  memberInputs(index).forEach((input,i)=>{const b=button('',()=>{teamSlot=index;memberSlot=i;render();});b.setAttribute('aria-pressed',String(index===teamSlot&&i===memberSlot));b.append(el('small',`Naam ${i+1}`),el('strong',input.value||'Kies naam'));slots.append(b);});panel.append(slots);
  const actions=el('div',undefined,'wizard-team-actions');
  const add=button('Naam toevoegen',()=>{team.querySelector('.team-member-add').click();teamSlot=index;memberSlot=memberInputs(index).length-1;render();});add.disabled=memberInputs(index).length>=5;actions.append(add);
  const remove=button('Geselecteerde naam weghalen',()=>{if(index!==teamSlot)return;const rows=team.querySelectorAll('.team-member-row');rows[memberSlot]?.querySelector('.team-member-remove').click();memberSlot=Math.min(memberSlot,memberInputs(index).length-1);render();});remove.disabled=index!==teamSlot||memberInputs(index).length<=1;actions.append(remove);panel.append(actions);content.append(panel);
 });
 const active=memberInputs()[memberSlot];
 content.append(namePicker(active,`Naam ${memberSlot+1} van ${names()[teamSlot]?.value||`Team ${teamSlot+1}`}`,'Kies een naam uit spelerslijst'));

}
function render(){
 root.replaceChildren();
 const topbar=el('div',undefined,'wizard-topbar');topbar.append(button('TERUG',()=>{if(step)move(step-1);else if(!$('cancel').hidden)$('cancel').click();else document.dispatchEvent(new Event('open-play-menu'));},'wizard-back'));root.append(topbar);
 const nav=el('nav',undefined,'wizard-steps');nav.setAttribute('aria-label','Partij instellen');
 ['Spel','Instellingen','Spelers'].forEach((name,i)=>{const b=button(`${i+1} ${name}`,()=>move(i));b.disabled=i>step;b.setAttribute('aria-current',i===step?'step':'false');nav.append(b);});root.append(nav);
 const titles=['Wat gaan we spelen?','Maak het jouw partij',isTeams()?'Welke teams doen er mee?':'Wie doen er mee?'];root.append(el('h1',titles[step]));
 const content=el('div',undefined,'wizard-content');root.append(content);
 if(step===0){
  content.append(el('p','Kies een spel om te beginnen.','wizard-hint'));
  if(document.body.classList.contains('editing-current-match'))content.append(el('p','Je past de huidige partij aan. De app behoudt de stand waar dat technisch mogelijk is en waarschuwt vóór een wijziging waarvoor de score opnieuw moet beginnen.','wizard-info'));
  for(const category of ['Wedstrijd','Training']){content.append(el('h2',category));const tiles=el('div',undefined,'wizard-games');for(const [id,name,description,cat] of games.filter(game=>game[3]===category)){const tile=button('',()=>{chooseGame(id);move(1);},'wizard-game');tile.setAttribute('aria-pressed',String(selected===id));tile.append(el('strong',name),el('span',description),el('small','Kiezen →'));if(onlineGames.has(id))tile.append(el('span','Online mogelijk','wizard-online-badge'));tiles.append(tile);}content.append(tiles);}
 }else if(step===1){
  const game=games.find(item=>item[0]===selected);
  content.append(el('p',game?.[4]||'','wizard-info wizard-game-description'));
  if(onlineGames.has(selected)){
   const online=button('Online dartbaan maken',()=>document.dispatchEvent(new CustomEvent('open-online-for-game',{detail:{game:selected,options:{golfHoles:Number($('golf-holes').value),golfScoring:$('golf-scoring').value,shanghaiRounds:Number($('shanghai-rounds').value)}}})),'wizard-online-start');online.id='wizard-online-start';content.append(online,el('p','Speel samen op afstand. Maak een dartbaan en nodig online vrienden uit.','wizard-online-note'));
  }
  if(gameVideos[selected]){
   const video=el('a','▶ Bekijk uitlegvideo','wizard-video-link');
   video.href=`https://github.com/Axelman8/180-hitters/releases/latest/download/${gameVideos[selected]}`;
   video.onclick=event=>{event.preventDefault();openGameVideo(video.href,game?.[1]||selected);};content.append(video);
  }
  content.append(el('p',games.find(game=>game[0]===selected)?.[1]+' · tik op een tegel om te kiezen','wizard-hint'));
  const main=[['golf-holes','Aantal holes'],['golf-scoring','Puntentelling'],['shanghai-rounds','Aantal rondes'],['lives-mode','Doubles of Triples'],['start','Startscore'],['in-mode','Beginnen'],['out','Uitgooien'],['bull-mode','Bullwaarde'],['gotcha-target','Doelscore'],['gotcha-out','Uitgooien'],['scoring','Puntentelling'],['match-mode','Partijvorm'],['legs',$('target-text').textContent],['set-legs','Legs per set'],['max-rounds','Maximaal aantal rondes']];
  for(const [id,title] of main){const group=options(id,title);if(group)content.append(group);}
  if(selected==='tenlives')content.append(el('p','Iedereen begint met 10 levens en 3 pogingen op 20. Raak: resterende pijlen + 3 naar het volgende doel. Pogingen op: één doel terug; alleen op 20 kost dit een leven. Dan wisselt de speler. Bull (50) wint.','wizard-info'));
  if(selected==='121')content.append(el('p','Negen darts om uit te gooien. Je niveau begint bij 121.','wizard-info'));
  if(selected==='bobs27')content.append(el('p',"Start op 27. Gooi drie pijlen op D1 t/m D20 en daarna bull. Treffer: punten erbij; volledig missen: punten eraf.",'wizard-info'));
 }else{
  if(!['121','gotcha','bobs27','tenlives','fourinarow','scram','killer','bull41','twentyone','seabattle','golf','shanghai'].includes(selected)){const mode=options('participant-mode','Spelers of teams');if(mode)content.append(mode);}
  const count=options('count',isTeams()?'Aantal teams':'Aantal spelers');if(count)content.append(count);
  if(isTeams())renderTeams(content);else renderIndividuals(content);
  const starter=options('starter','Wie begint?');if(starter)content.append(starter);
  const summary=el('div',undefined,'wizard-summary');summary.append(el('strong',games.find(game=>game[0]===selected)?.[1]));
  const ids=selected==='golf'?['golf-holes','golf-scoring']:selected==='shanghai'?['shanghai-rounds']:selected==='tenlives'?['lives-mode']:selected==='fourinarow'?['four-bot']:['scram','killer','bull41','twentyone','seabattle','golf','shanghai'].includes(selected)?[]:selected==='x01'?['start','in-mode','out','match-mode','legs']:selected==='gotcha'?['gotcha-target','gotcha-out']:selected==='bobs27'?[]:['scoring','match-mode','legs'];
  summary.append(el('p',ids.filter(id=>!$(id).closest('label').hidden).map(id=>id==='legs'?`Eerste tot ${$(id).value} ${$('match-mode').value==='sets'?'sets':'legs'}`:$(id).selectedOptions[0]?.textContent).join(' · ')),el('p',isTeams()?teamDraft().map(team=>`${team.name}: ${team.members.filter(Boolean).join(', ')}`).join(' | '):names().map(input=>input.value).join(' → ')));content.append(summary);
 }
 const actions=el('div',undefined,'wizard-actions');
 if(step)actions.append(button(step===2?(document.body.classList.contains('editing-current-match')?'Wijzigingen toepassen →':'Start partij →'):'Kies spelers →',()=>{if(step===1){move(2);return;}const required=isTeams()?allMembers().concat(names()):names();if(required.some(input=>!input.value.trim())){root.querySelector('.wizard-custom input')?.focus();return;}applyFourSymbols();remember();$('setup-form').requestSubmit();},'primary wizard-next'));
 root.append(actions);updateRosterPickers();queueSetup();
}
function applyRosters(data){
 const sort=list=>(list||[]).slice().sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}));
 venueRoster=sort(data.venuePlayers??data.players??[]);
 let personal=data.mobilePlayers??[];
 try{if(window.DartsAndroid?.getMobilePlayers)personal=JSON.parse(window.DartsAndroid.getMobilePlayers());}catch{}
 mobileRoster=sort(personal);updateRosterPickers();
}
async function refreshRoster(){void refreshOnlineFriends();try{const response=await fetch('/api/players',{cache:'no-store'});if(response.ok)applyRosters(await response.json());}catch{}}
document.addEventListener('online-friends-updated',updateRosterPickers);
document.addEventListener('players-lists-updated',event=>applyRosters(event.detail));
document.addEventListener('venue-profile-ready',updateRosterPickers);
new MutationObserver(()=>{if(applying)return;if(!$('setup').hidden){step=0;render();refreshRoster();}else{localSetupOwner=false;queueSetup();}}).observe($('setup'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('tablet-edit-match-open',event=>{if(event.detail?.selected&&games.some(game=>game[0]===event.detail.selected))selected=event.detail.selected;step=0;render();refreshRoster();});
try{const saved=JSON.parse(localStorage.getItem('darts.setup.preferences'));if(saved){for(const id of fields)if(saved.values?.[id]&&[...$(id).options].some(option=>option.value===saved.values[id]))change(id,saved.values[id]);if(Array.isArray(saved.fourSymbols)&&saved.fourSymbols.length===4&&saved.fourSymbols.every(symbol=>fourSymbols.includes(symbol))&&new Set(saved.fourSymbols).size===4)fourSymbolChoices=[...saved.fourSymbols];if(games.some(game=>game[0]===saved.selected))chooseGame(saved.selected);}}catch{}
render();refreshRoster();

function queueSetup(){
 if(applying||!document.body.classList.contains('remote-control'))return;
 pendingSetup=$('setup').hidden?null:{selected,step,names:names().map(input=>input.value),botLevels:names().map(input=>Number(input.dataset.botLevel)||0),teams:isTeams()?teamDraft():null,fourSymbols:[...fourSymbolChoices],values:Object.fromEntries([...fields,'starter'].map(id=>[id,$(id).value]))};
 clearTimeout(sendTimer);sendTimer=setTimeout(sendSetup,120);
}
async function sendSetup(){
 if(sendBusy||pendingSetup===undefined)return;
 sendBusy=true;const value=pendingSetup;pendingSetup=undefined;
 try{const current=await fetch('/api/setup',{cache:'no-store'}).then(response=>response.json());await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision,value})});}catch{}finally{sendBusy=false;if(pendingSetup!==undefined)void sendSetup();}
}
let setupPolling=false;
async function syncSetup(){
 if(document.body.classList.contains('remote-control')||setupPolling)return;setupPolling=true;
 try{
  const response=await fetch('/api/setup',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)return;
  const data=await response.json();if(data.version===seenVersion)return;seenVersion=data.version;if(localSetupOwner)return;
  if(!data.value){if(mirroring){mirroring=false;document.dispatchEvent(new Event('close-shared-setup'));}return;}
  applying=true;mirroring=true;document.dispatchEvent(new Event('show-shared-setup'));
  const draft=data.value;chooseGame(draft.selected);if(Array.isArray(draft.fourSymbols)&&draft.fourSymbols.length===4&&draft.fourSymbols.every(symbol=>fourSymbols.includes(symbol))&&new Set(draft.fourSymbols).size===4)fourSymbolChoices=[...draft.fourSymbols];
  for(const id of fields){const value=draft.values[id];if(value!==undefined&&[...$(id).options].some(option=>option.value===value))change(id,value);}
  if(draft.teams&&isTeams()){
   teamEditors().forEach((team,index)=>{
    const saved=draft.teams[index];if(!saved)return;team.querySelector('input[data-team-name]').value=saved.name;
    const container=team.querySelector('.team-members-editor');while(container.children.length<saved.members.length)team.querySelector('.team-member-add').click();while(container.children.length>Math.max(1,saved.members.length))container.lastElementChild.querySelector('.team-member-remove').click();
    memberInputs(index).forEach((input,i)=>{input.value=saved.members[i]||'';input.dispatchEvent(new Event('input',{bubbles:true}));});
   });
  }else names().forEach((input,i)=>{input.value=draft.names[i]??`Speler ${i+1}`;input.dataset.botLevel=String(draft.botLevels?.[i]||0);input.dispatchEvent(new Event('input',{bubbles:true}));});
  change('starter',draft.values.starter||'0');step=draft.step;render();await Promise.resolve();
 }catch{}finally{applying=false;setupPolling=false;}
}
document.addEventListener('new-match-setup-open',()=>{if(!document.body.classList.contains('remote-control')){localSetupOwner=true;mirroring=false;step=0;queueMicrotask(()=>{step=0;render();refreshRoster();});}});
syncSetup();setInterval(syncSetup,500);
