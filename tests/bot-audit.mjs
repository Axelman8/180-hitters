import assert from 'node:assert/strict';
import {newMatch,applyTurn,makeDart as d,previewCricket,previewTurn,previewGotcha} from '../dist/engine.js';
import {chooseBotTarget,botDart,botVisit,throwAt,seaPlan} from '../dist/bot.js';
import {previewParty,resetSeaFleets} from '../dist/party-rules.js';
import {createFourBoard,fourWinningLine} from '../dist/four-in-row.js';
const games=['x01','121','gotcha','cricket','tactics','fourinarow','killer','seabattle','scram','bull41','golf','shanghai','twentyone','bobs27','tenlives'];
let identity=1000,seed=651903;
const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
function fresh(game,level=40,count=4,options={}){
 const state=newMatch(['A','B','C','D'].slice(0,count),301,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:Array(count).fill(level),maxRounds:0,...options});
 state.startedAt=++identity;
 if(game==='seabattle')resetSeaFleets(state,random);
 if(game==='fourinarow')state.fourBoard=createFourBoard(null,random);
 return state;
}
for(const level of [40,50]){
 const killer=new Map(),sea=new Map(),visits=new Set();
 for(let n=0;n<240;n++){
  let s=fresh('killer',level,2),t=chooseBotTarget(s);killer.set(t.number,(killer.get(t.number)||0)+1);
  s=applyTurn(s,{hits:[d(t.number)]});assert.notEqual(chooseBotTarget(s).number,t.number,'Second BOT must choose an unowned number');
  s=fresh('seabattle',level,2);t=chooseBotTarget(s);sea.set(t.number,(sea.get(t.number)||0)+1);
  let hits=[];for(let dart=0;dart<3;dart++){const a=chooseBotTarget(s,hits);hits.push(d(a.number,a.mult));}visits.add(hits.map(h=>h.number).join('/'));
  const snapshot=structuredClone(s),target=chooseBotTarget(s);for(let repeat=0;repeat<5;repeat++)assert.deepEqual(chooseBotTarget(s),target,'UI rerenders must not change the displayed aim');
  const masked=structuredClone(s);for(const p of masked.players)for(let cell=0;cell<20;cell++)if(!p.seaShots[cell])p.seaFleet[cell]=null;
  assert.deepEqual(chooseBotTarget(s),chooseBotTarget(masked),'Only revealed enemy information may influence choices');assert.deepEqual(s,snapshot);
 }
 assert.ok(killer.size>=18&&Math.max(...killer.values())<45,'Killer openings must cover the board');
 assert.ok(sea.size>=18&&Math.max(...sea.values())<45&&visits.size>180,'Sea Battle search must not repeat a fixed opening');
 console.log(`PASS BOT ${level}: ${killer.size} Killer starting numbers, ${sea.size} Sea starting numbers, ${visits.size} different search visits / 240; stable across rerender and no hidden-fleet advantage`);
 let s=fresh('seabattle',level,2);
 // Reproduce the reported opening: BOT A records three waters on B's fleet.
 // B cannot infer A's hidden ships from that, but must explore equally useful
 // untouched numbers before repeating A's exact unsuccessful search.
 s.players[1].seaFleet.fill(0);
 for(const [id,cells] of [[1,[5,6,7]],[2,[10,11]],[3,[15,16]]])for(const cell of cells)s.players[1].seaFleet[cell]=id;
 s=applyTurn(s,{hits:[d(1),d(2),d(3)]});
 assert.equal(s.active,1);assert.ok(![1,2,3].includes(chooseBotTarget(s).number),'Second BOT explores after the first BOT throws three waters');
 for(let player=0;player<2;player++)if(player!==s.active)s.players[player].seaFleet.fill(null);
 assert.ok(![1,2,3].includes(chooseBotTarget(s).number),'The fresh search preference does not need hidden enemy ships');
 s=fresh('seabattle',level,2);
 // Every enemy has been probed on all cells except one; known water must never
 // become a target, including after another player made the observations.
 const enemy=s.players[1];enemy.seaShots.fill(1);enemy.seaFleet.fill(0);enemy.seaShots[13]=0;
 assert.equal(chooseBotTarget(s).number,14);
 // Prefer an untouched number over an equivalent search that was water on
 // our own fleet. This avoids both bots repeating each other's opening.
 s=fresh('seabattle',level,2);s.players[0].seaShots.fill(1);s.players[0].seaShots[16]=0;
 assert.equal(chooseBotTarget(s).number,17);
 s=fresh('seabattle',level,2);const p=s.players[1];p.seaFleet.fill(0);p.seaFleet[5]=p.seaFleet[6]=p.seaFleet[7]=1;p.seaShots[5]=p.seaShots[6]=1;p.seaHull[5]=p.seaHull[6]=2;
 assert.equal(chooseBotTarget(s).number,8,'Follow the known orientation of a partly found ship');assert.equal(seaPlan(s).kind,'hunt');
 p.seaShots[7]=1;p.seaHull[7]=1;assert.deepEqual(chooseBotTarget(s),{number:8,mult:1});
 p.seaHull[7]=2;assert.ok(![6,7,8].includes(chooseBotTarget(s).number),'A wreck must no longer attract darts');
 // Easy, rules-correct winning or closing singles are preferable to triples.
 for(const game of ['cricket','tactics']){
  s=fresh(game,level,2,{scoring:'no-score'});for(const number of s.numbers)s.players[0].marks[number]=3;s.players[0].marks[19]=2;
  assert.deepEqual(chooseBotTarget(s),{number:19,mult:1});
 }
 s=fresh('bull41',level,2);s.bull41Marks=24;assert.deepEqual(chooseBotTarget(s),{number:25,mult:1});
 s=fresh('twentyone',level,2);s.players[0].twentyOneTarget=21;assert.deepEqual(chooseBotTarget(s),{number:25,mult:1});assert.ok(botVisit(s,[d(25)]));
 for(const game of ['x01','121']){
  s=fresh(game,level,2,{out:'single'});s.out='single';s.players[0].remaining=15;assert.deepEqual(chooseBotTarget(s),{number:15,mult:1});
  s=fresh(game,level,2,{inMode:'double'});s.players[0].opened=false;s.players[0].remaining=32;assert.deepEqual(chooseBotTarget(s),{number:16,mult:2});
 }
 assert.equal(throwAt({number:25,mult:1},level,()=>1).mult,1,'Single bull needs its own physical aiming position');
 assert.equal(throwAt({number:25,mult:2},level,()=>1).mult,2);
 // A physical single-bull spill from a winning BB attempt must select the
 // available corner that blocks a rival, not the first corner in an array.
 s=fresh('fourinarow',level,2);s.fourOwners[0]=0;for(const cell of [1,2,3])s.fourOwners[cell]=1;for(const cell of [10,11,13])s.fourOwners[cell]=0;
 assert.equal(chooseBotTarget(s).cell,12);const values=[Math.exp(-.5*(11.125/(level===40?20:16))**2),0];
 assert.equal(botDart(s,[],()=>values.shift()).cell,4);
 console.log(`PASS BOT ${level}: known water, public search memory, logical ship hunting, wrecks, easy finish/closure, distinct bulls and tactical sB corner choice`);
}
function useful(s,hits,t){
 assert.ok([0,25,...Array.from({length:20},(_,i)=>i+1)].includes(t.number)&&[1,2,3].includes(t.mult));
 if(s.game==='seabattle'){
  const live=previewParty(s,hits),cell=t.number-1;
  assert.ok(live.players.some((p,i)=>i!==s.active&&!p.seaEliminated&&(!p.seaShots[cell]||(p.seaFleet[cell]&&p.seaHull[cell]<2))),'Aim only where a surviving enemy can still be damaged');
 }else if(s.game==='fourinarow'){
  const claimed=[...s.fourOwners];for(const h of hits)if(Number.isInteger(h.cell)&&claimed[h.cell]===null){const at=hits.filter(d=>d.cell===h.cell),id=s.fourBoard[h.cell];if(id==='bb'||id.startsWith('sb')||at.reduce((sum,d)=>sum+d.mult,0)>=3)claimed[h.cell]=s.active;}
  assert.equal(claimed[t.cell],null);
  const ownWins=claimed.map((v,i)=>{if(v!==null)return -1;const a=[...claimed];a[i]=s.active;return fourWinningLine(a,s.active)?i:-1;}).filter(i=>i>=0);
  if(ownWins.length)assert.ok(ownWins.includes(t.cell),'Take an available win');
 }else if(['cricket','tactics'].includes(s.game)){
  const players=previewCricket(s,hits).players,own=players[s.active];assert.ok(s.numbers.includes(t.number));
  assert.ok((own.marks[t.number]||0)<3||s.scoring!=='no-score'&&players.some((p,i)=>i!==s.active&&(p.marks[t.number]||0)<3),'A closed target must still be able to score');
 }else if(s.game==='x01'){
  assert.equal(previewTurn(s,[...hits,d(t.number,t.mult)]).bust,false,'Do not deliberately bust');
 }else if(s.game==='gotcha'){
  assert.equal(previewGotcha(s,[...hits,d(t.number,t.mult)]).bust,false,'A planned reset or finish must not bust');
 }else if(s.game==='killer'){
  if(s.killerStage==='assigning')assert.ok(!s.players.some(p=>p.killerNumber===t.number));
  else{const padded=[...hits,...Array.from({length:3-hits.length},()=>d(0))],live=applyTurn(s,{hits:padded}),own=live.players[s.active],victim=live.players.find(p=>p.killerNumber===t.number);assert.ok(victim&&!victim.killerEliminated);assert.ok(!own.killerActivated?t.number===own.killerNumber:victim!==own);}
 }else if(s.game==='scram'){
  const closed=[...s.scramClosed];if(s.scramRole==='stopper')for(const h of hits)if(h.number)closed[h.number===25?20:h.number-1]=true;
  // Scram requires a complete three-dart visit, including unused darts after
  // its final target was closed. Otherwise a closed target has no value.
  if(closed.some(value=>!value))assert.equal(closed[t.number===25?20:t.number-1],false);
 }else if(s.game==='golf'||s.game==='shanghai')assert.equal(t.number,s.partyTarget);
 else if(s.game==='tenlives')assert.equal(t.number,s.players[s.active].livesTarget);
 else if(s.game==='bobs27')assert.deepEqual(t,{number:s.bobsTarget,mult:2});
 else if(s.game==='bull41'&&s.bull41Role==='bull')assert.equal(t.number,25);
}
for(const level of [40,50])for(const game of games){
 let checked=0;
 for(const count of [2,3,4])for(let run=0;run<4;run++){
  let s=fresh(game,level,count),visits=0;
  while(s.phase==='playing'&&visits++<(game==='tenlives'?2000:500)){
   let hits=[],turn;
   for(let attempt=0;attempt<100;attempt++){
    if(s.game==='killer'&&s.killerStage==='assigning')hits=[];
    const target=chooseBotTarget(s,hits);useful(s,hits,target);checked++;
    hits.push(botDart(s,hits,random));turn=botVisit(s,hits);if(turn)break;
   }
   assert.ok(turn,game+' must finish a legal visit');s=applyTurn(s,turn);
  }
  assert.notEqual(s.phase,'playing',game+' must finish without stalling');
 }
 console.log(`PASS BOT ${level}: ${game}, ${checked} tactically valid aims, 12 full games with 2–4 players`);
}
