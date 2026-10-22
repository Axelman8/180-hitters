import {clearEffect} from './celebration.js';
import {renderMatchSummary} from './match-summary.js';

const dialog=document.getElementById('result-dialog');
function clearWinner(){
 dialog.classList.remove('winner-party');
 dialog.querySelector('#match-summary')?.remove();
 dialog.querySelector('.eyebrow').textContent='LEKKER GESPEELD';
 dialog.querySelector('.winner-decoration')?.remove();
}
dialog.addEventListener('close',()=>{if(!dialog.open)clearWinner();});
export function showWinner(state){
 if(state.phase!=='won'||state.winner===null||state.training121||['bobs27','tenlives'].includes(state.game)){clearWinner();return;}
 clearEffect();
 renderMatchSummary(state,dialog);
 if(dialog.classList.contains('winner-party'))return;
 dialog.classList.add('winner-party');
 dialog.querySelector('.eyebrow').textContent='Game shot and the match:';
 const decoration=document.createElement('div');
 decoration.className='winner-decoration';
 decoration.setAttribute('aria-hidden','true');
 for(let burst=0;burst<3;burst++){
  const fireworks=document.createElement('div');fireworks.className='winner-fireworks';
  fireworks.style.left=[18,82,50][burst]+'%';
  fireworks.style.top=[40,48,60][burst]+'%';
  fireworks.style.setProperty('--burst-delay',`${burst*1.6}s`);
  for(let ray=0;ray<12;ray++){
   const spark=document.createElement('b');
   spark.style.setProperty('--angle',`${ray*30}deg`);
   fireworks.append(spark);
  }
  decoration.append(fireworks);
 }
 const colors=['#ffd700','#83d9ef','#ff7cba','#cafa63','#fff0a4'];
 for(let i=0;i<48;i++){
  const flake=document.createElement('i');
  flake.style.setProperty('--left',`${(i*37)%100}%`);
  flake.style.setProperty('--delay',`${-(i%13)*.6}s`);
  flake.style.setProperty('--duration',`${5+(i%5)}s`);
  flake.style.setProperty('--drift',`${(i%2?1:-1)*(30+i%50)}px`);
  flake.style.background=colors[i%colors.length];
  decoration.append(flake);
 }
 dialog.prepend(decoration);
}
