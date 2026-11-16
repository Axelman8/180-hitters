import {previewParty,golfStroke} from './party-rules.js';
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
// Stable for a visible draft/reconnect, different between matches and players.
// Never seed decisions from hidden fleets or from the physical scatter RNG.
function decisionRandom(state,hits=[]){
 let seed=2166136261;
 const key=[state.startedAt,state.game,state.active,state.leg,state.round,state.history?.length||0,hits.map(h=>`${h.number}/${h.mult}/${h.cell??''}`).join(',')].join('|');
 for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 return ()=>{seed+=0x6D2B79F5;let n=seed;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
}
function chooseBest(items,score,random,margin=0){
 if(!items.length)return null;
 const values=items.map(score),best=Math.max(...values),choices=items.filter((_,i)=>values[i]>=best-Math.abs(best)*margin-1e-8);
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
function scoringTarget(numbers,random){
 const highest=Math.max(...numbers),choices=numbers.filter(n=>n>=highest-2&&n!==25);
 if(!choices.length)return aim(25,2);
 const weights=choices.map(n=>n===highest?10:n===highest-1?2:.5);let roll=random()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<choices.length;i++){roll-=weights[i];if(roll<0)return aim(choices[i]);}return aim(choices.at(-1));
}
export function boardHit(x,y){
 const radius=Math.hypot(x,y);
 if(radius>170)return makeDart(0);
 if(radius<=6.35)return makeDart(25,2);
 if(radius<=15.9)return makeDart(25);
 const angle=(Math.atan2(x,-y)+Math.PI*2+Math.PI/20)%(Math.PI*2);
 return makeDart(sectors[Math.floor(angle/(Math.PI/10))%20],radius>=162?2:radius>=99&&radius<=107?3:1);
}
export function throwAt(target,level=50,random=Math.random){
 const radius=target.number===25?(target.mult===1?11.125:0):target.mult===2?166:target.mult===3?103:135;
 const angle=target.number===25?0:sectors.indexOf(target.number)*Math.PI/10;
 const spread=level===40||level===50?botSigma[level]:botSpread(level);
 const distance=Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*spread;
 const direction=2*Math.PI*random();
 return boardHit(Math.sin(angle)*radius+distance*Math.cos(direction),-Math.cos(angle)*radius+distance*Math.sin(direction));
}
function routeTarget(label){if(label==='Bull'||label==='25')return aim(25,label==='Bull'?2:1);return aim(Number(label.slice(1)),{S:1,D:2,T:3}[label[0]]);}
function xTarget(state,remaining,opened,left,random){
 if(!opened){
  const legal=[];
  for(const mult of state.inMode==='master'?[3,2]:[2])for(let number=20;number>=1;number--){
   const rest=remaining-number*mult;
   if(rest>=0&&(state.out==='single'||rest!==1)&&(rest!==0||state.out!=='double'||mult===2))legal.push(aim(number,mult));
  }
  const finish=legal.find(t=>t.number*t.mult===remaining);if(finish)return finish;
  const preferred=legal.filter(t=>[20,18,16].includes(t.number)&&t.mult===(state.inMode==='master'?3:2));
  return chooseBest(preferred.length?preferred:legal,t=>preferred.length?1:t.number*t.mult,random)||aim(1,2);
 }
 // Take a broad single when it wins; Master-out also permits a familiar double.
 if(state.out==='single'&&remaining<=20)return aim(remaining,1);
 if(remaining<=40&&remaining%2===0)return aim(remaining/2,2);
 const route=checkout(remaining,state.out,left,state.bull)||checkout(remaining,state.out,3,state.bull);
 if(route)return routeTarget(route[0]);
 // Leave a useful even double rather than blindly throwing T20 on low scores.
 if(remaining<62){if(remaining%2)return aim(Math.min(19,remaining-32>0?remaining-32:1),1);return aim(remaining<=40?remaining/2:remaining-32,remaining<=40?2:1);}
 return remaining>180?scoringTarget([20,19,18],random):aim(20);
}
function fourShadow(state,hits){
 const owners=[...state.fourOwners],marks=Array(25).fill(0);
 for(const hit of hits)if(Number.isInteger(hit.cell)&&owners[hit.cell]===null){const id=state.fourBoard[hit.cell];marks[hit.cell]+=id==='bb'||id.startsWith('sb')?3:hit.mult;if(marks[hit.cell]>=3)owners[hit.cell]=state.active;}
 return {owners,marks};
}
function fourTarget(state,hits,random,allowed=null){
 const {owners,marks}=fourShadow(state,hits),open=owners.map((owner,index)=>owner===null?index:-1).filter(index=>index>=0&&(!allowed||allowed.includes(index)));
 const candidates=[];
 for(const cell of open){
  let score=marks[cell]*8;
  const candidate=[...owners];candidate[cell]=state.active;
  const wins=!!fourWinningLine(candidate,state.active);
  for(let opponent=0;opponent<state.players.length;opponent++)if(opponent!==state.active){candidate[cell]=opponent;if(fourWinningLine(candidate,opponent))score+=500;}
  // Position inside promising four-cell lines, including both diagonals.
  const row=Math.floor(cell/5),col=cell%5;
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]])for(let offset=0;offset<4;offset++){
   const line=Array.from({length:4},(_,i)=>[row+(i-offset)*dr,col+(i-offset)*dc]);
   if(line.some(([r,c])=>r<0||r>4||c<0||c>4))continue;
   const values=line.map(([r,c])=>owners[r*5+c]);if(values.every(owner=>owner===null||owner===state.active))score+=1+values.filter(owner=>owner===state.active).length*4;
  }
  // Winning ourselves always outranks blocking, even with three opponents.
  const id=state.fourBoard[cell],ease=id==='bb'?.55:id.startsWith('sb')?1.3:1;
  candidates.push({cell,wins,score,merit:score*ease});
 }
 const wins=candidates.filter(c=>c.wins),blocks=candidates.filter(c=>c.score>=500);
 const urgent=wins.length?wins:blocks;
 const best=urgent.length?chooseBest(urgent,c=>c.score,random):chooseBest(candidates,c=>c.merit,random,.08);
 return best?fourAim(state,best.cell,marks):aim(20);
}
function fourAim(state,cell,marks){const id=state.fourBoard[cell];return {...aim(id==='bb'||id.startsWith('sb')?25:Number(id.slice(1)),id==='bb'?2:id.startsWith('sb')?1:marks[cell]>=2?1:3),cell};}
function previewSonny(state,hits){
 if(!hits.length)return state;
 // These games accept complete visits. Padding misses gives a rules-accurate
 // preview of the current player's targets without changing the live match.
 try{return applyTurn(state,{hits:[...hits,...Array(3-hits.length).fill(makeDart(0))]});}catch{return state;}
}
export function cricketTarget(state,hits=[],random=decisionRandom(state,hits)){
 const players=previewCricket(state,hits).players,own=players[state.active],opponents=players.filter((_,i)=>i!==state.active);
 const open=state.numbers.filter(n=>(own.marks[n]||0)<3),target=(n,closing=false)=>aim(n,closing&&(own.marks[n]||0)===2?1:n===25?2:3);
 const cut=state.scoring==='cut-throat',noScore=state.scoring==='no-score';
 const winningScore=noScore||opponents.every(other=>cut?own.cricketPoints<=other.cricketPoints:own.cricketPoints>=other.cricketPoints);
 // A legal finish takes precedence over building a points cushion.
 if(open.length===1&&winningScore)return target(open[0],true);
 if(noScore||!opponents.length){const numbers=open.filter(n=>n!==25);return target(chooseBest(numbers.length?numbers:open,n=>own.marks[n]||0,random)||20,true);}
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
 if(behind&&scoring.length&&danger.length&&danger.length<=2)return target(danger[0],true);
 if(needsPoints&&scoring.length)return target(chooseBest(scoring,n=>value(n)*(cut?vulnerable(n).length:1),random,.1));
 if(behind){
  // Create a scoring opportunity first when every already closed target is
  // also closed by the relevant opponent. Finishing other targets cannot win.
  const opening=open.filter(n=>vulnerable(n).length).sort((a,b)=>value(b)/(3-(own.marks[b]||0))-value(a)/(3-(own.marks[a]||0)));
  if(opening.length)return target(chooseBest(opening,n=>value(n)/(3-(own.marks[n]||0)),random,.05));
 }
 // Close numbers on which opponents can currently score, then work down the
 // remaining targets. Re-evaluate after EACH dart, including overflow points.
 return target(danger[0]||chooseBest(open,n=>value(n)/(3-(own.marks[n]||0)),random,.05)||scoring[0]||20,!!danger.length);
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
export function gotchaPlan(state,hits=[],random=decisionRandom(state,hits)){
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
  const score=player.remaining-own.remaining;
  const alternatives=gotchaSegments.filter(segment=>{const rest=gotchaResetRoute(score-segment.number*segment.mult,left-1);return rest&&Math.abs(segment.cost+rest.cost-route.cost)<1e-8;});
  const first=chooseBest(alternatives,()=>1,random),rest=gotchaResetRoute(score-first.number*first.mult,left-1);
  const varied=[aim(first.number,first.mult),...rest.hits];
  return {kind:'reset',opponent:index,target:varied[0],route:varied};
 }
 return {kind:'score',target:xTarget(state,remaining,true,left,random)};
}
function seaDecision(state,hits,random){
 const live=previewParty(state,hits),actor=state.active,own=live.players[actor];
 // Read ship identities only for cells that have already been struck. Local
 // matches store full fleets, but the BOT gets no knowledge advantage from it.
 const enemies=live.players.filter((p,i)=>i!==actor&&!p.seaEliminated).map(p=>{
  const known=p.seaFleet.map((ship,cell)=>p.seaShots[cell]>0?ship:0);
  const sunk=new Set([1,2,3].filter(id=>known.filter((ship,cell)=>ship===id&&p.seaHull[cell]>=2).length>=({1:3,2:2,3:2}[id])));
  return {player:p,known,sunk};
 });
 const candidates=[];
 for(let cell=0;cell<20;cell++){
  let weight=0,possible=false,wounded=false,hunting=false;
  for(const {player:p,known,sunk} of enemies){
   if(p.seaShots[cell]>0){
    // Known water and destroyed cells add no value. The same number can still
    // be useful against another opponent because one shot attacks every fleet.
    if(known[cell]&&p.seaHull[cell]<2){possible=true;wounded=true;weight+=12;}
   }else{
    possible=true;weight+=2;
    for(const neighbour of [cell-5,cell+5,...(cell%5?[cell-1]:[]),...(cell%5<4?[cell+1]:[])]){
     if(neighbour>=0&&neighbour<20&&known[neighbour]&&!sunk.has(known[neighbour])){weight+=3;hunting=true;}
    }
    for(const id of [1,2,3])if(!sunk.has(id)){
     const cells=known.map((ship,i)=>ship===id?i:-1).filter(i=>i>=0);
     if(cells.length>=2&&(cells.every(i=>Math.floor(i/5)===Math.floor(cell/5))||cells.every(i=>i%5===cell%5)))weight+=3;
    }
   }
  }
  if(!possible)continue;
  weight-=own.seaFired[cell]*.1;
  // Prefer fresh exploration over repeating another player's unsuccessful
  // search when the remaining enemy information is otherwise equally useful.
  if(!wounded&&live.players.some(p=>p.seaShots[cell]>0))weight-=.25;
  candidates.push({target:aim(cell+1,wounded?1:2),weight,wounded,kind:wounded?'finish-cell':hunting?'hunt':'search'});
 }
 const wounded=candidates.filter(c=>c.wounded),best=chooseBest(wounded.length?wounded:candidates,c=>c.weight,random);return best?{target:best.target,kind:best.kind}:null;
}
function shanghaiTarget(state,hits,left){
 const missing=[3,2,1].filter(mult=>!hits.some(h=>h.number===state.partyTarget&&h.mult===mult));
 // Once a Shanghai is impossible this visit, maximize points instead.
 return aim(state.partyTarget,missing.length<=left?missing[0]||3:3);
}
export function seaPlan(state,hits=[],random=decisionRandom(state,hits)){
 if(state.game!=='seabattle'||state.phase!=='playing'||hits.length>=3||previewParty(state,hits).phase!=='playing')return null;
 return seaDecision(state,hits,random);
}
function keepGolfStroke(state,hits){
 const stroke=golfStroke(hits.at(-1),state.partyTarget);
 if(stroke===1)return true;
 if(stroke>3)return false;
 // Bank a valid target rather than risk replacing it with five strokes.
 // On the last hole, chase a better result if banking would definitely lose
 // to someone who has already completed all holes.
 const own=state.players[state.active];
 const finished=state.players.filter((p,i)=>i!==state.active&&p.golfScores.length===state.golfHoles);
 return !finished.length||own.golfStrokes+stroke<=Math.min(...finished.map(p=>p.golfStrokes));
}
export function chooseBotTarget(state,hits=[],random=decisionRandom(state,hits)){
 const p=state.players[state.active],left=3-hits.length;
 if(state.game==='golf')return aim(state.partyTarget,2);
 if(state.game==='shanghai')return shanghaiTarget(state,hits,left);
 if(state.game==='seabattle')return seaDecision(state,hits,random)?.target||aim(20);
 if(state.game==='fourinarow')return fourTarget(state,hits,random);
 if(state.game==='tenlives')return aim(p.livesTarget,p.livesTarget===25?2:state.livesMode==='triple'?3:2);
 if(state.game==='bobs27')return aim(state.bobsTarget,2);
 if(state.game==='x01'){const live=previewTurn(state,hits);return xTarget(state,live.remaining,live.opened,left,random);}
 if(state.game==='gotcha')return gotchaPlan(state,hits,random)?.target||aim(20);
 if(['cricket','tactics'].includes(state.game)){
  return cricketTarget(state,hits,random);
 }
 const shadow=previewSonny(state,hits),own=shadow.players[state.active];
 if(state.game==='scram'){
  const closed=[...state.scramClosed];if(state.scramRole==='stopper')for(const hit of hits)if(hit.number)closed[hit.number===25?20:hit.number-1]=true;
  const open=[20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1].filter(n=>!closed[n-1]);
  const target=scoringTarget(open,random);
  return aim(target.number,state.scramRole==='stopper'?1:target.mult);
 }
 if(state.game==='bull41'){
  const marks=state.bull41Marks+hits.reduce((sum,hit)=>sum+(hit.number===25?hit.mult:0),0);
  return state.bull41Role==='bull'?aim(25,25-marks===1?1:2):scoringTarget([20,19,18],random);
 }
 if(state.game==='killer'){
  if(state.killerStage==='assigning')return aim(chooseBest(sectors.filter(n=>!state.players.some(other=>other.killerNumber===n)),()=>1,random),1);
  const modern=state.killerRules==='three-hit';
  if(modern?!own.killerActivated:own.killerLetters<6)return aim(own.killerNumber,modern&&own.killerLetters<2?3:1);
  const victim=chooseBest(shadow.players.filter((other,i)=>i!==state.active&&!other.killerEliminated),other=>-(modern?other.killerLives:other.killerLetters)*10+(other.killerActivated?1:0),random);return aim(victim?.killerNumber||p.killerNumber,modern&&victim?.killerLives>1?3:1);
 }
 if(state.game==='twentyone')return aim(own.twentyOneTarget===21?25:own.twentyOneTarget,own.twentyOneTarget===21?1:3);
 throw Error('Voor dit spel ontbreekt een BOT-strategie.');
}
export function botDart(state,hits=[],random=Math.random){
 const target=chooseBotTarget(state,hits),hit=throwAt(target,botDifficulty(state).level,random);
 if(state.game!=='fourinarow')return hit;
 const {owners}=fourShadow(state,hits);
 const corners=state.fourBoard.map((id,i)=>id.startsWith('sb')&&owners[i]===null?i:-1).filter(i=>i>=0);
 let cell=hit.number===25?hit.mult===2?12:(state.fourBoard[target.cell]?.startsWith('sb')&&owners[target.cell]===null?target.cell:corners.length?fourTarget(state,hits,decisionRandom(state,[...hits,hit]),corners).cell:null):state.fourBoard.indexOf('n'+hit.number);
 if(cell<0||!hit.number)cell=null;
 return {...hit,cell,label:hit.number===25?(hit.mult===2?'BB':'sB'):hit.label};
}
export function botVisit(state,hits){
 if(state.game==='golf'&&state.golfScoring==='last'&&hits.length<3&&!keepGolfStroke(state,hits))return null;
 if(state.game==='tenlives'){const hit=hits.at(-1),p=state.players[state.active];return {trainingHit:hit.number===p.livesTarget&&hit.mult===(p.livesTarget===25?2:state.livesMode==='triple'?3:2),botDart:hit};}
 if(state.game==='killer'&&state.killerStage==='assigning'){
  const hit=hits[0];if(hit.number<1||hit.number>20||state.players.some(p=>p.killerNumber===hit.number))return null;
 }
 try{const turn={hits};applyTurn(state,turn);return turn;}catch(error){if(hits.length===3)throw error;return null;}
}
