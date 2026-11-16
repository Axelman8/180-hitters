import {gameMoments} from './game-moments.js';
let effect=null,timer,scope=null;
const queue=[];
const seen=new Set();
function moments(before,after){
 const match=String(before?.startedAt)+':'+before?.game;
 if(scope!==match){scope=match;seen.clear();}
 const events=gameMoments(before,after),fresh=events.filter(event=>!seen.has(`${before.history?.length||0}:${event.key}`));
 if(!fresh.length)return events.length>0;
 for(const event of fresh)seen.add(`${before.history?.length||0}:${event.key}`);
 if(seen.size>180){const keep=[...seen].slice(-90);seen.clear();keep.forEach(key=>seen.add(key));}
 const primary=[...fresh].sort((a,b)=>b.priority-a.priority)[0];
 const moment={...primary,detail:[...new Set(fresh.map(event=>event.detail))].join(' / ')};
 if(effect)queue.push(moment);else showCelebration(moment.title,true,moment);
 return true;
}
export function celebrateDraft(state,hits,apply){
 if(!state||state.phase!=='playing'||!hits.length||!['seabattle','killer','gotcha','fourinarow'].includes(state.game)||hits.some(hit=>hit.needsBullCorner))return;
 try{
  const miss=state.game==='fourinarow'?{cell:null,mult:1}:{number:0,mult:1};
  const padded=[...hits,...Array.from({length:Math.max(0,3-hits.length)},()=>({...miss}))];
  moments(state,apply(state,{hits:padded}));
 }catch{}
}
export function celebrateScore(previous,next){
 if(previous?.state?.startedAt!==next?.state?.startedAt||previous?.state?.game!==next?.state?.game){clearEffect();return;}
 if(next?.historyNavigation||previous?.historyNavigation||next?.editTurn||previous?.editTurn){clearEffect();return;}
 const before=previous?.state?.history,after=next?.state?.history;
 if(!before||!after)return;
 if(after.length<before.length){clearEffect();return;}
 if(JSON.stringify(after.slice(0,before.length))!==JSON.stringify(before))return;
 if(moments(previous.state,next.state))return;
 if(after.length<=before.length)return;
 const turn=after.at(-1);
 if(next.state.game==='tenlives'){if(turn.ended&&turn.score===0)explodeMissedTarget(turn,next.state);return;}
 if(turn.bust||!(turn.score>100)||document.body.classList.contains('remote-control'))return;
 showCelebration(String(turn.score),turn.score>=120,null,turn.name);
}
function symbol(kind){
 const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg');
 icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('class','moment-symbol');icon.setAttribute('aria-hidden','true');
 const paths=kind==='ship'?['M6 34H58L49 48H17Z','M31 8V34M28 12L12 29H28M35 12L51 29H35','M4 55Q11 49 18 55T32 55T46 55T60 55']:kind==='killer'?['M15 33a20 20 0 1 1 34 0v10l-9 4v9H24v-9l-9-4Z','M22 29h5M37 29h5M30 40h4M28 50v6M36 50v6']:kind==='four'?['M9 9H55V55H9ZM24 9V55M40 9V55M9 24H55M9 40H55','M14 14L50 50']:kind==='gotcha'?['M13 18A24 24 0 1 1 8 34M13 6V18H25','M25 27a7 7 0 1 1 14 0v10a7 7 0 1 1-14 0Z']:['M32 7a25 25 0 1 1-.1 0ZM15 15L49 49'];
 for(const d of paths){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);icon.append(path);}return icon;
}
function showCelebration(text,impact,moment=null,caption=''){
 removeEffect();
 effect=document.createElement('div');effect.id='score-celebration';
 if(moment){effect.classList.add('game-moment');effect.dataset.moment=moment.kind;effect.append(symbol(moment.kind));}
 if(impact){
  effect.classList.add('score-impact');
  void document.body.offsetWidth;
  document.body.classList.add('score-impact-active');
 }
 effect.setAttribute('popover','manual');effect.setAttribute('aria-hidden','true');
 const score=document.createElement('strong');score.textContent=text;
 effect.append(score);document.body.append(effect);
 if(moment||caption){const detail=document.createElement('span');detail.className=moment?'moment-detail':'score-actor';detail.textContent=moment?.detail||caption;effect.append(detail);}
 if(effect.showPopover){effect.showPopover();const current=effect;requestAnimationFrame(()=>{if(current===effect){current.hidePopover();current.showPopover();}});}
 if(impact&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
  const fragments=document.createElement('div');fragments.className='score-fragments';
  Object.assign(fragments.style,{left:score.offsetLeft+'px',top:score.offsetTop+'px',width:score.offsetWidth+'px',height:score.offsetHeight+'px'});
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){
   const piece=score.cloneNode(true);piece.className='score-piece';
   piece.style.clipPath=`inset(${row*25}% ${100-(col+1)*100/6}% ${100-(row+1)*25}% ${col*100/6}%)`;
   piece.style.setProperty('--burst-x',`${(col-2.5)*105}px`);
   piece.style.setProperty('--burst-y',`${(row-1.5)*135}px`);
   piece.style.setProperty('--burst-spin',`${(col-2.5)*(row%2?18:-18)}deg`);
   fragments.append(piece);
  }
  effect.append(fragments);
 }
 timer=setTimeout(()=>{removeEffect();const next=queue.shift();if(next)showCelebration(next.title,true,next);},impact?3100:4400);
}
function removeEffect(){clearTimeout(timer);effect?.remove();effect=null;document.body.classList.remove('score-impact-active');}
export function clearEffect(){queue.length=0;seen.clear();scope=null;removeEffect();}

function explodeMissedTarget(turn,state){
 clearEffect();
 effect=document.createElement('div');effect.id='lives-fail-effect';
 effect.setAttribute('popover','manual');effect.setAttribute('aria-hidden','true');
 const burst=document.createElement('div');burst.className='lives-fail-burst';
 const ring=document.createElement('i');ring.className='lives-fail-wave';burst.append(ring);
 for(let i=0;i<12;i++){
  const spark=document.createElement('i');spark.className='lives-fail-spark';
  const angle=i*Math.PI/6;
  spark.style.setProperty('--spark-x',`${Math.cos(angle)*180}px`);
  spark.style.setProperty('--spark-y',`${Math.sin(angle)*180}px`);
  spark.style.setProperty('--spark-turn',`${i*30}deg`);burst.append(spark);
 }
 const title=document.createElement('strong');title.textContent='Doel gemist';
 const detail=document.createElement('span');
 detail.textContent=turn.target===20?'-1 leven':`Terug naar ${turn.nextTarget===25?'Bull':(state.livesMode==='triple'?'T':'D')+turn.nextTarget}`;
 burst.append(title,detail);effect.append(burst);document.body.append(effect);
 if(effect.showPopover)effect.showPopover();
 timer=setTimeout(clearEffect,2000);
}
