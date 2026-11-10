import {canControl} from './controller.js';
import {renderGameReport} from './game-reports.js';
import {renderLivesSummary} from './ten-lives.js';
const android=window.DartsAndroid;
const local=android?.isLocalMode?.()===true;
const $=id=>document.getElementById(id);
const actions=$('top-actions');
const dialog=document.createElement('dialog');dialog.id='transfer-dialog';
dialog.setAttribute('aria-labelledby','transfer-title');
dialog.innerHTML='<h2 id="transfer-title"></h2><p id="transfer-description"></p><div id="transfer-items"></div><p id="transfer-message" role="status"></p><button id="transfer-confirm" class="primary wide" hidden>Overzetten en huidige partij bewaren</button><button id="transfer-close" class="wide">Sluiten</button>';
document.body.append(dialog);
const reportDialog=document.createElement('dialog');reportDialog.id='archive-report-dialog';
reportDialog.innerHTML='<p class="eyebrow">OPGESLAGEN PARTIJ</p><h2 id="result-title">Wedstrijdrapport</h2><p id="archive-report-date"></p><button id="archive-report-close" class="wide" type="button">Rapport sluiten</button>';
document.body.append(reportDialog);
let selection=null,working=false,pendingShown=false;
function pending(){try{return JSON.parse(android?.getPendingNucTransfer?.()||'null');}catch{return null;}}
function button(id,label,action){const b=document.createElement('button');b.id=id;b.textContent=label;b.type='button';b.onclick=action;actions.append(b);return b;}
function describe(match){const s=match?.state;return s?`${s.game.toUpperCase()} · ${s.players.map(p=>p.name).join(' / ')} · leg ${s.leg??1}`:'Geen actieve partij';}
async function get(path){const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('NUC niet bereikbaar of nog niet bijgewerkt.');return r.json();}
function open(title){selection=null;$('transfer-title').textContent=title;$('transfer-items').replaceChildren();$('transfer-message').textContent='';$('transfer-description').textContent='';$('transfer-confirm').hidden=true;if(!dialog.open)dialog.showModal();}
async function previewTransfer(){
 const source=pending();if(!source)return;
 open('Partij van telefoon overzetten');
 try{
  const target=await get('/api/state');
  $('transfer-description').textContent=`Van telefoon: ${describe(source.match)}. Op de NUC: ${describe(target.match)}. De NUC-partij wordt eerst opgeslagen. Daarna speel je verder op de NUC; deze telefoon bedient die partij.`;
  selection={path:'/api/match-transfer',body:{...source,revision:target.revision}};
  $('transfer-confirm').textContent='Overzetten en huidige partij bewaren';$('transfer-confirm').hidden=false;
 }catch(e){$('transfer-message').textContent=e.message;}
}
async function listBackups(){
 open('Opgeslagen NUC-partijen');
 try{
  const data=await get('/api/match-backups');
  $('transfer-description').textContent=data.backups.length?'Kies een partij. De huidige partij wordt eerst bewaard. Maximaal 30 herstelkopieën / 100 MB; de oudste worden automatisch verwijderd, de nieuwste blijft behouden.':'Er zijn nog geen herstelkopieën van overgezette partijen. Maximaal 30 kopieën / 100 MB; de nieuwste blijft altijd behouden.';
  for(const item of data.backups.sort((a,b)=>b.time-a.time)){
   const b=document.createElement('button');b.className='wide';b.style.marginBottom='8px';
   b.textContent=`${new Date(item.time*1000).toLocaleString('nl-NL')} · ${String(item.game).toUpperCase()} · ${item.players.join(' / ')} · leg ${item.leg??1}`;
   const description=b.textContent,row=document.createElement('section');row.className='archive-match-row';
   const label=document.createElement('strong');label.textContent=description;
   const view=document.createElement('button');view.type='button';view.className='primary wide archive-view';view.textContent='Rapport bekijken';
   view.onclick=async()=>{try{const saved=await get(`/api/match-backups/${item.id}`),state=saved.match.state;dialog.close();reportDialog.querySelector('#game-report')?.remove();reportDialog.querySelector('#lives-summary')?.remove();$('archive-report-date').textContent=new Date(saved.time*1000).toLocaleString('nl-NL');if(state.game==='tenlives')renderLivesSummary(state,reportDialog);else renderGameReport(state,reportDialog);if(!reportDialog.open)reportDialog.showModal();}catch(e){$('transfer-message').textContent=e.message;}};
   b.textContent='Partij terugzetten';b.className='wide archive-restore';b.style.marginBottom='0';b.onclick=async()=>{
    try{
     const target=await get('/api/state');
     selection={path:'/api/match-restore',body:{backup:item.id,revision:target.revision,requestId:Date.now().toString(36)+Math.random().toString(36).slice(2)}};
     $('transfer-description').textContent=`Terugzetten: ${description}. Huidige partij: ${describe(target.match)}. Deze wordt eerst bewaard.`;
     $('transfer-items').replaceChildren();$('transfer-confirm').textContent='Terugzetten en huidige partij bewaren';$('transfer-confirm').hidden=false;
    }catch(e){$('transfer-message').textContent=e.message;}
   };
   row.append(label,view,b);$('transfer-items').append(row);
  }
 }catch(e){$('transfer-message').textContent=e.message;}
}
$('transfer-confirm').onclick=async()=>{
 if(working||!selection)return;
 if(!canControl()&&window.DartsAndroid?.isTabletShell){$('transfer-message').textContent='Sluit dit venster en kies onder Verbindingen voor Bediening overnemen.';return;}
 if(!canControl()){$('transfer-message').textContent='Sluit dit venster en kies eerst Verbindingen → Bediening overnemen.';return;}
 working=true;$('transfer-confirm').disabled=true;$('transfer-close').disabled=true;
 try{
  const r=await fetch(selection.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection.body),signal:AbortSignal.timeout(12000)});
  const result=await r.json();
  if(!r.ok)throw Error(result.error||'Overzetten niet bevestigd.');
  if(selection.path==='/api/match-transfer')android?.clearPendingNucTransfer?.();
  dialog.close();document.dispatchEvent(new Event('controller-refresh'));
  if(transferButton&&!local)transferButton.hidden=true;
 }catch(e){$('transfer-message').textContent=e.message+' Bij geen bevestiging kun je dezelfde opdracht opnieuw proberen. Bij een gewijzigde NUC-partij: sluit en open dit venster opnieuw.';}
 finally{working=false;$('transfer-confirm').disabled=false;$('transfer-close').disabled=false;}
};
$('transfer-close').onclick=()=>dialog.close();
$('archive-report-close').onclick=()=>reportDialog.close();
dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});
let transferButton=null;
if(local&&android?.prepareNucTransfer){
 transferButton=button('transfer-to-nuc','Partij overzetten naar NUC',()=>document.dispatchEvent(new Event('prepare-phone-transfer')));
}else if(!local){
 button('match-backups','Opgeslagen NUC-partijen',listBackups);
 if(pending()){
  transferButton=button('transfer-to-nuc','Partij van telefoon overzetten',previewTransfer);
  const timer=setInterval(()=>{if(canControl()&&!pendingShown){pendingShown=true;clearInterval(timer);void previewTransfer();}},750);
 }
}
