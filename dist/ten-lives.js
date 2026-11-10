export const livesTargets=[20,19,18,17,16,15,14,13,12,11,10,25];
export const livesLabel=(state,player)=>player.livesTarget===25?'Bull (50)':(state.livesMode==='triple'?'T':'D')+player.livesTarget;

// A recorded input is one physical dart. Only exhausting a target ends a visit.
export function applyLivesDart(state,turn){
 if(state.phase!=='playing')throw Error('Deze training is afgelopen.');
 if(turn.trainingMisses!==undefined){
  const count=turn.trainingMisses;
  if(!Number.isInteger(count)||count<1||count>3||count>state.players[state.active].attempts)throw Error('Kies maximaal drie resterende pogingen.');
  let next=state;
  for(let i=0;i<count;i++)next=applyLivesDart(next,{trainingHit:false});
  const last=next.history.at(-1);
  next.history.splice(state.history.length,count,{...last,darts:count,labels:`${count} keer mis`,input:{trainingMisses:count}});
  return next;
 }
 if(typeof turn.trainingHit!=='boolean')throw Error('Kies Doel geraakt of Mis voor deze pijl.');
 const s=structuredClone(state),index=s.active,p=s.players[index],target=p.livesTarget;
 if(p.lives<=0)throw Error('Deze speler is uitgeschakeld.');
 p.attempts--;p.darts++;let ended=false;
 if(turn.trainingHit){
  p.livesHits++;
  if(target===25){s.phase='won';s.winner=index;s.reason='lives-bull';s.completedAt=Date.now();}
  else{p.livesTarget=livesTargets[livesTargets.indexOf(target)+1];p.attempts+=3;}
 }else if(p.attempts===0){
  ended=true;
  if(target===20)p.lives--;
  else p.livesTarget=livesTargets[livesTargets.indexOf(target)-1];
  p.attempts=p.lives>0?3:0;
  s.turns++;
  const alive=s.players.map((p,i)=>p.lives>0?i:-1).filter(i=>i>=0);
  if(!alive.length){s.phase='won';s.winner=null;s.reason='lives-eliminated';s.completedAt=Date.now();}
  else{do{s.active=(s.active+1)%s.players.length;}while(s.players[s.active].lives===0);}
 }
 p.remaining=p.lives;
 s.history.push({name:p.name,player:index,leg:1,target,score:turn.trainingHit?1:0,darts:1,remaining:p.lives,lives:p.lives,attempts:p.attempts,nextTarget:p.livesTarget,ended,labels:turn.trainingHit?'Raak':'Mis',recordedAt:Date.now(),input:{trainingHit:turn.trainingHit}});
 return s;
}

const targetLabel=(state,target)=>target===25?'Bull':(state.livesMode==='triple'?'T':'D')+target;
const clock=value=>value?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'Niet geregistreerd';

// Build one row for every completed target attempt. This works for solo play and
// for players whose attempts are interleaved in a multiplayer training.
export function livesSummary(state){
 const pending=new Map(),rows=[],rounds=new Map();
 const finish=(playerIndex,success)=>{
  const item=pending.get(playerIndex);if(!item)return;
  const round=(rounds.get(playerIndex)||0)+1;rounds.set(playerIndex,round);
  rows.push({...item,round,success});pending.delete(playerIndex);
 };
 for(const turn of state.history||[]){
  const playerIndex=Number.isInteger(turn.player)?turn.player:Math.max(0,state.players.findIndex(player=>player.name===turn.name));
  let item=pending.get(playerIndex);
  if(item&&item.target!==turn.target){finish(playerIndex,false);item=null;}
  if(!item){item={playerIndex,player:state.players[playerIndex]?.name||turn.name||'Speler',target:turn.target,darts:0,throws:[]};pending.set(playerIndex,item);}
  const count=Math.max(1,Number(turn.darts)||1),hit=Number(turn.score)>0;
  item.darts+=count;
  for(let dart=0;dart<count;dart++)item.throws.push(hit&&dart===count-1?'Raak':'Mis');
  if(hit)finish(playerIndex,true);else if(turn.ended)finish(playerIndex,false);
 }
 for(const playerIndex of [...pending.keys()])finish(playerIndex,false);
 const goals=new Map();
 for(const row of rows){
  const label=targetLabel(state,row.target),goal=goals.get(label)||{label,target:row.target,attempts:0,hits:0,oneDart:0,darts:0};
  goal.attempts++;goal.darts+=row.darts;
  if(row.success){goal.hits++;if(row.darts===1)goal.oneDart++;}
  goals.set(label,goal);
 }
 const ranking=[...goals.values()].sort((a,b)=>{
  const aAverage=a.darts/a.attempts,bAverage=b.darts/b.attempts;
  return aAverage-bAverage||b.oneDart-a.oneDart||b.hits/b.attempts-a.hits/a.attempts||livesTargets.indexOf(a.target)-livesTargets.indexOf(b.target);
 });
 return {
  title:`Hitters Challenge - ${state.livesMode==='triple'?'Triples':'Doubles'}`,
  started:clock(state.startedAt),ended:clock(state.completedAt),
  totalDarts:state.players.reduce((total,player)=>total+(Number(player.darts)||0),0),
  rows,ranking,oneDart:ranking.filter(goal=>goal.oneDart>0)
 };
}

export function renderLivesSummary(state,dialog){
 dialog.querySelector('#lives-summary')?.remove();
 const report=livesSummary(state),section=el('section',undefined,'lives-summary');section.id='lives-summary';section.setAttribute('aria-label','Samenvatting Hitters Challenge');
 section.append(el('h3',report.title));
 const meta=el('dl',undefined,'lives-summary-meta');
 for(const [label,value] of [['Begintijd',report.started],['Eindtijd',report.ended],['Darts totaal',String(report.totalDarts)]]){meta.append(el('dt',label),el('dd',value));}
 section.append(meta);
 const one=el('div',undefined,'lives-summary-one');one.append(el('h4','Met 1 dart geraakt'),el('p',report.oneDart.length?report.oneDart.map(goal=>`${goal.label} × ${goal.oneDart}`).join(' · '):'Geen doel met de eerste dart geraakt.'));section.append(one);
 const ranking=el('div',undefined,'lives-summary-ranking');ranking.append(el('h4','Sterkst naar zwakst'));
 const rankingList=el('ol');for(const goal of report.ranking){const average=(goal.darts/goal.attempts).toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1});rankingList.append(el('li',`${goal.label} - ${average} darts gemiddeld${goal.oneDart?` · ${goal.oneDart}× met 1 dart`:''}`));}ranking.append(rankingList);section.append(ranking);
 const wrap=el('div',undefined,'lives-summary-table-wrap'),table=el('table',undefined,'lives-summary-table'),head=table.createTHead(),header=head.insertRow();
 for(const label of ['Ronde','Doel','Aantal darts','Darts gegooid'])header.append(el('th',label));
 const body=table.createTBody(),multi=state.players.length>1;
 for(const row of report.rows){const tr=body.insertRow();for(const value of [multi?`${row.round} · ${row.player}`:String(row.round),targetLabel(state,row.target),String(row.darts),row.throws.join(' · ')])tr.append(el('td',value));if(!row.success)tr.className='missed';}
 wrap.append(table);section.append(wrap);dialog.querySelector('#result-title').after(section);
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function renderLives(state,actions){
 let root=document.getElementById('lives-game');
 if(!root){root=el('section',undefined,'lives-game');root.id='lives-game';document.getElementById('game').append(root);}
 root.replaceChildren();
 const heading=el('div',undefined,'lives-heading');heading.append(el('h2','Hitters Challenge'),el('span',state.livesMode==='triple'?'Triples · 20 t/m 10 → Bull':'Doubles · 20 t/m 10 → Bull'));root.append(heading);
 const cards=el('div',undefined,'lives-players');cards.style.setProperty('--count',state.players.length);
 state.players.forEach((p,i)=>{
  const card=el('article',undefined,'lives-player'+(i===state.active?' active':'')+(p.lives===0?' eliminated':''));
  card.append(el('h3',p.name),el('strong',p.lives===0?'Uitgeschakeld':livesLabel(state,p),'lives-goal'),el('p',p.lives===0?'Geen pogingen meer':`${p.attempts} ${p.attempts===1?'poging':'pogingen'}`));
  const marks=el('div',undefined,'life-marks');marks.setAttribute('aria-label',`${p.lives} van 10 levens`);
  for(let i=0;i<10;i++)marks.append(el('i',String(i+1),i<p.lives?'available':'lost'));
  card.append(marks,el('small',`${p.lives} / 10 levens`));cards.append(card);
 });root.append(cards);
 const p=state.players[state.active],focus=el('div',undefined,'lives-focus panel');
 const target=el('div',undefined,'lives-target-block');
 target.append(el('span','DOEL','lives-focus-label'),el('strong',livesLabel(state,p),'lives-current'));
 const attempts=el('div',undefined,'lives-attempts'+(p.attempts<=2?' last-attempts':''));
 attempts.setAttribute('role','status');attempts.setAttribute('aria-label',`${p.attempts} ${p.attempts===1?'poging':'pogingen'} over voor ${livesLabel(state,p)}`);
 attempts.append(el('strong',String(p.attempts),'lives-attempt-count'),document.createTextNode(' '),el('span',`${p.attempts===1?'poging':'pogingen'} over`,'lives-attempt-label'));
 const focusValues=el('div',undefined,'lives-focus-values');focusValues.append(target,attempts);
 focus.append(el('p',p.name,'lives-name'),focusValues);
 const route=el('div',undefined,'lives-route');
 for(const target of livesTargets){const n=el('span',target===25?'Bull':String(target));if(target===p.livesTarget)n.className='current';route.append(n);}focus.append(route);root.append(focus);
 const controls=el('section',undefined,'lives-controls panel');
 const btn=(text,id,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.id=id;b.onclick=fn;return b;};
 const tiles=el('div',undefined,'lives-entry');
 tiles.append(btn('Raak','lives-hit',()=>actions.dart(true),'primary'),btn('Mis','lives-miss',()=>actions.dart(false),'lives-miss'),btn(`${Math.min(3,p.attempts)} keer mis`,'lives-miss-three',()=>actions.misses(Math.min(3,p.attempts)),'lives-miss lives-miss-three'));
 tiles.querySelector('#lives-hit').setAttribute('aria-label',`${livesLabel(state,p)} geraakt`);
 for(const b of tiles.children)b.disabled=state.phase!=='playing';
 controls.append(tiles,el('p','Voer elke pijl direct in. Alleen het aangegeven doel telt. Bull is uitsluitend 50.','lives-hint'));
 const undo=btn('Vorige invoer herstellen','lives-undo',actions.undo,'lives-undo');undo.disabled=!actions.canUndo;
 const redo=btn('Volgende pijl →','lives-redo',actions.redo);redo.disabled=!actions.canRedo;
 const history=el('div',undefined,'lives-history-actions');history.append(undo,redo);controls.append(history);
 const toggle=btn('Scherminvoer in-/uitklappen','lives-toggle',actions.toggle);controls.append(toggle);root.append(controls);
 const last=state.history.at(-1);
 const note=el('p',last?`${last.name}: ${last.target===25?'Bull':(state.livesMode==='triple'?'T':'D')+last.target} ${last.labels.toLowerCase()}${last.ended?(last.lives===0?' · uitgeschakeld':last.target===20?' · één leven kwijt':' · één doel terug'):''}`:'Raak het doel om door te gaan. Overgebleven pijlen + 3 voor het volgende doel.','lives-last');note.setAttribute('aria-live','polite');root.append(note);
}
