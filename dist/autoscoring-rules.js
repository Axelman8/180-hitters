import {applyTurn,makeDart,previewTurn,previewCricket,previewGotcha,previewBobs27} from './engine.js';
import {sonnyGameIds,sonnyAutoCommit} from './sonny-games.js';

// Pure adapter: camera events use precisely the same rules as manual darts.
export function applyCameraEvent(match,draft,event){
 const next=structuredClone(match),state=next?.state;
 if(!state)throw Error('Start eerst een partij.');
 if(state.players[state.active]?.bot)throw Error('De BOT gooit; cameradetectie wacht op de volgende speler.');
 let hits=state.game==='fourinarow'?structuredClone(draft?.hits||[]):(draft?.hits||[]).map(d=>makeDart(d.number,d.mult));
 if(event.kind==='removed'){
  if(hits.length)throw Error('Niet alle darts geregistreerd. Vul ontbrekende darts of Mis handmatig in en hervat daarna.');
  return {match:next,hits:[],closed:false};
 }
 if(state.phase!=='playing'||next.future?.length||next.editTurn||next.pendingTurns?.length)throw Error('Camera gepauzeerd. Ga naar de actuele partijstand en hervat.');
 if(draft?.entry)throw Error('Rond de handmatige invoer eerst af.');
 if(hits.length>=3)throw Error('Drie darts staan al klaar. Controleer de beurt.');
 const hit=makeDart(event.hit.number,event.hit.mult);
 let turn,closed=false;
 if(state.game==='tenlives'){
  const p=state.players[state.active];
  turn={trainingHit:hit.number===p.livesTarget&&hit.mult===(p.livesTarget===25?2:state.livesMode==='triple'?3:2)};
 }else if(state.game==='fourinarow'){
  let cell=null,needsBullCorner=false;
  if(hit.number===25&&hit.mult===1){
   const corners=state.fourBoard.map((id,index)=>id.startsWith('sb')?index:-1).filter(index=>index>=0);
   const free=corners.filter(index=>state.fourOwners[index]===null&&!hits.some(dart=>dart.cell===index));
   // An unclaimed corner needs the player's choice. If all corners have
   // already been claimed, a bull still counts as a dart without a new claim.
   const reserved=hits.filter(dart=>dart.needsBullCorner).length;
   if(free.length>reserved)needsBullCorner=true;
   else cell=corners.find(index=>state.fourOwners[index]!==null||hits.some(dart=>dart.cell===index))??corners[0];
  }
  else if(hit.number===25&&hit.mult===2)cell=state.fourBoard.indexOf('bb');
  else if(hit.number!==0)cell=state.fourBoard.indexOf('n'+hit.number);
  if(cell<0&&!needsBullCorner)throw Error('Deze cameraworp hoort niet bij een vak op het speelveld.');
  hits.push({...hit,cell,needsBullCorner,label:needsBullCorner?'Kies sB-hoek':hit.label});
  if(!hits.some(item=>item.needsBullCorner)){let ended=false;try{ended=applyTurn(state,{hits}).phase!=='playing';}catch{}if(hits.length===3||ended){turn={hits};closed=true;}}
 }else if(sonnyGameIds.includes(state.game)){
  hits.push(hit);
  if(sonnyAutoCommit(state,hits)){turn={hits};closed=true;}
 }else{
  hits.push(hit);
  const preview=state.game==='gotcha'?previewGotcha(state,hits):state.game==='bobs27'?previewBobs27(state,hits):['tactics','cricket'].includes(state.game)?previewCricket(state,hits):previewTurn(state,hits);
  if(hits.length===3||preview.bust||preview.finished){turn={hits};closed=true;}
 }
 if(turn){
  const updated=applyTurn(state,turn);
  if(updated.phase==='won'&&!updated.completedAt)updated.completedAt=Date.now();
  if(state.game==='tenlives')closed=updated.turns!==state.turns||updated.phase!=='playing';
  const {history,...packed}=state;
  next.undo=[...(next.undo||[]),{...packed,historyLength:history.length}];
  next.state=updated;next.future=[];next.editTurn=null;next.historyNavigation=false;
  next.modeOverride=null;next.editingPending=false;
  hits=[];
 }
 return {match:next,hits:state.game==='fourinarow'?hits:hits.map(({number,mult})=>({number,mult})),closed};
}
