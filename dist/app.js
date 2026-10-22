import {renderLives} from './ten-lives.js';
import {matchSummary,renderLegTable} from './match-summary.js';
import {renderScreenOverview} from './screen-overview.js';
import {replayTurns} from './replay.js';
import {celebrateScore} from './celebration.js';
import {showWinner} from './winner.js';
import {newMatch,applyTurn,nextLeg,validX01Total,checkout,setupShot,possibleTotal,makeDart,previewTurn,previewCricket,previewGotcha,previewBobs27,playerStats} from './engine.js';
const phoneLayout=matchMedia('(max-width:600px)');
function mobileLayout(){document.body.classList.toggle('remote-control',!!window.DartsAndroid||new URLSearchParams(location.search).has('android')||new URLSearchParams(location.search).get('remote')==='1'||phoneLayout.matches);}
phoneLayout.addEventListener('change',mobileLayout);mobileLayout();
const $=id=>document.getElementById(id),key='oche.match.v1';
const androidLocal=window.DartsAndroid?.isLocalMode?.()===true;
const connectedLabel=androidLocal?'Lokaal op deze telefoon':'Verbonden met NUC';
const savedLabel=androidLocal?'Lokaal opgeslagen':'Opgeslagen op NUC';
let historyOpen=false;
try{historyOpen=localStorage.getItem('axelman8.historyOpen')==='true';}catch{}
function renderHistoryMenu(){
 document.body.classList.toggle('history-open',historyOpen);
 $('toggle-history').setAttribute('aria-expanded',String(historyOpen));
 $('toggle-history').textContent=historyOpen?'Beurtbediening inklappen':'Beurtbediening uitklappen';
}
$('toggle-history').onclick=()=>{historyOpen=!historyOpen;try{localStorage.setItem('axelman8.historyOpen',String(historyOpen));}catch{}renderHistoryMenu();};
renderHistoryMenu();
let state=null,undo=[],future=[],pendingTurns=[],pendingReason='',editingPending=false,historyNavigation=false,entry='',dartList=[],multiplier=1,mode='total',preferredMode='total',modeOverride=null,editTurn=null,gotchaRule='end',resetTargetsOpen=false;
const cricket=()=>state&&['cricket','tactics'].includes(state.game);
const totalAllowed=()=>!!state&&!['bobs27','tenlives'].includes(state.game);
function renderLivesGame(){renderLives(state,{dart:hit=>commit({trainingHit:hit}),undo:()=>$('undo').click(),redo:()=>goForward(),canUndo:undo.length>0,canRedo:future.length>0,toggle:()=>$('toggle-input').click()});}

const namesOfRules={single:'Straight',double:'Double',master:'Master'};
const scoringNames={standard:'Standard','cut-throat':'Cut Throat','no-score':'No Score'};
function migrate(s){
 if(s.version===2)return s;
 const base=newMatch(s.players.map(p=>p.name),s.start,s.out,s.target,{maxRounds:0});
 return {...base,...s,version:2,players:s.players.map((p,i)=>({...base.players[i],...p,setLegs:p.legs})),turns:s.history.filter(h=>h.leg===s.leg).length,round:Math.floor(s.history.filter(h=>h.leg===s.leg).length/s.players.length)+1};
}
try{const saved=JSON.parse(localStorage.getItem(key));if([1,2].includes(saved?.state?.version)&&saved.state.players?.length){state=migrate(saved.state);undo=(saved.undo||[]).map(s=>migrate(s.historyLength===undefined?s:{...s,history:state.history.slice(0,s.historyLength)}));}}catch{}
let revision=-1, ready=false, syncing=false, busy=false, confirmed=null;
const draftOwner=Date.now().toString(36)+Math.random().toString(36).slice(2);
let sharedDraft=null,draftSequence=0,draftWrites=0;
async function publishDraft(){
 if(!state||state.phase!=='playing'||!ready||busy)return;
 const payload={revision,owner:draftOwner,seq:++draftSequence,hits:dartList.map(({number,mult})=>({number,mult})),entry:mode==='total'&&!cricket()?entry:''};
 draftWrites++;
 try{const res=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(4000)});if(!res.ok&&payload.revision===revision)message('Pijlen niet gesynchroniseerd. Controleer de stand.');}catch{if(payload.revision===revision)message('Pijlen niet gesynchroniseerd. Controleer je verbinding.');}
 finally{draftWrites--;}

}
const localScreen=['127.0.0.1','localhost','::1'].includes(location.hostname);
function packState(s){const {history,...rest}=s;return {...rest,historyLength:history.length};}
function snapshot(){
 const history= [state,...future.map(item=>item.state)].filter(Boolean).reduce((all,s)=>s.history.length>all.length?s.history:all,[]);
 return {state,gotchaRule,inputPreferenceVersion:1,preferredMode,modeOverride,editTurn,historyNavigation,pendingTurns,pendingReason,editingPending,undo:undo.map(packState),future:future.map(item=>({...item,state:packState(item.state)})),timelineHistory:future.length?history:undefined};
}
function restore(match){
 state=match?.state||null;editTurn=match?.editTurn||null;gotchaRule=match?.gotchaRule==='manual'?'manual':'end';
 preferredMode=match?.inputPreferenceVersion===1&&match?.preferredMode==='dart'?'dart':'total';
 modeOverride=(match?.inputPreferenceVersion===1||editTurn)&&['total','dart'].includes(match?.modeOverride)?match.modeOverride:null;
 const history=match?.timelineHistory||state?.history||[];
 const unpack=s=>{if(s.historyLength===undefined)return s;const {historyLength,...rest}=s;return {...rest,history:history.slice(0,historyLength)};};
 undo=(match?.undo||[]).map(unpack);
 future=(match?.future||[]).map(item=>({...item,state:unpack(item.state)}));
 pendingTurns=match?.pendingTurns||[];pendingReason=match?.pendingReason||'';editingPending=!!match?.editingPending;
 historyNavigation=!!match?.historyNavigation;
}
function cache(){
 const value=JSON.stringify(snapshot());
 try{localStorage.setItem(key,value);}catch{}
 try{window.DartsAndroid?.saveSnapshot?.(value);}catch{}
}
function connection(ok,text){ready=ok;$('saved').textContent=text;$('connection-status').textContent=text;$('connection-status').classList.toggle('offline',!ok);}
function receive(data){
 if(!data.match?.historyNavigation)celebrateScore(confirmed,data.match);
 revision=data.revision;confirmed=data.match;sharedDraft=null;
 restore(data.match);cache();
 for(const d of document.querySelectorAll('dialog[open]'))if(!['players-dialog','network-dialog','layout-dialog'].includes(d.id))d.close();
 resetInput();restoreTurnInput();render();
}
async function persist(keepModeOverride=false,restoredTurn=null){
 editTurn=restoredTurn;
 // Only restored historical input temporarily overrides the saved preference.
 if(!keepModeOverride)modeOverride=null;
 busy=true;
 try{
  const res=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,match:snapshot()}),signal:AbortSignal.timeout(5000)});
  const data=await res.json();
  if(res.status===409){receive(data);connection(true,connectedLabel);message('Een ander apparaat heeft de partij gewijzigd. Controleer de stand en voer je beurt opnieuw in.');return false;}
  if(!res.ok)throw Error(data.error||'Opslaan mislukt');
  if(!data.match?.historyNavigation)celebrateScore(confirmed,data.match);
  revision=data.revision;confirmed=data.match;sharedDraft=null;cache();connection(true,savedLabel);return true;
 }catch(e){restore(confirmed);resetInput();render();connection(false,'Geen bevestiging van NUC - wacht op verbinding');message('Controleer de stand zodra de verbinding terug is voordat je opnieuw invoert.');return false;}
 finally{busy=false;}
}
async function synchronize(){
 if(syncing||busy||draftWrites)return;syncing=true;const requestedRevision=revision,requestedDraftSequence=draftSequence;
 try{
  const res=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!res.ok)throw Error();
  const data=await res.json();
  if(busy||revision!==requestedRevision)return;
  if(data.match===null&&revision===-1&&localScreen&&state){revision=data.revision;if(!await persist())return;}
  else if(data.revision!==revision)receive(data);
  if(!draftWrites&&requestedDraftSequence===draftSequence){
   const draft=data.draft?.revision===revision?data.draft:null;
   const hits=draft?.hits||[];
   const nextEntry=draft?draft.entry||'':editTurn&&!editTurn.hits?String(editTurn.score??0):'';
   if(entry!==nextEntry){entry=nextEntry;renderInput();}
   const next=hits.map(d=>makeDart(d.number,d.mult));
   if(JSON.stringify(next)!==JSON.stringify(dartList)){
    sharedDraft=null;dartList=next;multiplier=1;
    if(next.length&&!(cricket()&&mode==='total'))setMode('dart');
    message();renderInput();
   }
  }
  connection(true,connectedLabel);
 }catch{connection(false,'Geen verbinding met NUC - invoer tijdelijk geblokkeerd');}
 finally{syncing=false;}
}
for(const type of ['click','submit','keydown'])document.addEventListener(type,e=>{
 if((!ready||busy)&&!e.target.closest('#header-menu summary, #layout-open, #layout-dialog, #toggle-toolbar, #mobile-dock, #fullscreen, #open-kiosk, #network-open, #network-dialog, #android-app-action, #android-update-action, #android-download-dialog')){e.preventDefault();e.stopImmediatePropagation();}
},true);
function message(text=''){$('message').textContent=text;}
function button(text,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=handler;return b;}
function resetInput(){resetTargetsOpen=false;document.querySelectorAll('#gotcha-targets input').forEach(el=>el.checked=false);entry='';dartList=[];multiplier=1;message();renderInput();}
function renderInput(){
 if(state?.game==='tenlives'){renderLivesGame();return;}
 $('training-status').hidden=!state?.training121&&state?.game!=='bobs27';
 if(state?.training121){
  const live=previewTurn(state,dartList),used=state.trainingDarts+(live.bust?3:dartList.length);
  $('training-status').textContent=`Poging ${state.leg} | Start ${state.start} | ${Math.max(0,9-used)} van 9 darts over`;
 }
 if(state?.game==='bobs27'){
  const live=previewBobs27(state,dartList),target=live.target===25?'Bull':'D'+live.target;
  $('training-status').textContent=`${state.players[state.active].name} | Ronde ${state.round} van 21 | Doel ${target} | Score ${live.score} | ${live.hits} raak`;
 }
 $('entry').textContent=entry||'0';
 $('gotcha-total-options').hidden=state?.game!=='gotcha';
 $('gotcha-targets').hidden=!resetTargetsOpen;
 $('gotcha-reset').setAttribute('aria-expanded',String(resetTargetsOpen));
 $('gotcha-reset').disabled=state?.phase!=='playing'||!state?.players.some((p,i)=>i!==state.active&&p.remaining>0);
 $('gotcha-targets').replaceChildren(...(state?.game==='gotcha'?state.players:[]).flatMap((p,i)=>{
  if(i===state.active||p.remaining<=0)return [];
  return [button(`${p.name} (${p.remaining}) op nul`,()=>resetGotchaOpponent(i))];
 }));
 $('gotcha-reset-summary').hidden=true;
 const opening=state?.game==='x01'&&!state.players[state.active].opened;
 $('total-rule-note').hidden=!opening&&state?.game!=='gotcha';
 $('total-rule-note').textContent=opening?`${state.inMode==='double'?'Dubbel-in':'Master-in'}: tel alleen punten vanaf de eerste geldige ${state.inMode==='double'?'dubbel':'dubbel of triple'}. Nog niet in? Vul 0 in.`:state?.game==='gotcha'?'Gelijke eindscore zet een tegenstander automatisch op nul. Gebruik de knop voor tussentijdse treffers.':'';
 $('dart-slots').replaceChildren(...Array.from({length:3},(_,i)=>{const el=document.createElement('span');el.textContent=dartList[i]?.label||'—';return el;}));
 document.querySelectorAll('[data-multiplier]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.multiplier)===multiplier));
 renderCheckout();if(cricket())renderBoard();
 renderScreenOverview(state,mode,entry,dartList);
}
function renderCheckout(){
 if(!state||cricket())return;
 if(state.game==='gotcha'){renderGotcha();return;}
 if(state.game==='bobs27'){renderBobs27();return;}
 $('points-preview').hidden=true;
 const live=mode==='dart',preview=previewTurn(state,live?dartList:[]),p=state.players[state.active];
 document.querySelectorAll('#players .remaining').forEach((el,i)=>{
 if(!state.players[i])return;
 const pending=i===state.active&&live&&state.phase==='playing';
 el.textContent=pending?preview.remaining:state.players[i].remaining;
 el.classList.toggle('pending-points',pending&&dartList.length>0&&preview.remaining!==p.remaining);
 });
 const opening=$('players').children[state.active]?.querySelector('.player-statistics span:last-child b');
 if(opening)opening.textContent=preview.opened?p.best:'NOG IN';
 let title, note;
 if(preview.bust){title='Bust - '+p.remaining+' blijft staan';note='De beurt wordt automatisch opgeslagen.';}
 else if(preview.finished){title='Uitgegooid!';note='De uitgooi wordt automatisch opgeslagen.';}
 else if(!preview.dartsLeft){title=preview.remaining+' over';note='Drie pijlen ingevoerd. De beurt wordt automatisch opgeslagen.';}
 else if(!preview.opened){title=namesOfRules[state.inMode]+'-in nodig';note=preview.dartsLeft+' pijlen over. Pijlen tellen pas vanaf een geldige opening.';}
 else {title=preview.remaining+' over - '+preview.dartsLeft+(preview.dartsLeft===1?' pijl':' pijlen');
  note=preview.route?'Mogelijke uitgooi met de resterende pijlen.':'Geen uitgooi mogelijk met de resterende pijlen.';
  note+=live?' Na de laatste pijl gaat de beurt automatisch door.':' Tik op Per pijl om het advies na iedere worp bij te werken.';
 }
 const setup=state.phase==='playing'&&preview.opened&&!preview.bust&&!preview.finished&&!preview.route?setupShot(preview.remaining,state.out,preview.dartsLeft,state.bull):null;
 if(setup)note=`Advies laatste pijl: ${setup.label}. Dan blijft ${setup.remaining} over voor ${setup.next.join(' ? ')} in je volgende beurt.`;
 $('checkout-title').textContent=title;$('checkout-note').textContent=note;
 $('checkout').replaceChildren(...(preview.route||(setup?[setup.label]:['-'])).map(t=>{const b=document.createElement('b');b.textContent=t;return b;}));
 const ended=live&&(preview.bust||preview.finished||dartList.length===3);
 $('board-keys').querySelectorAll('button').forEach(b=>b.disabled=ended||state.phase!=='playing');
}
function renderBobs27(){
 const pending=state.phase==='playing'?dartList:[],v=previewBobs27(state,pending),p=state.players[state.active],target=v.target===25?'Bull':'D'+v.target;
 document.querySelectorAll('#players .remaining').forEach((score,i)=>{const active=i===state.active;score.textContent=active?v.score:state.players[i].remaining;score.classList.toggle('pending-points',active&&v.score!==p.remaining);});
 $('points-preview').hidden=!pending.length;$('points-preview').textContent=pending.length?`${v.hits} van ${pending.length} pijlen raak op ${target}`:'';
 $('checkout-title').textContent=`Doel: ${target}`;
 $('checkout-note').textContent=`Drie pijlen. Iedere treffer is +${v.value}; bij nul treffers gaat ${v.value} van je score af. Bij 0 of lager stopt de training.`;
 $('checkout').replaceChildren(...[target,`${v.hits} raak`].map(t=>{const b=document.createElement('b');b.textContent=t;return b;}));
 $('board-keys').querySelectorAll('button').forEach(b=>b.disabled=pending.length===3||state.phase!=='playing');
}
function renderGotcha(){
 const pending=state.phase==='playing'?dartList:[],v=previewGotcha(state,pending),p=v.players[state.active];
 document.querySelectorAll('#players .remaining').forEach((el,i)=>{if(!v.players[i])return;el.textContent=v.players[i].remaining;el.classList.toggle('pending-points',v.players[i].remaining!==state.players[i].remaining);});
 $('points-preview').hidden=!v.resets.length;$('points-preview').textContent='GOTCHA! '+v.resets.map(i=>state.players[i].name+' naar 0').join(' / ');
 $('checkout-title').textContent=v.bust?'Bust - terug naar '+p.remaining:v.finished?state.start+' bereikt!':(state.start-p.remaining)+' nodig om te winnen';
 $('checkout-note').textContent=v.bust?'Je eigen beurt vervalt. Eerdere Gotcha-treffers blijven staan. De beurt gaat automatisch door.':v.finished?'De partij wordt automatisch afgesloten.':`Doel: ${state.start} / ${namesOfRules[state.out]}-out. Raak de score van een tegenstander om die terug te zetten op 0.`;
 const route=!v.bust&&!v.finished?checkout(state.start-p.remaining,state.out,3-v.used):null;
 $('checkout').replaceChildren(...(route||['-']).map(t=>{const b=document.createElement('b');b.textContent=t;return b;}));
 $('board-keys').querySelectorAll('button').forEach(b=>b.disabled=v.bust||v.finished||pending.length===3||state.phase!=='playing');
}
function setMode(m){
 mode=totalAllowed()?m:'dart';
 $('submit').hidden=(mode==='total'&&!cricket())||(mode==='dart'&&!editTurn);
 $('total-input').hidden=mode!=='total'||cricket();
 $('dart-input').hidden=mode!=='dart'&&!cricket();
 $('mode-total').hidden=!totalAllowed();
 $('mode-total').classList.toggle('selected',mode==='total');$('mode-dart').classList.toggle('selected',mode==='dart');
 $('visit-mode-note').hidden=!(cricket()&&mode==='total');
}

function showSetup(){document.querySelector('main').scrollTop=0;window.scrollTo(0,0);$('setup').hidden=false;$('game').hidden=true;$('cancel').hidden=!state;$('setup-form').hidden=true;$('category-cancel').hidden=!state;for(const id of ['category-match','category-training'])$(id).setAttribute('aria-pressed','false');}
function chooseCategory(training){
 $('game-type').value=training?'training':$('game-type').value==='training'?'x01':$('game-type').value;
 $('setup-form').hidden=false;$('category-cancel').hidden=true;
 $('category-match').setAttribute('aria-pressed',String(!training));$('category-training').setAttribute('aria-pressed',String(training));
 settings();
}
$('category-match').onclick=()=>chooseCategory(false);$('category-training').onclick=()=>chooseCategory(true);$('category-cancel').onclick=()=>render();
function buildKeys(){
 const numbers=cricket()?state.numbers.filter(n=>n!==25):Array.from({length:20},(_,i)=>i+1);
 $('board-keys').replaceChildren(...numbers.map(n=>button(n,()=>addDart(n,multiplier))));
 $('board-keys').append(button('Mis',()=>addDart(0,1)),button(state?.game==='x01'&&state.bull==='50/50'?'Buitenbull 50':'25',()=>addDart(25,1)),button('Bull',()=>addDart(25,2)));
 if(state.game==='tactics'){
  const remove=button('Laatste pijl wissen',()=>$('remove-dart').click());remove.id='tactics-remove';remove.dataset.action='remove';
  const confirm=button('Beurt bevestigen',()=>$('submit').click());confirm.id='tactics-confirm';confirm.dataset.action='confirm';
  $('board-keys').append(remove,confirm);
 }

}
function renderBoard(){
 const pending=state.phase==='playing'?(dartList.length?dartList:sharedDraft?.hits||[]):[];
 const preview=previewCricket(state,pending);
 const gains=preview.players.map((p,i)=>({name:p.name,points:p.cricketPoints-state.players[i].cricketPoints})).filter(p=>p.points>0);
 document.querySelectorAll('#players .remaining').forEach((el,i)=>{
  if(!preview.players[i])return;
  el.textContent=preview.players[i].cricketPoints;
  el.classList.toggle('pending-points',preview.players[i].cricketPoints!==state.players[i].cricketPoints);
 });
 $('points-preview').textContent=gains.length?'Voorlopig: '+gains.map(p=>`${p.name} +${p.points}`).join(' / '):'';
 $('points-preview').hidden=!gains.length;
 const pendingMarks=target=>pending.filter(d=>d.number===target).reduce((sum,d)=>sum+d.mult,0);
 $('cricket-live').textContent=pending.length?'Nog bevestigen: '+pending.map(d=>makeDart(d.number,d.mult).label).join(' / '):'Blauw = geraakt | Groen = gesloten';
 $('cricket-live').classList.toggle('pending',pending.length>0);
 const table=document.createElement('table');table.className='marks-table';const head=table.createTHead().insertRow();
 for(const name of ['Doel',...state.players.map(p=>p.name)]){const th=document.createElement('th');th.textContent=name;head.append(th);}
 const body=table.createTBody();
 for(const target of state.numbers){const row=body.insertRow();const name=document.createElement('th');name.textContent=target===25?'Bull':target;row.append(name);
  const extra=pendingMarks(target);row.classList.toggle('pending-row',extra>0);
  state.players.forEach((p,i)=>{
   const cell=row.insertCell(),saved=p.marks[target]||0,live=i===state.active&&extra>0,marks=preview.players[i].marks[target]||0;
   cell.textContent=['\u2014','/','\u00d7','\u2297'][marks];
   cell.setAttribute('aria-label',`${p.name}: ${marks} van 3 treffers op ${target===25?'bull':target}${live?' (nog bevestigen)':''}`);
   cell.className=(marks===3?'open-score':marks>0?'hit-mark':'')+(i===state.active?' current':'')+(live?' pending-mark':'');
  });
 }
 $('cricket-board').replaceChildren(table);
 $('board-keys').querySelectorAll('button:not([data-action])').forEach(b=>b.disabled=preview.finished||pending.length===3||state.phase!=='playing');
 if(state.game==='tactics'&&$('tactics-remove')){
  $('tactics-remove').disabled=state.phase!=='playing'||pending.length===0;
  $('tactics-confirm').disabled=state.phase!=='playing'||pending.length===0;
 }
 $('cricket-note').textContent=state.scoring==='no-score'?'Sluit elk doel met drie treffers. / = 1 · × = 2 · ⊗ = gesloten.':state.scoring==='cut-throat'?'Extra treffers geven punten aan tegenstanders die dit doel nog open hebben. Sluit alles met de laagste score.':'Extra treffers scoren zolang een tegenstander het doel nog open heeft. Sluit alles met de hoogste score.';
}
function render(){
 document.body.dataset.game=state?.game||'';
 if(!state){showSetup();return;}
 if(state.game==='tenlives'){
  mode='dart';
  $('setup').hidden=true;$('game').hidden=false;document.body.classList.remove('cricket-game');document.body.classList.add('training-game');
  $('undo').disabled=!undo.length;$('redo').disabled=!future.length;
  renderLivesGame();if(state.phase!=='playing')showResult();return;
 }
 $('setup').hidden=true;$('game').hidden=false;document.body.classList.toggle('cricket-game',cricket());document.body.classList.toggle('training-game',!!state.training121||state.game==='bobs27');setMode(modeOverride||preferredMode);buildKeys();
 const current=state.players[state.active],format=state.matchMode==='off'?'VRIJ SPELEN':`EERSTE TOT ${state.target} ${state.matchMode==='sets'?'SETS':'LEGS'}`;
 $('match-label').textContent=cricket()?`${state.game.toUpperCase()} / ${scoringNames[state.scoring]} / ${format}`:`${state.start} / ${namesOfRules[state.inMode]}-IN / ${namesOfRules[state.out]}-OUT / ${format}`;
 $('match-label').textContent+=` / RONDE ${state.round}${state.tiebreak?' (VERLENGING)':''}`;
 if(state.game==='gotcha')$('match-label').textContent=`TRAINING / GOTCHA / PRECIES ${state.start} / ${namesOfRules[state.out]}-OUT`;
 if(state.game==='bobs27')$('match-label').textContent="TRAINING / BOB'S 27 / D1 T/M D20 + BULL";
 if(state.training121)$('match-label').textContent='TRAINING / 121 / NEGEN DARTS / DUBBEL-UIT';
 $('turn-label').hidden=state.phase==='playing'&&state.game!=='bobs27';
 $('turn-label').textContent=state.phase==='playing'?(state.game==='bobs27'?`${current.name}: richt op ${state.bobsTarget===25?'Bull':'D'+state.bobsTarget}`:`${current.name} is aan de beurt`):(state.training121||state.game==='bobs27')?'Training afgerond':'Leg afgelopen';
 const legSummary=matchSummary(state);
 $('players').replaceChildren(...state.players.map((p,i)=>{
  const card=document.createElement('article');card.className='player'+(state.active===i?' active':'')+(p.bobsEliminated?' bobs-eliminated':'');
  card.innerHTML='<div class="player-top"><strong></strong><span class="badge"></span><div class="match-score"></div></div><div class="remaining"></div><div class="stats player-statistics"></div>';
  card.querySelector('strong').textContent=p.name;card.querySelector('.badge').textContent=p.bobsEliminated?'AFGEVALLEN':state.active===i?'● AAN DE BEURT':'';
  const matchScores=state.game==='bobs27'?[]:state.training121?[[p.trainingLevel||state.start,'NIVEAU'],[p.trainingBest||state.trainingBest,'BESTE']]:state.matchMode==='sets'?[[p.sets,'SETS'],[p.setLegs,'LEGS (SET)']]:[[p.legs,'LEGS']];
  card.querySelector('.match-score').replaceChildren(...matchScores.map(([value,label])=>{
   const item=document.createElement('span'),number=document.createElement('b'),caption=document.createElement('small');
   number.textContent=value;caption.textContent=label;item.append(number,caption);item.setAttribute('aria-label',`${value} ${label.toLowerCase()}`);return item;
  }));
  card.querySelector('.remaining').textContent=cricket()?p.cricketPoints:p.remaining;
  const stats=playerStats(state,i),average=v=>v===null?'-':v.toFixed(1);
  const items=state.game==='bobs27'?[]:[
   [stats.legDarts,state.training121?'DARTS POGING':'DARTS LEG'],[stats.gameDarts,'DARTS SPEL'],
   [average(stats.legAverage),cricket()?'LEG MPR':state.training121?'POGING GEM.':'LEG GEM.'],
   [average(stats.gameAverage),cricket()?'SPEL MPR':'SPEL GEM.'],
   [!cricket()&&!p.opened?'NOG IN':p.best,cricket()?'BESTE MARKS':'BESTE BEURT']
  ];
  card.querySelector('.stats').replaceChildren(...items.map(([value,label])=>{const cell=document.createElement('span'),b=document.createElement('b'),small=document.createElement('small');b.textContent=value;small.textContent=label;cell.append(b,small);return cell;}));
  if(state.game!=='bobs27'){
   const legs=document.createElement('div');legs.className='player-leg-results';
   legs.append(renderLegTable(legSummary.rows[i].perLeg,legSummary.marks));card.append(legs);
  }
  return card;
 }));
 $('cricket-panel').hidden=!cricket();$('finish-panel').hidden=cricket();
 if(cricket())renderBoard();else renderCheckout();
 $('leg-label').textContent=state.game==='bobs27'?`Ronde ${Math.min(state.round,21)} van 21`:state.training121?`Poging ${state.leg}`:`${state.matchMode==='sets'?`Set ${state.set} · `:''}Leg ${state.leg} · Ronde ${state.round}${state.tiebreak?' · Verlenging':''}`;
 $('history').replaceChildren(...state.history.slice(-12).reverse().map(h=>{const li=document.createElement('li'),label=document.createElement('span'),sub=document.createElement('small'),score=document.createElement('b');label.textContent=h.name;sub.textContent=state.game==='bobs27'?`${h.target===25?'Bull':'D'+h.target} · ${h.hits} raak · score ${h.remaining}`:`${state.training121?'Poging':'Leg'} ${h.leg} · ${h.labels||`${h.remaining} over`}`;label.append(sub);score.textContent=h.bust?'BUST':state.game==='bobs27'?(h.score>0?'+':'')+h.score:cricket()?`${h.marks} M`:h.score;li.append(label,score);return li;}));
 if(!state.history.length){const li=document.createElement('li');li.className='empty';li.textContent='Het bord is klaar. Voer je eerste beurt in.';$('history').append(li);}
 $('undo').disabled=!undo.length;$('redo').disabled=!future.length;$('history-latest').disabled=!future.length;const latest=future.reduce((n,item)=>Math.max(n,item.state.history.length),state.history.length);$('history-position').textContent=future.length?`Terug in de partij: ${state.history.length} van ${latest} beurten. Latere beurten blijven bewaard en worden bij een correctie opnieuw berekend.`:`${state.history.length} beurten gespeeld`;$('submit').disabled=state.phase!=='playing';$('confirm-total').disabled=state.phase!=='playing';$('keypad-bust').disabled=state.phase!=='playing';$('bust').disabled=state.phase!=='playing';$('bust').textContent=cricket()||state.game==='bobs27'?'Drie missers':'Bust / geen score';
 renderPendingTurns();renderInput();if(state.phase!=='playing')showResult();
}
function sameTurn(a,b){
 const normal=t=>t?.hits?{hits:t.hits.map(({number,mult})=>({number,mult}))}:{score:t?.score,darts:t?.darts??3,forceBust:!!t?.forceBust};
 return JSON.stringify(normal(a))===JSON.stringify(normal(b));
}
function laterTurns(){
 const states=[state,...undo,...future.map(item=>item.state)];
 const latest=states.reduce((a,b)=>b.history.length>a.history.length?b:a,state);
 return latest.history.slice(state.history.length+1).map((record,offset)=>{
  const index=state.history.length+1+offset;
  const before=states.find(s=>s.history.length===index&&s.leg===record.leg&&s.phase==='playing');
  const matches=latest.players.map((p,i)=>p.name===record.name?i:-1).filter(i=>i>=0);
  return {input:recoverTurn(record),player:before?.active??(matches.length===1?matches[0]:-1),leg:record.leg,name:record.name,description:record.labels||String(record.score)};
 });
}
async function commit(turn){try{
 if(future.length&&editTurn&&sameTurn(turn,editTurn)){await goForward();return;}
 const updated=applyTurn(state,turn);
 const latest=future[0]?.state;
 const browsing=state.game==='x01'&&future.length>0;
 const queued=state.game==='x01'?[...(future.length?laterTurns():[]),...pendingTurns.slice(editingPending?1:0)]:[];
 undo.push(state);future=[];historyNavigation=false;editingPending=false;
 const replay=replayTurns(updated,queued);
 undo.push(...replay.undo);state=replay.state;pendingTurns=replay.pending;pendingReason=replay.reason;
 if(!pendingTurns.length&&latest?.leg===state.leg+1&&state.phase==='leg')state=nextLeg(state);
 let restored=null;
 if(browsing&&replay.undo.length){
  const end=state;
  const steps=[...replay.undo.slice(1),end];
  future=steps.map(s=>{
   const input=recoverTurn(end.history[s.history.length]);
   return {state:s,editTurn:input,modeOverride:input?(input.hits?'dart':'total'):null,preferredMode};
  }).reverse();
  undo.splice(undo.length-replay.undo.length,replay.undo.length);
  state=replay.undo[0];
  restored=recoverTurn(end.history[state.history.length]);
  modeOverride=restored?(restored.hits?'dart':'total'):null;
  historyNavigation=true;
 }
 if(!await persist(!!restored,restored))return;
 resetInput();restoreTurnInput();render();
 if(browsing&&future.length)message('Correctie opgeslagen. Ga zelf verder met Volgende beurt of Naar laatste stand.');
}catch(e){message(e.message);}}
function renderPendingTurns(){
 $('pending-turns').hidden=!pendingTurns.length;
 $('pending-reason').textContent=pendingReason;
 $('pending-list').replaceChildren(...pendingTurns.map(item=>{const li=document.createElement('li');li.textContent=`Leg ${item.leg} / ${item.name}: ${item.description}`;return li;}));
 const first=pendingTurns[0];
 $('pending-load').disabled=!first?.input||state.phase!=='playing'||state.active!==first.player||state.leg!==first.leg||!!future.length;
}
$('pending-load').onclick=async()=>{
 const first=pendingTurns[0];if(!first?.input||state.phase!=='playing'||state.active!==first.player||state.leg!==first.leg||future.length)return;
 editingPending=true;modeOverride=first.input.hits?'dart':'total';
 if(!await persist(true,first.input))return;
 resetInput();restoreTurnInput();render();
 message('Bewaarde beurt geladen. Corrigeer deze en bevestig; daarna worden de overige beurten opnieuw verwerkt.');
};
function totalTurn(score,extra={}){
 return {score,...extra};
}
async function resetGotchaOpponent(index){
 if(busy||!ready||state?.game!=='gotcha'||state.phase!=='playing'||index===state.active||!state.players[index]?.remaining)return;
 const name=state.players[index].name;
 undo.push(state);
 state=structuredClone(state);
 state.players[index].remaining=0;
 future=[];historyNavigation=false;
 if(!await persist(true,editTurn))return;
 resetTargetsOpen=false;
 render();
 message(`${name} staat op nul. Je kunt nu je score invoeren. Herstellen kan met Vorige beurt herstellen.`);
}
$('gotcha-reset').onclick=()=>{
 const targets=state.players.map((p,i)=>i!==state.active&&p.remaining>0?i:-1).filter(i=>i>=0);
 if(targets.length===1){void resetGotchaOpponent(targets[0]);return;}
 resetTargetsOpen=!resetTargetsOpen;renderInput();
};
function canFinishTotal(score,n){return state.game==='gotcha'?!!checkout(score,state.out,n):validX01Total(state,score,n,true);}
function totalSubmit(){
 if(!entry){message('Voer een score in, ook bij een beurt van 0.');return;}
 const score=Number(entry);if(!possibleTotal(score)){message('Deze score is niet mogelijk met drie pijlen.');return;}
 const left=state.game==='gotcha'?state.start-state.players[state.active].remaining:state.players[state.active].remaining;
 if(score===left&&canFinishTotal(score,3)){
  document.querySelectorAll('[data-darts]').forEach(b=>b.disabled=!canFinishTotal(score,Number(b.dataset.darts)));
  $('finish-dialog').querySelector('p').textContent=`Met hoeveel pijlen uitgegooid? ${state.out==='double'?'Bevestig alleen als de laatste pijl een dubbel was.':state.out==='master'?'Bevestig alleen als de laatste pijl een dubbel of triple was.':''}`;
  $('finish-dialog').showModal();return;
 }
 commit(totalTurn(score));
}
function addDigit(d){if(entry.length>=3)return;entry=(entry==='0'?'':entry)+d;message();renderInput();publishDraft();}
function addDart(n,m){if(dartList.length===3){message('Drie pijlen ingevuld. Bevestig je beurt.');return;}dartList.push(makeDart(n,m));if(n===25&&m===1&&state?.game==='x01'&&state.bull==='50/50')dartList.at(-1).label='Buitenbull 50';multiplier=1;message();renderInput();
 const preview=state.game==='bobs27'?previewBobs27(state,dartList):state.game==='gotcha'?previewGotcha(state,dartList):cricket()?previewCricket(state,dartList):previewTurn(state,dartList);
 if(mode==='dart'&&(dartList.length===3||preview.bust||preview.finished)){void commit({hits:[...dartList]});}else publishDraft();
}
for(const n of ['1','2','3','4','5','6','7','8','9','bust','0']){
 const key=button(n==='bust'?'BUST / geen score':n,()=>{if(n==='bust')$('bust').click();else addDigit(n);});
 if(n==='bust'){key.id='keypad-bust';key.setAttribute('aria-label','Bust / geen score');}
 $('keypad').append(key);
}
const confirmTotal=button('Bevestigen',totalSubmit);confirmTotal.id='confirm-total';confirmTotal.className='primary';confirmTotal.setAttribute('aria-label','Beurt bevestigen');$('keypad').append(confirmTotal);
for(const [n,label] of [[1,'Single'],[2,'Double'],[3,'Triple']]){const b=button(label,()=>{multiplier=n;renderInput();});b.dataset.multiplier=n;$('multipliers').append(b);}
$('remove-dart').onclick=()=>{dartList.pop();message();renderInput();publishDraft();};$('backspace').onclick=()=>{entry=entry.slice(0,-1);message();renderInput();publishDraft();};
for(const m of ['total','dart'])$('mode-'+m).onclick=async()=>{
 if(m===mode||!totalAllowed())return;
 preferredMode=m;modeOverride=m;
 if(!await persist(true))return;
 resetInput();render();
};
$('submit').onclick=()=>mode==='total'&&!cricket()?totalSubmit():commit({hits:dartList});
$('bust').onclick=()=>commit(cricket()||state?.game==='bobs27'?{hits:[makeDart(0),makeDart(0),makeDart(0)]}:totalTurn(0,{forceBust:true}));
function restoreTurnInput(){
 if(!editTurn)return;
 entry=editTurn.hits?'':String(editTurn.score??0);
 dartList=(editTurn.hits||[]).map(d=>makeDart(d.number,d.mult));
}
function recoverTurn(history){
 if(history?.input)return structuredClone(history.input);
 if(history?.labels){
  const labels=history.labels.match(/Buitenbull 50|Bull|Mis|[DT]?\d+/g)||[];
  const hits=labels.map(label=>label==='Mis'?makeDart(0):label==='Bull'?makeDart(25,2):label==='Buitenbull 50'?makeDart(25):makeDart(Number(label.replace(/^[DT]/,'')),label[0]==='D'?2:label[0]==='T'?3:1));
  if(hits.length)return {hits};
 }
 return history&&!history.bust?{score:history.score}:null;
}
$('undo').onclick=async()=>{
 if(!undo.length)return;
 const last=state.history.at(-1),previous=undo.pop();
 future.push({state,editTurn,modeOverride,preferredMode});historyNavigation=true;editingPending=false;
 const recovered=state.game==='x01'&&previous.history.length===state.history.length-1?recoverTurn(last):null;
 state=previous;
 if(recovered)modeOverride=recovered.hits?'dart':'total';
 if(!await persist(!!recovered,recovered))return;
 resetInput();restoreTurnInput();render();
 if(recovered)message('Vorige invoer hersteld. Pas de score of pijlen aan en bevestig de beurt.');
};
async function goForward(all=false){
 if(!future.length)return;
 editingPending=false;
 do{
  undo.push(state);
  const item=future.pop();state=item.state;editTurn=item.editTurn||null;modeOverride=item.modeOverride||null;
 }while(all&&future.length);
 historyNavigation=true;
 if(!await persist(true,editTurn))return;
 resetInput();restoreTurnInput();render();
}
$('redo').onclick=()=>goForward();
$('history-latest').onclick=()=>goForward(true);
for(const b of document.querySelectorAll('[data-darts]'))b.onclick=()=>{$('finish-dialog').close();commit(totalTurn(Number(entry),{darts:Number(b.dataset.darts)}));};
$('finish-cancel').onclick=()=>$('finish-dialog').close();
function showResult(){
 showWinner(state);
 if(state.game==='tenlives'){
  $('result-title').textContent=state.winner===null?'Training afgelopen':state.players[state.winner].name+' wint!';
  $('result-text').textContent=(state.winner===null?'Alle spelers zijn hun levens kwijt. ':'Bull geraakt! ')+state.players.map(p=>`${p.name}: ${p.lives} levens, ${p.darts} pijlen`).join(' ? ');
  $('continue').textContent='Nieuwe training';$('finish-match').hidden=true;
  if(!$('result-dialog').open)$('result-dialog').showModal();return;
 }
 if(state.game==='bobs27'){
  const complete=['bobs-complete','bobs-tie'].includes(state.reason),scores=state.players.map(p=>`${p.name}: ${p.remaining} (${p.bobsHits||0} raak)`).join(' · ');
  $('result-title').textContent=state.reason==='bobs-tie'?'Gelijkspel!':state.winner!==null?`${state.players[state.winner].name} wint!`:complete?"Bob's 27 voltooid!":'Training afgelopen';
  $('result-text').textContent=scores;
  $('continue').textContent='Nieuwe training';$('finish-match').hidden=true;
  if(!$('result-dialog').open)$('result-dialog').showModal();return;
 }
 if(state.training121){
  $('result-title').textContent=state.trainingSuccess?'Uitgegooid!':'Negen darts voorbij';
  const change=state.trainingChange>0?'+'+state.trainingChange:String(state.trainingChange);
  $('result-text').textContent=state.trainingSuccess?`Uit in ${state.trainingDarts} darts: 1 + ${9-state.trainingDarts} over = ${change}. Volgende startscore: ${state.trainingNext}.`:`Niet uitgegooid. ${state.trainingChange===0?'Je blijft op het minimum van 121.':'Startscore -1: de volgende poging begint op '+state.trainingNext+'.'}`;
  $('continue').textContent=state.players.length>1?'Volgende speler: '+state.players[(state.active+1)%state.players.length].name:'Volgende poging';$('finish-match').hidden=true;
  if(!$('result-dialog').open)$('result-dialog').showModal();return;
 }
 $('result-title').textContent=state.winner===null?'Partij afgerond':`${state.players[state.winner].name} wint ${state.phase==='won'?'de partij':state.setComplete?'de set':'de leg'}!`;
 if(state.phase==='won'&&state.winner!==null)$('result-title').textContent=state.players[state.winner].name;
 $('result-text').textContent=(state.reason==='round-limit'?'Rondelimiet bereikt. ':'')+state.players.map(p=>`${p.name}: ${state.matchMode==='sets'?`${p.sets} sets, `:''}${p.legs} legs`).join(' · ');
 $('continue').textContent=state.phase==='won'?'Nieuwe partij →':'Volgende leg →';$('finish-match').hidden=state.matchMode!=='off'||state.phase==='won';
 if(!$('result-dialog').open)$('result-dialog').showModal();
}
$('continue').onclick=async()=>{$('result-dialog').close();if(state.phase==='won')showSetup();else{state=nextLeg(state);if(!await persist())return;resetInput();render();}};
$('result-undo').onclick=()=>{$('result-dialog').close();$('undo').click();};
$('finish-match').onclick=async()=>{state={...state,phase:'won',winner:null};if(!await persist())return;$('result-dialog').close();showSetup();};
function starterOptions(){const previous=$('starter').value;$('starter').replaceChildren(...[...$('names').querySelectorAll('input')].map((input,i)=>{const o=document.createElement('option');o.value=i;o.textContent=input.value.trim()||`Speler ${i+1}`;return o;}));$('starter').value=Number(previous)<Number($('count').value)?previous:'0';if(!$('starter').value)$('starter').value='0';}
function names(){const old=[...$('names').querySelectorAll('input')].map(i=>i.value);$('names').replaceChildren(...Array.from({length:Number($('count').value)},(_,i)=>{const label=document.createElement('label');label.textContent=`Speler ${i+1}`;const input=document.createElement('input');input.value=old[i]||`Speler ${i+1}`;input.maxLength=24;input.required=true;input.autocomplete='off';input.oninput=starterOptions;label.append(input);return label;}));starterOptions();}
function settings(){
 const training=$('game-type').value==='training',gotcha=training&&$('training-type').value==='gotcha',bobs=training&&$('training-type').value==='bobs27',x=$('game-type').value==='x01';
 document.querySelectorAll('[data-x01]').forEach(el=>el.hidden=!x);
 $('game-type').closest('label').hidden=training;
 $('scoring-label').hidden=x||training;
 $('lives-mode-label').hidden=!(training&&$('training-type').value==='tenlives');
 $('gotcha-target-label').hidden=!gotcha;$('gotcha-out-label').hidden=!gotcha;
 $('training-label').hidden=!training;$('training-help').hidden=!training;
 $('training-help').textContent=training&&$('training-type').value==='tenlives'?'10 levens: Doubles of Triples van 20 t/m 10, daarna Bull (50). Raak: resterende pogingen plus 3. Mis je alle pogingen, dan ??n doel terug of op 20 ??n leven kwijt; daarna de volgende speler.':gotcha?'Gotcha: 2 tot 4 spelers beginnen op 0. Tel per pijl op naar de gekozen doelscore. Kies Straight-out, Double-out of Master-out. Gelijk aan een tegenstander? Die gaat naar 0. Te hoog, een ongeldige finish of 1 punt over bij Double/Master-out is bust: je eigen score gaat terug naar het begin van de beurt; eerdere Gotcha-treffers blijven staan.':bobs?"Bob's 27: 1 tot 4 spelers. Iedereen gooit drie pijlen op D1 t/m D20 en daarna Bull. Iedere treffer telt de dubbelwaarde erbij. Geen treffer trekt die waarde af. Bij 0 of lager valt die speler af.":'121: 1 tot 4 spelers, elk met een eigen niveau. Per speler een poging van maximaal negen darts, daarna de volgende speler. Dubbel-uit. Gelukt: +1 plus overgebleven darts. Niet gelukt: -1, minimaal 121. Een bust verbruikt de rest van je beurt.';
 $('count').querySelector('option[value="1"], option:first-child').disabled=gotcha;
 for(const id of ['match-mode','max-rounds','count','starter'])$(id).closest('label').hidden=training&&!['count','starter'].includes(id);
 document.querySelector('.setup-help:not(#training-help)').hidden=training;
 $('set-legs-label').hidden=training||$('match-mode').value!=='sets';
 $('target-label').hidden=training||$('match-mode').value==='off';
 $('target-text').textContent=$('match-mode').value==='sets'?'Sets nodig om te winnen':'Legs nodig om te winnen';
 if(gotcha&&Number($('count').value)<2){$('count').value='2';names();}

}

$('training-type').onchange=settings;$('game-type').onchange=settings;$('match-mode').onchange=settings;$('count').onchange=names;names();settings();$('settings').onclick=()=>{if(state&&state.phase!=='won'){if(!$('new-match-dialog').open)$('new-match-dialog').showModal();}else showSetup();};
$('new-match-cancel').onclick=()=>$('new-match-dialog').close();
$('new-match-confirm').onclick=()=>{$('new-match-dialog').close();showSetup();};$('cancel').onclick=render;
$('setup-form').onsubmit=async e=>{
 e.preventDefault();const players=[...$('names').querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean);if(players.length!==Number($('count').value))return;
 const gotcha=$('game-type').value==='training'&&$('training-type').value==='gotcha',bobs=$('game-type').value==='training'&&$('training-type').value==='bobs27';
 state=newMatch(players,Number($(gotcha?'gotcha-target':'start').value),$(gotcha?'gotcha-out':'out').value,Number($('legs').value),{training121:$('game-type').value==='training'&&$('training-type').value==='121',livesMode:$('lives-mode').value,game:$('game-type').value==='training'?($('training-type').value==='tenlives'?'tenlives':gotcha?'gotcha':bobs?'bobs27':'x01'):$('game-type').value,inMode:$('in-mode').value,scoring:$('scoring').value,matchMode:$('match-mode').value,legsPerSet:Number($('set-legs').value),bull:$('bull-mode').value,maxRounds:Number($('max-rounds').value),starter:Number($('starter').value)});
 undo=[];future=[];pendingTurns=[];pendingReason='';editingPending=false;historyNavigation=false;mode=totalAllowed()?preferredMode:'dart';if(!await persist())return;resetInput();render();
};
document.addEventListener('show-shared-setup',()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();showSetup();});
document.addEventListener('close-shared-setup',()=>render());
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('Gebruik F11 voor volledig scherm.');}};
 document.addEventListener('keydown',e=>{if(!state||state.phase!=='playing'||!$('setup').hidden||document.querySelector('dialog[open]')||mode!=='total')return;if(/^\d$/.test(e.key)){e.preventDefault();addDigit(e.key);}else if(e.key==='Backspace'){e.preventDefault();$('backspace').click();}else if(e.key==='Enter'){e.preventDefault();totalSubmit();}});
render();

connection(false,androidLocal?'Lokale opslag openen...':'Verbinding met NUC maken...');synchronize();setInterval(synchronize,750);
