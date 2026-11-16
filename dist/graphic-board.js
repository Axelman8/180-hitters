import {playerColors,getAppearance} from './appearance-settings.js';
export {playerColors} from './appearance-settings.js';
export const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
export const button=(text,action,cls)=>{const el=node('button',text,cls);el.type='button';el.onclick=action;return el;};
export function svg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
const point=(r,a)=>[250+r*Math.sin(a*Math.PI/180),250-r*Math.cos(a*Math.PI/180)];
const wedge=(lo,hi,a,b)=>`M${point(hi,a)} A${hi},${hi} 0 0 1 ${point(hi,b)} L${point(lo,b)} A${lo},${lo} 0 0 0 ${point(lo,a)} Z`;
export function dartboard({target=null,numbers=null,players=[],active=0,hit=null,centre='',detail='',doubleOnly=false}={}){
 const style=getAppearance().board;
 const board=svg('svg',{viewBox:'0 0 500 500',class:'graphic-dartboard',role:'group','aria-label':hit?'Dartbord: tik op het gegooide getal':'Dartbord met het actuele doel'});
 board.append(svg('circle',{cx:250,cy:250,r:247,fill:'#0a141d',stroke:'#426173','stroke-width':2}));
 [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5].forEach((number,index)=>{
  const relevant=numbers?numbers.includes(number):target===number;
  const group=svg('g',{'data-number':number,class:'graphic-sector'+(relevant?' highlighted':''),...(hit?{role:'button',tabindex:0,'aria-label':`Raak ${number}`}:{})});
  for(const [lo,hi,ring] of [[23,116,'single'],[116,130,'triple'],[130,190,'single'],[190,205,'double']]){
   const mark=players.length?(players[active]?.marks[number]||0):0;
   const closed=players.length&&players.every(p=>(p.marks[number]||0)>=3);
   const classic=ring==='single'?(index%2?'#ded4b5':'#171b20'):(index%2?'#248257':'#b84349');
   const fill=closed?'#22323b':style==='classic'?classic:relevant?(doubleOnly&&ring!=='double'?'#283b37':mark===3?'#4a8054':'#9fcd57'):style==='calm'?(ring==='single'?'#1b2b34':'#354b56'):index%2?'#273943':'#172630';
   const highlight=style==='classic'&&relevant&&(!doubleOnly||ring==='double');
   group.append(svg('path',{d:wedge(lo,hi,index*18-9,index*18+9),fill,stroke:highlight?'#dafa8e':'#0c1921','stroke-width':highlight?3.5:2}));
   if(players.length&&relevant&&ring==='single'&&lo===130){
    for(let p=0;p<players.length;p++){const pos=point(146+p*11,index*18);group.append(svg('circle',{cx:pos[0],cy:pos[1],r:3.8,fill:(players[p].marks[number]||0)>=3?playerColors[p]:'#53616b'}));}
   }
  }
  const pos=point(229,index*18);group.append(svg('text',{x:pos[0],y:pos[1],'text-anchor':'middle','dominant-baseline':'central',fill:relevant?'#dcf6a9':'#b8c9d1','font-size':25,'font-weight':800},String(number)));
  if(hit){group.onclick=()=>hit(number);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hit(number);}};}board.append(group);
 });
 const bull=svg('g',{...(hit?{role:'button',tabindex:0,'aria-label':'Raak bull'}:{})});bull.append(svg('circle',{cx:250,cy:250,r:22,fill:target===25||numbers?.includes(25)?'#a1ce63':'#345665'}));bull.append(svg('circle',{cx:250,cy:250,r:11,fill:'#c8f56a'}));
 if(hit){bull.onclick=()=>hit(25);bull.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();hit(25);}};}board.append(bull);
 if(centre){board.append(svg('circle',{cx:250,cy:250,r:69,fill:'#101c23',stroke:'#91b85d','stroke-width':2}),svg('text',{x:250,y:246,'text-anchor':'middle',fill:'#d8f7a1','font-size':40,'font-weight':900},centre),svg('text',{x:250,y:274,'text-anchor':'middle',fill:'#b7c9d1','font-size':15},detail));}
 return board;
}
