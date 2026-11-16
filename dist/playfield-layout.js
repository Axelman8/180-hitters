// Fit to the actual remaining viewport, after the score strip and input panel.
// No fixed vh board caps: portrait, landscape, folding and old tablet browsers
// all use the same measured space. Only presentation dimensions are changed.
let state=null,queued=false,watching=false,sizeObserver=null;
const frames=new Set();
const shown=e=>e&&!e.hidden&&getComputedStyle(e).display!=='none';
function set(el,key,value){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}
export function fitPlayfield(value){
 state=value;const game=document.getElementById('game');
 const active=!!state&&shown(game)&&document.getElementById('setup')?.hidden;
 document.body.classList.toggle('viewport-game',active);if(!active)return;
 game.dataset.layoutMatch=String(state.startedAt);
 game.dataset.hasHistory=String(!!state.history?.length);
 const kind=state.game==='killer'?'killer':['seabattle','golf','shanghai'].includes(state.game)?'party':['gotcha','cricket','tactics','bobs27'].includes(state.game)?'visual':state.game==='fourinarow'?'four':['scram','bull41','twentyone'].includes(state.game)?'sonny':state.game==='tenlives'?'lives':'x01';
 document.body.dataset.playfield=kind;
 document.body.classList.toggle('stage-input',document.body.classList.contains('remote-control')||!document.body.classList.contains('input-collapsed'));
 document.body.style.setProperty('--player-count',String(state.players.length));
 document.body.style.setProperty('--narrow-player-count',String(Math.min(2,state.players.length)));
 if(!watching){
  watching=true;sizeObserver=new ResizeObserver(queue);sizeObserver.observe(document.querySelector('main'));sizeObserver.observe(document.querySelector('header'));
  window.addEventListener('resize',queue);window.visualViewport?.addEventListener('resize',queue);
  new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class']});
  const boards='.graphic-dartboard,.killer-dartboard,.golf-course,.four-board,.party-controls,.scoring,.sonny-controls,.lives-controls,.visual-player,.lives-player';
  new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'?r.target.matches('#total-input,#dart-input'):[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(boards)||n.querySelector(boards)))))queue();}).observe(game,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  const visibility=new MutationObserver(()=>fitPlayfield(state));visibility.observe(game,{attributes:true,attributeFilter:['hidden']});visibility.observe(document.getElementById('setup'),{attributes:true,attributeFilter:['hidden']});
 }
 queue();
}
function queue(){if(!queued){queued=true;requestAnimationFrame(measure);}}
function measure(){
 queued=false;if(!state||!document.body.classList.contains('viewport-game'))return;
 const main=document.querySelector('main'),game=document.getElementById('game');if(!shown(game))return;
 document.body.classList.toggle('stage-input',document.body.classList.contains('remote-control')||!document.body.classList.contains('input-collapsed'));
 set(document.body,'--viewport-height',Math.round(window.visualViewport?.height||innerHeight)+'px');
 const style=getComputedStyle(main),height=Math.floor(main.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom));
 set(game,'--play-height',Math.max(200,height)+'px');
 const scoring=game.querySelector('.scoring');
 if(scoring)scoring.dataset.entryMode=document.getElementById('total-input').hidden?'dart':'total';
 // Board frames are a real grid/flex cell, not a viewport-relative guess.
 for(const image of game.querySelectorAll('.graphic-dartboard,.killer-dartboard,.golf-course')){
  let frame=image.parentElement;
  if(!frame.classList.contains('stage-board-frame')){const wrap=document.createElement('div');wrap.className='stage-board-frame';image.before(wrap);wrap.append(image);frame=wrap;}
  frame.hidden=!shown(image);
 }
 // A camera/BOT banner or expanded controls can resize the board cell without
 // resizing the window. Watch those cells too, releasing replaced render nodes.
 for(const frame of frames)if(!game.contains(frame)){sizeObserver.unobserve?.(frame);frames.delete(frame);}
 for(const frame of game.querySelectorAll('.stage-board-frame,.four-board-frame,.killer-arena,.party-arena,.visual-arena,.four-layout'))if(!frames.has(frame)){frames.add(frame);sizeObserver.observe(frame);}
 const match=state.startedAt;
 requestAnimationFrame(()=>{
  if(!state||state.startedAt!==match||!document.body.classList.contains('viewport-game'))return;
  for(const image of game.querySelectorAll('.graphic-dartboard,.killer-dartboard,.golf-course')){
   const frame=image.parentElement;if(!shown(image)||!shown(frame))continue;
   const parent=frame.parentElement,layout=getComputedStyle(parent),view=image.viewBox.baseVal,ratio=view.width/view.height;
   const column=layout.display==='flex'&&layout.flexDirection==='column';
   if(!column){frame.style.removeProperty('height');frame.style.removeProperty('flex');}
   const bounds=frame.getBoundingClientRect();
   // Fit against the arena, then keep the board and its caption together at
   // the top. A tall portrait display must not add a blank gap above the board.
   const siblings=column?[...parent.children].filter(el=>el!==frame&&shown(el)):[];
   const available=column?parent.clientHeight-parseFloat(layout.paddingTop)-parseFloat(layout.paddingBottom)-siblings.reduce((sum,el)=>sum+el.getBoundingClientRect().height,0)-(parseFloat(layout.rowGap)||0)*siblings.length:bounds.height;
   const width=Math.floor(Math.min(bounds.width,Math.max(1,available)*ratio)),height=Math.floor(width/ratio);
   set(image,'--fitted-width',Math.max(1,width)+'px');set(image,'--fitted-height',Math.max(1,height)+'px');
   if(column){set(frame,'height',Math.max(1,height)+'px');set(frame,'flex','0 0 auto');}
  }
  for(const frame of game.querySelectorAll('.four-board-frame')){
   const size=Math.floor(Math.min(frame.clientWidth,frame.clientHeight));set(frame,'--four-size',Math.max(1,size)+'px');
  }
  game.dataset.layoutReady=String(state.startedAt);game.dispatchEvent(new Event('playfield-fitted'));
 });
}
