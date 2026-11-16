import {getAppearance,playerColors,symbolNames} from './appearance-settings.js';
import {fitPlayfield} from './playfield-layout.js';
const ns='http://www.w3.org/2000/svg';
export function playerMarker(kind,index=0){
 const mark=document.createElementNS(ns,'svg');mark.setAttribute('viewBox','0 0 24 24');mark.setAttribute('aria-hidden','true');mark.classList.add('appearance-marker');
 const tag=kind==='circle'?'circle':kind==='square'?'rect':kind==='numbers'?'text':'path',shape=document.createElementNS(ns,tag);
 const attrs=kind==='circle'?{cx:12,cy:12,r:8}:kind==='square'?{x:4,y:4,width:16,height:16,rx:1}:kind==='triangle'?{d:'M12 3L22 21H2Z'}:kind==='numbers'?{x:12,y:18,'text-anchor':'middle','font-size':19,'font-weight':900,fill:'currentColor',stroke:'none'}:{d:'M5 5L19 19M19 5L5 19'};
 for(const [name,value] of Object.entries({fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linejoin':'round',...attrs}))shape.setAttribute(name,String(value));
 if(kind==='numbers')shape.textContent=String(index+1);mark.append(shape);return mark;
}
export function applyAppearanceDocument(){
 const p=getAppearance(),body=document.body;
 body.dataset.playSpace=p.space;body.dataset.boardStyle=p.board;body.dataset.scoreStyle=p.scoreboard.mode;body.dataset.activeEmphasis=p.emphasis;
 body.classList.toggle('appearance-custom-colors',p.colorMode==='custom');
 body.classList.toggle('appearance-hide-last',p.scoreboard.mode==='custom'&&!p.scoreboard.last);
 for(let i=0;i<4;i++){if(p.colorMode==='custom')document.documentElement.style.setProperty('--four-p'+i,p.colors[i]);else document.documentElement.style.removeProperty('--four-p'+i);}
 return p;
}
function extraInfo(state,index,prefs){
 const p=state.players[index],root=document.createElement('div');root.className='appearance-summary';
 const scoring=['x01','gotcha','cricket','tactics'].includes(state.game),marks=['cricket','tactics'].includes(state.game);
 const add=(key,label,value)=>{if(!prefs.scoreboard[key])return;const item=document.createElement('span'),caption=document.createElement('small'),number=document.createElement('b');item.dataset.scoreInfo=key;caption.textContent=label;number.textContent=String(value);item.append(caption,number);root.append(item);};
 if(scoring){add('average',marks?'MPR':'Gem.',p.darts?(((marks?p.totalMarks:p.points)||0)*3/p.darts).toFixed(1):'-');if(!state.training121)add('legs',state.matchMode==='sets'?'Sets / legs':'Legs',state.matchMode==='sets'?`${p.sets||0} / ${p.setLegs||0}`:p.legs||0);add('best',marks?'Beste marks':'Beste beurt',p.best||0);}
 add('darts','Darts',p.darts||0);
 if(state.game==='x01'&&!p.opened){const status=document.createElement('span');status.textContent='Nog ingooien';root.append(status);}
 const history=state.history||[],unique=state.players.filter(other=>other.name===p.name).length===1;
 const last=[...history].reverse().find(h=>Number.isInteger(h.player)?h.player===index:unique&&h.name===p.name);
 add('last','Laatste beurt',last?(last.bust?'BUST':last.labels||String(last.score??'-')):'-');
 return root;
}
export function applyGameAppearance(state){
 const prefs=applyAppearanceDocument();
 document.body.classList.toggle('appearance-focus',prefs.focus&&state?.phase==='playing'&&!document.getElementById('game')?.hidden);
 if(!state?.players){fitPlayfield(state);return;}
 for(const selector of ['#players>.player','.visual-players>.visual-player','.party-players>.party-player','.killer-players>.killer-player','.four-legend>article','.sonny-players>article','.lives-players>.lives-player']){
  document.querySelectorAll(selector).forEach((card,index)=>{
   if(!state.players[index])return;card.dataset.appearancePlayer=String(index);card.style.setProperty('--appearance-player-color',playerColors[index]);
   const name=card.querySelector('.player-top>strong,.killer-player-name,h3')||[...card.children].find(n=>n.tagName==='STRONG');
   name?.querySelector('.appearance-marker')?.remove();
   if(name&&prefs.markers!=='none'){
    // Four in a Row symbols are shared game data and must match its claimed cells.
    const existing=state.game==='fourinarow'?state.players[index].fourSymbol:null;
    const four=['\u25cb','\u00d7','\u25b3','\u25a1'].indexOf(existing);
    const kind=state.game==='fourinarow'?(four>=0?symbolNames[four]:symbolNames[index]):prefs.markers==='numbers'?'numbers':prefs.symbols[index];
    name.prepend(playerMarker(kind,index));
   }
   card.querySelector('.appearance-summary')?.remove();
   if(prefs.scoreboard.mode==='custom')card.append(extraInfo(state,index,prefs));
  });
 }
 fitPlayfield(state);
}
