import assert from 'node:assert/strict';
import {newMatch,applyTurn,previewCricket,nextLeg,makeDart} from '../dist/engine.js';
import {buildGameReport} from '../dist/game-reports.js';
import {botDart,botVisit} from '../dist/bot.js';
import {applyCameraEvent} from '../dist/autoscoring-rules.js';
const d=makeDart,miss=d(0),stat=(report,key)=>report.players[0].stats.find(([label])=>label===key)?.[1];
for(const game of ['cricket','tactics'])for(const scoring of ['standard','cut-throat','no-score']){
 const state=newMatch(['Solo'],501,'double',2,{game,scoring,maxRounds:0}),hits=[d(20,3),d(20,3),miss],before=structuredClone(state),points=scoring==='no-score'?0:60;
 assert.equal(previewCricket(state,hits.slice(0,1)).players[0].cricketPoints,0);
 assert.equal(previewCricket(state,hits.slice(0,2)).players[0].cricketPoints,points);
 assert.deepEqual(state,before,'A preview must not change the saved score');
 const updated=applyTurn(state,{hits});
 assert.equal(updated.players[0].cricketPoints,points);assert.equal(updated.players[0].points,points);
 assert.equal(updated.history[0].score,points);assert.equal(updated.players[0].marks[20],3);
 assert.equal(updated.players[0].totalMarks,scoring==='no-score'?3:6);
 const report=buildGameReport(updated);
 if(scoring==='no-score'){assert.ok(!report.headers.includes('Punten'));assert.match(report.subtitle,/puntentelling staat uit/);}
 else{assert.equal(stat(report,'Eindscore'),'60');assert.equal(stat(report,'Totaal gescoord'),'60');assert.equal(report.rows[0][report.headers.indexOf('Punten')],'60');assert.ok(report.bars.some(chart=>chart.items.some(item=>item.display==='60 punten')));}
 // A double bull can close the last mark and score its one excess mark on
 // the winning dart, without requiring the two unused darts.
 for(const n of updated.numbers)updated.players[0].marks[n]=3;updated.players[0].marks[25]=2;
 const finished=applyTurn(updated,{hits:[d(25,2)]});
 assert.equal(finished.phase,'leg');assert.equal(finished.history.at(-1).darts,1);
 assert.equal(finished.players[0].cricketPoints,points+(scoring==='no-score'?0:25));
 const next=nextLeg(finished);assert.equal(next.players[0].cricketPoints,0);assert.equal(next.players[0].points,points+(scoring==='no-score'?0:25));
 if(scoring!=='no-score'){const totals=buildGameReport(next);assert.equal(stat(totals,'Eindscore'),'0');assert.equal(stat(totals,'Totaal gescoord'),'85');}
 console.log(`PASS: solo ${game}/${scoring}, live points, overflow, bull, early finish, new leg, report and share data`);
}
for(const game of ['cricket','tactics']){
 let match={state:newMatch(['Solo'],501,'double',1,{game}),undo:[]},draft=null;match.state.players[0].marks[20]=3;
 for(const hit of [d(20,3),d(20,3),miss]){const result=applyCameraEvent(match,draft,{kind:'dart',hit});match=result.match;draft={hits:result.hits};}
 assert.equal(match.state.players[0].cricketPoints,120);assert.equal(match.state.history[0].score,120);
}
console.log('PASS: solo camera events use the same scoring rule as manual darts');
// Additional solo games with point scores must expose their actual credited
// totals; drills whose objective is progress/lives keep their existing result.
let x=newMatch(['Solo'],40,'double',1);x=applyTurn(x,{hits:[d(20,2)]});assert.equal(stat(buildGameReport(x),'Totaal gescoord'),'40');
let bust=newMatch(['Solo'],40,'double',1);bust=applyTurn(bust,{hits:[d(20,3)]});assert.equal(stat(buildGameReport(bust),'Totaal gescoord'),'0');
let training=newMatch(['Solo'],121,'double',1,{training121:true});training=applyTurn(training,{hits:[d(20,3),d(11,3),d(14,2)]});assert.equal(stat(buildGameReport(training),'Totaal gescoord'),'121');
let bobs=newMatch(['Solo'],27,'double',1,{game:'bobs27'});bobs=applyTurn(bobs,{hits:[d(1,2),d(1,2),miss]});assert.equal(stat(buildGameReport(bobs),'Eindscore'),'31');
let gotcha=newMatch(['A','B'],301,'single',1,{game:'gotcha'});gotcha=applyTurn(gotcha,{hits:[d(20,3),d(20,3),d(20,3)]});assert.equal(stat(buildGameReport(gotcha),'Totaal gescoord'),'180');
console.log("PASS: X01 credited totals and busts, 121 total points, Bob's 27 end score and Gotcha totals");
// The same solo rule runs for a bot and does not turn into endless score
// farming. Multiplayer rules remain covered by the regular engine tests.
let seed=654721;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(const game of ['cricket','tactics']){
 let total=0;
 for(let sample=0;sample<20;sample++){
  let state=newMatch(['BOT'],501,'double',1,{game,botLevels:[50],maxRounds:0});
  for(let visit=0;visit<200&&state.phase==='playing';visit++){let hits=[],turn;do{hits.push(botDart(state,hits,random));turn=botVisit(state,hits);}while(!turn);state=applyTurn(state,turn);}
  assert.equal(state.phase,'won');assert.equal(state.players[0].cricketPoints,state.history.reduce((sum,turn)=>sum+turn.score,0));total+=state.players[0].cricketPoints;
 }
 assert.ok(total>0);console.log(`PASS: solo ${game} BOT completes and retains scored points`);
}
