import {applyTurn,makeDart,previewTurn,previewCricket,previewGotcha,previewBobs27} from './engine.js';

// Pure adapter: camera events use precisely the same rules as manual darts.
export function applyCameraEvent(match,draft,event){
 const next=structuredClone(match),state=next?.state;
 if(!state)throw Error('Start eerst een partij.');
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
  if(hits.some(item=>item.needsBullCorner))throw Error('Kies eerst op telefoon of tablet welk sB-hoekvak is geraakt.');
  const hit=makeDart(event.hit.number,event.hit.mult);let cell=null,needsBullCorner=false;
  if(hit.number===25&&hit.mult===1)needsBullCorner=true;
  else if(hit.number===25&&hit.mult===2)cell=state.fourBoard.indexOf('bb');
  else cell=state.fourBoard.indexOf('n'+hit.number);
  if(cell<0&&!needsBullCorner)throw Error('Deze cameraworp hoort niet bij een vak op het speelveld.');
  hits.push({...hit,cell,needsBullCorner,label:needsBullCorner?'Kies sB-hoek':hit.label});
  if(!needsBullCorner){let ended=false;try{ended=applyTurn(state,{hits}).phase!=='playing';}catch{}if(hits.length===3||ended){turn={hits};closed=true;}}
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
