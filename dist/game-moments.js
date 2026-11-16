// Presentation events derived from shared game state; never change a score.
export function gameMoments(before,after){
 if(!before||!after||before.game!==after.game||before.startedAt!==after.startedAt||before.players.length!==after.players.length)return [];
 const events=[],add=(key,title,detail,kind,priority=1)=>events.push({key,title,detail,kind,priority});
 after.players.forEach((player,index)=>{
  const prior=before.players[index];if(prior.name!==player.name)return;
  if(after.game==='seabattle'){
   for(const [id,length] of [[1,3],[2,2],[3,2]]){
    const sunk=p=>p.seaFleet?.filter((ship,cell)=>ship===id&&p.seaHull?.[cell]>=2).length>=length;
    if(!sunk(prior)&&sunk(player))add(`ship:${index}:${id}`,'SCHIP GEZONKEN!',`${player.name}: schip van ${length} vakken`,'ship',2);
   }
   if(!prior.seaEliminated&&player.seaEliminated)add(`out:${index}`,'UITGESCHAKELD!',`${player.name}: hele vloot gezonken`,'ship',3);
  }else if(after.game==='killer'){
   if(!prior.killerEliminated&&player.killerEliminated)add(`out:${index}`,'UITGESCHAKELD!',player.name,'killer',3);
   else if(Number.isFinite(prior.killerLives)&&player.killerLives<prior.killerLives){const lost=prior.killerLives-player.killerLives;add(`life:${index}:${player.killerLives}`,'RAAK!',`${player.name}: -${lost} ${lost===1?'leven':'levens'}`,'killer',2);}
   if(!prior.killerActivated&&player.killerActivated)add(`killer:${index}`,'KILLER!',`${player.name} kan nu aanvallen`,'killer',1);
  }else if(after.game==='gotcha'&&index!==before.active&&prior.remaining>0&&player.remaining===0){
   add(`reset:${index}`,'GOTCHA!',`${player.name} terug naar 0`,'gotcha',2);
  }else if(after.game==='bobs27'&&!prior.bobsEliminated&&player.bobsEliminated){
   add(`out:${index}`,'UITGESCHAKELD!',player.name,'out',3);
  }else if(after.game==='tenlives'&&prior.lives>0&&player.lives===0){
   add(`out:${index}`,'UITGESCHAKELD!',`${player.name}: geen levens meer`,'out',3);
  }
 });
 if(after.game==='fourinarow')after.fourOwners.forEach((owner,cell)=>{
  if(owner===null||before.fourOwners[cell]!==null)return;
  const id=after.fourBoard[cell],label=id==='bb'?'BB':id.startsWith('sb')?'sB':id.slice(1);
  add(`claim:${cell}`,'VAK GECLAIMD!',`${after.players[owner].name}: ${label}`,'four',1);
 });
 return events;
}
