import assert from 'node:assert/strict';
import {newMatch,applyTurn,makeDart,previewGotcha} from '../dist/engine.js';
import {chooseBotTarget,gotchaPlan,botDart,botVisit} from '../dist/bot.js';
const fresh=(level,score=160,opponents=[180],out='double')=>{
 const state=newMatch([`BOT ${level}`,...opponents.map((_,i)=>`Opponent ${i+1}`)],301,out,1,{game:'gotcha',botLevels:[level,...opponents.map(()=>0)]});
 state.players[0].remaining=score;opponents.forEach((value,index)=>state.players[index+1].remaining=value);return state;
};
const aimed=(state,hits=[])=>{const target=chooseBotTarget(state,hits);return makeDart(target.number,target.mult);};
for(const level of [40,50]){
 let state=fresh(level),original=structuredClone(state);
 assert.deepEqual(chooseBotTarget(state),{number:20,mult:1},'Attack even with fewer than 170 points left');
 assert.equal(gotchaPlan(state).opponent,1);assert.deepEqual(state,original);
 let hits=[aimed(state)];assert.equal(previewGotcha(state,hits).players[1].remaining,0);
 let result=applyTurn(state,{hits:[...hits,makeDart(0),makeDart(0)]});assert.equal(result.players[1].remaining,0);
 assert.deepEqual(result.history.at(-1).resets,[1]);
 // Reach a score requiring several darts, then recompute after a miss.
 state=fresh(level,50,[130]);assert.equal(gotchaPlan(state).route.length,2);
 hits=[];while(previewGotcha(state,hits).players[1].remaining>0&&hits.length<3)hits.push(aimed(state,hits));
 assert.equal(previewGotcha(state,hits).players[1].remaining,0);
 state=fresh(level,110,[131]);hits=[makeDart(5)];assert.deepEqual(chooseBotTarget(state,hits),{number:16,mult:1});
 assert.equal(previewGotcha(state,[...hits,aimed(state,hits)]).players[1].remaining,0);
 // Three broad singles are preferable to a speculative triple when available.
 state=fresh(level,40,[100]);assert.deepEqual(gotchaPlan(state).route,[{number:20,mult:1},{number:20,mult:1},{number:20,mult:1}]);
 assert.equal(gotchaPlan(state,[makeDart(0),makeDart(0)]).route.length,1,'One remaining dart uses a reachable segment');
 state=fresh(level,40,[120,60]);assert.equal(gotchaPlan(state,[makeDart(0),makeDart(0)]).opponent,2,'Do not chase a score requiring more darts than remain');
 // The most advanced reachable opponent is the largest immediate threat.
 state=fresh(level,40,[60,80,100]);assert.equal(gotchaPlan(state).opponent,3);
 hits=[];for(let i=0;i<3;i++)hits.push(aimed(state,hits));
 result=applyTurn(state,{hits});assert.deepEqual(result.players.slice(1).map(player=>player.remaining),[0,0,0]);assert.deepEqual(result.history.at(-1).resets,[1,2,3]);
 // A close opponent can be reset on the way to a legal finish.
 state=fresh(level,250,[270]);hits=[];for(let i=0;i<3;i++)hits.push(aimed(state,hits));
 result=applyTurn(state,{hits});assert.equal(result.phase,'won');assert.equal(result.winner,0);assert.equal(result.players[1].remaining,0);
 for(const [score,out,label] of [[261,'double','D20'],[281,'double','D10'],[281,'single','20'],[241,'master','T20']]){
  state=fresh(level,score,[score+10],out);assert.equal(gotchaPlan(state).kind,'finish');assert.equal(aimed(state).label,label);
  const winning=applyTurn(state,{hits:[aimed(state)]});assert.equal(winning.winner,0);assert.equal(winning.phase,'won');
 }
 state=fresh(level,200,[190,0]);assert.equal(gotchaPlan(state).kind,'score','Behind/zero opponents cannot be reached by adding points');
 state=fresh(level,200,[300]);assert.equal(gotchaPlan(state).kind,'score','Double-out must not target an illegal one-point remainder');
 state=fresh(level,40,[120]);assert.equal(gotchaPlan(state,[makeDart(20,3),makeDart(20)]).kind,'score','Already reset opponents must not be targeted again');
 state=fresh(level,280,[290]);assert.equal(gotchaPlan(state,[makeDart(20,3)]),null,'Bust ends the visit');
 assert.equal(gotchaPlan(state,[makeDart(0),makeDart(0),makeDart(0)]),null);
 console.log(`PASS BOT ${level}: singles, 1–3 dart resets, per-dart replanning, four players, reset-plus-win, finish priority and bust/remaining-dart guards`);
}
let seed=539743;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(const level of [40,50]){
 let resets=0;
 for(let sample=0;sample<400;sample++){
  const state=fresh(level,160,[180]),hits=[];let turn;
  do{hits.push(botDart(state,hits,random));turn=botVisit(state,hits);}while(!turn);
  if(applyTurn(state,turn).players[1].remaining===0)resets++;
 }
 assert.ok(resets>120,`Level ${level}: only ${resets}/400 reset opportunities used`);
 assert.ok(resets<400,'Bot accuracy must retain natural misses');
 console.log(`PASS BOT ${level}: ${resets}/400 reset attempts succeeded with unchanged physical scatter`);
}
