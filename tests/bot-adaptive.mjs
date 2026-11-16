import assert from 'node:assert/strict';
import {newMatch,applyTurn,makeDart} from '../dist/engine.js';
import {botDart,botVisit,chooseBotTarget,botDifficulty,botSigma} from '../dist/bot.js';
import {botMarkReferences,botSpread} from '../dist/bot-level.js';
const fresh=(game='x01',scoring='standard',count=2)=>newMatch(['BOT','Human','Human 2','BOT 2'].slice(0,count),501,'double',1,{game,scoring,maxRounds:0,botLevels:[40,0,0,50].slice(0,count)});
let state=fresh(),human=state.players[1];human.darts=9;human.points=150;
assert.equal(botDifficulty(state).level,45);
human.points=180;assert.equal(botDifficulty(state).level,55);
human.points=149.7;assert.equal(botDifficulty(state).level,40,'Below the ten-point gap, keep the base level');
human.points=135;assert.equal(botDifficulty(state).adaptive,false);
human.points=210;assert.equal(botDifficulty(state).level,65,'Stay five below a stronger human rather than taking half the gap');
human.points=90;assert.equal(botDifficulty(state).level,40);
human.darts=6;human.points=360;assert.equal(botDifficulty(state).level,40);
human.darts=9;human.points=540;assert.equal(botDifficulty(state).level,100);
assert.equal(botDifficulty(state,1).level,0);
for(const options of [{game:'gotcha'},{game:'x01',training121:true}]){
 const s=newMatch(['BOT','Human'],501,'double',1,{...options,botLevels:[40,0]});
 s.players[1].darts=9;s.players[1].points=210;
 assert.equal(botDifficulty(s).level,65,`${options.training121?'121':options.game} follows the human scoring average`);
}
state=fresh('x01','standard',4);state.players[1].darts=state.players[2].darts=9;state.players[1].points=150;state.players[2].points=210;
assert.equal(botDifficulty(state,0).level,65);assert.equal(botDifficulty(state,3).level,65);
state.players[3].points=540;state.players[3].darts=9;assert.equal(botDifficulty(state).level,65,'Bots must not form an escalating feedback loop');
state.players[1].points=state.players[2].points=177;assert.equal(botDifficulty(state,3).level,50,'BOT 50 stays at base against an average below 60');
state.players[1].points=180;assert.equal(botDifficulty(state,3).level,55);
const copy=structuredClone(state);botDifficulty(state);assert.deepEqual(state,copy);
for(const game of ['cricket','tactics'])for(const scoring of ['standard','cut-throat','no-score']){
 const s=fresh(game,scoring),ref=botMarkReferences[game][scoring];s.players[1].darts=30;s.players[1].totalMarks=ref[1]*10;
 assert.equal(botDifficulty(s).level,45);
 s.players[1].cricketPoints=100000;assert.equal(botDifficulty(s).level,45,'Scoreboard points must not be treated as 501 average');
 s.players[1].totalMarks=ref[0]*10;assert.equal(botDifficulty(s).level,40);
}
console.log('PASS: ten-point trigger, five below human, minimum sample, bounds, four players, no bot feedback, immutable stats and MPR-based skill');
const d=makeDart;
for(const game of ['cricket','tactics']){
 let s=fresh(game);s.players[0].marks[20]=3;
 assert.equal(chooseBotTarget(s).number,20,'Build points when a scoring target is open');
 const after=applyTurn(s,{hits:[d(20,3),d(19,3),d(18,3)]});assert.equal(after.players[0].cricketPoints,60);
 assert.equal(chooseBotTarget(s,[d(20,3)]).number,19,'Re-evaluate after building the points cushion');
 s=fresh(game);assert.equal(chooseBotTarget(s,[d(20,3)]).number,20,'Newly closed target becomes a scoring target on dart two');
 s.players[0].marks[20]=3;s.players[1].cricketPoints=150;
 assert.equal(chooseBotTarget(s).number,20,'Catch a points deficit');
 s.players[1].marks[20]=3;s.players[0].marks[19]=2;
 assert.equal(chooseBotTarget(s).number,19,'Create a scoreable target when the opponent closed our earlier ones');
 s=fresh(game);s.players[0].marks[20]=3;s.players[1].marks[19]=3;s.players[1].cricketPoints=40;
 assert.equal(chooseBotTarget(s).number,19,'Stop a scoring arms race by closing the opposing route');
 s=fresh(game);s.players[0].cricketPoints=100;s.players[0].marks[20]=3;s.players[1].marks[19]=3;
 assert.equal(chooseBotTarget(s).number,19,'Defend a comfortable lead');
 s=fresh(game);for(const number of s.numbers)s.players[0].marks[number]=3;s.players[0].marks[25]=2;
 assert.equal(chooseBotTarget(s).number,25,'Win immediately instead of farming unnecessary points');
 const winning=botVisit(s,[d(25)]);assert.ok(winning);assert.notEqual(applyTurn(s,winning).phase,'playing');
 s.players[0].marks[25]=3;s.players[1].cricketPoints=100;for(const number of s.numbers)s.players[1].marks[number]=3;s.players[1].marks[15]=0;
 assert.equal(chooseBotTarget(s).number,15,'Closed everything but behind: score on the remaining opponent opening');
 s=fresh(game,'no-score');s.players[0].marks[20]=3;
 assert.notEqual(chooseBotTarget(s).number,20,'No Score must not deliberately farm points');
 s=fresh(game,'cut-throat',3);s.players[0].cricketPoints=40;s.players[1].cricketPoints=0;s.players[2].cricketPoints=100;
 s.players[0].marks[20]=s.players[0].marks[19]=3;s.players[1].marks[20]=3;s.players[2].marks[19]=3;
 assert.equal(chooseBotTarget(s).number,19,'Cut Throat: target the low-scoring opponent, not an already losing player');
 const scored=applyTurn(s,{hits:[d(19,3),d(19,3),d(19,3)]});assert.equal(scored.players[1].cricketPoints,171);assert.equal(scored.players[2].cricketPoints,100);assert.equal(scored.players[0].cricketPoints,40);
 console.log(`PASS: ${game} points, catch-up, new scoring routes, defense, legal finish, all-closed deficit, No Score and Cut Throat`);
}
// Complete games with mixed accurate/less accurate bots must not settle into
// endless point trading; no round cap is used to conceal a stalled strategy.
let seed=726153;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(const game of ['cricket','tactics'])for(const scoring of ['standard','cut-throat','no-score'])for(const count of [2,3,4]){
 for(let run=0;run<8;run++){
  let s=newMatch(['A','B','C','D'].slice(0,count),501,'double',1,{game,scoring,maxRounds:0,botLevels:[40,50,40,50].slice(0,count)});
  let visits=0;
  while(s.phase==='playing'&&visits++<400){let hits=[],turn;do{hits.push(botDart(s,hits,random));turn=botVisit(s,hits);}while(!turn);s=applyTurn(s,turn);}
  assert.notEqual(s.phase,'playing',`${game}/${scoring}/${count} stalled`);
 }
}
console.log('PASS: 144 complete Cricket/Tactics matches, all scoring rules, 2-4 players, no artificial round cap');
for(const target of [45,55,65,75,95]){
 let points=0,darts=0;
 for(let game=0;game<800;game++){
  let s=fresh();s.players[1].darts=9;s.players[1].points=(target+5)*3;
  for(let turn=0;turn<300&&s.phase==='playing';turn++){
   s.active=0;let hits=[],input;do{hits.push(botDart(s,hits,random));input=botVisit(s,hits);}while(!input);s=applyTurn(s,input);
  }
  assert.equal(s.phase,'won');points+=s.players[0].points;darts+=s.players[0].darts;
 }
 const average=3*points/darts;assert.ok(Math.abs(average-target)<2.5,`Adaptive target ${target}: ${average}`);
 console.log(`PASS: adaptive target ${target}, measured ${average.toFixed(2)} across 800 complete 501 legs`);
}
assert.ok(botSpread(45)<botSigma[40]&&botSpread(45)>botSigma[50]);
