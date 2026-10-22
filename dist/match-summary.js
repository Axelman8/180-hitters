export function matchSummary(state){
 const marks=['cricket','tactics'].includes(state.game),count=state.players.length;
 const legs=[...new Set([state.leg,...state.history.map(turn=>turn.leg)])].sort((a,b)=>a-b);
 const rows=state.players.map(player=>({name:player.name,legs:player.legs,sets:player.sets,points:0,darts:0,perLeg:legs.map(leg=>({leg,points:0,darts:0,average:null,finish:null}))}));
 for(const leg of legs){
  const starter=((state.starter-(state.leg-leg))%count+count)%count;
  state.history.filter(turn=>turn.leg===leg).forEach((turn,visit)=>{
   const row=rows[(starter+visit)%count],cell=row.perLeg.find(item=>item.leg===leg);
   const points=turn.bust?0:marks?(turn.marks||0):turn.score;
   if(!turn.bust&&!marks&&((state.game==='gotcha'&&turn.remaining===state.start)||(state.game!=='gotcha'&&turn.remaining===0)))cell.finish=turn.score;
   cell.points+=points;cell.darts+=turn.darts;
   row.points+=points;row.darts+=turn.darts;
  });
 }
 for(const row of rows){
  row.average=row.darts?row.points/row.darts*3:null;
  for(const cell of row.perLeg)cell.average=cell.darts?cell.points/cell.darts*3:null;
 }
 return {marks,rows};
}
export function renderMatchSummary(state,dialog){
 dialog.querySelector('#match-summary')?.remove();
 const summary=document.createElement('section');summary.id='match-summary';
 summary.setAttribute('aria-label','Partijoverzicht');
 const {marks,rows}=matchSummary(state);
 const heading=document.createElement('h3');heading.textContent='Partijoverzicht';
 const note=document.createElement('p');note.className='summary-note';
 note.textContent=marks?'MPR: gemiddeld aantal marks per 3 darts.':'Gemiddelden per 3 darts. Het eindgemiddelde telt alle gegooide darts mee.';
 summary.append(heading,note);
 const format=value=>value===null?'—':value.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
 rows.forEach((row,index)=>{
  const card=document.createElement('article');card.className='summary-player'+(index===state.winner?' summary-winner':'');
  const header=document.createElement('div');header.className='summary-player-head';
  const name=document.createElement('h4');name.textContent=row.name;
  const total=document.createElement('div');total.className='summary-total';
  const totalValue=document.createElement('strong');totalValue.textContent=format(row.average);
  const label=document.createElement('small');label.textContent=marks?'SPELGEMIDDELDE MPR':'SPELGEMIDDELDE';
  total.append(totalValue,label);
  const wins=document.createElement('div');wins.className='summary-wins';
  wins.textContent=`${row.legs} ${row.legs===1?'leg':'legs'}`+(state.matchMode==='sets'?` · ${row.sets} sets`:'');
  header.append(name,wins,total);
  const breakdown=renderLegTable(row.perLeg,marks);breakdown.classList.add('summary-leg-table');
  card.append(header,breakdown);summary.append(card);
 });
 dialog.querySelector('#result-title').after(summary);
}

export function renderLegTable(legs,marks=false){
 const table=document.createElement('table');table.className='leg-results-table';
 table.setAttribute('aria-label','Resultaten per leg');
 const head=document.createElement('thead'),heading=document.createElement('tr'),body=document.createElement('tbody');
 for(const text of ['Leg',marks?'Gemiddelde (MPR)':'Gemiddelde',...(!marks?['Finish']:[])]){
  const cell=document.createElement('th');cell.scope='col';cell.textContent=text;heading.append(cell);
 }
 head.append(heading);
 for(const leg of legs){
  const line=document.createElement('tr'),number=document.createElement('th');number.scope='row';number.textContent=String(leg.leg);line.append(number);
  const avg=document.createElement('td');avg.textContent=leg.average===null?'\u2014':leg.average.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});line.append(avg);
  if(!marks){const finish=document.createElement('td');finish.textContent=leg.finish===null?'\u2014':String(leg.finish);line.append(finish);}
  body.append(line);
 }
 table.append(head,body);return table;
}
