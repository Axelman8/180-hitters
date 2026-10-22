const $=id=>document.getElementById(id);
let row,history,shortcut,lastView;
matchMedia('(max-width:600px)').addEventListener('change',()=>queueMicrotask(()=>{if(lastView)renderScreenOverview(...lastView);}));
export function renderScreenOverview(state,mode,entry,darts){
 if(!state)return;
 lastView=[state,mode,entry,darts];
 const remote=document.body.classList.contains('remote-control');
 const cricket=['cricket','tactics'].includes(state.game);
 if(!row){
  row=document.createElement('div');row.id='screen-overview';
  row.innerHTML='<section class="panel screen-visit"><p class="eyebrow">DEZE BEURT</p><strong id="screen-visit-score">0</strong><div id="screen-visit-darts"></div></section>';
  document.querySelector('.play-grid').before(row);
  history=document.createElement('section');history.id='screen-player-history';history.className='panel';
  document.querySelector('.play-grid').after(history);
  shortcut=document.createElement('button');shortcut.id='screen-input-shortcut';shortcut.textContent='Scherminvoer uitklappen';
  shortcut.onclick=()=>$('toggle-input').click();
  document.querySelector('header .top-actions').append(shortcut);
 }
 const finish=$('finish-panel');
 if(!remote&&!cricket)row.append(finish);
 else document.querySelector('.play-grid > aside').prepend(finish);
 row.hidden=remote||cricket;
 $('screen-visit-score').textContent=mode==='total'?entry||'0':darts.reduce((sum,d)=>sum+d.number*d.mult,0);
 $('screen-visit-darts').textContent=mode==='dart'?darts.map(d=>d.label).join('   ·   '):'';
 const columns=state.players.map(player=>({name:player.name,turns:[]}));
 // A fresh table for the current leg, using that leg's starting player.
 state.history.filter(turn=>turn.leg===state.leg).forEach((turn,i)=>columns[(state.starter+i)%columns.length].turns.push(turn));
 const title=document.createElement('h2'),legLabel=document.createElement('p');
 title.id='screen-history-title';title.textContent='Score per beurt';
 legLabel.id='screen-history-leg';legLabel.textContent=`Leg ${state.leg}`;
 const table=document.createElement('table'),head=document.createElement('thead'),heading=document.createElement('tr'),body=document.createElement('tbody');
 table.setAttribute('aria-label','Laatste beurten per speler');
 const corner=document.createElement('th');corner.scope='col';corner.setAttribute('aria-label','Beurtnummer');heading.append(corner);
 for(const col of columns){const name=document.createElement('th');name.scope='col';name.textContent=col.name;heading.append(name);}
 head.append(heading);
 const latest=Math.max(0,...columns.map(col=>col.turns.length));
 for(let attempt=Math.max(1,latest);attempt>=Math.max(1,latest-4);attempt--){
  const line=document.createElement('tr'),number=document.createElement('th');number.scope='row';number.textContent=String(attempt);line.append(number);
  for(const col of columns){
   const cell=document.createElement('td'),turn=col.turns[attempt-1];
   cell.textContent=!turn?'\u2014':turn.bust?'BUST':cricket?`${turn.marks} M`:String(turn.score);line.append(cell);
  }
  body.append(line);
 }
 table.append(head,body);history.replaceChildren(title,legLabel,table);
}
