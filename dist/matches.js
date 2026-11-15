import {canControl,takeControl} from './controller.js';
import {renderGameReport} from './game-reports.js';
import {renderLivesSummary} from './ten-lives.js';

const $=id=>document.getElementById(id),open=document.createElement('button');
open.id='matches-open';open.type='button';open.textContent='Mijn partijen';$('top-actions').append(open);
const dialog=document.createElement('dialog');dialog.id='matches-dialog';dialog.setAttribute('aria-labelledby','matches-title');
dialog.innerHTML='<h2 id="matches-title">Mijn partijen</h2><p id="matches-source"></p><label>Partij zoeken<input id="matches-search" type="search" placeholder="Spel of speler" autocomplete="off"></label><p id="matches-status" role="status"></p><div id="matches-list"></div><button id="matches-close" class="wide" type="button">TERUG</button>';
document.body.append(dialog);
const report=document.createElement('dialog');report.id='matches-report-dialog';report.innerHTML='<h2 id="result-title">Partijrapport</h2><p id="matches-report-date"></p><button id="matches-report-close" class="wide" type="button">TERUG naar mijn partijen</button>';document.body.append(report);
const names={x01:'X01',cricket:'Cricket',tactics:'Tactics',gotcha:'Gotcha',bobs27:"Bob’s 27",tenlives:'Hitters Challenge',fourinarow:'4 op een rij',scram:'Scram',killer:'Killer',bull41:'Bull / 41',twentyone:'21'};
const date=value=>new Date(value*1000).toLocaleString('nl-NL',{dateStyle:'medium',timeStyle:'short'});
const game=item=>item.training121?'121':names[item.game]||item.game;
let items=[],loading=false;
async function request(path,body){
 const r=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Partijen ophalen is niet gelukt. Controleer de verbinding.');return data;
}
function render(){
 const list=$('matches-list'),query=$('matches-search').value.trim().toLocaleLowerCase('nl');list.replaceChildren();
 const selected=items.filter(item=>(game(item)+' '+item.players.join(' ')).toLocaleLowerCase('nl').includes(query));
 if(!selected.length){const note=document.createElement('p');note.className='muted';note.textContent=query?'Geen partijen gevonden met deze naam.':'Je hebt hier nog geen bewaarde partijen. Nieuwe partijen worden automatisch opgeslagen.';list.append(note);return;}
 for(const item of selected){
  const card=document.createElement('article');card.className='saved-game';
  const heading=document.createElement('h3');heading.textContent=game(item);const players=document.createElement('strong');players.textContent=item.players.join(' / ');
  const when=document.createElement('p');when.textContent='Laatst gespeeld: '+date(item.time);
  const status=document.createElement('span');status.className='saved-game-status';status.textContent=item.phase==='won'?'Afgerond':item.current?'Huidige partij · Nog bezig':'Nog bezig';
  if(item.phase==='won'&&Number.isInteger(item.winner)&&item.players[item.winner])status.textContent+=' · '+item.players[item.winner]+' wint';
  const actions=document.createElement('div');actions.className='saved-game-actions';
  if(item.phase!=='won'){
   const resume=document.createElement('button');resume.type='button';resume.className='primary';resume.textContent='Verder spelen';
   resume.onclick=async()=>{
    if(loading)return;loading=true;resume.disabled=true;$('matches-status').textContent='Partij openen…';
    try{
     if(!canControl()&&!await takeControl())throw Error('Bediening overnemen is niet gelukt. Probeer opnieuw.');
     const current=await request('/api/state'),same=items.find(value=>value.current)?.id===item.id;
     if(!same&&current.match&&current.match.state.phase!=='won'&&!confirm('Deze partij hervatten? Je huidige partij wordt automatisch bewaard.'))return;
     const saved=await request('/api/matches/resume',{id:item.id,revision:current.revision});
     dialog.close();document.dispatchEvent(new CustomEvent('resume-saved-match',{detail:saved}));
    }catch(error){$('matches-status').textContent=error.message;}finally{loading=false;resume.disabled=false;}
   };actions.append(resume);
  }
  const view=document.createElement('button');view.type='button';view.textContent='Rapport bekijken';
  view.onclick=async()=>{view.disabled=true;try{const saved=await request('/api/matches/'+item.id),state=saved.match.state;report.querySelector('#game-report')?.remove();report.querySelector('#lives-summary')?.remove();report.querySelector('#result-title').textContent=game(item)+' · '+(item.phase==='won'?'Partijrapport':'Tussenstand');$('matches-report-date').textContent=date(item.time);if(state.game==='tenlives')renderLivesSummary(state,report);else renderGameReport(state,report);dialog.close();report.showModal();}catch(error){$('matches-status').textContent=error.message;}finally{view.disabled=false;}};actions.append(view);
  card.append(heading,players,when,status,actions);list.append(card);
 }
}
async function show(){
 document.dispatchEvent(new Event('close-navigation'));$('matches-search').value='';$('matches-status').textContent='Partijen ophalen…';$('matches-list').replaceChildren();if(!dialog.open)dialog.showModal();
 const local=window.DartsAndroid?.isLocalMode?.()===true;
 $('matches-source').textContent=local?'Partijen op dit apparaat · de laatst gespeelde staat bovenaan.':'Partijen op de NUC · de laatst gespeelde staat bovenaan.';
 try{items=(await request('/api/matches')).matches||[];items.sort((a,b)=>b.time-a.time);$('matches-status').textContent='';render();}catch(error){$('matches-status').textContent=error.message;}
}
open.onclick=()=>void show();$('matches-search').oninput=render;$('matches-close').onclick=()=>{dialog.close();document.dispatchEvent(new Event('open-play-menu'));};
$('matches-report-close').onclick=()=>{report.close();void show();};
