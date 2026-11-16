import {renderDartSlots} from './dart-editor.js';
import {playerColors as colors,getAppearance} from './appearance-settings.js';

const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const ns='http://www.w3.org/2000/svg';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const svg=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
const point=(r,a)=>[260+r*Math.sin(a*Math.PI/180),260-r*Math.cos(a*Math.PI/180)];
function sector(inner,outer,start,end){const a=point(outer,start),b=point(outer,end),c=point(inner,end),d=point(inner,start);return `M${a} A${outer},${outer} 0 0 1 ${b} L${c} A${inner},${inner} 0 0 0 ${d} Z`;}
const button=(text,callback,cls)=>{const el=node('button',text,cls);el.type='button';el.onclick=callback;return el;};
let currentRoot=null;
function fit(){if(currentRoot?.isConnected&&!currentRoot.hidden){const available=Math.floor(innerHeight-currentRoot.getBoundingClientRect().top-8);currentRoot.style.setProperty('--killer-available',`${Math.max(360,available)}px`);}}
if(typeof window!=='undefined')window.addEventListener('resize',()=>requestAnimationFrame(fit));

// Rendering uses the same rule engine as manual input, cameras and the relay.
// A padded visit previews each dart without changing the saved match or turn.
export function renderKillerGame(root,state,pending,actions,applyTurn){
 const modern=state.killerRules==='three-hit',threshold=modern?3:6,ready=player=>modern?player.killerActivated:player.killerLetters===6;
 const assigning=state.killerStage==='assigning',actor=state.active,limit=assigning?1:3;
 const locked=state.phase!=='playing'||(!actions.editing&&pending.length>=limit);
 let preview=state;
 if(pending.length)try{preview=applyTurn(state,{hits:assigning?pending.slice(0,1):[...pending,...Array.from({length:Math.max(0,3-pending.length)},()=>({number:0,mult:1}))]});}catch{}
 root.replaceChildren();root.className='killer-game';
 currentRoot=root;requestAnimationFrame(fit);
 const header=node('div',undefined,'killer-heading');
 const title=node('div');title.append(node('span','LAATSTE SPELER WINT','killer-eyebrow'),node('h2','KILLER'));
 const instructions=assigning?'Raak met je andere hand een vrij getal voor je eigen doel.':ready(state.players[actor])?'Raak de getallen van je tegenstanders.':modern?'Drie treffers op je eigen getal maken je KILLER.':'Raak je eigen getal. Zes treffers maken je KILLER.';
 header.append(title,node('p',instructions));root.append(header);

 const players=node('section',undefined,'killer-players');players.setAttribute('aria-label','Spelers en levens');
 state.players.forEach((player,index)=>{
  const shown=preview.players[index],isKiller=ready(shown)&&!shown.killerEliminated;
  const card=node('article',undefined,'killer-player'+(index===actor?' active':'')+(shown.killerEliminated?' eliminated':''));card.style.setProperty('--killer-color',colors[index]);
  if(index===actor)card.setAttribute('aria-current','true');
  const name=node('strong',player.name,'killer-player-name');name.title=player.name;
  const number=button(shown.killerNumber??'?',()=>actions.hit(shown.killerNumber),'killer-number');number.disabled=locked||shown.killerNumber===null||assigning;number.setAttribute('aria-label',`Raak ${shown.killerNumber??'onbekend'} van ${player.name}`);
  const status=shown.killerEliminated?'UITGESCHAKELD':assigning?(shown.killerNumber===null?'KIES JE GETAL':'GETAL GEKOZEN'):isKiller?'KILLER':`${shown.killerLetters}/${threshold} · BOUW KILLER OP`;
  const badge=node('span',status,'killer-player-status');
  const life=node('div',undefined,'killer-lives');life.setAttribute('role','img');life.setAttribute('aria-label',`${shown.killerLetters} van ${threshold} treffers, ${modern?shown.killerLives:shown.killerInitial?1:0} levens`);
  for(let n=0;n<threshold;n++)life.append(node('span',modern?String(n+1):'KILLER'[n],n<shown.killerLetters?'filled':''));
  for(let n=0;n<(modern?3:1);n++){const heart=node('span',(modern?n<shown.killerLives:shown.killerInitial)?'\u2665':'\u00d7','killer-heart');heart.setAttribute('aria-hidden','true');life.append(heart);}
  card.append(number,name,badge,life);players.append(card);
 });root.append(players);

 const arena=node('section',undefined,'killer-arena');arena.setAttribute('aria-label','Killer dartbord');
 const board=svg('svg',{viewBox:'0 0 520 520',class:'killer-dartboard',role:'group','aria-label':'Dartbord. Kies een getal of tik op het getal bij een speler.'});
 board.append(svg('circle',{cx:260,cy:260,r:255,fill:'#0a141d',stroke:'#715293','stroke-width':2}));
 order.forEach((number,index)=>{
  const owner=preview.players.findIndex(p=>p.killerNumber===number),player=preview.players[owner],color=owner>=0?colors[owner]:null;
  const group=svg('g',{class:'killer-sector'+(owner>=0?' owned':'')+(owner===actor?' current':'')+(player?.killerEliminated?' eliminated':''),role:'button',tabindex:locked?-1:0,'aria-label':`${number}${player?' · '+player.name:''}`,'aria-disabled':String(locked),'data-number':number});
  if(color)group.style.setProperty('--sector-color',color);
  const start=index*18-9,end=start+18;
  for(const [inner,outer,ring] of [[24,118,'single'],[118,132,'triple'],[132,194,'single'],[194,210,'double']]){
   const style=getAppearance().board,base=style==='classic'?(ring==='single'?(index%2?'#ded4b5':'#171b20'):(index%2?'#248257':'#b84349')):style==='calm'?(ring==='single'?'#1b2b34':'#354b56'):index%2?'#49314f':'#30263d';
   group.append(svg('path',{d:sector(inner,outer,start,end),class:`killer-ring ${ring}`,fill:owner>=0?color:base,'fill-opacity':owner>=0?(ring==='single'?.62:.95):1,stroke:'#111c25','stroke-width':1.5}));
  }
  const pos=point(235,index*18),label=svg('text',{x:pos[0],y:pos[1],'text-anchor':'middle','dominant-baseline':'central',fill:color||'#c6c3cf'});label.textContent=String(number);group.append(label);
  const hit=()=>{if(!locked)actions.hit(number);};group.onclick=hit;group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();hit();}};board.append(group);
 });
 board.append(svg('circle',{cx:260,cy:260,r:23,fill:'#bc8cde',stroke:'#111c25','stroke-width':2}));
 const skull=svg('g',{'aria-hidden':true,fill:'#101c23'});skull.append(svg('path',{d:'M248 259a12 12 0 1 1 24 0v5l-5 3v6h-14v-6l-5-3z'}),svg('circle',{cx:255,cy:258,r:3,fill:'#ede2fa'}),svg('circle',{cx:265,cy:258,r:3,fill:'#ede2fa'}));board.append(skull);
 arena.append(board);const caption=node('div',undefined,'killer-board-caption');caption.append(node('strong',state.players[actor].name),node('span',assigning?'Kiest een eigen getal':`Doel ${state.players[actor].killerNumber} · ${ready(state.players[actor])?'aanvallen':'KILLER opbouwen'}`));arena.append(caption);root.append(arena);

 const controls=node('aside',undefined,'sonny-controls killer-controls');
 controls.append(node('strong',assigning?'Eigen getal kiezen':'Jouw worp','killer-controls-title'));
 const multipliers=node('div',undefined,'sonny-multipliers');
 for(const [mult,text] of [[1,'Single'],[2,'Double'],[3,'Triple']]){const el=button(text,()=>actions.setMultiplier(mult),mult===actions.multiplier?'selected':'');el.setAttribute('aria-pressed',String(mult===actions.multiplier));multipliers.append(el);}controls.append(multipliers);
 const darts=node('div',undefined,'sonny-darts');renderDartSlots(darts,pending,{editing:actions.editing,selected:actions.selectedDart,select:actions.select,placeholder:index=>assigning&&index>0?'—':`Pijl ${index+1}`});controls.append(darts);
 const row=node('div',undefined,'sonny-actions'),miss=button('MIS',actions.miss),remove=button('Wissen',actions.remove),confirm=button('Bevestigen',actions.confirm,'primary');miss.disabled=locked||assigning;remove.disabled=!pending.length;confirm.disabled=pending.length!==limit&&!(pending.length&&preview.phase==='won');row.append(miss,remove,confirm);controls.append(row);
 controls.append(node('p',assigning?'Elk getal van 1 tot 20 kan maar één speler hebben.':modern?'Single 1, dubbel 2, triple 3. Elke speler heeft drie levens.':'Tik op het bord of op een spelersgetal. Elke geraakte pijl telt één treffer.','killer-input-help'));root.append(controls);
}
