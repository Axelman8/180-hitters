import assert from 'node:assert/strict';
import {newSonnyMatch,applySonnyTurn,sonnyAutoCommit} from '../../dist/sonny-games.js';
const base='http://127.0.0.1:8787';
async function request(path,value,status=200){const res=await fetch(base+path,value===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;}
const d=(number,mult=1)=>({number,mult});
for(const game of ['golf','shanghai','seabattle'])for(const count of [2,3,4]){
 let room=await request('/rooms',{name:'A',public:false,match:{state:newSonnyMatch(Array.from({length:count},(_,i)=>'P'+i),game),undo:[]}},201);
 const code=room.code,keys=[room.key];
 try{
  await request(`/rooms/${code}`,undefined,404);
  for(let i=1;i<count;i++){const joined=await request(`/rooms/${code}/join`,{name:'P'+i,supportedGames:[game]});keys.push(joined.key);}
  room=await request(`/rooms/${code}/starter`,{key:keys[0],starter:count-1});
  let visit=0;
  while(room.match.state.phase==='playing'&&visit++<200){
   const role=room.match.state.active;room=await request(`/rooms/${code}?key=${keys[role]}`);
   const old=room.match.state;
   if(game==='seabattle')for(const [i,p] of old.players.entries())if(i!==role){for(let c=0;c<20;c++)if(!p.seaShots[c])assert.equal(p.seaFleet[c],null);}
   const hits=[];
   for(let slot=0;slot<3;slot++){
    let hit=game==='golf'?d(old.partyTarget,role===0?2:1):game==='shanghai'?d(old.partyTarget,[1,3,2][slot]):d(((visit-1)*3+slot)%20+1,2);
    if(game==='seabattle'){
     const revealed=await request(`/rooms/${code}/reveal`,{key:keys[role],turns:old.turns,slot,number:hit.number});hit={...hit,seaShips:revealed.seaShips};
     const wrongRole=(role+1)%count;await request(`/rooms/${code}/reveal`,{key:keys[wrongRole],turns:old.turns,slot,number:hit.number},403);
    }
    hits.push(hit);await request(`/rooms/${code}/draft`,{key:keys[role],seq:Date.now()+slot,hits});
    if(sonnyAutoCommit(old,hits))break;
   }
   const next=applySonnyTurn(old,{hits});if(next.phase==='won')next.completedAt=Date.now();
   room=await request(`/rooms/${code}/state`,{key:keys[role],revision:room.revision,match:{state:next,undo:[]}});
   assert.equal(room.match.state.turns,next.turns);assert.equal(room.draft,null);
   for(let viewer=0;viewer<count;viewer++){
    const observed=await request(`/rooms/${code}?key=${keys[viewer]}`);assert.equal(observed.match.state.active,next.active);assert.equal(observed.match.state.phase,next.phase);
   }
  }
  assert.equal(room.match.state.phase,'won',game+' did not finish');if(game==='golf')assert.equal(room.match.state.winner,0);
  console.log(`PASS: ${game}, ${count} online players: starter, per-dart state, complete game, winner${game==='seabattle'?', private fleets and shot authorization':''}`);
 }finally{await request(`/rooms/${code}/close`,{key:keys[0]});}
}
