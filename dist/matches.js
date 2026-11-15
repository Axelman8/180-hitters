import {canControl,takeControl} from './controller.js';
import {renderGameReport} from './game-reports.js';
import {renderLivesSummary} from './ten-lives.js';

const $=id=>document.getElementById(id),open=document.createElement('button');
open.id='matches-open';open.type='button';open.textContent='Mijn partijen';$('top-actions').append(open);
const dialog=document.createElement('dialog');dialog.id='matches-dialog';dialog.setAttribute('aria-labelledby','matches-title');
dialog.innerHTML=`<button id="matches-close" class="wide" type="button">TERUG</button><h2 id="matches-title">Mijn partijen</h2><p id="matches-source"></p><p id="matches-status" role="status"></p>
 <div id="matches-browse"><label>Partij zoeken<input id="matches-search" type="search" placeholder="Spel of speler" autocomplete="off"></label>
 <div class="matches-toolbar"><span id="matches-selection" aria-live="polite">Geen partijen geselecteerd</span><button id="matches-clear" type="button" disabled>Selectie wissen</button><button id="matches-delete" type="button" disabled>Verwijderen</button></div>
 <p id="matches-delete-hint" class="muted"></p><div id="matches-list"></div></div>
 <section id="matches-confirm" hidden aria-labelledby="matches-confirm-title"><h3 id="matches-confirm-title">Partijen verwijderen?</h3><p id="matches-confirm-summary"></p><p id="matches-confirm-current"></p><p>Dit kan niet ongedaan worden gemaakt. Spelers in je spelerslijst blijven bewaard.</p><ul id="matches-confirm-list"></ul><div class="matches-confirm-actions"><button id="matches-delete-cancel" type="button">Annuleren</button><button id="matches-delete-confirm" type="button">Definitief verwijderen</button></div></section>
 `;
document.body.append(dialog);
const report=document.createElement('dialog');report.id='matches-report-dialog';report.innerHTML='<h2 id="result-title">Partijrapport</h2><p id="matches-report-date"></p><button id="matches-report-close" class="wide" type="button">TERUG naar mijn partijen</button>';document.body.append(report);
const names={x01:'X01',cricket:'Cricket',tactics:'Tactics',gotcha:'Gotcha',bobs27:"Bob’s 27",tenlives:'Hitters Challenge',fourinarow:'4 op een rij',scram:'Scram',killer:'Killer',bull41:'Bull / 41',twentyone:'21'};
const date=value=>new Date(value*1000).toLocaleString('nl-NL',{dateStyle:'medium',timeStyle:'short'});
const game=item=>item.training121?'121':names[item.game]||item.game;
const source=()=>window.DartsAndroid?.isLocalMode?.()===true?'op dit apparaat':'op de NUC';
let items=[],loading=false,canDelete=false,revision=null,pending=null;
const selection=new Set();
async function request(path,body){
 const r=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok){const error=Error(data.error||'Partijen ophalen is niet gelukt. Controleer de verbinding.');error.status=r.status;throw error;}return data;
}
function accept(data){items=(data.matches||[]).sort((a,b)=>b.time-a.time);canDelete=data.canDelete===true;revision=data.revision;for(const id of selection)if(!items.some(item=>item.id===id))selection.delete(id);}
function filtered(){const query=$('matches-search').value.trim().toLocaleLowerCase('nl');return items.filter(item=>(game(item)+' '+item.players.join(' ')).toLocaleLowerCase('nl').includes(query));}
function updateSelection(){
 const visible=filtered(),count=visible.filter(item=>selection.has(item.id)).length;
 $('matches-selection').textContent=selection.size?selection.size+' '+(selection.size===1?'partij geselecteerd':'partijen geselecteerd'):'Geen partijen geselecteerd';
 $('matches-clear').disabled=loading||!selection.size;$('matches-delete').disabled=loading||!canDelete||!selection.size;
 const all=$('matches-select-all');if(all){all.checked=visible.length>0&&count===visible.length;all.indeterminate=count>0&&count<visible.length;all.disabled=loading||!canDelete;}
 dialog.querySelectorAll('.saved-game').forEach(row=>{const checked=selection.has(row.dataset.id);row.classList.toggle('is-selected',checked);row.querySelector('input').checked=checked;row.querySelector('input').disabled=loading||!canDelete;});
}
function selectBox(label,change){const target=document.createElement('label');target.className='matches-checkbox';const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',label);input.onchange=()=>change(input.checked);target.append(input);return target;}
function render(){
 const list=$('matches-list');list.replaceChildren();$('matches-delete-hint').textContent=canDelete?'Selecteer één of meer partijen. Het vak bovenaan selecteert alle gevonden partijen.':'Verwijderen is beschikbaar na het bijwerken van de NUC naar de nieuwste versie.';
 const visible=filtered();
 if(!visible.length){const note=document.createElement('p');note.className='muted';note.textContent=$('matches-search').value.trim()?'Geen partijen gevonden met deze naam.':'Je hebt hier nog geen bewaarde partijen. Nieuwe partijen worden automatisch opgeslagen.';list.append(note);updateSelection();return;}
 const table=document.createElement('table');table.className='matches-table';const caption=document.createElement('caption');caption.textContent='Bewaarde partijen, laatst gespeeld bovenaan';caption.className='matches-visually-hidden';table.append(caption);
 const head=table.createTHead(),headers=head.insertRow(),selectHead=document.createElement('th');selectHead.scope='col';const all=selectBox('Alle gevonden partijen selecteren',checked=>{for(const item of filtered())if(checked)selection.add(item.id);else selection.delete(item.id);updateSelection();});all.querySelector('input').id='matches-select-all';selectHead.append(all);headers.append(selectHead);
 for(const title of ['Spel','Spelers','Datum gespeeld','Status']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;headers.append(cell);}
 const body=table.createTBody();
 for(const item of visible){
  const row=body.insertRow();row.className='saved-game';row.dataset.id=item.id;
  row.insertCell().append(selectBox(game(item)+' — '+item.players.join(' / ')+' selecteren',checked=>{if(checked)selection.add(item.id);else selection.delete(item.id);updateSelection();}));
  const title=row.insertCell(),heading=document.createElement('strong');heading.className='saved-game-title';heading.textContent=game(item);title.append(heading);
  const players=row.insertCell();players.className='saved-game-players';players.textContent=item.players.join(' / ');
  const when=row.insertCell(),time=document.createElement('time');time.dateTime=new Date(item.time*1000).toISOString();time.textContent=date(item.time);when.append(time);
  const status=row.insertCell();status.className='saved-game-status';status.textContent=item.phase==='won'?'Afgerond':item.current?'Huidige partij · Nog bezig':'Nog bezig';
  if(item.phase==='won'&&Number.isInteger(item.winner)&&item.players[item.winner])status.textContent+=' · '+item.players[item.winner]+' wint';
  const actions=document.createElement('div');actions.className='saved-game-actions';
  if(item.phase!=='won'){
   const resume=document.createElement('button');resume.type='button';resume.className='primary';resume.textContent='Verder spelen';
   resume.onclick=async()=>{
    if(loading)return;loading=true;resume.disabled=true;$('matches-status').textContent='Partij openen…';updateSelection();
    try{
     if(!canControl()&&!await takeControl())throw Error('Bediening overnemen is niet gelukt. Probeer opnieuw.');
     const current=await request('/api/state'),same=items.find(value=>value.current)?.id===item.id;
     if(!same&&current.match&&current.match.state.phase!=='won'&&!confirm('Deze partij hervatten? Je huidige partij wordt automatisch bewaard.'))return;
     const saved=await request('/api/matches/resume',{id:item.id,revision:current.revision});
     dialog.close();document.dispatchEvent(new CustomEvent('resume-saved-match',{detail:saved}));
    }catch(error){$('matches-status').textContent=error.message;}finally{loading=false;resume.disabled=false;updateSelection();}
   };actions.append(resume);
  }
  const view=document.createElement('button');view.type='button';view.textContent='Rapport bekijken';
  view.onclick=async()=>{if(loading)return;view.disabled=true;try{const saved=await request('/api/matches/'+item.id),state=saved.match.state;report.querySelector('#game-report')?.remove();report.querySelector('#lives-summary')?.remove();report.querySelector('#result-title').textContent=game(item)+' · '+(item.phase==='won'?'Partijrapport':'Tussenstand');$('matches-report-date').textContent=date(item.time);if(state.game==='tenlives')renderLivesSummary(state,report);else renderGameReport(state,report);dialog.close();report.showModal();}catch(error){$('matches-status').textContent=error.message;}finally{view.disabled=false;}};actions.append(view);
  title.append(actions);
 }
 list.append(table);updateSelection();
}
function cancelDelete(){pending=null;$('matches-confirm').hidden=true;$('matches-browse').hidden=false;$('matches-delete').focus();}
async function prepareDelete(){
 if(loading||!selection.size||!canDelete)return;loading=true;updateSelection();$('matches-status').textContent='Selectie controleren…';
 try{
  accept(await request('/api/matches'));render();if(!selection.size)throw Error('Deze partijen zijn al verwijderd.');
  pending={ids:[...selection],revision};const selected=items.filter(item=>selection.has(item.id));
  $('matches-confirm-summary').textContent=selected.length+' '+(selected.length===1?'partij':'partijen')+' '+source()+' definitief verwijderen?';
  $('matches-confirm-current').textContent=selected.some(item=>item.current)?'Let op: de huidige partij zit in je selectie. Deze wordt ook beëindigd.':'';
  $('matches-confirm-list').replaceChildren();for(const item of selected){const li=document.createElement('li');li.textContent=game(item)+' — '+item.players.join(' / ')+' — '+date(item.time);$('matches-confirm-list').append(li);}
  $('matches-status').textContent='';$('matches-browse').hidden=true;$('matches-confirm').hidden=false;$('matches-delete-cancel').focus();
 }catch(error){$('matches-status').textContent=error.message;}finally{loading=false;updateSelection();}
}
async function deleteSelected(){
 if(loading||!pending)return;loading=true;$('matches-delete-confirm').disabled=true;$('matches-delete-cancel').disabled=true;$('matches-close').disabled=true;$('matches-status').textContent='Partijen verwijderen…';
 try{
  if(!canControl()&&!await takeControl())throw Error('Bediening overnemen is niet gelukt. Probeer opnieuw.');
  const result=await request('/api/matches/delete',pending);accept(result);selection.clear();cancelDelete();render();
  if(result.clearedCurrent&&result.state)document.dispatchEvent(new CustomEvent('saved-match-deleted',{detail:result.state}));
  const count=result.deleted?.length||0;$('matches-status').textContent=count?count+' '+(count===1?'partij verwijderd':'partijen verwijderd')+' '+source()+'.':'De geselecteerde partijen waren al verwijderd.';
 }catch(error){
  cancelDelete();if(error.status===409||error.status===404){try{accept(await request('/api/matches'));render();}catch{}}
  $('matches-status').textContent=error.status===404?'Werk de NUC bij om partijen te kunnen verwijderen.':error.message;
 }finally{loading=false;$('matches-delete-confirm').disabled=false;$('matches-delete-cancel').disabled=false;$('matches-close').disabled=false;updateSelection();}
}
async function show(){
 document.dispatchEvent(new Event('close-navigation'));selection.clear();pending=null;items=[];canDelete=false;updateSelection();$('matches-browse').hidden=false;$('matches-confirm').hidden=true;$('matches-search').value='';$('matches-status').textContent='Partijen ophalen…';$('matches-list').replaceChildren();if(!dialog.open)dialog.showModal();
 $('matches-source').textContent='Partijen '+source()+' · de laatst gespeelde staat bovenaan.';
 try{accept(await request('/api/matches'));$('matches-status').textContent='';render();}catch(error){$('matches-status').textContent=error.message;}
}
open.onclick=()=>void show();$('matches-search').oninput=render;
$('matches-clear').onclick=()=>{selection.clear();updateSelection();};$('matches-delete').onclick=()=>void prepareDelete();
$('matches-delete-cancel').onclick=cancelDelete;$('matches-delete-confirm').onclick=()=>void deleteSelected();
$('matches-close').onclick=()=>{if(pending){cancelDelete();return;}dialog.close();document.dispatchEvent(new Event('open-play-menu'));};
dialog.addEventListener('cancel',event=>{if(loading||pending){event.preventDefault();if(!loading)cancelDelete();}});
$('matches-report-close').onclick=()=>{report.close();void show();};
