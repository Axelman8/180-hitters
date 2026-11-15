import assert from 'node:assert/strict';
import {newMatch,applyTurn,makeDart} from '../dist/engine.js';
import {botDisplayDarts} from '../dist/bot-runner.js';
const miss=makeDart(0),double=makeDart(20,2);
let solo=newMatch(['BOT 50'],501,'double',1,{game:'tenlives',livesMode:'double',botLevels:[50]});
const commit=(state,dart,hit=false)=>applyTurn(state,{trainingHit:hit,botDart:dart});
const display=(state,pending=[])=>botDisplayDarts(state,pending).map(dart=>dart.label);
assert.deepEqual(display(solo),[]);
assert.deepEqual(display(solo,[miss]),['Mis']);solo=commit(solo,miss);
assert.deepEqual(display(solo),['Mis']);assert.deepEqual(display(solo,[double]),['Mis','D20']);solo=commit(solo,double,true);
assert.equal(solo.players[0].livesTarget,19);assert.deepEqual(display(solo),['Mis','D20']);
assert.deepEqual(display(solo,[miss]),['Mis','D20','Mis']);solo=commit(solo,miss);
assert.deepEqual(display(solo),['Mis','D20','Mis']);assert.deepEqual(display(solo,[miss]),['Mis']);
solo=commit(solo,miss);assert.deepEqual(display(solo),['Mis']);
// A target can exhaust its attempts halfway through a group. The next visit
// starts at dart 1, even if the solo bot remains the active player.
let short=newMatch(['Solo BOT'],501,'double',1,{game:'tenlives',livesMode:'double',botLevels:[50]});
short.players[0].attempts=1;short=commit(short,miss);
assert.ok(short.history.at(-1).ended);assert.deepEqual(display(short),['Mis']);
assert.deepEqual(display(short,[double]),['D20']);
short=commit(short,miss);assert.deepEqual(display(short),['Mis']);
// Two bot seats cannot inherit each other's preceding darts.
let duo=newMatch(['BOT A','BOT B'],501,'double',1,{game:'tenlives',livesMode:'triple',botLevels:[40,50]});
for(let i=0;i<3;i++)duo=commit(duo,miss);
assert.equal(duo.active,1);assert.deepEqual(display(duo),[]);
assert.deepEqual(display(duo,[miss]),['Mis']);duo=commit(duo,miss);
assert.deepEqual(display(duo,[miss]),['Mis','Mis']);
const other=newMatch(['BOT'],501,'double',1,{botLevels:[50]});
assert.deepEqual(display(other,[double,miss]),['D20','Mis']);
console.log('PASS: Hitters BOT slots 1, 2, 3 across per-dart commits, target changes, reload-derived history, new visits and multiple BOT seats');
