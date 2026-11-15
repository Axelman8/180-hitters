// Original 180 Hitters bot. Aiming and physical accuracy are deliberately separate:
// the same player misses into neighbouring segments in every game.
import {makeDart,checkout,previewTurn,previewCricket,previewGotcha,applyTurn} from './engine.js';
import {fourWinningLine} from './four-in-row.js';
import {botDifficulty,botSpread} from './bot-level.js';
export {botLevel,botDifficulty} from './bot-level.js';
const sectors=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
// Calibrated on complete 501, straight-in/double-out legs, including misses
// at doubles and busts. Short matches naturally vary around the target.
export const botSigma={40:20,50:16};
const aim=(number,mult=3)=>({number,mult});
export function boardHit(x,y){
 const radius=Math.hypot(x,y);
 if(radius>170)return makeDart(0);
 if(radius<=6.35)return makeDart(25,2);
 if(radius<=15.9)return makeDart(25);
 const angle=(Math.atan2(x,-y)+Math.PI*2+Math.PI/20)%(Math.PI*2);
 return makeDart(sectors[Math.floor(angle/(Math.PI/10))%20],radius>=162?2:radius>=99&&radius<=107?3:1);
}
export function throwAt(target,level=50,random=Math.random){
 const radius=target.number===25?0:target.mult===2?166:target.mult===3?103:135;
 const angle=sectors.indexOf(target.number)*Math.PI/10;
 const spread=level===40||level===50?botSigma[level]:botSpread(level);
 const distance=Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*spread;
 const direction=2*Math.PI*random();
 return boardHit(Math.sin(angle)*radius+distance*Math.cos(direction),-Math.cos(angle)*radius+distance*Math.sin(direction));
}
function routeTarget(label){if(label==='Bull'||label==='25')return aim(25,label==='Bull'?2:1);return aim(Number(label.slice(1)),{S:1,D:2,T:3}[label[0]]);}
function xTarget(state,remaining,opened,left){
 if(!opened)return aim(20,state.inMode==='master'?3:2);
 const route=checkout(remaining,state.out,left,state.bull)||checkout(remaining,state.out,3,state.bull);
 if(route)return routeTarget(route[0]);
 // Leave a useful even double rather than blindly throwing T20 on low scores.
 if(remaining<62){if(remaining%2)return aim(Math.min(19,remaining-32>0?remaining-32:1),1);return aim(remaining<=40?remaining/2:remaining-32,remaining<=40?2:1);}
 return aim(20);
}
function fourShadow(state,hits){
 const owners=[...state.fourOwners],marks=Array(25).fill(0);
 for(const hit of hits)if(Number.isInteger(hit.cell)&&owners[hit.cell]===null){const id=state.fourBoard[hit.cell];marks[hit.cell]+=id==='bb'||id.startsWith('sb')?3:hit.mult;if(marks[hit.cell]>=3)owners[hit.cell]=state.active;}
 return {owners,marks};
}
function fourTarget(state,hits){
 const {owners,marks}=fourShadow(state,hits),open=owners.map((owner,index)=>owner===null?index:-1).filter(index=>index>=0);
 let best=null,bestScore=-Infinity;
 for(const cell of open){
  let score=marks[cell]*8;
  const candidate=[...owners];candidate[cell]=state.active;
  if(fourWinningLine(candidate,state.active))score+=1000;
  for(let opponent=0;opponent<state.players.length;opponent++)if(opponent!==state.active){candidate[cell]=opponent;if(fourWinningLine(candidate,opponent))score+=500;}
  // Position inside promising four-cell lines, including both diagonals.
  const row=Math.floor(cell/5),col=cell%5;
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]])for(let offset=0;offset<4;offset++){
   const line=Array.from({length:4},(_,i)=>[row+(i-offset)*dr,col+(i-offset)*dc]);
   if(line.some(([r,c])=>r<0||r>4||c<0||c>4))continue;
   const values=line.map(([r,c])=>owners[r*5+c]);if(values.every(owner=>owner===null||owner===state.active))score+=1+values.filter(owner=>owner===state.active).length*4;
  }
  if(score>bestScore){bestScore=score;best=cell;}
 }
 if(best===null)return aim(20);
 const id=state.fourBoard[best];return {...aim(id==='bb'||id.startsWith('sb')?25:Number(id.slice(1)),id==='bb'?2:id.startsWith('sb')?1:marks[best]>=2?1:3),cell:best};
}
function previewSonny(state,hits){
 if(!hits.length)return state;
 // These games accept complete visits. Padding misses gives a rules-accurate
 // preview of the current player's targets without changing the live match.
 try{return applyTurn(state,{hits:[...hits,...Array(3-hits.length).fill(makeDart(0))]});}catch{return state;}
}
export function cricketTarget(state,hits=[]){
 const players=previewCricket(state,hits).players,own=players[state.active],opponents=players.filter((_,i)=>i!==state.active);
 const open=state.numbers.filter(n=>(own.marks[n]||0)<3),target=n=>aim(n,n===25?2:3);
 const cut=state.scoring==='cut-throat',noScore=state.scoring==='no-score';
 const winningScore=noScore||opponents.every(other=>cut?own.cricketPoints<=other.cricketPoints:own.cricketPoints>=other.cricketPoints);
 // A legal finish takes precedence over building a points cushion.
 if(open.length===1&&winningScore)return target(open[0]);
 if(noScore||!opponents.length)return target(open[0]||20);
 const buffer=60,behind=!winningScore;
 const needsPoints=cut?opponents.some(other=>other.cricketPoints<own.cricketPoints+buffer):own.cricketPoints<Math.max(...opponents.map(other=>other.cricketPoints))+buffer;
 // In Cut Throat, attack the opponents whose points are still below ours.
 // Scoring against an already losing opponent cannot repair that deficit.
 const relevant=opponents.filter(other=>!cut||other.cricketPoints<own.cricketPoints+(behind?1:buffer));
 const vulnerable=n=>relevant.filter(other=>(other.marks[n]||0)<3);
 const value=n=>n*(n===25?.45:1); // Bull is harder to hit than a number's treble.
 const scoring=state.numbers.filter(n=>(own.marks[n]||0)===3&&vulnerable(n).length).sort((a,b)=>value(b)*(cut?vulnerable(b).length:1)-value(a)*(cut?vulnerable(a).length:1));
 const danger=open.filter(n=>opponents.some(other=>(other.marks[n]||0)===3)).sort((a,b)=>value(b)/(3-(own.marks[b]||0))-value(a)/(3-(own.marks[a]||0)));
 // Stop a small number of opposing scoring routes before trading points on
 // different numbers indefinitely. Keep our own open scoring route for later.
 if(behind&&scoring.length&&danger.length&&danger.length<=2)return target(danger[0]);
 if(needsPoints&&scoring.length)return target(scoring[0]);
 if(behind){
  // Create a scoring opportunity first when every already closed target is
  // also closed by the relevant opponent. Finishing other targets cannot win.
  const opening=open.filter(n=>vulnerable(n).length).sort((a,b)=>value(b)/(3-(own.marks[b]||0))-value(a)/(3-(own.marks[a]||0)));
  if(opening.length)return target(opening[0]);
 }
 // Close numbers on which opponents can currently score, then work down the
 // remaining targets. Re-evaluate after EACH dart, including overflow points.
 return target(danger[0]||open[0]||scoring[0]||20);
}
// Prefer broad singles to a difficult double/triple when spare darts allow it.
// These costs affect route choice only; throwAt still supplies the original
// level-dependent physical scatter, including misses and neighbouring numbers.
const gotchaSegments=[
 ...Array.from({length:20},(_,i)=>({...aim(20-i,1),cost:1})),
 {...aim(25,1),cost:2.6},
 ...Array.from({length:20},(_,i)=>({...aim(20-i,2),cost:3})),
 ...Array.from({length:20},(_,i)=>({...aim(20-i,3),cost:3.3})),
 {...aim(25,2),cost:4.2}
];
const gotchaRoutes=new Map();
function gotchaResetRoute(score,left){
 if(score===0)return {cost:0,hits:[]};
 if(left<1||score<0||score>60*left)return null;
 const key=score+'/'+left;if(gotchaRoutes.has(key))return gotchaRoutes.get(key);
 let best=null;
 for(const segment of gotchaSegments){
  const rest=gotchaResetRoute(score-segment.number*segment.mult,left-1);if(!rest)continue;
  const cost=segment.cost+rest.cost;
  if(!best||cost<best.cost-1e-8)best={cost,hits:[aim(segment.number,segment.mult),...rest.hits]};
 }
 gotchaRoutes.set(key,best);return best;
}
export function gotchaPlan(state,hits=[]){
 if(state.game!=='gotcha'||state.phase!=='playing')return null;
 const live=previewGotcha(state,hits),left=3-hits.length,own=live.players[state.active];
 if(left<1||live.bust||live.finished)return null;
 const remaining=state.start-own.remaining;
 const winning=gotchaSegments.find(segment=>segment.number*segment.mult===remaining&&(state.out==='single'||segment.mult===2||(state.out==='master'&&segment.mult===3)));
 if(winning)return {kind:'finish',target:aim(winning.number,winning.mult),route:[aim(winning.number,winning.mult)]};
 // Reset the highest reachable opponent first, including near the finish.
 // Positive route darts stay below that opponent's score, avoiding a bust.
 const opponents=live.players.map((player,index)=>({player,index})).filter(({player,index})=>index!==state.active&&player.remaining>own.remaining&&player.remaining<state.start&&(state.out==='single'||player.remaining!==state.start-1)).sort((a,b)=>b.player.remaining-a.player.remaining);
 for(const {player,index} of opponents){
  const route=gotchaResetRoute(player.remaining-own.remaining,left);if(!route)continue;
  return {kind:'reset',opponent:index,target:route.hits[0],route:route.hits};
 }
 return {kind:'score',target:xTarget(state,remaining,true,left)};
}
export function chooseBotTarget(state,hits=[]){
 const p=state.players[state.active],left=3-hits.length;
 if(state.game==='fourinarow')return fourTarget(state,hits);
 if(state.game==='tenlives')return aim(p.livesTarget,p.livesTarget===25?2:state.livesMode==='triple'?3:2);
 if(state.game==='bobs27')return aim(state.bobsTarget,2);
 if(state.game==='x01'){const live=previewTurn(state,hits);return xTarget(state,live.remaining,live.opened,left);}
 if(state.game==='gotcha')return gotchaPlan(state,hits)?.target||aim(20);
 if(['cricket','tactics'].includes(state.game)){
  return cricketTarget(state,hits);
 }
 const shadow=previewSonny(state,hits),own=shadow.players[state.active];
 if(state.game==='scram'){
  const closed=[...state.scramClosed];if(state.scramRole==='stopper')for(const hit of hits)if(hit.number)closed[hit.number===25?20:hit.number-1]=true;
  const n=[20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,25].find(n=>!closed[n===25?20:n-1])||20;
  return aim(n,n===25?2:state.scramRole==='stopper'?1:3);
 }
 if(state.game==='bull41')return state.bull41Role==='bull'?aim(25,2):aim(20);
 if(state.game==='killer'){
  if(state.killerStage==='assigning')return aim(sectors.find(n=>!state.players.some(other=>other.killerNumber===n)),1);
  if(own.killerLetters<6)return aim(own.killerNumber,1);
  const victim=shadow.players.filter((other,i)=>i!==state.active&&!other.killerEliminated).sort((a,b)=>a.killerLetters-b.killerLetters)[0];return aim(victim?.killerNumber||p.killerNumber,1);
 }
 if(state.game==='twentyone')return aim(own.twentyOneTarget===21?25:own.twentyOneTarget,own.twentyOneTarget===21?2:3);
 throw Error('Voor dit spel ontbreekt een BOT-strategie.');
}
export function botDart(state,hits=[],random=Math.random){
 const target=chooseBotTarget(state,hits),hit=throwAt(target,botDifficulty(state).level,random);
 if(state.game!=='fourinarow')return hit;
 const {owners}=fourShadow(state,hits);
 let cell=hit.number===25?hit.mult===2?12:(state.fourBoard[target.cell]?.startsWith('sb')&&owners[target.cell]===null?target.cell:state.fourBoard.findIndex((id,i)=>id.startsWith('sb')&&owners[i]===null)):state.fourBoard.indexOf('n'+hit.number);
 if(cell<0||!hit.number)cell=null;
 return {...hit,cell,label:hit.number===25?(hit.mult===2?'BB':'sB'):hit.label};
}
export function botVisit(state,hits){
 if(state.game==='tenlives'){const hit=hits.at(-1),p=state.players[state.active];return {trainingHit:hit.number===p.livesTarget&&hit.mult===(p.livesTarget===25?2:state.livesMode==='triple'?3:2),botDart:hit};}
 if(state.game==='killer'&&state.killerStage==='assigning'){
  const hit=hits[0];if(hit.number<1||hit.number>20||state.players.some(p=>p.killerNumber===hit.number))return null;
 }
 try{const turn={hits};applyTurn(state,turn);return turn;}catch(error){if(hits.length===3)throw error;return null;}
}
