import assert from 'node:assert/strict';
import {newMatch,applyTurn} from '../dist/engine.js';
import {seaPublicMatch,golfStroke} from '../dist/party-rules.js';
import {applyCameraEvent} from '../dist/autoscoring-rules.js';
import {chooseBotTarget} from '../dist/bot.js';
import {buildGameReport} from '../dist/game-reports.js';
const d=(number,mult=1)=>({number,mult}),miss=d(0),names=['A','B','C','D'];
for(let n=0;n<40;n++){
 const state=newMatch(names,0,'single',1,{game:'seabattle'});
 for(const p of state.players){assert.equal(p.seaFleet.filter(Boolean).length,7);assert.equal(p.seaRemaining,14);for(const id of [1,2,3]){const cells=p.seaFleet.flatMap((v,i)=>v===id?[i]:[]);assert.equal(cells.length,id===1?3:2);assert.ok(cells.every((v,i)=>i===0||v-cells[i-1]===(cells[1]-cells[0])));}}
 const publicMatch=seaPublicMatch({state,undo:[state]},0);assert.deepEqual(publicMatch.state.players[1].seaFleet,Array(20).fill(null));assert.equal(publicMatch.undo.length,0);assert.deepEqual(publicMatch.state.players[0].seaFleet,state.players[0].seaFleet);
}
let sea=newMatch(names,0,'single',1,{game:'seabattle',starter:2}),before=structuredClone(sea);
const target=sea.players[0].seaFleet.findIndex(Boolean)+1;sea=applyTurn(sea,{hits:[d(target,2),d(target,3),miss]});
assert.equal(before.players[2].seaRemaining,sea.players[2].seaRemaining);assert.equal(sea.players[0].seaRemaining,12);assert.equal(sea.players[0].seaHull[target-1],2);assert.equal(sea.active,3);assert.equal(before.players[0].seaRemaining,14);
sea.active=2;for(let i=0;i<4;i++)if(i!==2){sea.players[i].seaRemaining=2;sea.players[i].seaHull=sea.players[i].seaFleet.map(v=>v?2:0);sea.players[i].seaFleet[0]=1;sea.players[i].seaHull[0]=0;}
sea=applyTurn(sea,{hits:[d(1,2)]});assert.equal(sea.phase,'won');assert.equal(sea.winner,2);assert.equal(sea.history.at(-1).darts,1);
let golf=newMatch(names,0,'single',1,{game:'golf',starter:3,golfHoles:9});
golf=applyTurn(golf,{hits:[d(1,2),d(8),d(1,3)]});assert.equal(golf.players[3].golfStrokes,1);assert.equal(golf.active,0);assert.equal(golf.partyTarget,1);
for(let n=0;n<3;n++)golf=applyTurn(golf,{hits:[miss,miss,miss]});assert.equal(golf.partyTarget,2);assert.equal(golf.active,3);
let last=newMatch(['A'],0,'single',1,{game:'golf',golfScoring:'last',golfHoles:18});last=applyTurn(last,{hits:[d(1,2),d(9)]});assert.equal(last.players[0].golfStrokes,5);assert.equal(last.partyTarget,2);
assert.throws(()=>applyTurn(newMatch(['A'],0,'single',1,{game:'golf'}),{hits:[d(1,2)]}));
for(const [mult,stroke] of [[1,3],[2,1],[3,2]])assert.equal(golfStroke(d(5,mult),5),stroke);
let shanghai=newMatch(names,0,'single',1,{game:'shanghai'});shanghai=applyTurn(shanghai,{hits:[d(1),d(1,3),d(1,2)]});assert.equal(shanghai.phase,'won');assert.equal(shanghai.winner,0);assert.equal(shanghai.players[0].shanghaiPoints,6);
for(const game of ['golf','shanghai']){
 let s=newMatch(names,0,'single',1,{game,starter:2});
 const limit=game==='golf'?9:7;
 for(let visit=0;visit<limit*4;visit++)s=applyTurn(s,{hits:[miss,miss,miss]});
 assert.equal(s.phase,'won');assert.equal(s.winner,null);assert.equal(s.history.length,limit*4);assert.equal(buildGameReport(s).rows.length,limit*4);
}
for(const game of ['golf','shanghai','seabattle']){
 const s=newMatch(['A','B'],0,'single',1,{game}),hits=game==='shanghai'?[d(1),d(1,3),d(1,2)]:[d(1),miss,miss];let camera={state:s,undo:[]},draft=null;
 for(const hit of hits){const result=applyCameraEvent(camera,draft,{kind:'dart',hit});camera=result.match;draft={hits:result.hits};}
 delete camera.state.completedAt;assert.deepEqual(camera.state,applyTurn(s,{hits}));assert.ok(chooseBotTarget(s).number>=1);assert.ok(buildGameReport(camera.state).title);
}
console.log('PASS: Zeeslag fleet generation/privacy, damage, no friendly fire, immediate win; golf 9/18, best/last, starter/round fairness; Shanghai combo/score/ties; camera parity and reports');
