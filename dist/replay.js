import {applyTurn,nextLeg} from './engine.js';
// Replay original input only when it still belongs to the same player and leg.
// Keep every unprocessed turn when a correction changes the match flow.
export function replayTurns(initial,turns){
 let state=initial;const undo=[];
 for(let i=0;i<turns.length;i++){
  const item=turns[i];
  let candidate=state;
  if(candidate.phase==='leg'&&item.leg===candidate.leg+1)candidate=nextLeg(candidate);
  let reason='';
  if(!item.input)reason='De oorspronkelijke invoer van deze beurt ontbreekt.';
  else if(candidate.phase!=='playing')reason='De gewijzigde beurt heeft de leg of partij eerder afgesloten.';
  else if(candidate.leg!==item.leg||candidate.active!==item.player)reason='Deze beurt hoort bij een andere speler of leg.';
  if(!reason){
   try{const updated=applyTurn(candidate,item.input);undo.push(candidate);state=updated;continue;}
   catch(error){reason=error.message;}
  }
  return {state,undo,pending:turns.slice(i),reason};
 }
 return {state,undo,pending:[],reason:''};
}
