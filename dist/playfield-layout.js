// Fit to the actual remaining viewport, after the score strip and input panel.
// No fixed vh board caps: portrait, landscape, folding and old tablet browsers
// all use the same measured space. Only presentation dimensions are changed.
let state=null,queued=false,watching=false;
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
  watching=true;const observer=new ResizeObserver(queue);observer.observe(document.querySelector('main'));observer.observe(document.querySelector('header'));
  window.addEventListener('resize',queue);window.visualViewport?.addEventListener('resize',queue);
  new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class']});
  const boards='.graphic-dartboard,.killer-dartboard,.golf-course,.four-board,.party-controls,.scoring,.sonny-controls,.lives-controls,.visual-player,.lives-player';
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(boards)||n.querySelector(boards)))))queue();}).observe(game,{childList:true,subtree:true});
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
 // Board frames are a real grid/flex cell, not a viewport-relative guess.
 for(const image of game.querySelectorAll('.graphic-dartboard,.killer-dartboard,.golf-course')){
  let frame=image.parentElement;
  if(!frame.classList.contains('stage-board-frame')){const wrap=document.createElement('div');wrap.className='stage-board-frame';image.before(wrap);wrap.append(image);frame=wrap;}
  frame.hidden=!shown(image);
 }
 const match=state.startedAt;
 requestAnimationFrame(()=>{
  if(!state||state.startedAt!==match||!document.body.classList.contains('viewport-game'))return;
  for(const image of game.querySelectorAll('.graphic-dartboard,.killer-dartboard,.golf-course')){
   const frame=image.parentElement;if(!shown(image)||!shown(frame))continue;
   const bounds=frame.getBoundingClientRect(),view=image.viewBox.baseVal,ratio=view.width/view.height;
   const width=Math.floor(Math.min(bounds.width,bounds.height*ratio)),height=Math.floor(width/ratio);
   set(image,'--fitted-width',Math.max(1,width)+'px');set(image,'--fitted-height',Math.max(1,height)+'px');
  }
  for(const frame of game.querySelectorAll('.four-board-frame')){
   const size=Math.floor(Math.min(frame.clientWidth,frame.clientHeight));set(frame,'--four-size',Math.max(1,size)+'px');
  }
  game.dataset.layoutReady=String(state.startedAt);game.dispatchEvent(new Event('playfield-fitted'));
 });
}
