import {getAppearance} from './appearance-settings.js';

const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs={},text){const n=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));if(text!==undefined)n.textContent=text;return n;}
const point=(r,a)=>[260+r*Math.sin(a*Math.PI/180),260-r*Math.cos(a*Math.PI/180)];
function sector(inner,outer,start,end){return `M${point(outer,start)} A${outer},${outer} 0 0 1 ${point(outer,end)} L${point(inner,end)} A${inner},${inner} 0 0 0 ${point(inner,start)} Z`;}

// A visual target guide. Scoring continues through Raak/Mis or the camera/BOT.
export function livesBoard(state){
 const player=state.players[state.active],target=player.livesTarget,ring=target===25?'bull':state.livesMode==='triple'?'triple':'double',style=getAppearance().board;
 const board=svg('svg',{viewBox:'0 0 520 520',class:'lives-dartboard',role:'img','aria-label':`Dartbord voor ${player.name}: raak ${target===25?'bull (50)':`${ring==='triple'?'triple':'dubbel'} ${target}`}`,'data-target':target,'data-ring':ring});
 board.append(svg('circle',{cx:260,cy:260,r:255,fill:'#0a141d',stroke:'#715293','stroke-width':2}));
 order.forEach((number,index)=>{
  const group=svg('g',{class:'lives-board-sector'+(number===target?' current':''),'data-number':number});
  const start=index*18-9,end=start+18;
  for(const [inner,outer,kind] of [[24,118,'single'],[118,132,'triple'],[132,194,'single'],[194,210,'double']]){
   const active=number===target&&kind===ring;
   const base=style==='classic'?(kind==='single'?(index%2?'#ded4b5':'#171b20'):(index%2?'#248257':'#b84349')):style==='calm'?(kind==='single'?'#1b2b34':'#354b56'):index%2?'#49314f':'#30263d';
   group.append(svg('path',{d:sector(inner,outer,start,end),class:'lives-board-ring'+(active?' target-ring':''),'data-ring':kind,fill:active?'var(--accent,#c8f56a)':base,stroke:active?'var(--accent,#c8f56a)':'#111c25','stroke-width':active?3:1.5}));
  }
  const position=point(235,index*18);
  group.append(svg('text',{x:position[0],y:position[1],'text-anchor':'middle','dominant-baseline':'central',fill:number===target?'var(--accent,#c8f56a)':'#c6c3cf'},number));
  board.append(group);
 });
 const bull=svg('g',{'aria-hidden':'true',class:'lives-board-bull'});
 bull.append(svg('circle',{cx:260,cy:260,r:23,fill:style==='classic'?'#248257':'#49314f',stroke:'#111c25','stroke-width':2}));
 bull.append(svg('circle',{cx:260,cy:260,r:11,class:target===25?'target-ring':'',fill:target===25?'var(--accent,#c8f56a)':style==='classic'?'#b84349':'#715293',stroke:target===25?'var(--accent,#c8f56a)':'#111c25','stroke-width':2}));
 board.append(bull);return board;
}

let current=null,observer=null,watching=false,queued=false;
function schedule(){if(!queued){queued=true;requestAnimationFrame(fit);}}
function fit(){
 queued=false;if(!current)return;
 const {root,focus,frame}=current;
 if(!root.isConnected||document.body.dataset.game!=='tenlives'||!root.getClientRects().length)return;
 if(!matchMedia('(orientation:portrait)').matches){frame.hidden=true;return;}
 // Measure the established layout without the guide first. Keeping an old
 // board height in the flex/grid calculation would make fitting feed itself.
 frame.hidden=true;
 const layout=getComputedStyle(focus),padding=parseFloat(layout.paddingTop)+parseFloat(layout.paddingBottom);
 const children=[...focus.children].filter(n=>n!==frame&&getComputedStyle(n).display!=='none');
 const used=children.reduce((sum,n)=>{const s=getComputedStyle(n);return sum+n.getBoundingClientRect().height+parseFloat(s.marginTop)+parseFloat(s.marginBottom);},0)+padding+(parseFloat(layout.rowGap)||0)*children.length;
 const main=document.querySelector('main'),mainStyle=getComputedStyle(main),bottom=Math.min(window.visualViewport?.height||innerHeight,main.getBoundingClientRect().bottom-parseFloat(mainStyle.paddingBottom))-6;
 const bounds=focus.getBoundingClientRect();
 const free=bounds.height-parseFloat(layout.borderTopWidth)-parseFloat(layout.borderBottomWidth)-used+bottom-root.getBoundingClientRect().bottom;
 const size=Math.floor(Math.min(bounds.width-parseFloat(layout.borderLeftWidth)-parseFloat(layout.borderRightWidth)-parseFloat(layout.paddingLeft)-parseFloat(layout.paddingRight),free)+.01);
 frame.hidden=size<130;
 if(!frame.hidden&&frame.style.getPropertyValue('--lives-board-size')!==size+'px')frame.style.setProperty('--lives-board-size',size+'px');
}
export function fitLivesBoard(root,focus,frame){
 current={root,focus,frame};
 if(!watching){watching=true;new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});}
 if(typeof ResizeObserver!=='undefined'){
  if(!observer)observer=new ResizeObserver(schedule);
  observer.disconnect();
  for(const n of [document.querySelector('main'),document.querySelector('header'),root,focus,...root.querySelectorAll('.lives-players,.lives-controls')])if(n)observer.observe(n);
 }
 schedule();
}
if(typeof window!=='undefined'){
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
}
