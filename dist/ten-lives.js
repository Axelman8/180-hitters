export const livesTargets=[20,19,18,17,16,15,14,13,12,11,10,25];
export const livesLabel=(state,player)=>player.livesTarget===25?'Bull (50)':(state.livesMode==='triple'?'T':'D')+player.livesTarget;

// A recorded input is one physical dart. Only exhausting a target ends a visit.
export function applyLivesDart(state,turn){
 if(state.phase!=='playing')throw Error('Deze training is afgelopen.');
 if(turn.trainingMisses!==undefined){
  const count=turn.trainingMisses;
  if(!Number.isInteger(count)||count<1||count>3||count>state.players[state.active].attempts)throw Error('Kies maximaal drie resterende pogingen.');
  let next=state;
  for(let i=0;i<count;i++)next=applyLivesDart(next,{trainingHit:false});
  const last=next.history.at(-1);
  next.history.splice(state.history.length,count,{...last,darts:count,labels:`${count} keer mis`,input:{trainingMisses:count}});
  return next;
 }
 if(typeof turn.trainingHit!=='boolean')throw Error('Kies Doel geraakt of Mis voor deze pijl.');
 const s=structuredClone(state),index=s.active,p=s.players[index],target=p.livesTarget;
 if(p.lives<=0)throw Error('Deze speler is uitgeschakeld.');
 p.attempts--;p.darts++;let ended=false;
 if(turn.trainingHit){
  p.livesHits++;
  if(target===25){s.phase='won';s.winner=index;s.reason='lives-bull';s.completedAt=Date.now();}
  else{p.livesTarget=livesTargets[livesTargets.indexOf(target)+1];p.attempts+=3;}
 }else if(p.attempts===0){
  ended=true;
  if(target===20)p.lives--;
  else p.livesTarget=livesTargets[livesTargets.indexOf(target)-1];
  p.attempts=p.lives>0?3:0;
  s.turns++;
  const alive=s.players.map((p,i)=>p.lives>0?i:-1).filter(i=>i>=0);
  if(!alive.length){s.phase='won';s.winner=null;s.reason='lives-eliminated';s.completedAt=Date.now();}
  else{do{s.active=(s.active+1)%s.players.length;}while(s.players[s.active].lives===0);}
 }
 p.remaining=p.lives;
 s.history.push({name:p.name,player:index,leg:1,target,score:turn.trainingHit?1:0,darts:1,remaining:p.lives,lives:p.lives,attempts:p.attempts,nextTarget:p.livesTarget,ended,labels:turn.trainingHit?'Raak':'Mis',recordedAt:Date.now(),input:{trainingHit:turn.trainingHit}});
 return s;
}

const targetLabel=(state,target)=>target===25?'Bull':(state.livesMode==='triple'?'T':'D')+target;
const clock=value=>value?new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'Niet geregistreerd';

// Build one row for every completed target attempt. This works for solo play and
// for players whose attempts are interleaved in a multiplayer training.
export function livesSummary(state){
 const pending=new Map(),rows=[],rounds=new Map();
 const finish=(playerIndex,success)=>{
  const item=pending.get(playerIndex);if(!item)return;
  const round=(rounds.get(playerIndex)||0)+1;rounds.set(playerIndex,round);
  rows.push({...item,round,success});pending.delete(playerIndex);
 };
 for(const turn of state.history||[]){
  const playerIndex=Number.isInteger(turn.player)?turn.player:Math.max(0,state.players.findIndex(player=>player.name===turn.name));
  let item=pending.get(playerIndex);
  if(item&&item.target!==turn.target){finish(playerIndex,false);item=null;}
  if(!item){item={playerIndex,player:state.players[playerIndex]?.name||turn.name||'Speler',target:turn.target,darts:0,throws:[]};pending.set(playerIndex,item);}
  const count=Math.max(1,Number(turn.darts)||1),hit=Number(turn.score)>0;
  item.darts+=count;
  for(let dart=0;dart<count;dart++)item.throws.push(hit&&dart===count-1?'Raak':'Mis');
  if(hit)finish(playerIndex,true);else if(turn.ended)finish(playerIndex,false);
 }
 for(const playerIndex of [...pending.keys()])finish(playerIndex,false);
 const goals=new Map();
 for(const row of rows){
  const label=targetLabel(state,row.target),goal=goals.get(label)||{label,target:row.target,attempts:0,hits:0,oneDart:0,darts:0};
  goal.attempts++;goal.darts+=row.darts;
  if(row.success){goal.hits++;if(row.darts===1)goal.oneDart++;}
  goals.set(label,goal);
 }
 const ranking=[...goals.values()].sort((a,b)=>{
  const aAverage=a.darts/a.attempts,bAverage=b.darts/b.attempts;
  return aAverage-bAverage||b.oneDart-a.oneDart||b.hits/b.attempts-a.hits/a.attempts||livesTargets.indexOf(a.target)-livesTargets.indexOf(b.target);
 });
 return {
  title:`Hitters Challenge - ${state.livesMode==='triple'?'Triples':'Doubles'}`,
  started:clock(state.startedAt),ended:clock(state.completedAt),
  totalDarts:state.players.reduce((total,player)=>total+(Number(player.darts)||0),0),
  rows,ranking,oneDart:ranking.filter(goal=>goal.oneDart>0)
 };
}

export function renderLivesSummary(state,dialog){
 dialog.querySelector('#lives-summary')?.remove();
 const report=livesSummary(state),section=el('section',undefined,'lives-summary');section.id='lives-summary';section.setAttribute('aria-label','Samenvatting Hitters Challenge');
 section.append(el('h3',report.title));
 const meta=el('dl',undefined,'lives-summary-meta');
 for(const [label,value] of [['Begintijd',report.started],['Eindtijd',report.ended],['Darts totaal',String(report.totalDarts)]]){meta.append(el('dt',label),el('dd',value));}
 section.append(meta);
 const one=el('div',undefined,'lives-summary-one');one.append(el('h4','Met 1 dart geraakt'));
 if(report.oneDart.length){const chart=el('div',undefined,'lives-one-dart-chart'),maximum=Math.max(...report.oneDart.map(goal=>goal.oneDart));for(const goal of report.oneDart){const row=el('div'),label=el('span',goal.label),track=el('i'),bar=el('b'),count=el('strong',`× ${goal.oneDart}`);bar.style.width=`${goal.oneDart/maximum*100}%`;track.append(bar);row.append(label,track,count);chart.append(row);}one.append(chart);}else one.append(el('p','Geen doel met de eerste dart geraakt.'));
 section.append(one);
 const ranking=el('div',undefined,'lives-summary-ranking');ranking.append(el('h4','Sterkst naar zwakst'));
 const bestAverage=Math.min(...report.ranking.map(goal=>goal.darts/goal.attempts));
 const rankingList=el('ol');for(const goal of report.ranking){const numeric=goal.darts/goal.attempts,average=numeric.toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1}),item=el('li');item.append(el('span',`${goal.label} - ${average} darts gemiddeld${goal.oneDart?` · ${goal.oneDart}× met 1 dart`:''}`));const track=el('i'),bar=el('b');bar.style.width=`${Math.max(8,bestAverage/numeric*100)}%`;track.append(bar);item.append(track);rankingList.append(item);}ranking.append(rankingList);section.append(ranking);
 const wrap=el('div',undefined,'lives-summary-table-wrap'),table=el('table',undefined,'lives-summary-table'),head=table.createTHead(),header=head.insertRow();
 for(const label of ['Ronde','Doel','Aantal darts','Darts gegooid'])header.append(el('th',label));
 const body=table.createTBody(),multi=state.players.length>1;
 for(const row of report.rows){const tr=body.insertRow();for(const value of [multi?`${row.round} · ${row.player}`:String(row.round),targetLabel(state,row.target),String(row.darts),row.throws.join(' · ')])tr.append(el('td',value));if(!row.success)tr.className='missed';}
 wrap.append(table);section.append(wrap);
 const share=el('button','Delen als afbeelding','lives-summary-share primary wide');share.type='button';share.onclick=async()=>{
  const original=share.textContent;share.disabled=true;share.textContent='Afbeelding maken...';
  try{window.DartsAndroid?.logShare?.('deelknop geactiveerd');await shareLivesSummary(state);share.textContent='Deelmenu geopend';}
  catch(error){window.DartsAndroid?.logShare?.('fout: '+(error?.message||error));share.textContent=error?.message||'Delen is niet gelukt';}
  finally{setTimeout(()=>{share.disabled=false;share.textContent=original;},2200);}
 };
 section.append(share);dialog.querySelector('#result-title').after(section);
}

const chartColors=['#c8f56a','#83d9ef','#ffbb79','#d8a7ff'];
const timelineData=(state,report)=>{
 const previous=new Map();
 return report.rows.map(row=>{const prior=previous.get(row.playerIndex),current=livesTargets.indexOf(row.target);previous.set(row.playerIndex,current);let movement='Start';if(prior!==undefined)movement=current>prior?'Vooruit':current<prior?'Terug':'Opnieuw';if(!row.success)movement='Niet geraakt';return {...row,movement,label:targetLabel(state,row.target)};});
};
export function renderRoundTimeline(state,report=livesSummary(state)){
 const card=el('div',undefined,'lives-round-timeline');card.append(el('h4','Rondeverloop'),el('p','Iedere kaart toont het doel en het aantal gebruikte darts.','lives-timeline-note'));
 const grid=el('div',undefined,'lives-timeline-grid'),maxDarts=Math.max(3,...report.rows.map(row=>row.darts));
 for(const row of timelineData(state,report)){const item=el('article',undefined,row.success?'success':'missed');item.style.setProperty('--player-color',chartColors[row.playerIndex%chartColors.length]);const top=el('div');top.append(el('span',`Ronde ${row.round}${state.players.length>1?` · ${row.player}`:''}`),el('small',row.movement));const result=el('div');result.append(el('strong',row.label),el('b',`${row.darts} ${row.darts===1?'dart':'darts'}`));const meter=el('i'),fill=el('u');fill.style.width=`${Math.max(8,row.darts/maxDarts*100)}%`;meter.append(fill);item.append(top,result,meter);grid.append(item);}
 card.append(grid);return card;
}
const chartPoint=(row,maxRound,width=900,height=420)=>({
 x:92+(maxRound===1?.5:(row.round-1)/(maxRound-1))*(width-130),
 y:34+(livesTargets.length-1-livesTargets.indexOf(row.target))*((height-92)/(livesTargets.length-1))
});
const dartsPoint=(row,maxRound,maxDarts,width=900,height=420)=>({
 x:92+(maxRound===1?.5:(row.round-1)/(maxRound-1))*(width-130),
 y:34+(maxDarts-row.darts)/Math.max(1,maxDarts-1)*(height-92)
});
const svgNode=(tag,attributes={},text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));if(text!==undefined)node.textContent=text;return node;};
export function renderLivesChart(state,report=livesSummary(state)){
 const card=el('div',undefined,'lives-summary-chart');card.append(el('h4','Doelverloop per ronde'));
 const width=900,height=420,maxRound=Math.max(1,...report.rows.map(row=>row.round)),svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Grafiek met doel en aantal darts per ronde'});
 for(const target of livesTargets){const point=chartPoint({round:1,target},maxRound,width,height);svg.append(svgNode('line',{x1:92,y1:point.y,x2:width-38,y2:point.y,class:'chart-grid'}),svgNode('text',{x:78,y:point.y+5,'text-anchor':'end',class:'chart-axis'},targetLabel(state,target)));}
 const tickStep=Math.max(1,Math.ceil(maxRound/10));for(let round=1;round<=maxRound;round+=tickStep){const point=chartPoint({round,target:20},maxRound,width,height);svg.append(svgNode('text',{x:point.x,y:height-15,'text-anchor':'middle',class:'chart-axis'},round));}
 state.players.forEach((player,index)=>{
  const rows=report.rows.filter(row=>row.playerIndex===index),color=chartColors[index%chartColors.length];if(!rows.length)return;
  const points=rows.map(row=>chartPoint(row,maxRound,width,height));svg.append(svgNode('polyline',{points:points.map(point=>`${point.x},${point.y}`).join(' '),fill:'none',stroke:color,'stroke-width':5,'stroke-linejoin':'round','stroke-linecap':'round'}));
  rows.forEach((row,rowIndex)=>{const point=points[rowIndex];svg.append(svgNode('circle',{cx:point.x,cy:point.y,r:9,fill:row.success?color:'#192b35',stroke:row.success?color:'#ffbb79','stroke-width':4}),svgNode('text',{x:point.x,y:point.y-14,'text-anchor':'middle',class:'chart-darts',fill:color},`${row.darts}d`));});
 });
 card.append(svg);
 if(state.players.length>1){const legend=el('div',undefined,'lives-chart-legend');state.players.forEach((player,index)=>{const item=el('span',player.name);item.style.setProperty('--chart-color',chartColors[index%chartColors.length]);legend.append(item);});card.append(legend);}
 return card;
}

export function renderDartsLineChart(state,report=livesSummary(state)){
 const card=el('div',undefined,'lives-summary-chart lives-darts-line-chart');card.append(el('h4','Aantal darts per ronde'));
 const width=900,height=420,maxRound=Math.max(1,...report.rows.map(row=>row.round)),maxDarts=Math.max(3,...report.rows.map(row=>row.darts)),svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Lijngrafiek van het aantal darts per ronde'}),dartStep=Math.max(1,Math.ceil(maxDarts/8));
 for(let darts=1;darts<=maxDarts;darts+=dartStep){const point=dartsPoint({round:1,darts},maxRound,maxDarts,width,height);svg.append(svgNode('line',{x1:92,y1:point.y,x2:width-38,y2:point.y,class:'chart-grid'}),svgNode('text',{x:78,y:point.y+5,'text-anchor':'end',class:'chart-axis'},darts));}
 const tickStep=Math.max(1,Math.ceil(maxRound/10));for(let round=1;round<=maxRound;round+=tickStep){const point=dartsPoint({round,darts:1},maxRound,maxDarts,width,height);svg.append(svgNode('text',{x:point.x,y:height-15,'text-anchor':'middle',class:'chart-axis'},round));}
 state.players.forEach((player,index)=>{const rows=report.rows.filter(row=>row.playerIndex===index),color=chartColors[index%chartColors.length];if(!rows.length)return;const points=rows.map(row=>dartsPoint(row,maxRound,maxDarts,width,height));svg.append(svgNode('polyline',{points:points.map(point=>`${point.x},${point.y}`).join(' '),fill:'none',stroke:color,'stroke-width':5,'stroke-linejoin':'round','stroke-linecap':'round'}));rows.forEach((row,rowIndex)=>{const point=points[rowIndex];svg.append(svgNode('circle',{cx:point.x,cy:point.y,r:9,fill:row.success?color:'#192b35',stroke:row.success?color:'#ffbb79','stroke-width':4}),svgNode('text',{x:point.x,y:point.y-14,'text-anchor':'middle',class:'chart-goal',fill:color},targetLabel(state,row.target)));});});
 card.append(svg);return card;
}

const wrapText=(context,text,width)=>{
 const words=String(text).split(/\s+/),lines=[];let line='';
 for(const word of words){const next=line?line+' '+word:word;if(context.measureText(next).width<=width||!line)line=next;else{lines.push(line);line=word;}}
 if(line)lines.push(line);return lines;
};
const rounded=(context,x,y,width,height,radius=18)=>{context.beginPath();context.roundRect(x,y,width,height,radius);context.fill();};
function createLivesOverviewImage(state){
 const report=livesSummary(state),width=1080,margin=58,inner=width-margin*2,canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 context.font='26px sans-serif';
 const bestAverage=Math.min(...report.ranking.map(goal=>goal.darts/goal.attempts)),rankingItems=report.ranking.map((goal,index)=>{const average=goal.darts/goal.attempts;return {goal,average,percent:Math.max(.08,bestAverage/average),lines:wrapText(context,`${index+1}. ${goal.label} - ${average.toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1})} darts gemiddeld${goal.oneDart?` · ${goal.oneDart}× met 1 dart`:''}`,inner-56)};});
 const oneCardHeight=report.oneDart.length?58+report.oneDart.length*35:100,rankingContentHeight=rankingItems.reduce((total,item)=>total+item.lines.length*35+26,0),height=414+oneCardHeight+rankingContentHeight;
 canvas.width=width;canvas.height=height;context.textBaseline='middle';
 context.fillStyle='#0c151b';context.fillRect(0,0,width,height);
 let y=58;
 context.fillStyle='#c8f56a';context.font='800 48px sans-serif';context.fillText(report.title,margin,y+30);y+=92;
 context.fillStyle='#142129';rounded(context,margin,y,inner,118);const meta=[['BEGINTIJD',report.started],['EINDTIJD',report.ended],['DARTS TOTAAL',String(report.totalDarts)]];
 for(let index=0;index<meta.length;index++){const x=margin+28+index*inner/3;context.fillStyle='#93a9b2';context.font='700 17px sans-serif';context.fillText(meta[index][0],x,y+30);context.fillStyle='#fff';context.font='800 29px sans-serif';context.fillText(meta[index][1],x,y+76);}y+=142;
 context.fillStyle='#142129';rounded(context,margin,y,inner,oneCardHeight);context.fillStyle='#83d9ef';context.font='800 23px sans-serif';context.fillText('MET 1 DART GERAAKT',margin+26,y+27);context.font='22px sans-serif';
 if(report.oneDart.length){const maximum=Math.max(...report.oneDart.map(goal=>goal.oneDart));let oneY=y+61;for(const goal of report.oneDart){context.fillStyle='#fff';context.fillText(goal.label,margin+28,oneY);context.fillStyle='#20313b';rounded(context,margin+118,oneY-9,inner-215,18,9);context.fillStyle='#83d9ef';rounded(context,margin+118,oneY-9,(inner-215)*goal.oneDart/maximum,18,9);context.fillStyle='#fff';context.fillText(`× ${goal.oneDart}`,margin+inner-62,oneY);oneY+=35;}}else{context.fillStyle='#fff';context.fillText('Geen doel met de eerste dart geraakt.',margin+26,y+67);}y+=oneCardHeight+24;
 context.fillStyle='#142129';const rankingHeight=54+rankingContentHeight;rounded(context,margin,y,inner,rankingHeight);context.fillStyle='#83d9ef';context.font='800 23px sans-serif';context.fillText('STERKST NAAR ZWAKST',margin+26,y+28);context.font='26px sans-serif';let rankingY=y+65;for(const item of rankingItems){context.fillStyle='#fff';for(const line of item.lines){context.fillText(line,margin+28,rankingY);rankingY+=35;}context.fillStyle='#20313b';rounded(context,margin+28,rankingY-7,inner-56,15,8);context.fillStyle='#c8f56a';rounded(context,margin+28,rankingY-7,(inner-56)*item.percent,15,8);rankingY+=26;}y+=rankingHeight+24;
 context.fillStyle='#728b96';context.font='18px sans-serif';context.fillText('Gemaakt met 180 Hitters',margin,height-26);
 return canvas;
}

function createLivesRoundsImage(state,rows,page,pageCount){
 const report=livesSummary(state),width=1080,margin=58,inner=width-margin*2,tableWidths=[150,160,185,469],canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 context.font='25px sans-serif';
 const tableRows=rows.map(row=>{const values=[state.players.length>1?`${row.round} · ${row.player}`:String(row.round),targetLabel(state,row.target),String(row.darts),row.throws.join(' · ')];const lines=values.map((value,index)=>wrapText(context,value,tableWidths[index]-28));return {row,lines,height:Math.max(58,Math.max(...lines.map(value=>value.length))*32+20)};});
 const height=230+tableRows.reduce((total,row)=>total+row.height,0);canvas.width=width;canvas.height=height;context.textBaseline='middle';context.fillStyle='#0c151b';context.fillRect(0,0,width,height);
 context.fillStyle='#c8f56a';context.font='800 43px sans-serif';context.fillText(report.title,margin,72);
 context.fillStyle='#93a9b2';context.font='700 22px sans-serif';context.fillText(`RONDES · DEEL ${page} VAN ${pageCount}`,margin,120);
 let y=154,x=margin;const headers=['RONDE','DOEL','AANTAL DARTS','DARTS GEGOOID'];context.fillStyle='#20313b';rounded(context,margin,y,inner,58,12);context.font='800 19px sans-serif';context.fillStyle='#c8f56a';for(let index=0;index<headers.length;index++){context.fillText(headers[index],x+14,y+29);x+=tableWidths[index];}y+=58;
 context.font='25px sans-serif';for(const item of tableRows){context.fillStyle=item.row.success?'#142129':'#2e251f';context.fillRect(margin,y,inner,item.height-2);x=margin;for(let column=0;column<item.lines.length;column++){context.fillStyle=item.row.success?'#fff':'#ffbb79';let lineY=y+20;for(const line of item.lines[column]){context.fillText(line,x+14,lineY);lineY+=32;}x+=tableWidths[column];}y+=item.height;}
 return canvas;
}

export function createLivesSummaryImages(state){
 const rows=livesSummary(state).rows,pageSize=16,pageCount=Math.max(1,Math.ceil(rows.length/pageSize)),images=[{canvas:createLivesOverviewImage(state),suffix:'overzicht'}];
 for(let index=0;index<pageCount;index++)images.push({canvas:createLivesRoundsImage(state,rows.slice(index*pageSize,(index+1)*pageSize),index+1,pageCount),suffix:`rondes-${String(index+1).padStart(2,'0')}`});
 return images;
}

export function createLivesSummaryImage(state){return createLivesOverviewImage(state);}

export async function shareLivesSummary(state){
 const bridge=window.DartsAndroid,date=new Date().toISOString().slice(0,10),images=createLivesSummaryImages(state);bridge?.logShare?.(`${images.length} afbeeldingen opbouwen`);
 const parts=images.map(({canvas,suffix})=>{const data=canvas.toDataURL('image/png');if(!data.startsWith('data:image/png;base64,'))throw Error('Afbeelding kon niet worden gemaakt.');return {encoded:data.slice(data.indexOf(',')+1),filename:`hitters-challenge-${date}-${suffix}.png`,canvas};});
 bridge?.logShare?.(`${parts.length} afbeeldingen gereed`);
 const append=async encoded=>{const chunkSize=196608;for(let offset=0,index=0;offset<encoded.length;offset+=chunkSize,index++){if(!bridge.appendPngShare(encoded.slice(offset,offset+chunkSize)))throw Error('Afbeelding kon niet worden overgedragen.');if(index%8===7)await new Promise(resolve=>setTimeout(resolve,0));}};
 if(bridge?.beginPngShareCollection&&bridge?.beginPngSharePart&&bridge?.appendPngShare&&bridge?.finishPngSharePart&&bridge?.finishPngShareCollection){
  if(!bridge.beginPngShareCollection())throw Error('Delen kon niet worden voorbereid.');
  for(const part of parts){if(!bridge.beginPngSharePart(part.filename))throw Error('Afbeelding kon niet worden voorbereid.');await append(part.encoded);if(!bridge.finishPngSharePart())throw Error('Afbeelding kon niet worden opgeslagen.');}
  if(!bridge.finishPngShareCollection())throw Error('Android kon het deelmenu niet openen.');return;
 }
 const files=[];for(const part of parts){const blob=await new Promise(resolve=>part.canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Afbeelding kon niet worden gemaakt.');files.push(new File([blob],part.filename,{type:'image/png'}));}
 if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){await navigator.share({title:'Hitters Challenge',text:'Mijn Hitters Challenge-resultaat',files});return;}
 for(const file of files){const link=document.createElement('a');link.href=URL.createObjectURL(file);link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1500);}
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function renderLives(state,actions){
 let root=document.getElementById('lives-game');
 if(!root){root=el('section',undefined,'lives-game');root.id='lives-game';document.getElementById('game').append(root);}
 root.replaceChildren();
 const heading=el('div',undefined,'lives-heading');heading.append(el('h2','Hitters Challenge'),el('span',state.livesMode==='triple'?'Triples · 20 t/m 10 → Bull':'Doubles · 20 t/m 10 → Bull'));root.append(heading);
 const cards=el('div',undefined,'lives-players');cards.style.setProperty('--count',state.players.length);
 state.players.forEach((p,i)=>{
  const card=el('article',undefined,'lives-player'+(i===state.active?' active':'')+(p.lives===0?' eliminated':''));
  card.append(el('h3',p.name),el('strong',p.lives===0?'Uitgeschakeld':livesLabel(state,p),'lives-goal'),el('p',p.lives===0?'Geen pogingen meer':`${p.attempts} ${p.attempts===1?'poging':'pogingen'}`));
  const marks=el('div',undefined,'life-marks');marks.setAttribute('aria-label',`${p.lives} van 10 levens`);
  for(let i=0;i<10;i++)marks.append(el('i',String(i+1),i<p.lives?'available':'lost'));
  card.append(marks,el('small',`${p.lives} / 10 levens`));cards.append(card);
 });root.append(cards);
 const p=state.players[state.active],focus=el('div',undefined,'lives-focus panel');
 const target=el('div',undefined,'lives-target-block');
 target.append(el('span','DOEL','lives-focus-label'),el('strong',livesLabel(state,p),'lives-current'));
 const attempts=el('div',undefined,'lives-attempts'+(p.attempts<=2?' last-attempts':''));
 attempts.setAttribute('role','status');attempts.setAttribute('aria-label',`${p.attempts} ${p.attempts===1?'poging':'pogingen'} over voor ${livesLabel(state,p)}`);
 attempts.append(el('strong',String(p.attempts),'lives-attempt-count'),document.createTextNode(' '),el('span',`${p.attempts===1?'poging':'pogingen'} over`,'lives-attempt-label'));
 const focusValues=el('div',undefined,'lives-focus-values');focusValues.append(target,attempts);
 focus.append(el('p',p.name,'lives-name'),focusValues);
 const route=el('div',undefined,'lives-route');
 for(const target of livesTargets){const n=el('span',target===25?'Bull':String(target));if(target===p.livesTarget)n.className='current';route.append(n);}focus.append(route);root.append(focus);
 const controls=el('section',undefined,'lives-controls panel');
 const btn=(text,id,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.id=id;b.onclick=fn;return b;};
 const tiles=el('div',undefined,'lives-entry');
 tiles.append(btn('Raak','lives-hit',()=>actions.dart(true),'primary'),btn('Mis','lives-miss',()=>actions.dart(false),'lives-miss'),btn(`${Math.min(3,p.attempts)} keer mis`,'lives-miss-three',()=>actions.misses(Math.min(3,p.attempts)),'lives-miss lives-miss-three'));
 tiles.querySelector('#lives-hit').setAttribute('aria-label',`${livesLabel(state,p)} geraakt`);
 for(const b of tiles.children)b.disabled=state.phase!=='playing';
 controls.append(tiles,el('p','Voer elke pijl direct in. Alleen het aangegeven doel telt. Bull is uitsluitend 50.','lives-hint'));
 const undo=btn('Vorige invoer herstellen','lives-undo',actions.undo,'lives-undo');undo.disabled=!actions.canUndo;
 const redo=btn('Volgende pijl →','lives-redo',actions.redo);redo.disabled=!actions.canRedo;
 const history=el('div',undefined,'lives-history-actions');history.append(undo,redo);controls.append(history);
 const toggle=btn('Scherminvoer in-/uitklappen','lives-toggle',actions.toggle);controls.append(toggle);root.append(controls);
 const last=state.history.at(-1);
 const note=el('p',last?`${last.name}: ${last.target===25?'Bull':(state.livesMode==='triple'?'T':'D')+last.target} ${last.labels.toLowerCase()}${last.ended?(last.lives===0?' · uitgeschakeld':last.target===20?' · één leven kwijt':' · één doel terug'):''}`:'Raak het doel om door te gaan. Overgebleven pijlen + 3 voor het volgende doel.','lives-last');note.setAttribute('aria-live','polite');root.append(note);
}
