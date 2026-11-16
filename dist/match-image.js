// A reproducible, full-resolution picture of the saved board. No screen capture,
// live draft or current screen is used: archived and NUC matches work identically.
import {svg,dartboard,playerColors} from './graphic-board.js';
import {seaLog,turnPlayer} from './sea-log.js';
import {fourSymbols} from './four-in-row.js';
const titles={x01:'X01',cricket:'Cricket',tactics:'Tactics',gotcha:'Gotcha',bobs27:"Bob's 27",tenlives:'Hitters Challenge',fourinarow:'4 op een rij',killer:'Killer',seabattle:'Zeeslag Darts',golf:'Dartgolf',shanghai:'Shanghai',scram:'Scram',bull41:'Bull / 41',twentyone:'21'};
const color=i=>playerColors[i%playerColors.length];
const box=(root,x,y,width,height,fill='#14242d',stroke='#2d4652')=>root.append(svg('rect',{x,y,width,height,rx:14,fill,stroke,'stroke-width':2}));
function text(root,value,x,y,size=26,fill='#eaf4f7',attrs={}){
 const label=String(value??'-'),width=attrs['data-width'];delete attrs['data-width'];
 const n=svg('text',{x,y,fill,'font-size':size,'font-weight':700,...attrs},label);
 if(width&&label.length*size*.59>width){n.setAttribute('textLength',width);n.setAttribute('lengthAdjust','spacingAndGlyphs');}
 root.append(n);return n;
}
const centered=(root,value,x,y,size=26,fill='#eaf4f7',width=180)=>text(root,value,x,y,size,fill,{'text-anchor':'middle','data-width':width});
const turns=(s,i)=>(s.history||[]).filter(t=>turnPlayer(s,t)===i);
function result(s,p){
 if(s.game==='killer')return `${p.killerNumber??'?'} | ${p.killerEliminated?'Uitgeschakeld':`${p.killerLives??3} levens`}`;
 if(s.game==='seabattle')return `${p.seaRemaining??0} levens | ${p.seaDamage||0} schade`;
 if(s.game==='tenlives')return `${p.lives??0} levens | ${p.livesTarget===25?'Bull':(s.livesMode==='triple'?'T':'D')+(p.livesTarget??20)}`;
 if(s.game==='fourinarow')return `${s.fourOwners?.filter(i=>s.players[i]===p).length||0} vakken`;
 if(s.game==='golf')return `${p.golfStrokes||0} slagen`;
 if(s.game==='shanghai')return `${p.shanghaiPoints||0} punten`;
 if(s.game==='scram')return `${p.scramScore||0} punten`;
 if(s.game==='bull41')return `${p.bull41Score||0} punten`;
 if(s.game==='twentyone')return p.twentyOneAdjusted==null?`${p.twentyOneDarts||0} darts`:`${p.twentyOneAdjusted} darts (na triples)`;
 if(s.training121)return `Niveau ${p.trainingLevel||s.start||121}`;
 if(['cricket','tactics'].includes(s.game))return `${p.cricketPoints||0} punten`;
 if(s.game==='gotcha'||s.game==='bobs27')return `${p.remaining??0} punten`;
 return `${p.remaining??0} over | ${p.legs||0} legs${s.matchMode==='sets'?` | ${p.sets||0} sets`:''}`;
}
function table(root,y,headers,rows){
 const w=1000/headers.length,h=52;box(root,40,y,1000,h,'#20343f');
 headers.forEach((v,i)=>centered(root,v,40+w*(i+.5),y+34,23,i?color(i-1):'#c8f56a',w-18));y+=h;
 for(const row of rows){box(root,40,y,1000,h-3);row.forEach((v,i)=>centered(root,v,40+w*(i+.5),y+33,25,i?color(i-1):'#eaf4f7',w-18));y+=h;}return y;
}
function fourBoard(root,s,y){
 (s.fourBoard||[]).forEach((id,i)=>{
  const x=40+(i%5)*200,top=y+Math.floor(i/5)*200,owner=s.fourOwners?.[i],claimed=Number.isInteger(owner),c=claimed?color(owner):'#526b78';
  box(root,x+5,top+5,190,190,claimed?'#20343f':'#14242d',c);
  centered(root,id==='bb'?'BB':id.startsWith('sb')?'sB':id.slice(1),x+100,top+53,40,claimed?'#dbe6eb':'#93a9b2');
  if(claimed){const symbol=s.players[owner]?.fourSymbol;centered(root,fourSymbols.includes(symbol)?symbol:fourSymbols[owner],x+100,top+133,85,c);centered(root,s.players[owner]?.name,x+100,top+175,22,c,170);}
  if(s.fourWinningCells?.includes(i))root.append(svg('rect',{x:x+9,y:top+9,width:182,height:182,rx:12,fill:'none',stroke:'#c8f56a','stroke-width':5}));
 });return y+1000;
}
function marksBoard(root,s,y){
 const width=1000/(s.players.length+1);y=table(root,y,['Doel',...s.players.map(p=>p.name)],[]);
 for(const number of s.numbers||[]){box(root,40,y,1000,55);centered(root,number===25?'BULL':number,40+width/2,y+36,27);
  s.players.forEach((p,i)=>{const n=Math.min(3,p.marks?.[number]||0),x=40+width*(i+1.5),cy=y+28,c=color(i),g=svg('g',{stroke:c,'stroke-width':4,'stroke-linecap':'round',fill:'none'});
   if(n===0)g.append(svg('path',{d:`M${x-7} ${cy}h14`,opacity:.35}));
   if(n>=1)g.append(svg('path',{d:`M${x-11} ${cy+11}l22 -22`}));
   if(n>=2)g.append(svg('path',{d:`M${x-11} ${cy-11}l22 22`}));
   if(n>=3)g.append(svg('circle',{cx:x,cy,r:21}));root.append(g);
  });y+=60;
 }return y;
}
function fleetBoards(root,s,y){
 const log=seaLog(s,[]),cols=s.players.length===1?1:2,width=1000/cols;
 s.players.forEach((p,index)=>{const x=40+index%cols*width,top=y+Math.floor(index/cols)*500;
  centered(root,p.name,x+width/2,top+30,28,color(index),width-24);
  (p.seaFleet||[]).forEach((ship,i)=>{const cw=(width-16)/4,cx=x+8+i%4*cw,cy=top+50+Math.floor(i/4)*86,known=ship!==null&&ship!==undefined&&((p.seaShots?.[i]||0)>0||s.phase==='won'),damage=p.seaHull?.[i]||0;
   const sunk=known&&ship&&p.seaFleet.every((id,n)=>id!==ship||(p.seaHull[n]||0)>=2),label=!known?'ONBEKEND':!ship?'WATER':sunk?'GEZONKEN':damage>=2?'VERNIETIGD':damage?'RAAK':'SCHIP',credit=log.cells[index]?.[i],by=sunk?credit?.sunkBy:damage>=2?credit?.destroyedBy:credit?.hitBy;
   box(root,cx+2,cy,cw-5,80,ship&&known?damage>=2?'#452735':'#303c36':'#14242d',sunk?'#ff819d':'#2d4652');
   centered(root,i+1,cx+cw/2,cy+27,26);centered(root,label,cx+cw/2,cy+50,15,damage>=2?'#ff819d':'#83d9ef',cw-12);
   if(Number.isInteger(by))centered(root,s.players[by]?.name,cx+cw/2,cy+70,13,color(by),cw-12);
  });
 });return y+Math.ceil(s.players.length/cols)*500;
}
function board(root,s,y){
 if(s.game==='fourinarow')return fourBoard(root,s,y);
 if(['cricket','tactics'].includes(s.game))return marksBoard(root,s,y);
 if(s.game==='seabattle')return fleetBoards(root,s,y);
 if(s.game==='killer'){
  const image=dartboard({numbers:s.players.map(p=>p.killerNumber).filter(Number.isInteger),centre:'K',detail:'KILLER'});image.setAttribute('x',150);image.setAttribute('y',y);image.setAttribute('width',780);image.setAttribute('height',780);
  s.players.forEach((p,i)=>{const g=image.querySelector(`[data-number="${p.killerNumber}"]`);if(g){for(const path of g.querySelectorAll('path'))path.setAttribute('fill',p.killerEliminated?'#26343b':color(i));}});image.removeAttribute('class');root.append(image);return y+800;
 }
 if(s.game==='gotcha'){
  s.players.forEach((p,i)=>{const top=y+i*118;box(root,40,top,1000,100);text(root,p.name,62,top+34,25,color(i));text(root,`${p.remaining} / ${s.start}`,1016,top+34,25,color(i),{'text-anchor':'end'});box(root,62,top+58,956,22,'#263943');box(root,62,top+58,Math.max(4,956*Math.min(1,(p.remaining||0)/(s.start||301))),22,color(i),color(i));});return y+s.players.length*118;
 }
 if(s.game==='scram'){
  for(let i=0;i<21;i++){const x=40+i%7*143,top=y+Math.floor(i/7)*125,closed=!!s.scramClosed?.[i];box(root,x+4,top+4,134,113,closed?'#2c4437':'#14242d');centered(root,i===20?'BULL':i+1,x+71,top+46,31);centered(root,closed?'GESLOTEN':'OPEN',x+71,top+87,18,closed?'#c8f56a':'#93a9b2');}return y+375;
 }
 const goals=s.game==='bobs27'?[...Array.from({length:20},(_,i)=>i+1),25]:s.game==='tenlives'?[20,19,18,17,16,15,14,13,12,11,10,25]:s.game==='golf'?Array.from({length:s.golfHoles||9},(_,i)=>i+1):s.game==='shanghai'?Array.from({length:s.shanghaiRounds||7},(_,i)=>i+1):null;
 if(goals)return table(root,y,[s.game==='golf'?'Hole':'Doel',...s.players.map(p=>p.name)],goals.map((goal,n)=>[goal===25?'BULL':s.game==='bobs27'?'D'+goal:s.game==='tenlives'?(s.livesMode==='triple'?'T':'D')+goal:goal,...s.players.map((p,i)=>{
  if(s.game==='golf')return p.golfScores?.[n]??'-';if(s.game==='shanghai')return p.shanghaiScores?.[n]??'-';const own=turns(s,i).filter(t=>t.target===goal);return !own.length?'-':s.game==='bobs27'?`${own.reduce((a,t)=>a+(t.hits||0),0)} raak`:`${own.reduce((a,t)=>a+(t.darts||0),0)} darts`;
 })]));
 if(s.game==='twentyone')return table(root,y,['Doel',...s.players.map(p=>p.name)],Array.from({length:21},(_,n)=>[n===20?'BULL':n+1,...s.players.map(p=>p.twentyOneFinished||p.twentyOneTarget>n+1?'GERAAKT':'-')]));
 if(s.game==='bull41'){
  const image=dartboard({target:25,centre:'BULL',detail:`${s.bull41Marks||0} / 25 MARKS`});image.setAttribute('x',190);image.setAttribute('y',y);image.setAttribute('width',700);image.setAttribute('height',700);image.removeAttribute('class');root.append(image);return y+720;
 }
 const attempts=[...new Set((s.history||[]).map(t=>s.training121?t.trainingAttempt||t.leg||1:t.leg||1))];
 return table(root,y,[s.training121?'Poging':'Leg',...s.players.map(p=>p.name)],attempts.map(leg=>[leg,...s.players.map((p,i)=>{const last=turns(s,i).filter(t=>(s.training121?t.trainingAttempt||t.leg||1:t.leg||1)===leg).at(-1);return last?last.remaining===0&&!last.bust?'UIT':`${last.remaining} over`:'-';})]));
}
export function createMatchImage(state){
 const root=svg('svg',{xmlns:'http://www.w3.org/2000/svg',role:'img','aria-label':'Eindstand van '+(state.training121?'121':titles[state.game]||'de partij'),'font-family':'Arial, sans-serif'}),title=state.training121?'121':titles[state.game]||'Partij';
 box(root,0,0,1080,3000,'#0c151b','#0c151b');text(root,title,40,66,46,'#c8f56a');
 const winner=Number.isInteger(state.winner)?state.players[state.winner]?.name:null;
 text(root,state.phase==='won'?winner?'Gewonnen door '+winner:'Gelijkspel':'Tussenstand',40,112,29,winner?color(state.winner):'#83d9ef',{'data-width':1000});
 const count=state.players.length,cols=count===1?1:2,width=1000/cols;
 state.players.forEach((p,i)=>{const x=40+i%cols*width,y=142+Math.floor(i/cols)*118;box(root,x+3,y,width-9,104,'#14242d',i===state.winner?color(i):'#2d4652');text(root,p.name,x+20,y+39,30,color(i),{'data-width':width-40});text(root,result(state,p),x+20,y+77,23,'#d8e6eb',{'data-width':width-40});});
 const bottom=board(root,state,162+Math.ceil(count/cols)*118),height=bottom+75;root.setAttribute('viewBox',`0 0 1080 ${height}`);root.setAttribute('width','1080');root.setAttribute('height',String(height));root.firstElementChild.setAttribute('height',String(height));text(root,'180 Hitters | '+new Date(state.completedAt||state.startedAt||Date.now()).toLocaleString('nl-NL'),40,height-26,21,'#93a9b2');return root;
}
export function appendMatchImage(section,state){
 const figure=document.createElement('figure');figure.className='match-final-image';const caption=document.createElement('figcaption');caption.textContent=state.phase==='won'?'Speelveld · eindstand':'Speelveld · tussenstand';figure.append(caption,createMatchImage(state));section.append(figure);
}
export async function createMatchImageCanvas(state){
 const picture=createMatchImage(state),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Number(picture.getAttribute('height'));
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(picture)],{type:'image/svg+xml;charset=utf-8'}));
 try{const image=new Image();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Eindstand kon niet worden gemaakt.')),10000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('Eindstand kon niet worden gemaakt.'));};image.src=url;});canvas.getContext('2d').drawImage(image,0,0);return canvas;}finally{URL.revokeObjectURL(url);}
}
