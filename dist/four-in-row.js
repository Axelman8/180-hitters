export const fourSymbols=['○','×','△','□'];
const corners=new Map([[0,'sb1'],[4,'sb2'],[20,'sb3'],[24,'sb4']]);
const lines=[];
for(let row=0;row<5;row++)for(let col=0;col<=1;col++)lines.push([0,1,2,3].map(step=>row*5+col+step));
for(let col=0;col<5;col++)for(let row=0;row<=1;row++)lines.push([0,1,2,3].map(step=>(row+step)*5+col));
for(let row=0;row<=1;row++)for(let col=0;col<=1;col++)lines.push([0,1,2,3].map(step=>(row+step)*5+col+step));
for(let row=0;row<=1;row++)for(let col=3;col<5;col++)lines.push([0,1,2,3].map(step=>(row+step)*5+col-step));

const label=id=>id==='bb'?'BB':id.startsWith('sb')?'sB':id.slice(1);
const value=id=>id==='bb'?25:id.startsWith('sb')?25:Number(id.slice(1));
function sattolo(values,random=Math.random){
 const result=[...values];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*i);[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
export function createFourBoard(previous=null,random=Math.random){
 const numberPositions=[...Array(25).keys()].filter(index=>index!==12&&!corners.has(index));
 let numbers;
 if(Array.isArray(previous)&&previous.length===25){
  const prior=numberPositions.map(index=>previous[index]).filter(id=>/^n\d+$/.test(id));
  numbers=prior.length===20?sattolo(prior,random):sattolo(Array.from({length:20},(_,index)=>`n${index+1}`),random);
 }else numbers=sattolo(Array.from({length:20},(_,index)=>`n${index+1}`),random);
 const board=Array(25);for(const [index,id] of corners)board[index]=id;board[12]='bb';numberPositions.forEach((position,index)=>board[position]=numbers[index]);return board;
}
export function fourWinningLine(owners,player){return lines.find(line=>line.every(index=>owners[index]===player))||null;}
function targetPriority(state,index,player,random){
 let score=0;
 for(const line of lines.filter(line=>line.includes(index))){
  const own=line.filter(cell=>state.fourOwners[cell]===player).length;
  const blocked=line.some(cell=>state.fourOwners[cell]!==null&&state.fourOwners[cell]!==player);
  if(!blocked)score+=own*own+1;
  for(let opponent=0;opponent<state.players.length;opponent++)if(opponent!==player){
   const theirs=line.filter(cell=>state.fourOwners[cell]===opponent).length;
   const defended=line.some(cell=>state.fourOwners[cell]!==null&&state.fourOwners[cell]!==opponent);
   if(!defended)score+=theirs===3?80:theirs*2;
  }
 }
 return score+(index===12?4:0)+random();
}
export function createFourBotTurn(state,random=Math.random){
 const shadow=structuredClone(state),player=shadow.active,hits=[];
 for(let dart=0;dart<3;dart++){
  const open=shadow.fourBoard.map((_,index)=>index).filter(index=>shadow.fourOwners[index]===null);
  if(!open.length){hits.push({cell:null,mult:1,number:0,label:'Mis'});continue;}
  const winning=open.find(index=>{const owners=[...shadow.fourOwners];owners[index]=player;return !!fourWinningLine(owners,player);});
  const ranked=open.map(index=>({index,score:targetPriority(shadow,index,player,random)})).sort((a,b)=>b.score-a.score);
  const cell=winning??ranked[0].index,id=shadow.fourBoard[cell],roll=random();let mult;
  if(id==='bb')mult=roll<.33?2:0;
  else if(id.startsWith('sb'))mult=roll<.6?1:0;
  else mult=roll<.12?0:roll<.54?1:roll<.82?2:3;
  if(!mult){hits.push({cell:null,mult:1,number:0,label:'Mis'});continue;}
  hits.push({cell,mult,number:id==='bb'||id.startsWith('sb')?25:value(id),label:id==='bb'?'BB':(mult===2?'D':mult===3?'T':'')+label(id)});
  const marks=id==='bb'||id.startsWith('sb')?3:mult,bot=shadow.players[player];bot.fourMarks[cell]=Math.min(3,(bot.fourMarks[cell]||0)+marks);
  if(bot.fourMarks[cell]>=3){shadow.fourOwners[cell]=player;shadow.players.forEach((candidate,index)=>candidate.fourMarks[cell]=index===player?3:0);if(fourWinningLine(shadow.fourOwners,player)||shadow.fourOwners.every(owner=>owner!==null))break;}
 }
 return {hits};
}
function applyVisit(state,turn){
 if(!Array.isArray(turn.hits)||turn.hits.length<1||turn.hits.length>3)throw Error('Voer een tot drie pijlen in.');
 const s=structuredClone(state),current=s.active,p=s.players[current];let score=0;
 const expireLooseMarks=()=>s.players.forEach((player,playerIndex)=>{player.fourMarks=player.fourMarks.map((marks,index)=>s.fourOwners[index]===playerIndex?3:0);});
 // Partial marks only live within one visit. This also cleans states made by older versions.
 expireLooseMarks();
 const labels=[];let winning=null,used=0;
 for(const raw of turn.hits){
  if(winning)throw Error('De partij was al gewonnen. Wis de extra pijlen.');
  used++;
  if(raw.cell===null||raw.cell===undefined||raw.mult===0){labels.push('Mis');continue;}
  const cell=Number(raw.cell),mult=Number(raw.mult),id=s.fourBoard[cell];
  if(!Number.isInteger(cell)||cell<0||cell>=25||![1,2,3].includes(mult)||!id)throw Error('Ongeldige pijl voor 4 op een rij.');
  if(id.startsWith('sb')&&mult!==1)throw Error('sB telt als single bull.');
  if(id==='bb'&&mult!==2)throw Error('BB telt als bull.');
  const marks=id==='bb'||id.startsWith('sb')?3:mult;labels.push((mult===2?'D':mult===3?'T':'')+label(id));score+=(id==='bb'?50:value(id)*mult);
  if(s.fourOwners[cell]===null){p.fourMarks[cell]=Math.min(3,(p.fourMarks[cell]||0)+marks);if(p.fourMarks[cell]>=3){s.fourOwners[cell]=current;s.players.forEach((player,index)=>player.fourMarks[cell]=index===current?3:0);winning=fourWinningLine(s.fourOwners,current);}}
 }
 const full=s.fourOwners.every(owner=>owner!==null);
 if(!winning&&!full&&turn.hits.length!==3)throw Error('Voer alle drie de pijlen in.');
 p.darts+=used;p.points+=score;p.best=Math.max(p.best,score);
 s.history.push({input:structuredClone(turn),name:p.name,player:current,score,darts:used,leg:1,labels:labels.join(' / '),captured:s.fourOwners.map((owner,index)=>owner===current&&state.fourOwners[index]!==current?index:-1).filter(index=>index>=0)});
 expireLooseMarks();
 if(winning){s.phase='won';s.winner=current;s.reason='four-in-row';s.fourWinningCells=winning;s.completedAt=Date.now();return s;}
 if(full){s.phase='won';s.winner=null;s.reason='four-draw';s.completedAt=Date.now();return s;}
 s.turns++;s.active=(current+1)%s.players.length;s.round=Math.floor(s.turns/s.players.length)+1;return s;
}
export function applyFourTurn(state,turn){
 if(state.phase!=='playing')throw Error('Deze partij is afgelopen.');
 let result=applyVisit(state,turn);
 if(result.phase==='playing'&&result.players[result.active]?.bot)result=applyVisit(result,createFourBotTurn(result));
 return result;
}
export function fourCellLabel(id){return label(id);}

const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
export function renderFourInRow(root,state,pending,actions){
 root.replaceChildren();
 const needsBullCorner=pending.some(hit=>hit.needsBullCorner);
 const legend=el('div',undefined,'four-legend');state.players.forEach((player,index)=>{const item=el('article',undefined,index===state.active?'active':'');item.style.setProperty('--player-color',`var(--four-p${index})`);item.append(el('b',fourSymbols[index],'four-symbol'),el('strong',player.name),player.bot?el('small','BOT · ±50 gemiddeld'):el('small',index===state.active?'Aan de beurt':''));legend.append(item);});root.append(legend);
 const layout=el('div',undefined,'four-layout'),board=el('section',undefined,'four-board');board.setAttribute('aria-label','4 op een rij speelveld');
 const pendingMarks=new Map();for(const hit of pending)if(Number.isInteger(hit.cell)){const id=state.fourBoard[hit.cell];pendingMarks.set(hit.cell,(pendingMarks.get(hit.cell)||0)+(id==='bb'||id.startsWith('sb')?3:hit.mult));}
 state.fourBoard.forEach((id,index)=>{
  const owner=state.fourOwners[index],pendingClaim=owner===null&&(pendingMarks.get(index)||0)>=3,displayOwner=pendingClaim?state.active:owner,cell=el('button',undefined,'four-cell');cell.type='button';cell.dataset.cell=String(index);cell.dataset.kind=id==='bb'?'bb':id.startsWith('sb')?'sb':'number';
  if(displayOwner!==null){cell.classList.add('owned',`player-${displayOwner}`);if(pendingClaim)cell.classList.add('pending-owned');cell.style.setProperty('--owner-color',`var(--four-p${displayOwner})`);cell.append(el('span',fourSymbols[displayOwner],'four-owner'));}
  else cell.append(el('strong',label(id)));
  if(state.fourWinningCells?.includes(index))cell.classList.add('winning');
  const progress=el('span',undefined,'four-progress');if(!pendingClaim)state.players.forEach((player,playerIndex)=>{const marks=Math.min(3,(player.fourMarks[index]||0)+(playerIndex===state.active?(pendingMarks.get(index)||0):0));if(marks)progress.append(el('i','•'.repeat(marks),`player-${playerIndex}`));});cell.append(progress);
  cell.disabled=state.phase!=='playing'||pendingClaim||!!state.players[state.active]?.bot||(needsBullCorner?(!id.startsWith('sb')||owner!==null):pending.length>=3);cell.onclick=()=>actions.hit(index);board.append(cell);
 });
 layout.append(board);
 const controls=el('aside',undefined,'four-controls');controls.append(el('p',needsBullCorner?'Autodarts zag single bull. Kies nu één van de vrije sB-hoekvakken.':'Getallen: maak 3 marks binnen deze beurt. Losse marks vervallen. sB en BB claim je direct.','four-help'));
 const multipliers=el('div',undefined,'four-multipliers');for(const [mult,text] of [[1,'Single'],[2,'Double'],[3,'Triple']]){const button=el('button',text,mult===actions.multiplier?'selected':'');button.type='button';button.onclick=()=>actions.setMultiplier(mult);multipliers.append(button);}controls.append(multipliers);
 const darts=el('div',undefined,'four-darts');for(let index=0;index<3;index++)darts.append(el('span',pending[index]?.label||`Pijl ${index+1}`));controls.append(darts);
 const miss=el('button','Mis','four-miss');miss.type='button';miss.disabled=pending.length>=3||needsBullCorner;miss.onclick=actions.miss;
 const remove=el('button','Laatste pijl wissen');remove.type='button';remove.disabled=!pending.length;remove.onclick=actions.remove;
 const confirm=el('button','Beurt bevestigen','primary');confirm.type='button';confirm.disabled=pending.length!==3||needsBullCorner;confirm.onclick=actions.confirm;
 const buttons=el('div',undefined,'four-actions');buttons.append(miss,remove,confirm);controls.append(buttons);
 const note=el('p',state.fourBoard.some((id,index)=>(id.startsWith('sb')||id==='bb')&&pending.some(hit=>hit.cell===index))?'Bull geraakt: dit vak is direct geclaimd.':'Niet geclaimde marks vervallen na de derde pijl.','four-note');controls.append(note);
 layout.append(controls);root.append(layout);
}
