import assert from 'node:assert/strict';
import {newMatch,applyTurn} from '../dist/engine.js';
import {seaPublicMatch} from '../dist/party-rules.js';
import {seaLog,seaShotText,turnPlayer} from '../dist/sea-log.js';
import {turnFeedback} from '../dist/game-feedback.js';
import {gameMoments} from '../dist/game-moments.js';
import {botDart,botVisit} from '../dist/bot.js';
const d=(number,mult=1)=>({number,mult}),miss=d(0);
let s=newMatch(['BOT 50 #1','BOT 40 #2'],301,'single',1,{game:'seabattle',starter:1});
// Regression from the phone: BOT 40 attacks 7 twice. Its own 7 is water,
// while 7 belongs to a two-cell ship in BOT 50's fleet.
s.players[0].seaFleet=[0,2,0,0,0,0,2,3,3,0,0,0,1,1,1,0,0,0,0,0];
s.players[1].seaFleet=[3,3,2,2,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0];
const original=structuredClone(s),partial=applyTurn(s,{hits:[d(7),miss,d(7)]});
let log=seaLog(partial);
assert.equal(partial.players[0].seaHull[6],2);
assert.equal(partial.players[1].seaHull[6],0);
assert.equal(log.cells[0][6].destroyedBy,1);
assert.equal(log.last.actor,1);assert.match(seaShotText(partial,log.last),/BOT 40 #2.*7.*BOT 50 #1.*vernietigd/);
assert.equal(gameMoments(s,partial).find(e=>e.key==='cell:0:6').actor,1);
s=applyTurn(partial,{hits:[miss,miss,miss]});
const sunk=applyTurn(s,{hits:[d(2,2),miss,miss]});log=seaLog(sunk);
assert.equal(log.sunk[0][2].actor,1);assert.equal(log.cells[0][6].sunkBy,1);
assert.match(gameMoments(s,sunk).find(e=>e.key==='ship:0:2').detail,/BOT 40 #2.*BOT 50 #1/);
const fog=seaPublicMatch({state:sunk},1).state,fogLog=seaLog(fog);
assert.equal(fog.players[0].seaFleet[12],null);
assert.equal(fogLog.cells[0][12].hitBy,undefined,'Unknown ship cells must not receive credit');
assert.equal(fogLog.sunk[0][2].actor,1,'Revealed ship credits survive online fog');
assert.deepEqual(original.players[0].seaHull,Array(20).fill(0),'Presentation must not alter scores');
assert.equal(turnPlayer(sunk,sunk.history[0]),1);
assert.match(turnFeedback(sunk,sunk.history[0]),/2 schade/);
console.log('PASS phone cell 7 regression: attacker, victim, cell destruction versus whole ship, saved/online credits and immutable scores');
let seed=52;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const game of ['x01','121','gotcha','cricket','tactics','fourinarow','killer','seabattle','scram','bull41','golf','shanghai','twentyone','bobs27','tenlives']){
 for(const count of [2,4]){
  let state=newMatch(['BOT 40 A','BOT 50 B','BOT 40 C','BOT 50 D'].slice(0,count),301,'double',1,{game:game==='121'?'x01':game,training121:game==='121',livesMode:'double',botLevels:[40,50,40,50].slice(0,count),maxRounds:0});
  const visited=new Set();
  for(let n=0;n<120&&state.phase==='playing'&&visited.size<count;n++){
   const actor=state.active;let hits=[],turn;
   for(let attempt=0;attempt<100&&!turn;attempt++){if(state.game==='killer'&&state.killerStage==='assigning')hits=[];hits.push(botDart(state,hits,random));turn=botVisit(state,hits);}
   assert.ok(turn);state=applyTurn(state,turn);
   const row=state.history.at(-1);assert.equal(turnPlayer(state,row),actor);
   assert.ok(turnFeedback(state,row).length>0,`${game} needs a visible visit result`);visited.add(actor);
  }
  assert.equal(visited.size,count,`${game}: feedback for every participant`);
 }
}
console.log('PASS named visit feedback for all fifteen games, 2 and 4 BOT players, training and scoring units');
