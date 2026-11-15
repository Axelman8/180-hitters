import assert from 'node:assert/strict';
import {newMatch,applyTurn,nextLeg,makeDart} from '../dist/engine.js';
import {botDart,botVisit,boardHit,throwAt} from '../dist/bot.js';
let seed=824239;
const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
function visit(state){
 let hits=[],turn;
 for(let n=0;n<100;n++){
  if(state.game==='killer'&&state.killerStage==='assigning')hits=[];
  hits.push(botDart(state,hits,random));turn=botVisit(state,hits);
  if(turn)return applyTurn(state,turn);
 }
 throw Error('BOT could not finish a legal visit');
}
assert.deepEqual([boardHit(0,0).label,boardHit(10,0).label,boardHit(0,-103).label,boardHit(0,-166).label,boardHit(0,-180).label],['Bull','25','T20','D20','Mis']);
for(const game of ['x01','cricket','tactics','fourinarow','scram','killer','bull41','twentyone','121','gotcha','tenlives','bobs27']){
 for(let run=0;run<3;run++){
  let state=newMatch(['A','B','C','D'],game==='gotcha'?301:501,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:run===1?'triple':'double',botLevels:[40,50,40,50],maxRounds:0});
  assert.deepEqual(state.players.map(p=>p.botLevel),[40,50,40,50]);
  for(let i=0;i<1500&&state.phase==='playing';i++){
   const old=state,actor=old.active;state=visit(old);
   assert.equal(old.history.length+1,state.history.length);
   assert.ok(state.players[actor].darts>old.players[actor].darts);
   if(state.training121&&state.phase==='leg')state=nextLeg(state);
   if(game==='121'&&i===35)break;
  }
  assert.ok(game==='121'||state.phase!=='playing',`${game} did not finish`);
 }
 console.log(`PASS: ${game}, four BOT seats, both levels and complete legal turns`);
 const mixed=newMatch(['Human','BOT 40','Human 2','BOT 50'],game==='gotcha'?301:501,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:[0,40,0,50]});
 assert.deepEqual(mixed.players.map(p=>p.bot),[false,true,false,true]);
}
for(const level of [40,50]){
 let points=0,darts=0,lowest=180,highest=0,misses=0;
 for(let game=0;game<1500;game++){
  let state=newMatch(['BOT'],501,'double',1,{botLevels:[level],maxRounds:0});
  for(let turn=0;turn<300&&state.phase==='playing';turn++)state=visit(state);
  assert.equal(state.phase,'won');points+=state.players[0].points;darts+=state.players[0].darts;
  for(const turn of state.history){lowest=Math.min(lowest,turn.score);highest=Math.max(highest,turn.score);misses+=turn.input.hits.filter(hit=>hit.number===0).length;}
 }
 const average=points*3/darts;assert.ok(Math.abs(average-level)<2,`Level ${level}: ${average}`);assert.ok(lowest===0&&highest>=100&&misses>0);
 console.log(`PASS: level ${level}: ${average.toFixed(2)} over 1,500 full 501 legs, including doubles/busts; varied visits and misses`);
}
// Winning on the first dart ends immediately, and engine no longer hides an
// entire BOT reply inside a human visit.
let four=newMatch(['Human','BOT'],0,'single',1,{game:'fourinarow',botLevels:[0,50]});
four=applyTurn(four,{hits:[{cell:null,mult:1},{cell:null,mult:1},{cell:null,mult:1}]});assert.equal(four.history.length,1);assert.equal(four.active,1);
four.fourOwners[0]=four.fourOwners[1]=four.fourOwners[2]=1;
assert.equal(botVisit(four,[{cell:3,mult:3,number:20}]).hits.length,1);
let finish=newMatch(['BOT','Human'],40,'double',1,{botLevels:[50,0]});assert.equal(botVisit(finish,[makeDart(20,2)]).hits.length,1);
console.log('PASS: early wins and no instantaneous hidden BOT reply');
