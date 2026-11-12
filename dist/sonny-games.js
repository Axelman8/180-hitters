export const sonnyGameIds=['scram','killer','bull41','twentyone'];
export const sonnyGameNames={scram:'Scram',killer:'Killer',bull41:'Bull / 41',twentyone:'21'};
const symbols=['○','×','△','□'];
const targetId=number=>number===25?20:number-1;
const dartScore=hit=>hit.number===25?(hit.mult===2?50:25):hit.number*hit.mult;
const dartLabel=hit=>hit.number===0?'Mis':hit.number===25?(hit.mult===2?'BB':'sB'):(hit.mult===1?'':hit.mult===2?'D':'T')+hit.number;
const basePlayer=(name,index)=>({name,sonnySymbol:symbols[index],remaining:0,legs:0,sets:0,setLegs:0,points:0,darts:0,best:0,opened:true,marks:{},cricketPoints:0,totalMarks:0});
function common(names,game,starter){
 const minimum=game==='twentyone'?1:2;if(names.length<minimum||names.length>4)throw Error(`${sonnyGameNames[game]} wordt met ${minimum} tot 4 spelers gespeeld.`);
 if(!Number.isInteger(starter)||starter<0||starter>=names.length)starter=0;
 return {version:2,game,start:0,out:'single',inMode:'single',scoring:'standard',matchMode:'off',target:1,legsPerSet:1,bull:'25/50',maxRounds:0,players:names.map(basePlayer),active:starter,starter,leg:1,round:1,turns:0,set:1,history:[],phase:'playing',winner:null,startedAt:Date.now()};
}
const opponents=(state,player)=>state.players.map((_,index)=>index).filter(index=>index!==player);
function beginScramPhase(state){const order=opponents(state,state.scramScorer);state.scramClosed=Array(21).fill(false);state.scramRole='stopper';state.active=order[0];state.scramStopperCursor=order.length>1?1:0;}
function beginBullPhase(state){const order=opponents(state,state.bull41Scorer);state.bull41Marks=0;state.bull41Role='bull';state.active=order[0];state.bull41ThrowerCursor=order.length>1?1:0;}
export function newSonnyMatch(names,game,starter=0){
 const state=common(names,game,starter);
 if(game==='scram'){state.players.forEach(player=>player.scramScore=0);state.scramPhase=0;state.scramScorer=starter;beginScramPhase(state);}
 if(game==='killer'){state.killerStage='assigning';state.players.forEach(player=>Object.assign(player,{killerNumber:null,killerLetters:0,killerActivated:false,killerInitial:true,killerEliminated:false}));}
 if(game==='bull41'){state.players.forEach(player=>player.bull41Score=0);state.bull41Phase=0;state.bull41Scorer=starter;beginBullPhase(state);}
 if(game==='twentyone'){state.players.forEach(player=>Object.assign(player,{twentyOneTarget:1,twentyOneDarts:0,twentyOneTriples:0,twentyOneFinished:false,twentyOneAdjusted:null}));}
 return state;
}
function validateHits(turn,min=3,max=3){
 if(!Array.isArray(turn.hits)||turn.hits.length<min||turn.hits.length>max)throw Error(`Voer ${min===max?min:`${min} tot ${max}`} pijlen in.`);
 return turn.hits.map(raw=>{const number=Number(raw.number),mult=Number(raw.mult);if(!Number.isInteger(number)||!Number.isInteger(mult)||![1,2,3].includes(mult)||(![0,25].includes(number)&&(number<1||number>20))||(number===25&&mult===3)||(number===0&&mult!==1))throw Error('Ongeldige pijl.');return {number,mult,label:dartLabel({number,mult})};});
}
function finishByScore(state,field,high=true,tieField=null){
 const values=state.players.map(player=>player[field]),best=(high?Math.max:Math.min)(...values),leaders=values.map((value,index)=>value===best?index:-1).filter(index=>index>=0);
 if(leaders.length===1){state.winner=leaders[0];state.phase='won';return;}
 if(tieField){const tieBest=Math.max(...leaders.map(index=>state.players[index][tieField]));const tied=leaders.filter(index=>state.players[index][tieField]===tieBest);state.winner=tied.length===1?tied[0]:null;}else state.winner=null;
 state.phase='won';
}
function applyScram(state,turn){
 const hits=validateHits(turn),s=structuredClone(state),actor=s.active,role=s.scramRole;let score=0;
 if(role==='stopper'){for(const hit of hits)if(hit.number)s.scramClosed[targetId(hit.number)]=true;}
 else{for(const hit of hits)if(hit.number&&!s.scramClosed[targetId(hit.number)])score+=dartScore(hit);}
 if(role==='scorer'){s.players[actor].scramScore+=score;s.players[actor].points+=score;s.players[actor].best=Math.max(s.players[actor].best,score);}
 s.players[actor].darts+=3;s.history.push({input:{hits},name:s.players[actor].name,player:actor,darts:3,score,role,labels:hits.map(dartLabel).join(' / '),leg:1});s.turns++;
 if(role==='stopper'){
  if(s.scramClosed.every(Boolean)){
   s.scramPhase++;if(s.scramPhase>=s.players.length){finishByScore(s,'scramScore');return s;}
   s.scramScorer=(s.starter+s.scramPhase)%s.players.length;beginScramPhase(s);
  }else{s.scramRole='scorer';s.active=s.scramScorer;}
 }else{
  const order=opponents(s,s.scramScorer);s.scramRole='stopper';s.active=order[s.scramStopperCursor%order.length];s.scramStopperCursor=(s.scramStopperCursor+1)%order.length;
 }
 s.round++;return s;
}
function nextAlive(state,from){for(let step=1;step<=state.players.length;step++){const index=(from+step)%state.players.length;if(!state.players[index].killerEliminated)return index;}return from;}
function applyKiller(state,turn){
 const s=structuredClone(state),actor=s.active,p=s.players[actor];
 if(s.killerStage==='assigning'){
  const [hit]=validateHits(turn,1,1);if(hit.number<1||hit.number>20)throw Error('Gooi voor je eigen getal op 1 tot en met 20.');if(s.players.some(player=>player.killerNumber===hit.number))throw Error('Dit getal is al van een andere speler. Gooi opnieuw.');
  p.killerNumber=hit.number;p.darts++;s.history.push({input:{hits:[hit]},name:p.name,player:actor,darts:1,score:0,role:'nummer kiezen',labels:dartLabel(hit),leg:1});s.turns++;
  const missing=s.players.findIndex(player=>player.killerNumber===null);if(missing>=0)s.active=missing;else{s.killerStage='playing';s.active=s.starter;s.round=1;}return s;
 }
 const hits=validateHits(turn);for(const hit of hits){
  if(!hit.number)continue;const target=s.players.findIndex(player=>player.killerNumber===hit.number);if(target<0)continue;
  if(target===actor){if(!p.killerEliminated&&p.killerLetters<6){p.killerLetters++;if(p.killerLetters===6)p.killerActivated=true;}}
  else if(p.killerLetters===6&&p.killerActivated&&!s.players[target].killerEliminated){const victim=s.players[target];if(victim.killerLetters>0)victim.killerLetters--;else{victim.killerInitial=false;victim.killerEliminated=true;}}
 }
 p.darts+=3;s.history.push({input:{hits},name:p.name,player:actor,darts:3,score:0,role:'killer',labels:hits.map(dartLabel).join(' / '),leg:1});s.turns++;
 const alive=s.players.map((player,index)=>!player.killerEliminated?index:-1).filter(index=>index>=0);if(alive.length===1){s.winner=alive[0];s.phase='won';return s;}s.active=nextAlive(s,actor);s.round++;return s;
}
function applyBull41(state,turn){
 const hits=validateHits(turn),s=structuredClone(state),actor=s.active,role=s.bull41Role;let score=0,marks=0;
 if(role==='bull'){marks=hits.reduce((sum,hit)=>sum+(hit.number===25?hit.mult:0),0);s.bull41Marks=Math.min(25,s.bull41Marks+marks);}
 else{const total=hits.reduce((sum,hit)=>sum+dartScore(hit),0);score=Math.max(0,total-41);s.players[actor].bull41Score+=score;s.players[actor].points+=score;s.players[actor].best=Math.max(s.players[actor].best,total);}
 s.players[actor].darts+=3;s.history.push({input:{hits},name:s.players[actor].name,player:actor,darts:3,score,marks,role,labels:hits.map(dartLabel).join(' / '),leg:1});s.turns++;
 if(role==='bull'){
  if(s.bull41Marks>=25){s.bull41Phase++;if(s.bull41Phase>=s.players.length){finishByScore(s,'bull41Score');return s;}s.bull41Scorer=(s.starter+s.bull41Phase)%s.players.length;beginBullPhase(s);}
  else{s.bull41Role='scorer';s.active=s.bull41Scorer;}
 }else{const order=opponents(s,s.bull41Scorer);s.bull41Role='bull';s.active=order[s.bull41ThrowerCursor%order.length];s.bull41ThrowerCursor=(s.bull41ThrowerCursor+1)%order.length;}
 s.round++;return s;
}
function previewTwentyOnePlayer(player,hits){
 const result={...player};for(const hit of hits){if(result.twentyOneFinished)break;result.twentyOneDarts++;const target=result.twentyOneTarget;if((target===21&&hit.number===25)||(target<=20&&hit.number===target)){if(hit.mult===3)result.twentyOneTriples++;result.twentyOneTarget+=target===21?1:hit.mult;if(result.twentyOneTarget>21){result.twentyOneFinished=true;result.twentyOneAdjusted=result.twentyOneDarts-(target===20&&hit.mult===3?1:0);}}}return result;
}
function applyTwentyOne(state,turn){
 const hits=validateHits(turn,1,3),s=structuredClone(state),actor=s.active,p=s.players[actor],preview=previewTwentyOnePlayer(p,hits);if(!preview.twentyOneFinished&&hits.length!==3)throw Error('Voer alle drie de pijlen in.');Object.assign(p,preview);p.darts+=hits.length;s.history.push({input:{hits},name:p.name,player:actor,darts:hits.length,score:0,role:'21',labels:hits.map(dartLabel).join(' / '),leg:1});s.turns++;
 if(s.players.every(player=>player.twentyOneFinished)){finishByScore(s,'twentyOneAdjusted',false,'twentyOneTriples');return s;}
 for(let step=1;step<=s.players.length;step++){const index=(actor+step)%s.players.length;if(!s.players[index].twentyOneFinished){s.active=index;break;}}s.round++;return s;
}
export function applySonnyTurn(state,turn){if(state.game==='scram')return applyScram(state,turn);if(state.game==='killer')return applyKiller(state,turn);if(state.game==='bull41')return applyBull41(state,turn);if(state.game==='twentyone')return applyTwentyOne(state,turn);throw Error('Onbekend Sonny-spel.');}
export function sonnyAutoCommit(state,hits){if(state.game==='killer'&&state.killerStage==='assigning')return hits.length===1;if(state.game==='twentyone')return hits.length===3||previewTwentyOnePlayer(state.players[state.active],hits).twentyOneFinished;return hits.length===3;}

const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function playerStatus(state,player,index){
 if(state.game==='scram')return `${player.scramScore} punten${index===state.scramScorer?' · scoorder':''}`;
 if(state.game==='bull41')return `${player.bull41Score} punten${index===state.bull41Scorer?' · puntengooier':''}`;
 if(state.game==='killer')return state.killerStage==='assigning'?`Eigen getal: ${player.killerNumber??'–'}`:player.killerEliminated?'Uitgeschakeld':`#${player.killerNumber} · ${'KILLER'.slice(0,player.killerLetters)}${'·'.repeat(6-player.killerLetters)}${player.killerInitial?' · ♥':''}`;
 return player.twentyOneFinished?`${player.twentyOneAdjusted} pijlen · ${player.twentyOneTriples} triples`:`Doel: ${player.twentyOneTarget===21?'Bull':player.twentyOneTarget}`;
}
export function renderSonnyGame(root,state,pending,actions){
 root.replaceChildren();const heading=el('div',undefined,'sonny-heading');heading.append(el('h2',sonnyGameNames[state.game]),el('p',state.game==='scram'?`${state.scramRole==='stopper'?'Stopper':'Scoorder'} aan de beurt · ${state.scramClosed.filter(Boolean).length}/21 gestopt`:state.game==='bull41'?`${state.bull41Role==='bull'?'Bullwerper':'Puntengooier'} · ${state.bull41Marks}/25 bullmarks`:state.game==='killer'?(state.killerStage==='assigning'?'Gooi één pijl met je verkeerde hand voor een uniek eigen getal.':'Bouw KILLER op en raak daarna het getal van een tegenstander.'):state.players[state.active].twentyOneFinished?'Klaar':`Raak ${state.players[state.active].twentyOneTarget===21?'Bull':state.players[state.active].twentyOneTarget}. Single +1, dubbel +2, triple +3.`));root.append(heading);
 const players=el('div',undefined,'sonny-players');state.players.forEach((player,index)=>{const card=el('article',undefined,index===state.active?'active':'');card.style.setProperty('--sonny-color',`var(--four-p${index})`);card.append(el('b',player.sonnySymbol,'sonny-symbol'),el('strong',player.name),el('small',playerStatus(state,player,index)));players.append(card);});root.append(players);
 const layout=el('div',undefined,'sonny-layout'),board=el('section',undefined,'sonny-board');for(const number of [...Array.from({length:20},(_,index)=>index+1),25]){const button=el('button',number===25?'Bull':String(number),'sonny-target');button.type='button';button.dataset.number=String(number);
  if(state.game==='scram'&&state.scramClosed[targetId(number)])button.classList.add('closed');
  if(state.game==='twentyone'&&(state.players[state.active].twentyOneTarget===number||(number===25&&state.players[state.active].twentyOneTarget===21)))button.classList.add('current');
  if(state.game==='killer')state.players.forEach((player,index)=>{if(player.killerNumber===number){button.classList.add('assigned');button.style.setProperty('--target-color',`var(--four-p${index})`);button.append(el('i',player.sonnySymbol));}});
  if(state.game==='bull41'&&state.bull41Role==='bull'&&number===25)button.classList.add('current');button.disabled=pending.length>=3||(state.game==='killer'&&state.killerStage==='assigning'&&number===25);button.onclick=()=>actions.hit(number);board.append(button);
 }layout.append(board);
 const controls=el('aside',undefined,'sonny-controls'),multipliers=el('div',undefined,'sonny-multipliers');for(const [mult,text] of [[1,'Single'],[2,'Double'],[3,'Triple']]){const button=el('button',text,mult===actions.multiplier?'selected':'');button.type='button';button.onclick=()=>actions.setMultiplier(mult);multipliers.append(button);}controls.append(multipliers);
 const darts=el('div',undefined,'sonny-darts');for(let index=0;index<3;index++)darts.append(el('span',pending[index]?.label||`Pijl ${index+1}`));controls.append(darts);
 const actionRow=el('div',undefined,'sonny-actions'),miss=el('button','Mis');miss.type='button';miss.disabled=pending.length>=3||state.game==='killer'&&state.killerStage==='assigning';miss.onclick=actions.miss;const remove=el('button','Laatste wissen');remove.type='button';remove.disabled=!pending.length;remove.onclick=actions.remove;const confirm=el('button','Bevestigen','primary');confirm.type='button';confirm.disabled=state.game==='killer'&&state.killerStage==='assigning'?pending.length!==1:pending.length!==3;confirm.onclick=actions.confirm;actionRow.append(miss,remove,confirm);controls.append(actionRow);layout.append(controls);root.append(layout);
}
