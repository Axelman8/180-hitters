let effect=null,timer;
export function celebrateScore(previous,next){
 const before=previous?.state?.history,after=next?.state?.history;
 if(!before||!after)return;
 if(after.length<before.length){clearEffect();return;}
 if(after.length<=before.length||JSON.stringify(after.slice(0,before.length))!==JSON.stringify(before))return;
 const turn=after.at(-1);
 if(next.state.game==='tenlives'){if(turn.ended&&turn.score===0)explodeMissedTarget(turn,next.state);return;}
 if(turn.bust||!(turn.score>100)||document.body.classList.contains('remote-control'))return;
 clearEffect();
 const impact=turn.score>=120;
 effect=document.createElement('div');effect.id='score-celebration';
 if(impact){
  effect.classList.add('score-impact');
  void document.body.offsetWidth;
  document.body.classList.add('score-impact-active');
 }
 effect.setAttribute('popover','manual');effect.setAttribute('aria-hidden','true');
 const score=document.createElement('strong');score.textContent=String(turn.score);
 effect.append(score);document.body.append(effect);
 if(effect.showPopover)effect.showPopover();
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
 timer=setTimeout(clearEffect,impact?3100:4400);
}
export function clearEffect(){clearTimeout(timer);effect?.remove();effect=null;document.body.classList.remove('score-impact-active');}

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
