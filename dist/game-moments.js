import {seaLog,turnPlayer} from './sea-log.js';
// Presentation events derived from shared game state; never change a score.
export function gameMoments(before,after){
 if(!before||!after||before.game!==after.game||before.startedAt!==after.startedAt||before.players.length!==after.players.length)return [];
 const sea=after.game==='seabattle'?seaLog(after):null;
 const latest=after.history?.at(-1),actor=(after.history?.length>before.history?.length?turnPlayer(after,latest):null)??before.active;
 const attackBy=index=>{
  const turn=[...(after.history||[])].slice(before.history?.length||0).reverse().find(h=>h.resets?.includes(index)||after.game==='killer'&&h.input?.hits?.some(hit=>hit.number===after.players[index].killerNumber)&&turnPlayer(after,h)!==index);
  return turnPlayer(after,turn)??actor;
 };
 const events=[],add=(key,title,detail,kind,priority=1,by=actor)=>events.push({key,title,detail,kind,priority,actor:by});
 after.players.forEach((player,index)=>{
  const prior=before.players[index];if(prior.name!==player.name)return;
  if(after.game==='seabattle'){
   for(const [id,length] of [[1,3],[2,2],[3,2]]){
    const sunk=p=>p.seaFleet?.filter((ship,cell)=>ship===id&&p.seaHull?.[cell]>=2).length>=length;
    if(!sunk(prior)&&sunk(player)){
     const by=sea.sunk[index]?.[id]?.actor??actor;
     add(`ship:${index}:${id}`,'SCHIP GEZONKEN!',`${after.players[by].name} laat het schip van ${player.name} zinken (${length} vakken)`,'ship',2,by);
    }
   }
   player.seaHull?.forEach((damage,cell)=>{
    if(damage<2||prior.seaHull?.[cell]>=2)return;
    const by=sea.cells[index]?.[cell]?.destroyedBy??actor;
    const id=player.seaFleet[cell],length=id===1?3:2;
    const whole=player.seaFleet.filter((ship,i)=>ship===id&&player.seaHull[i]>=2).length>=length;
    if(!whole)add(`cell:${index}:${cell}`,'SCHEEPSVAK VERNIETIGD!',`${after.players[by].name} vernietigt ${cell+1} van ${player.name}`,'ship',1,by);
   });
   if(!prior.seaEliminated&&player.seaEliminated){const by=[...sea.shots].reverse().find(shot=>shot.results.some(r=>r.victim===index&&r.damage>0))?.actor??actor;add(`out:${index}`,'UITGESCHAKELD!',`${after.players[by].name} laat de hele vloot van ${player.name} zinken`,'ship',3,by);}
  }else if(after.game==='killer'){
   const by=attackBy(index),attacker=after.players[by].name;
   if(!prior.killerEliminated&&player.killerEliminated)add(`out:${index}`,'UITGESCHAKELD!',`${attacker} schakelt ${player.name} uit`,'killer',3,by);
   else if(Number.isFinite(prior.killerLives)&&player.killerLives<prior.killerLives){const lost=prior.killerLives-player.killerLives;add(`life:${index}:${player.killerLives}`,'RAAK!',`${attacker} raakt ${player.name}: -${lost} ${lost===1?'leven':'levens'}`,'killer',2,by);}
   if(!prior.killerActivated&&player.killerActivated)add(`killer:${index}`,'KILLER!',`${player.name} kan nu aanvallen`,'killer',1,index);
  }else if(after.game==='gotcha'&&prior.remaining>0&&player.remaining===0){
   const by=attackBy(index);if(index!==by)add(`reset:${index}`,'GOTCHA!',`${after.players[by].name} zet ${player.name} terug naar 0`,'gotcha',2,by);
  }else if(after.game==='bobs27'&&!prior.bobsEliminated&&player.bobsEliminated){
   add(`out:${index}`,'UITGESCHAKELD!',player.name,'out',3);
  }else if(after.game==='tenlives'&&prior.lives>0&&player.lives===0){
   add(`out:${index}`,'UITGESCHAKELD!',`${player.name}: geen levens meer`,'out',3);
  }
 });
 if(after.game==='fourinarow')after.fourOwners.forEach((owner,cell)=>{
  if(owner===null||before.fourOwners[cell]!==null)return;
  const id=after.fourBoard[cell],label=id==='bb'?'BB':id.startsWith('sb')?'sB':id.slice(1);
  add(`claim:${cell}`,'VAK GECLAIMD!',`${after.players[owner].name}: ${label}`,'four',1,owner);
 });
 return events;
}
