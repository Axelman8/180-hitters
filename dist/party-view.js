import {renderDartSlots} from './dart-editor.js';
import {partyNames,previewParty,partyAutoCommit,seaSunk} from './party-rules.js';
import {seaLog,seaShotText} from './sea-log.js';
import {node,button,svg,playerColors,dartboard} from './graphic-board.js';
let boardPlayer=0,boardMatch=null,boardFollow=true,scrollMatch=null;
export function renderPartyGame(root,state,hits,actions){
 if(scrollMatch!==state.startedAt){scrollMatch=state.startedAt;document.querySelector('main').scrollTop=0;window.scrollTo(0,0);}
 root.replaceChildren();root.className='party-game';root.dataset.party=state.game;
 const actor=state.active,preview=previewParty(state,hits),sea=state.game==='seabattle',golf=state.game==='golf',p=state.players[actor];
 const heading=node('div',undefined,'party-heading');heading.append(node('h2',partyNames[state.game]),node('p',sea?'Raak getallen om de vloten van alle tegenstanders te beschadigen.':golf?`Hole ${state.partyTarget}/${state.golfHoles} · ${state.golfScoring==='last'?'Laatste pijl telt; je mag eerder stoppen':'Beste van drie pijlen telt'}`:`Ronde ${state.partyTarget}/${state.shanghaiRounds} · Single + dubbel + triple wint direct`));root.append(heading);
 const cards=node('div',undefined,'party-players');
 preview.players.forEach((player,index)=>{const card=node('article',undefined,'party-player'+(index===actor?' active':'')+(player.seaEliminated?' eliminated':''));card.style.setProperty('--player-color',playerColors[index]);const score=sea?player.seaRemaining:golf?player.golfStrokes:player.shanghaiPoints;card.append(node('strong',player.name),node('b',String(score)),node('small',sea?'scheepslevens':golf?'slagen':'punten'));cards.append(card);});root.append(cards);
 const arena=node('section',undefined,'party-arena');arena.setAttribute('aria-label',partyNames[state.game]+' speelveld');
 if(sea){
  const log=seaLog(state,hits),last=log.last;
  if(boardMatch!==state.startedAt){boardMatch=state.startedAt;boardFollow=true;}
  if(boardFollow){
   const latest=[...log.shots].reverse().find(shot=>shot.results.length),by=latest?.actor??actor;
   const targets=latest?.results||[];
   const best=[...targets].sort((a,b)=>Number(b.sunk)-Number(a.sunk)||Number(b.destroyed)-Number(a.destroyed)||b.damage-a.damage)[0];
   boardPlayer=best?.victim??(by+1)%state.players.length;
  }
  if(!preview.players[boardPlayer])boardPlayer=0;
  const chooser=node('div',undefined,'sea-fleet-tabs');state.players.forEach((player,index)=>{
   const tab=button('Vloot '+player.name,()=>{boardPlayer=index;boardFollow=false;actions.refresh?actions.refresh():renderPartyGame(root,state,hits,actions);},index===boardPlayer?'selected':'');
   tab.setAttribute('aria-pressed',String(index===boardPlayer));chooser.append(tab);
  });
  const follow=button(boardFollow?'Aanval volgen':'Volg de aanval',()=>{boardFollow=true;actions.refresh?actions.refresh():renderPartyGame(root,state,hits,actions);},boardFollow?'selected sea-follow':'sea-follow');
  follow.setAttribute('aria-pressed',String(boardFollow));chooser.append(follow);arena.append(chooser);
  const action=node('p',seaShotText(state,last),'sea-last-action');action.setAttribute('role','status');arena.append(action);
  const victim=preview.players[boardPlayer],grid=node('div',undefined,'sea-grid');grid.dataset.fleetPlayer=String(boardPlayer);grid.setAttribute('aria-label',`Vloot van ${victim.name}. Iedere pijl raakt alle tegenstanders op dit getal.`);
  victim.seaFleet.forEach((ship,cell)=>{
   const known=victim.seaShots[cell]>0||state.phase==='won',damaged=victim.seaHull[cell]||0,credit=log.cells[boardPlayer][cell];
   const whole=known&&ship&&victim.seaFleet.filter((id,i)=>id===ship&&victim.seaHull[i]>=2).length>=(ship===1?3:2);
   const cls=!known?'unknown':ship?(damaged===2?'sunk':'damaged'):'water';
   const status=!known?'ONBEKEND':ship?whole?'GEZONKEN':damaged===2?'VERNIETIGD':damaged?'RAAK':'ONGERAAKT':'WATER';
   const lastHit=last?.number===cell+1&&last.results.some(r=>r.victim===boardPlayer);
   const tile=button('',()=>actions.hit(cell+1),'sea-cell '+cls+(whole?' ship-sunk':'')+(hits.some(h=>h.number===cell+1)?' fired':'')+(lastHit?' last-hit':''));
   tile.disabled=state.phase!=='playing'||!actions.editing&&hits.length>=3;tile.dataset.number=String(cell+1);
   const by=whole?credit.sunkBy:damaged===2?credit.destroyedBy:credit.hitBy;
   const attribution=known&&ship&&Number.isInteger(by)?'Door '+state.players[by].name:'';
   tile.setAttribute('aria-label',`${cell+1}: ${status}. ${attribution}`);tile.title=tile.getAttribute('aria-label');
   tile.append(node('b',String(cell+1)),node('span',status,'sea-cell-status'));
   if(attribution)tile.append(node('small',attribution,'sea-cell-credit'));
   if(known&&ship){const boat=svg('svg',{viewBox:'0 0 24 16',class:'sea-ship','aria-hidden':'true'});boat.append(svg('path',{d:'M1 7h22l-6 8H6zM8 1h8v5H8z',fill:damaged===2?'#fa8299':'#ffcd73'}));tile.append(boat);}grid.append(tile);
  });arena.append(grid,node('p',`Vloot van ${victim.name} | ${victim.seaRemaining}/14 levens | ${seaSunk(victim)}/3 schepen gezonken. Single 1 schade, dubbel/triple 2. Bull doet geen schade.`,'party-caption'));
 }else if(golf){
  const rows=Math.ceil(state.golfHoles/3),course=svg('svg',{viewBox:`0 0 460 ${rows*88+30}`,class:'golf-course',role:'img','aria-label':`Golfbaan, hole ${state.partyTarget} van ${state.golfHoles}`});
  course.append(svg('rect',{x:0,y:0,width:460,height:rows*88+30,rx:22,fill:'#16372e'}));
  const points=Array.from({length:state.golfHoles},(_,i)=>[80+(Math.floor(i/3)%2?2-i%3:i%3)*150,60+Math.floor(i/3)*88]);
  course.append(svg('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#4f8262','stroke-width':28,'stroke-linecap':'round','stroke-linejoin':'round'}));
  for(const [index,[x,y]] of points.entries()){const current=index+1===state.partyTarget;course.append(svg('ellipse',{cx:x,cy:y,rx:42,ry:28,fill:current?'#91bb5f':'#3b674d'}),svg('line',{x1:x,y1:y-22,x2:x,y2:y+9,stroke:'#e5edd7','stroke-width':2}),svg('path',{d:`M${x} ${y-22} l25 9 -25 7z`,fill:current?'#ffcb6b':'#becfa5'}),svg('text',{x:x-18,y:y+8,'font-size':18,'font-weight':850,fill:'#0f211b','text-anchor':'middle'},String(index+1)));}
  state.players.forEach((player,index)=>{const pos=points[Math.min(points.length-1,player.golfScores.length)],x=pos[0]-28+index*17,y=pos[1]+21;course.append(svg('circle',{cx:x,cy:y,r:index===actor?8:6,fill:playerColors[index],stroke:'#10261e','stroke-width':2}));});arena.append(course,node('p',`${p.name} richt op ${state.partyTarget}. Dubbel = 1 slag · triple = 2 · single = 3 · mis = 5.`,'party-caption'));
 }else{
  arena.append(dartboard({target:state.partyTarget,centre:String(state.partyTarget),detail:'DOEL VAN DE RONDE'}));
  const combo=node('div',undefined,'shanghai-combo');for(const [mult,label] of [[1,'SINGLE'],[2,'DUBBEL'],[3,'TRIPLE']])combo.append(node('span',label,hits.some(h=>h.number===state.partyTarget&&h.mult===mult)?'lit':''));arena.append(combo);
 }root.append(arena);
 const controls=node('aside',undefined,'party-controls sonny-controls');controls.append(node('strong',`${p.name} gooit`));
 const darts=node('div',undefined,'sonny-darts');renderDartSlots(darts,hits,{editing:actions.editing,selected:actions.selectedDart,select:actions.select,placeholder:index=>`Pijl ${index+1}`});controls.append(darts);
 const multipliers=node('div',undefined,'sonny-multipliers');
 for(const [mult,label] of [[1,golf?'Single · 3':'Single'],[2,golf?'Dubbel · 1':'Dubbel'],[3,golf?'Triple · 2':'Triple']]){const b=button(label,()=>{actions.setMultiplier(mult);if(!sea)actions.hit(state.partyTarget);},sea&&actions.multiplier===mult?'selected':'');b.disabled=state.phase!=='playing'||!actions.editing&&hits.length>=3;b.setAttribute('aria-pressed',String(sea&&actions.multiplier===mult));multipliers.append(b);}controls.append(multipliers);
 const row=node('div',undefined,'sonny-actions');const miss=button(golf?'MIS · 5':'MIS',actions.miss),remove=button('Wissen',actions.remove),confirm=button(golf&&state.golfScoring==='last'?'Hole afronden':'Bevestigen',actions.confirm,'primary');miss.disabled=state.phase!=='playing'||!actions.editing&&hits.length>=3;remove.disabled=!hits.length;confirm.disabled=!partyAutoCommit(state,hits)&&!(golf&&state.golfScoring==='last'&&hits.length);row.append(miss,remove,confirm);controls.append(row);
 controls.append(node('p',sea?'De gekozen vloot bepaalt alleen wat je bekijkt. Je valt altijd alle tegenstanders aan.':golf?'Bij laatste pijl kun je na iedere pijl de hole afronden. Anders telt na drie pijlen automatisch je resultaat.':'Raak alle drie de soorten op het doelgetal in dezelfde beurt. Alleen dit rondegetal levert punten op.','party-input-help'));root.append(controls);
}
