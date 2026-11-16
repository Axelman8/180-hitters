// Reconstruct visible shot credits from saved turns, including older matches.
// Unknown online fleet cells remain unknown; never reveal an unplayed cell.
export function turnPlayer(state,turn){
 if(Number.isInteger(turn?.player)&&state.players[turn.player])return turn.player;
 const matches=state.players.flatMap((p,i)=>p.name===turn?.name?[i]:[]);
 return matches.length===1?matches[0]:null;
}
export function seaLog(state,hits=[]){
 const cells=state.players.map(()=>Array.from({length:20},()=>({}))),sunk=state.players.map(()=>({})),shots=[];
 const hull=state.players.map(()=>Array(20).fill(0));
 const visits=(state.history||[]).map((turn,visit)=>({actor:turnPlayer(state,turn),hits:turn.input?.hits||[],visit}));
 if(hits.length)visits.push({actor:state.active,hits,visit:state.history?.length||0});
 for(const turn of visits){
  if(turn.actor===null)continue;
  for(const [dart,hit] of turn.hits.entries()){
   const shot={actor:turn.actor,number:hit.number,label:hit.label||(hit.number===0?'Mis':hit.number===25?(hit.mult===2?'BB':'sB'):(hit.mult===2?'D':hit.mult===3?'T':'')+hit.number),visit:turn.visit,dart,results:[]};
   if(hit.number>=1&&hit.number<=20){
    const cell=hit.number-1;
    state.players.forEach((p,victim)=>{
     if(victim===turn.actor)return;
     const ship=p.seaFleet[cell];if(ship===null||ship===undefined)return;
     const damage=ship?Math.max(0,Math.min(2-hull[victim][cell],hit.mult)):0;
     const result={victim,damage,ship,destroyed:damage>0&&hull[victim][cell]+damage===2,sunk:false};
     hull[victim][cell]+=damage;cells[victim][cell].lastShot=shot;
     if(damage)cells[victim][cell].hitBy=turn.actor;
     if(result.destroyed)cells[victim][cell].destroyedBy=turn.actor;
     if(ship&&!sunk[victim][ship]){
      const parts=p.seaFleet.flatMap((id,i)=>id===ship?[i]:[]),length=ship===1?3:2;
      if(parts.length===length&&parts.every(i=>hull[victim][i]>=2)){
       result.sunk=true;sunk[victim][ship]=shot;parts.forEach(i=>cells[victim][i].sunkBy=turn.actor);
      }
     }
     shot.results.push(result);
    });
   }
   shots.push(shot);
  }
 }
 return {cells,sunk,shots,last:shots.at(-1)};
}
export function seaShotText(state,shot){
 if(!shot)return 'De eerste pijl moet nog worden gegooid.';
 const outcomes=shot.results.map(r=>`${state.players[r.victim].name}: ${r.sunk?'schip gezonken':r.destroyed?'vak vernietigd':r.damage?'raak':r.ship?'al vernietigd':'water'}`);
 return `${state.players[shot.actor].name} · ${shot.label}${outcomes.length?' → '+outcomes.join(' / '):''}`;
}
