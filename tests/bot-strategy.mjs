import assert from 'node:assert/strict';
import {newMatch,applyTurn,makeDart as d} from '../dist/engine.js';
import {chooseBotTarget,botDart,botVisit,seaPlan} from '../dist/bot.js';
import {previewParty,seaSunk} from '../dist/party-rules.js';

const miss=d(0);
const fresh=(game,level=40,count=2,options={})=>newMatch(['BOT','B','C','D'].slice(0,count),game==='gotcha'?301:501,'double',1,{game,botLevels:Array(count).fill(level),maxRounds:0,...options});
const aimed=(s,hits=[])=>{const t=chooseBotTarget(s,hits);return {...d(t.number,t.mult),...(t.cell!==undefined?{cell:t.cell}:{})};};
const seaPlayer=(p,fleet,damaged=[])=>{
 p.seaFleet=[...fleet];p.seaHull=fleet.map((id,i)=>id&&damaged.includes(i)?2:0);
 p.seaShots=Array(20).fill(0);damaged.forEach(i=>p.seaShots[i]=1);
 p.seaRemaining=fleet.reduce((n,id,i)=>n+(id?2-p.seaHull[i]:0),0);
 p.seaEliminated=p.seaRemaining===0;
};

for(const level of [40,50]){
 // Known wrecks must not attract search darts in their vicinity. A damaged
 // ship that has NOT sunk should still invite a nearby follow-up shot.
 let s=fresh('seabattle',level),enemy=s.players[1];
 const fleet=Array(20).fill(0);[6,7,8].forEach(i=>fleet[i]=1);[15,16].forEach(i=>fleet[i]=2);[18,19].forEach(i=>fleet[i]=3);
 seaPlayer(enemy,fleet,[6,7,8]);assert.equal(seaSunk(enemy),1);
 assert.equal(seaPlan(s).kind,'search');
 assert.equal(chooseBotTarget(s).number,1,'After sinking a ship, resume unexplored search instead of hunting around its wreck');
 const visible=structuredClone(s);
 for(let i=0;i<20;i++)if(!enemy.seaShots[i])enemy.seaFleet[i]=(i+1)%4;
 assert.deepEqual(chooseBotTarget(s),chooseBotTarget(visible),'Unknown enemy fleet positions must never influence aiming');
 s=visible;enemy=s.players[1];enemy.seaHull[8]=1;enemy.seaRemaining++;
 assert.equal(seaPlan(s).kind,'finish-cell');
 assert.deepEqual(chooseBotTarget(s),{number:9,mult:1},'Finish a damaged cell with a broad single');
 // Destroying the final point of a cell changes the next target immediately.
 const next=chooseBotTarget(s,[d(9)]);assert.notEqual(next.number,9);
 // All shots attack all opponents. A wreck in one fleet does not invalidate a
 // still-live target on the same number in another fleet.
 s=fresh('seabattle',level,4);
 for(let i=1;i<4;i++)seaPlayer(s.players[i],fleet,[6,7,8]);
 s.players[2].seaHull[6]=1;s.players[2].seaRemaining++;
 assert.deepEqual(chooseBotTarget(s),{number:7,mult:1},'Finish the remaining live opponent cell despite wrecks at that number in other fleets');
 s.players[2].seaEliminated=true;
 assert.notEqual(chooseBotTarget(s).number,7,'Ignore an eliminated player');
 console.log(`PASS BOT ${level}: Sea Battle wrecks, wounded cells, shared attacks, eliminated fleets and hidden information`);

 s=fresh('shanghai',level);
 assert.equal(chooseBotTarget(s).mult,3);
 assert.equal(chooseBotTarget(s,[d(1,3)]).mult,2);
 assert.equal(chooseBotTarget(s,[d(1,3),d(1,2)]).mult,1);
 assert.equal(applyTurn(s,{hits:[d(1,3),d(1,2),aimed(s,[d(1,3),d(1,2)])]}).winner,0);
 assert.equal(chooseBotTarget(s,[miss,d(1,3)]).mult,3,'Two missing segments with one dart left: score points, do not chase an impossible Shanghai');
 assert.equal(chooseBotTarget(s,[d(1),d(1)]).mult,3,'Duplicate singles do not leave time for both double and triple');
 assert.equal(chooseBotTarget(s,[d(1,2),d(1,3)]).mult,1,'Keep a still-possible Shanghai after an unexpected double');
 console.log(`PASS BOT ${level}: Shanghai combination, missed darts, duplicate segments and point scoring`);

 s=fresh('golf',level,2,{golfScoring:'last'});
 assert.deepEqual(chooseBotTarget(s),{number:1,mult:2});
 for(const mult of [1,2,3]){
  const turn=botVisit(s,[d(1,mult)]);assert.ok(turn,'Bank a valid hole rather than overwrite it with a miss');
  assert.equal(applyTurn(s,turn).players[0].golfStrokes,{1:3,2:1,3:2}[mult]);
 }
 assert.equal(botVisit(s,[miss]),null);assert.equal(botVisit(s,[d(2)]),null);
 s.partyTarget=s.golfHoles;s.players[0].golfStrokes=25;s.players[1].golfStrokes=27;s.players[1].golfScores=Array(s.golfHoles).fill(3);
 assert.equal(botVisit(s,[d(9)]),null,'Last hole: do not bank a three when two is needed to avoid a certain loss');
 assert.ok(botVisit(s,[d(9,3)]),'Bank a tie when it is safer than gambling on one stroke');
 s=fresh('golf',level);assert.equal(botVisit(s,[d(1,2)]),null,'Best-of-three still requires a complete visit');
 console.log(`PASS BOT ${level}: Golf best/last scoring, banking and final-hole catch-up`);

 s=fresh('killer',level,4);
 for(let i=0;i<4;i++)s.players[i].killerNumber=[20,19,18,17][i];s.killerStage='playing';
 s.players[0].killerLetters=2;
 assert.deepEqual(chooseBotTarget(s),{number:20,mult:1},'One activation mark needs a single, not a speculative triple');
 assert.equal(chooseBotTarget(s,[d(20)]).number,19,'Attack immediately after becoming Killer within the visit');
 s.players[0].killerActivated=true;s.players[0].killerLetters=3;s.players[1].killerLives=1;
 assert.deepEqual(chooseBotTarget(s),{number:19,mult:1});
 assert.equal(chooseBotTarget(s,[d(19)]).number,18,'Skip a player eliminated by the preceding dart');
 s.killerRules=undefined;s.players.forEach(p=>{p.killerLetters=6;p.killerActivated=true;});s.players[1].killerLetters=0;
 assert.deepEqual(chooseBotTarget(s),{number:19,mult:1},'Saved six-letter Killer still removes one letter/life per hit');
 console.log(`PASS BOT ${level}: Killer activation, easy final hit, per-dart victim changes and saved rules`);

 s=fresh('fourinarow',level,4);s.fourOwners.fill(null);
 for(const i of [1,2,3])s.fourOwners[i]=0;
 for(const i of [0,5,6,7])s.fourOwners[i]=1;
 assert.equal(chooseBotTarget(s).cell,4,'Take the immediate win before blocking a rival');
 s.fourOwners.fill(null);for(const i of [0,1,2])s.fourOwners[i]=1;
 assert.equal(chooseBotTarget(s).cell,3,'Block an immediate opponent win');
 s.fourOwners.fill(null);for(const i of [0,1,2])s.fourOwners[i]=0;
 s.players[0].fourMarks[3]=2;
 assert.equal(chooseBotTarget(s).mult,3,'Old unclaimed marks expire between visits');
 const number=Number(s.fourBoard[3].slice(1));
 assert.equal(chooseBotTarget(s,[{...d(number,2),cell:3}]).mult,1,'Use a single to finish two marks already thrown in this visit');

 s=fresh('scram',level);s.scramClosed[19]=true;
 assert.notEqual(chooseBotTarget(s).number,20,'Stopper does not aim at a closed number');
 assert.equal(chooseBotTarget(s).mult,1,'Only one hit is needed to stop a number');
 assert.notEqual(chooseBotTarget(s,[d(19)]).number,19,'Newly stopped numbers count immediately');
 s.scramRole='scorer';s.active=s.scramScorer;
 assert.equal(chooseBotTarget(s).mult,3);assert.notEqual(chooseBotTarget(s).number,20);
 s.scramClosed.fill(true);s.scramClosed[20]=false;assert.equal(chooseBotTarget(s).number,25);

 s=fresh('bull41',level);assert.deepEqual(chooseBotTarget(s),{number:25,mult:2});
 s.bull41Role='scorer';s.active=s.bull41Scorer;assert.deepEqual(chooseBotTarget(s),{number:20,mult:3});
 s=fresh('twentyone',level);assert.equal(chooseBotTarget(s,[d(1,3)]).number,4);
 s.players[0].twentyOneTarget=20;assert.deepEqual(chooseBotTarget(s),{number:20,mult:3});
 assert.ok(botVisit(s,[d(20,3)]),'Finish on the winning dart instead of adding useless darts');

 s=fresh('bobs27',level);s.bobsTarget=17;
 assert.deepEqual(chooseBotTarget(s,[d(17,2)]),{number:17,mult:2},'All three darts address the current double');
 for(const mode of ['double','triple']){
  s=fresh('tenlives',level,2,{livesMode:mode});s.players[0].livesTarget=12;
  assert.deepEqual(chooseBotTarget(s),{number:12,mult:mode==='double'?2:3});
  s.players[0].livesTarget=25;assert.deepEqual(chooseBotTarget(s),{number:25,mult:2});
 }
 console.log(`PASS BOT ${level}: Four in a Row, Scram roles, Bull/41 roles, 21 progress, Bob's 27 and Hitters targets`);

 for(const training121 of [false,true]){
  s=fresh('x01',level,2,{training121});s.players[s.active].remaining=40;
  assert.deepEqual(chooseBotTarget(s),{number:20,mult:2});assert.ok(botVisit(s,[aimed(s)]));
  s.players[s.active].remaining=32;assert.deepEqual(chooseBotTarget(s,[miss,miss]),{number:16,mult:2});
 }
 s=fresh('x01',level,2,{inMode:'double'});assert.equal(chooseBotTarget(s).mult,2);
 s=fresh('x01',level,2,{inMode:'master'});assert.equal(chooseBotTarget(s).mult,3);
 s=fresh('gotcha',level);s.players[0].remaining=160;s.players[1].remaining=180;
 assert.deepEqual(chooseBotTarget(s),{number:20,mult:1},'Reset the reachable opponent');
 s.players[0].remaining=261;assert.deepEqual(chooseBotTarget(s),{number:20,mult:2},'A legal direct win comes first');

 for(const game of ['cricket','tactics'])for(const scoring of ['standard','cut-throat','no-score']){
  s=fresh(game,level,4,{scoring});s.players[0].marks[20]=3;
  assert.equal(chooseBotTarget(s).number,scoring==='no-score'?19:20,'Use the selected scoring variant');
  for(const p of s.players)p.marks[20]=3;
  assert.notEqual(chooseBotTarget(s).number,20,'A number closed by everyone can no longer earn anything');
 }
 console.log(`PASS BOT ${level}: X01 and 121 finishes/opening, Gotcha resets and all Cricket/Tactics variants`);
}

// Observe decisions as real scatter changes complete games, including wounded
// and eliminated fleets and visits that continue after a miss.
let seed=930543;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(const level of [40,50])for(const count of [2,3,4])for(let run=0;run<10;run++){
 let s=fresh('seabattle',level,count),visits=0;
 while(s.phase==='playing'&&visits++<500){
  const hits=[];let turn;
  do{
   const live=previewParty(s,hits),target=chooseBotTarget(s,hits),cell=target.number-1;
   assert.ok(live.players.some((p,i)=>i!==s.active&&!p.seaEliminated&&(!p.seaShots[cell]||(p.seaFleet[cell]&&p.seaHull[cell]<2))),'Never deliberately target known water or destroyed cells when no other opponent can be hit there');
   const before=structuredClone(s);hits.push(botDart(s,hits,random));assert.deepEqual(s,before,'Planning and throwing cannot mutate a match');turn=botVisit(s,hits);
  }while(!turn);
  s=applyTurn(s,turn);
 }
 assert.equal(s.phase,'won','Sea Battle must finish without a round cap');
}
console.log('PASS: 60 complete Sea Battle matches, useful intended targets after every dart, natural misses and immutable planning');
