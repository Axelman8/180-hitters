import {turnPlayer} from './sea-log.js';
import {placeBotStatus} from './bot-runner.js';
const dartLabel=d=>d.label||(d.cell!==undefined?'':d.number===0?'Mis':d.number===25?(d.mult===2?'BB':'sB'):(d.mult===2?'D':d.mult===3?'T':'')+d.number);
export function turnFeedback(state,turn){
 if(!turn)return '';
 const darts=turn.labels||turn.input?.hits?.map(dartLabel).filter(Boolean).join(' / ')||'';
 let result=turn.bust?'BUST':state.game==='seabattle'?`${turn.score||0} schade`:state.game==='golf'?`${turn.score} slagen`:state.game==='fourinarow'?`${turn.captured?.length||0} vakken`:state.game==='killer'?turn.role==='nummer kiezen'?'getal gekozen':'':state.game==='tenlives'?turn.score?'RAAK':'MIS':state.game==='twentyone'?'':state.game==='bull41'&&turn.role==='bull'?`${turn.marks||0} bull-marks`:['cricket','tactics'].includes(state.game)?`${turn.marks||0} marks · ${turn.score||0} punten`:`${turn.score>0&&state.game==='bobs27'?'+':''}${turn.score||0} punten`;
 if(turn.resets?.length)result+=' · '+turn.resets.map(i=>state.players[i]?.name+' op 0').join(', ');
 return [darts,result].filter(Boolean).join(' · ');
}
// A compact, persistent result belongs to the player's own card. Effects may
// disappear, but the attribution and last visit remain available afterwards.
export function paintGameFeedback(state,hits=[]){
 if(!state?.players)return;
 const selectors=['#players>.player','.visual-players>.visual-player','.party-players>.party-player','.killer-players>.killer-player','.four-legend>article','.sonny-players>article','.lives-players>.lives-player'];
 for(const selector of selectors)document.querySelectorAll(selector).forEach((card,index)=>{
  // A new match can have fewer players while the previous game's hidden
  // cards are still present until the full render finishes.
  if(!state.players[index])return;
  let note=card.querySelector('.game-player-action');
  const last=[...(state.history||[])].reverse().find(turn=>turnPlayer(state,turn)===index);
  const live=index===state.active&&state.phase==='playing'&&hits.length;
  const text=live?hits.map(dartLabel).filter(Boolean).join(' / '):last?turnFeedback(state,last):'';
  if(!note){note=document.createElement('small');note.className='game-player-action';card.append(note);}
  note.textContent=text?`${live?'Deze beurt':'Laatste'}: ${text}`:'\u00a0';note.title=text?note.textContent:'';
  note.setAttribute('aria-hidden',String(!text));
  if(text)note.setAttribute('aria-label',`${state.players[index].name}. ${note.textContent}`);else note.removeAttribute('aria-label');
  let botSlot=card.querySelector('.game-bot-slot');
  if(state.players[index].bot){if(!botSlot){botSlot=document.createElement('div');botSlot.className='game-bot-slot';card.append(botSlot);}}
  else botSlot?.remove();
 });
 placeBotStatus(state);
}
