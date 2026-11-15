import assert from 'node:assert/strict';
import {newMatch,makeDart,applyTurn} from '../dist/engine.js';
import {applyCameraEvent} from '../dist/autoscoring-rules.js';

const d=makeDart;
function fixture(game,names=['A','B'],options={}){
 return {match:{state:newMatch(names,501,'double',1,{game,...options}),undo:[]},hits:[]};
}
function camera(current,hit){
 return applyCameraEvent(current.match,{hits:current.hits},{kind:'dart',hit});
}
function fullVisit(current,hits){
 const expected=applyTurn(current.match.state,{hits}),actor=current.match.state.active;
 for(let index=0;index<hits.length;index++){
  current=camera(current,hits[index]);
  if(index<hits.length-1){assert.equal(current.closed,false);assert.equal(current.hits.length,index+1);assert.equal(current.match.state.active,actor);}
 }
 assert.equal(current.closed,true);assert.equal(current.hits.length,0);
 // Timing metadata is intentionally assigned when a result is committed.
 if(current.match.state.completedAt)expected.completedAt=current.match.state.completedAt;
 assert.deepEqual(current.match.state,expected);
 assert.equal(current.match.undo.length,1);
 return current;
}

for(const game of ['scram','bull41','twentyone']){
 const first=fullVisit(fixture(game),game==='twentyone'?[d(1),d(2,2),d(4,3)]:[d(20),d(19,2),d(0)]);
 assert.equal(first.match.state.history.length,1);assert.notEqual(first.match.state.active,game==='twentyone'?0:1);
 // A second visit must retain all three separate darts as well.
 const next={...first,match:{...first.match,undo:[]}};
 fullVisit(next,game==='twentyone'?[d(1),d(0),d(2)]:[d(20,3),d(20,3),d(0)]);
 console.log(`PASS: ${game} camera darts 1, 2, 3, exact manual rules and next player`);
}

let killer=fixture('killer');
for(const number of [5,12]){
 const actor=killer.match.state.active;
 killer=camera(killer,d(number));
 assert.equal(killer.closed,true);assert.equal(killer.hits.length,0);
 assert.equal(killer.match.state.players[actor].killerNumber,number);
}
assert.equal(killer.match.state.killerStage,'playing');
fullVisit({...killer,match:{...killer.match,undo:[]}},[d(5),d(5),d(5)]);
for(const hit of [d(0),d(25),d(5)]){
 let assigning=fixture('killer');assigning.match.state.players[1].killerNumber=5;
 assert.throws(()=>camera(assigning,hit),/Gooi|al van/,'Invalid/occupied numbers must never be assigned');
}
console.log('PASS: Killer one-dart number assignment, unique numbers and three-dart visits');

let twenty=fixture('twentyone',['Solo']);twenty.match.state.players[0].twentyOneTarget=21;
twenty=fullVisit(twenty,[d(25)]);
assert.equal(twenty.match.state.phase,'won');assert.equal(twenty.match.state.history[0].darts,1);
console.log('PASS: 21 immediately completes on the final bull');

let four=fixture('fourinarow'),cell=four.match.state.fourBoard.indexOf('n20');
const mapped=[{...d(20),cell},{...d(0),cell:null},{...d(0),cell:null}].map(hit=>({...hit,needsBullCorner:false}));
let expected=applyTurn(four.match.state,{hits:mapped});
for(const [index,hit] of [d(20),d(0),d(0)].entries()){
 four=camera(four,hit);assert.equal(four.hits.length,index===2?0:index+1);
}
assert.deepEqual(four.match.state,expected);assert.equal(four.closed,true);
assert.equal(four.match.state.players[0].fourMarks[cell],0,'Unclaimed marks expire');
assert.equal(four.match.state.history[0].darts,3);
let corner=camera(fixture('fourinarow'),d(25));
assert.equal(corner.hits[0].needsBullCorner,true);assert.equal(corner.closed,false);
corner=camera(corner,d(0));assert.equal(corner.hits.length,2);
corner=camera(corner,d(20,3));assert.equal(corner.hits.length,3);
assert.equal(corner.hits[0].needsBullCorner,true);
assert.equal(corner.closed,false,'Darts 2 and 3 register before the player chooses a bull corner');
assert.equal(corner.match.state.history.length,0,'A visit with an unresolved corner cannot commit');
let threeBulls=fixture('fourinarow');
for(let i=0;i<3;i++)threeBulls=camera(threeBulls,d(25));
assert.equal(threeBulls.hits.filter(hit=>hit.needsBullCorner).length,3);
let lastCorner=fixture('fourinarow');
for(const cell of [0,4,24])lastCorner.match.state.fourOwners[cell]=1;
for(let i=0;i<3;i++)lastCorner=camera(lastCorner,d(25));
assert.equal(lastCorner.hits.filter(hit=>hit.needsBullCorner).length,1,'One free corner needs one choice; later bulls still count');
const corners=[0,4,20,24];
for(const pendingLast of [false,true]){
 let occupied=fixture('fourinarow');for(const index of corners)occupied.match.state.fourOwners[index]=1;
 if(pendingLast){occupied.match.state.fourOwners[24]=null;occupied.hits=[{...d(25),cell:24}];}
 occupied=camera(occupied,d(25));
 assert.equal(occupied.hits.at(-1).needsBullCorner,false,'No impossible corner prompt when all corners are claimed');
 while(occupied.hits.length)occupied=camera(occupied,d(0));
 assert.equal(occupied.closed,true);assert.equal(occupied.match.state.active,1);
}
let winning=fixture('fourinarow');for(const index of [5,6,7])winning.match.state.fourOwners[index]=0;
const target=Number(winning.match.state.fourBoard[8].slice(1));winning=camera(winning,d(target,3));
assert.equal(winning.match.state.phase,'won');assert.equal(winning.match.state.history[0].darts,1);
assert.equal(winning.closed,true);assert.deepEqual(winning.hits,[]);
console.log('PASS: 4 in a row misses, expiring marks, bull corners and immediate winning dart');

for(const game of ['x01','gotcha','cricket','tactics','bobs27']){
 fullVisit(fixture(game),[d(20),d(19),d(0)]);
 console.log(`PASS: ${game} camera/manual parity`);
}
fullVisit(fixture('x01',['A','B'],{training121:true}),[d(20,3),d(20),d(0)]);
let lives=fixture('tenlives',['A','B'],{livesMode:'double'});lives=camera(lives,d(20,2));
assert.equal(lives.match.state.history.length,1);assert.equal(lives.match.state.players[0].livesHits,1);
console.log('PASS: 121 and Hitters Challenge camera input');

const original=fixture('scram'),unchanged=structuredClone(original);
camera(original,d(20));assert.deepEqual(original,unchanged);
const removed=applyCameraEvent(original.match,null,{kind:'removed'});assert.deepEqual(removed.match,original.match);
assert.throws(()=>applyCameraEvent(original.match,{hits:[d(20)]},{kind:'removed'}),/Niet alle darts/);
original.match.state.players[original.match.state.active].bot=50;
assert.throws(()=>camera(original,d(20)),/BOT gooit/);
console.log('PASS: pure adapter, removal safety and bot/camera exclusion');
