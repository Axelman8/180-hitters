import {renderDartSlots} from './dart-editor.js';
import {previewGotcha,previewCricket,previewBobs27} from './engine.js';
import {node,button,playerColors,dartboard} from './graphic-board.js';
let shell=null,scoring=null,home=null,cricketView='both',extraInput=false,lastMatch=null;
export function renderVisualGame(state,hits,actions){
 const enabled=state&&['gotcha','cricket','tactics','bobs27'].includes(state.game);
 document.body.classList.toggle('visual-game',!!enabled);
 if(!enabled){if(shell){shell.hidden=true;if(scoring&&home)home.prepend(scoring);}return;}
 if(!shell){shell=node('section',undefined,'visual-shell');shell.id='visual-game';document.getElementById('game').append(shell);scoring=document.querySelector('.play-grid .scoring');home=scoring.parentNode;}
 shell.hidden=false;shell.dataset.visual=state.game;if(lastMatch!==state.startedAt){lastMatch=state.startedAt;extraInput=false;document.querySelector('main').scrollTop=0;window.scrollTo(0,0);}shell.classList.toggle('graphic-extra-input',extraInput||!!actions.editing);
 const old=shell.querySelector('.visual-display');if(old)old.remove();
 const display=node('div',undefined,'visual-display'),actor=state.active,bobs=state.game==='bobs27',gotcha=state.game==='gotcha',cricket=!bobs&&!gotcha;
 let players=state.players,live=null;
 if(gotcha){live=previewGotcha(state,hits);players=live.players;}
 else if(cricket)players=previewCricket(state,hits).players;
 else{live=previewBobs27(state,hits);players=structuredClone(players);players[actor].remaining=live.score;}
 display.dataset.cricketView=cricketView;
 const heading=node('div',undefined,'visual-heading');heading.append(node('h2',gotcha?'GOTCHA':bobs?"BOB’S 27":state.game.toUpperCase()),node('p',gotcha?`Race naar precies ${state.start}. Kom gelijk met een tegenstander en zet die op nul.`:bobs?`D1 tot en met D20 en Bull · ronde ${state.round}/21`:`Sluit ieder getal met drie marks · ${state.scoring==='cut-throat'?'Cut Throat':state.scoring==='no-score'?'No Score':'Punten'}`));if(cricket){const toggle=button(cricketView==='board'?'Sluitingsbord':'Dartbord',()=>{cricketView=cricketView==='board'?'table':'board';renderVisualGame(state,hits,actions);},'graphic-view-toggle');toggle.setAttribute('aria-pressed',String(cricketView==='board'));heading.append(toggle);}display.append(heading);
 const cards=node('div',undefined,'visual-players');
 players.forEach((player,index)=>{const card=node('article',undefined,'visual-player'+(index===actor?' active':'')+(player.bobsEliminated?' eliminated':''));card.style.setProperty('--player-color',playerColors[index]);card.append(node('strong',player.name),node('b',String(cricket?player.cricketPoints:player.remaining),'visual-score'));
  if(player.members?.length){const names=node('div',undefined,'visual-team-members');player.members.forEach((name,n)=>names.append(node('span',name,index===actor&&n===actions.memberIndex(index)?'current':'')));card.append(names);card.append(node('small',`${player.legs||0} legs`,'visual-legs'));}
  if(gotcha&&index!==actor){const reset=button('Op 0',()=>actions.reset(index),'gotcha-player-reset');reset.dataset.playerIndex=String(index);reset.setAttribute('aria-label',`${player.name} op 0`);reset.disabled=state.phase!=='playing'||!!state.players[actor].bot||player.remaining<=0;card.append(reset);}
  if(bobs)card.append(node('small',player.bobsEliminated?'Afgevallen':index===actor?`${live.hits} raak deze beurt`:'punten'));
  if(cricket)card.append(node('small',`${state.numbers.filter(n=>(player.marks[n]||0)>=3).length}/${state.numbers.length} gesloten`));cards.append(card);
 });display.append(cards);
 const arena=node('section',undefined,'visual-arena');
 if(gotcha){
  cards.querySelectorAll('.visual-player').forEach((card,index)=>{const player=players[index],track=node('div',undefined,'gotcha-track'),runner=node('b',String(player.remaining),'gotcha-runner');runner.style.left=`${Math.max(0,Math.min(100,player.remaining/state.start*100))}%`;track.append(runner);card.append(track);});
  arena.append(node('div',`FINISH ${state.start}`,'gotcha-finish'));
  if(live.resets.length)arena.append(node('p','GOTCHA! '+live.resets.map(i=>players[i].name+' terug naar nul').join(' | '),'gotcha-impact'));
 }else if(bobs){
  arena.append(dartboard({target:state.bobsTarget,doubleOnly:true,centre:state.bobsTarget===25?'BULL':'D'+state.bobsTarget,detail:`${live.hits} RAAK · ${live.delta>=0?'+':''}${live.delta}`}));
  const route=node('div',undefined,'bobs-route');for(const target of [...Array.from({length:20},(_,i)=>i+1),25]){const done=state.history.filter(turn=>turn.target===target&&turn.player===actor||turn.target===target&&turn.name===state.players[actor].name);const cell=node('span',target===25?'B':String(target),target===state.bobsTarget?'current':done.length?(done.some(turn=>turn.hits>0)?'hit':'missed'):'');route.append(cell);}arena.append(route);
 }else{
  arena.append(dartboard({numbers:state.numbers,players,active:actor,hit:actions.hit}));
  const marks=node('div',undefined,'graphic-marks');marks.style.setProperty('--mark-columns',String(players.length+1));
  marks.append(node('b','Doel'));players.forEach((p,i)=>{const name=node('b',p.name);name.style.color=playerColors[i];marks.append(name);});
  state.numbers.forEach(number=>{const target=button(number===25?'BULL':String(number),()=>actions.hit(number),'graphic-mark-target');marks.append(target);players.forEach((p,i)=>{const count=p.marks[number]||0,cell=node('span',count===3?'● ● ●':count===2?'● ● ○':count===1?'● ○ ○':'○ ○ ○');cell.style.color=playerColors[i];cell.setAttribute('aria-label',`${p.name}: ${count} marks op ${number}`);marks.append(cell);});});arena.append(marks);
 }
 display.append(arena);
 if(cricket){
  const compact=node('div',undefined,'graphic-compact-input'),slots=node('div',undefined,'sonny-darts');renderDartSlots(slots,hits,{editing:actions.editing,selected:actions.selectedDart,select:actions.select,placeholder:n=>`Pijl ${n+1}`});compact.append(slots);
  const row=node('div',undefined,'graphic-compact-buttons');for(const [mult,label] of [[1,'Single'],[2,'Dubbel'],[3,'Triple']]){const b=button(label,()=>actions.setMultiplier(mult),mult===actions.multiplier?'selected':'');b.setAttribute('aria-pressed',String(mult===actions.multiplier));row.append(b);}const miss=button('MIS',()=>actions.hit(0));miss.id='graphic-miss';row.append(miss);compact.append(row);
  const more=button(extraInput?'Beurtbediening inklappen':'Beurtbediening / herstellen',()=>{extraInput=!extraInput;renderVisualGame(state,hits,actions);},'graphic-more-input');more.setAttribute('aria-expanded',String(extraInput));compact.append(more);display.append(compact);
 }
 shell.prepend(display);if(scoring.parentNode!==shell)shell.append(scoring);
 let miss=document.getElementById('visual-miss');if(!miss){miss=button('MIS',()=>actions.hit(0),'wide');miss.id='visual-miss';document.getElementById('remove-dart').before(miss);}miss.hidden=!cricket;
}
