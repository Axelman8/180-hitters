// Run against an isolated local Wrangler instance, never the production club.
import assert from 'node:assert/strict';
import {newSonnyMatch,applySonnyTurn} from '../../dist/sonny-games.js';
const base=process.env.ONLINE_TEST_BASE||'http://127.0.0.1:8787';
assert.ok(new URL(base).hostname==='127.0.0.1','Use a local test Worker.');
async function request(path,value,status=200){const response=await fetch(base+path,value===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
const hit=number=>({number,mult:1});
for(const count of [2,3,4]){
 let room=await request('/rooms',{name:'Host',match:{state:newSonnyMatch(Array.from({length:count},(_,i)=>'Player '+i),'killer'),undo:[]}},201);
 const code=room.code,keys=[room.key];
 try{
  const lobby=await request('/lobby');assert.equal(lobby.rooms.find(lane=>lane.code===code).game,'killer');
  await request(`/rooms/${code}/join`,{name:'Old client'},409);
  for(let i=1;i<count;i++){room=await request(`/rooms/${code}/join`,{name:'Player '+i,supportedGames:['fourinarow','killer']});keys.push(room.key);}
  room=await request(`/rooms/${code}/starter`,{key:keys[1],starter:count-1});assert.equal(room.match.state.starter,count-1);
  async function play(hits){
   const old=room.match.state,actor=old.active;
   const draft=await request(`/rooms/${code}/draft`,{key:keys[actor],seq:Date.now(),hits});assert.equal(draft.draft.hits.length,hits.length);
   const next=applySonnyTurn(old,{hits});if(next.phase==='won')next.completedAt=Date.now();
   room=await request(`/rooms/${code}/state`,{key:keys[actor],revision:room.revision,match:{state:next,undo:[]}});
   assert.deepEqual(room.match.state,next);assert.equal(room.draft,null);
  }
  // Number selection follows the selected starter, wraps, then returns to them.
  for(let i=0;i<count;i++){const actor=room.match.state.active;assert.equal(actor,(count-1+i)%count);await play([hit(actor+1)]);}
  assert.equal(room.match.state.killerStage,'playing');assert.equal(room.match.state.active,count-1);
  const wrong=structuredClone(room.match);wrong.state.game='fourinarow';
  await request(`/rooms/${code}/state`,{key:keys[count-1],revision:room.revision,match:wrong},400);
  // Build letters, publish darts 1/2/3, then eliminate in a four-seat match.
  for(let i=0;i<count;i++){const actor=room.match.state.active;await play([hit(actor+1),hit(actor+1),hit(actor+1)]);}
  assert.ok(room.match.state.players.every(player=>player.killerLetters===3));
  let visits=0,skipped=false;
  while(room.match.state.phase==='playing'&&visits++<100){
   const state=room.match.state,actor=state.active;
   const target=state.players.findIndex((p,i)=>i!==0&&!p.killerEliminated);
   const darts=actor===0?[hit(target+1),hit(target+1),hit(target+1)]:[hit(0),hit(0),hit(0)];
   await request(`/rooms/${code}/draft`,{key:keys[actor],seq:Date.now(),hits:darts.slice(0,1)});
   await request(`/rooms/${code}/draft`,{key:keys[actor],seq:Date.now()+1,hits:darts.slice(0,2)});
   await play(darts);
   if(room.match.state.phase==='playing'){assert.ok(!room.match.state.players[room.match.state.active].killerEliminated);if(room.match.state.players.some(p=>p.killerEliminated))skipped=true;}
  }
  assert.equal(room.match.state.phase,'won');assert.equal(room.match.state.winner,0);if(count>2)assert.ok(skipped);
  console.log(`PASS: online Killer ${count} players: starter, assignment, live darts, eliminated-player skip and winner`);
 }finally{await request(`/rooms/${code}/close`,{key:keys[0]});}
}
