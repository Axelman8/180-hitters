export const livesTargets=[20,19,18,17,16,15,14,13,12,11,10,25];
export const livesLabel=(state,player)=>player.livesTarget===25?'Bull (50)':(state.livesMode==='triple'?'T':'D')+player.livesTarget;

// A recorded input is one physical dart. Only exhausting a target ends a visit.
export function applyLivesDart(state,turn){
 if(state.phase!=='playing')throw Error('Deze training is afgelopen.');
 if(typeof turn.trainingHit!=='boolean')throw Error('Kies Doel geraakt of Mis voor deze pijl.');
 const s=structuredClone(state),index=s.active,p=s.players[index],target=p.livesTarget;
 if(p.lives<=0)throw Error('Deze speler is uitgeschakeld.');
 p.attempts--;p.darts++;let ended=false;
 if(turn.trainingHit){
  p.livesHits++;
  if(target===25){s.phase='won';s.winner=index;s.reason='lives-bull';}
  else{p.livesTarget=livesTargets[livesTargets.indexOf(target)+1];p.attempts+=3;}
 }else if(p.attempts===0){
  ended=true;
  if(target===20)p.lives--;
  else p.livesTarget=livesTargets[livesTargets.indexOf(target)-1];
  p.attempts=p.lives>0?3:0;
  s.turns++;
  const alive=s.players.map((p,i)=>p.lives>0?i:-1).filter(i=>i>=0);
  if(!alive.length){s.phase='won';s.winner=null;s.reason='lives-eliminated';}
  else{do{s.active=(s.active+1)%s.players.length;}while(s.players[s.active].lives===0);}
 }
 p.remaining=p.lives;
 s.history.push({name:p.name,player:index,leg:1,target,score:turn.trainingHit?1:0,darts:1,remaining:p.lives,lives:p.lives,attempts:p.attempts,nextTarget:p.livesTarget,ended,labels:turn.trainingHit?'Raak':'Mis',input:{trainingHit:turn.trainingHit}});
 return s;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function renderLives(state,actions){
 let root=document.getElementById('lives-game');
 if(!root){root=el('section',undefined,'lives-game');root.id='lives-game';document.getElementById('game').append(root);}
 root.replaceChildren();
 const heading=el('div',undefined,'lives-heading');heading.append(el('h2','10 levens'),el('span',state.livesMode==='triple'?'Triples · 20 t/m 10 → Bull':'Doubles · 20 t/m 10 → Bull'));root.append(heading);
 const cards=el('div',undefined,'lives-players');cards.style.setProperty('--count',state.players.length);
 state.players.forEach((p,i)=>{
  const card=el('article',undefined,'lives-player'+(i===state.active?' active':'')+(p.lives===0?' eliminated':''));
  card.append(el('h3',p.name),el('strong',p.lives===0?'Uitgeschakeld':livesLabel(state,p),'lives-goal'),el('p',p.lives===0?'Geen pogingen meer':`${p.attempts} ${p.attempts===1?'poging':'pogingen'}`));
  const marks=el('div',undefined,'life-marks');marks.setAttribute('aria-label',`${p.lives} van 10 levens`);
  for(let i=0;i<10;i++)marks.append(el('i',String(i+1),i<p.lives?'available':'lost'));
  card.append(marks,el('small',`${p.lives} / 10 levens`));cards.append(card);
 });root.append(cards);
 const p=state.players[state.active],focus=el('div',undefined,'lives-focus panel');
 focus.append(el('p',p.name,'lives-name'),el('strong',livesLabel(state,p),'lives-current'),el('p',`${p.attempts} ${p.attempts===1?'poging':'pogingen'} over`,'lives-attempts'));
 const route=el('div',undefined,'lives-route');
 for(const target of livesTargets){const n=el('span',target===25?'Bull':String(target));if(target===p.livesTarget)n.className='current';route.append(n);}focus.append(route);root.append(focus);
 const controls=el('section',undefined,'lives-controls panel');
 const btn=(text,id,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.id=id;b.onclick=fn;return b;};
 const tiles=el('div',undefined,'lives-entry');
 tiles.append(btn(`${livesLabel(state,p)} geraakt`,'lives-hit',()=>actions.dart(true),'primary'),btn('Mis / ander vak','lives-miss',()=>actions.dart(false),'lives-miss'));
 for(const b of tiles.children)b.disabled=state.phase!=='playing';
 controls.append(tiles,el('p','Voer elke pijl direct in. Alleen het aangegeven doel telt. Bull is uitsluitend 50.','lives-hint'));
 const undo=btn('Vorige pijl herstellen','lives-undo',actions.undo,'lives-undo');undo.disabled=!actions.canUndo;
 const redo=btn('Volgende pijl →','lives-redo',actions.redo);redo.disabled=!actions.canRedo;
 const history=el('div',undefined,'lives-history-actions');history.append(undo,redo);controls.append(history);
 const toggle=btn('Scherminvoer in-/uitklappen','lives-toggle',actions.toggle);controls.append(toggle);root.append(controls);
 const last=state.history.at(-1);
 const note=el('p',last?`${last.name}: ${last.target===25?'Bull':(state.livesMode==='triple'?'T':'D')+last.target} ${last.labels.toLowerCase()}${last.ended?(last.lives===0?' · uitgeschakeld':last.target===20?' · één leven kwijt':' · één doel terug'):''}`:'Raak het doel om door te gaan. Overgebleven pijlen + 3 voor het volgende doel.','lives-last');note.setAttribute('aria-live','polite');root.append(note);
}
