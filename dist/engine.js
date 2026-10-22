import {applyLivesDart} from './ten-lives.js';
export const targets = [...Array.from({length:20},(_,i)=>({label:`T${20-i}`,value:(20-i)*3,mult:3})),{label:'Bull',value:50,mult:2},...Array.from({length:20},(_,i)=>({label:`D${20-i}`,value:(20-i)*2,mult:2})),...Array.from({length:20},(_,i)=>({label:String(20-i),value:20-i,mult:1})),{label:'25',value:25,mult:1}];
const allowed=(mult,rule)=>rule==='single'||mult===2||(rule==='master'&&mult===3);
// Validate totals against the opening rule, bull setting and optional final dart.
export function validX01Total(state,score,n=3,finish=false){
 if(!Number.isInteger(score)||score<0||!Number.isInteger(n)||n<1||n>3)return false;
 const ts=[{value:0,mult:1},...targets.filter(t=>state.bull!=='50/50'||t.label!=='25')];
 const memo=new Map();
 function find(left,slots,opened){
  if(!slots)return left===0&&(!finish||opened);
  const key=`${left}/${slots}/${opened}`;if(memo.has(key))return memo.get(key);
  const result=ts.some(t=>{
   if(t.value>left||(!opened&&t.value&&!allowed(t.mult,state.inMode)))return false;
   if(finish&&slots===1&&(!t.value||!allowed(t.mult,state.out)))return false;
   return find(left-t.value,slots-1,opened||t.value>0);
  });memo.set(key,result);return result;
 }
 return find(score,n,state.players[state.active].opened);
}
export function possibleTotal(score,n=3){if(!Number.isInteger(score)||score<0||!Number.isInteger(n)||n<0||n>3||score>n*60)return false;if(n===0)return score===0;return [...new Set([0,...targets.map(t=>t.value)])].some(v=>v<=score&&possibleTotal(score-v,n-1));}
// Numeric routes transcribed from Winmau PDC Checkout Table, product X0872.
const preferredCheckouts=Object.fromEntries('41:9 D16;42:10 D16;43:3 D20;44:4 D20;45:13 D16;46:6 D20;47:7 D20;48:16 D16;49:17 D16;50:18 D16;51:19 D16;52:20 D16;53:13 D20;54:14 D20;55:15 D20;56:16 D20;57:17 D20;58:18 D20;59:19 D20;60:20 D20;61:T15 D8;62:T10 D16;63:T13 D12;64:T16 D8;65:T19 D4;66:T14 D12;67:T17 D8;68:T20 D4;69:T19 D6;70:T18 D8;71:T13 D16;72:T16 D12;73:T19 D8;74:T14 D16;75:T17 D12;76:T20 D8;77:T19 D10;78:T18 D12;79:T19 D11;80:T20 D10;81:T19 D12;82:Bull D16;83:T17 D16;84:T20 D12;85:T15 D20;86:T18 D16;87:T17 D18;88:T20 D14;89:T19 D16;90:T20 D15;91:T17 D20;92:T20 D16;93:T19 D18;94:T18 D20;95:T19 D19;96:T20 D18;97:T19 D20;98:T20 D19;99:T19 10 D16;100:T20 D20;101:T20 9 D16;102:T16 14 D20;103:T19 6 D20;104:T16 16 D20;105:T20 13 D16;106:T20 6 D20;107:T19 10 D20;108:T20 16 D16;109:T20 17 D16;110:T20 10 D20;111:T19 14 D20;112:T20 20 D16;113:T19 16 D20;114:T20 14 D20;115:T20 15 D20;116:T20 16 D20;117:T20 17 D20;118:T20 18 D20;119:T19 12 Bull;120:T20 20 D20;121:T20 11 Bull;122:T18 18 Bull;123:T19 16 Bull;124:T20 14 Bull;125:25 T20 D20;126:T19 19 Bull;127:T20 17 Bull;128:18 T20 Bull;129:19 T20 Bull;130:T20 20 Bull;131:T20 T13 D16;132:25 T19 Bull;133:T20 T19 D8;134:T20 T14 D16;135:25 T20 Bull;136:T20 T20 D8;137:T20 T19 D10;138:T20 T18 D12;139:T19 T14 D20;140:T20 T20 D10;141:T20 T19 D12;142:T20 T14 D20;143:T20 T17 D16;144:T20 T20 D12;145:T20 T15 D20;146:T20 T18 D16;147:T20 T17 D18;148:T20 T20 D14;149:T20 T19 D16;150:T20 T18 D18;151:T20 T17 D20;152:T20 T20 D16;153:T20 T19 D18;154:T20 T18 D20;155:T20 T19 D19;156:T20 T20 D18;157:T20 T19 D20;158:T20 T20 D19;160:T20 T20 D20;161:T20 T17 Bull;164:T20 T18 Bull;167:T20 T19 Bull;170:T20 T20 Bull'.split(';').map(row=>{const [score,route]=row.split(':');return [score,route.split(' ')];}));
// Below 41: direct doubles, otherwise single to a repeatedly splittable double.
for(let score=2;score<=40;score++){if(score%2===0)preferredCheckouts[score]=['D'+score/2];else{const double=[16,8,4,2,1].find(d=>score-2*d>=1&&score-2*d<=20);preferredCheckouts[score]=[String(score-2*double),'D'+double];}}
const checkoutLabels=route=>route.map(label=>/^\d+$/.test(label)?'S'+label:label);
export function checkout(score,out='double',n=3,bull='25/50'){
 if(score<1||score>n*60)return null;
 const ts=targets.filter(t=>bull!=='50/50'||t.label!=='25');
 const preferred=out==='double'?preferredCheckouts[score]:null;
 if(preferred&&preferred.length<=n&&preferred.every(label=>ts.some(t=>t.label===label)))return checkoutLabels(preferred);
 for(let length=1;length<=n;length++){const find=(left,slots)=>{if(slots===1){const t=ts.find(t=>t.value===left&&allowed(t.mult,out));return t?[t.label]:null;}for(const t of ts){if(t.value>=left)continue;const rest=find(left-t.value,slots-1);if(rest)return [t.label,...rest];}return null;};const route=find(score,length);if(route)return checkoutLabels(route);}
 return null;
}
// Use the first dart of the full checkout chart as a setup, never as a finish.
export function setupShot(score,out='double',n=1,bull='25/50'){
 if(n!==1||checkout(score,out,n,bull))return null;
 const route=checkout(score,out,3,bull);
 if(!route||route.length<2)return null;
 const label=route[0],value=label==='Bull'?50:Number(label.slice(1))*({S:1,D:2,T:3}[label[0]]);
 return {label,remaining:score-value,next:route.slice(1)};
}
export function newMatch(names,start=501,out='double',legs=3,options={}){
 if(options.game==='tenlives'){
  if(names.length<1||names.length>4)throw Error('Kies 1 tot 4 spelers.');
  if(!['double','triple'].includes(options.livesMode))throw Error('Kies Doubles of Triples.');
  start=10;legs=1;options={...options,inMode:'single',matchMode:'legs',maxRounds:0,bull:'25/50'};
 }
 if(options.game==='bobs27'){
  if(names.length<1||names.length>4)throw Error("Kies 1 tot 4 spelers voor Bob's 27.");
  start=27;out='double';legs=1;options={...options,inMode:'single',matchMode:'legs',maxRounds:0,bull:'25/50',starter:options.starter||0,bobsTarget:1,bobsRoundPlayed:[]};
 }
 if(options.game==='gotcha'){if(names.length<2)throw Error('Gotcha heeft minimaal twee spelers nodig.');if(![301,401,501,601,701].includes(start))throw Error('Ongeldige Gotcha-doelscore.');if(!['single','double','master'].includes(out))throw Error('Ongeldige finishregel.');legs=1;options={...options,inMode:'single',matchMode:'legs',maxRounds:0,bull:'25/50'};}
 if(options.training121){
  if(names.length<1||names.length>4)throw Error('Kies 1 tot 4 spelers.');
  start=121;out='double';legs=999999;options={...options,game:'x01',inMode:'single',matchMode:'legs',bull:'25/50',maxRounds:0,starter:options.starter||0,trainingDarts:0,trainingBest:121};
 }
 const config={game:'x01',inMode:'single',scoring:'standard',matchMode:'legs',legsPerSet:3,bull:'25/50',maxRounds:50,starter:0,...options};
 const numbers=config.game==='tactics'?[20,19,18,17,16,15,14,13,12,11,10,25]:[20,19,18,17,16,15,25];
 return {version:2,...config,start,out,target:legs,numbers,players:names.map(name=>({name,...(config.game==='tenlives'?{lives:10,livesTarget:20,attempts:3,livesHits:0}:{}),...(options.training121?{trainingLevel:121,trainingBest:121}:{}),...(config.game==='bobs27'?{bobsHits:0,bobsHighest:0,bobsEliminated:false}:{}),remaining:config.game==='gotcha'?0:start,legs:0,sets:0,setLegs:0,points:0,darts:0,best:0,opened:config.inMode==='single',marks:{},cricketPoints:0,totalMarks:0})),active:config.starter,starter:config.starter,leg:1,round:1,turns:0,set:1,history:[],phase:'playing',winner:null};
}
function win(s,index,reason='finish'){
 s.winner=index;s.reason=reason;const p=s.players[index];p.legs++;p.setLegs++;
 if(s.matchMode==='sets'&&p.setLegs>=s.legsPerSet){p.sets++;s.setComplete=true;}
 s.phase=s.matchMode==='off'?'leg':(s.matchMode==='sets'?p.sets:p.legs)>=s.target?'won':'leg';
}
function advance(s){
 s.turns++;s.active=(s.active+1)%s.players.length;s.round=Math.floor(s.turns/s.players.length)+1;
 if(s.maxRounds&&s.turns>=s.maxRounds*s.players.length&&s.turns%s.players.length===0){
  const rank=p=>s.game==='x01'?-p.remaining:s.scoring==='no-score'?s.numbers.reduce((n,t)=>n+(p.marks[t]||0),0):s.scoring==='cut-throat'?-p.cricketPoints:p.cricketPoints;
  const best=Math.max(...s.players.map(rank)),leaders=s.players.map((p,i)=>rank(p)===best?i:-1).filter(i=>i>=0);
  if(leaders.length===1)win(s,leaders[0],'round-limit');else s.tiebreak=true;
 }
}
export function makeDart(number,mult=1){
 if(!Number.isInteger(number)||!Number.isInteger(mult)||![1,2,3].includes(mult)||(![0,25].includes(number)&&(number<1||number>20))||(number===25&&mult===3)||(number===0&&mult!==1))throw Error('Ongeldige pijl.');
 return {number,mult,label:number===0?'Mis':number===25?(mult===2?'Bull':'25'):(mult===1?'':mult===2?'D':'T')+number};
}
export function previewTurn(state,hits=[]){
 const p=state.players[state.active];let remaining=p.remaining,opened=p.opened,bust=false,finished=false,used=0;
 for(const hit of hits){
  const d=makeDart(hit.number,hit.mult);used++;
  if(!opened&&d.number!==0&&allowed(d.mult,state.inMode))opened=true;
  if(opened){remaining-=d.number===25&&state.bull==='50/50'?50:d.number*d.mult;
   bust=remaining<0||(state.out!=='single'&&remaining===1)||(remaining===0&&!allowed(d.mult,state.out));
   finished=remaining===0&&!bust;
  }
  if(bust||finished)break;
 }
 if(bust){remaining=p.remaining;opened=p.opened;}
 const dartsLeft=Math.max(0,3-used);
 return {remaining,opened,bust,finished,dartsLeft,route:!bust&&!finished&&opened&&dartsLeft?checkout(remaining,state.out,dartsLeft,state.bull):null};
}
function applyCricketDart(s,d){
 const p=s.players[s.active];let marks=0,credited=0,finished=false;
 if(s.numbers.includes(d.number)){
  const prior=p.marks[d.number]||0,closing=Math.min(3-prior,d.mult),excess=d.mult-closing;
  const opponents=s.players.filter((other,j)=>j!==s.active&&(other.marks[d.number]||0)<3);
  p.marks[d.number]=prior+closing;marks+=closing;
  if(opponents.length&&s.scoring!=='no-score'){marks+=excess;const points=excess*d.number;credited+=points;if(s.scoring==='cut-throat')opponents.forEach(o=>o.cricketPoints+=points);else p.cricketPoints+=points;}
  finished=s.numbers.every(t=>(p.marks[t]||0)===3)&&(s.scoring==='no-score'||s.players.every(o=>s.scoring==='cut-throat'?p.cricketPoints<=o.cricketPoints:p.cricketPoints>=o.cricketPoints));
 }
 return {marks,credited,finished};
}
export function previewCricket(state,hits=[]){
 const s=structuredClone(state);let used=0,finished=false;
 for(const hit of hits){if(finished)break;const d=makeDart(hit.number,hit.mult);used++;finished=applyCricketDart(s,d).finished;}
 return {players:s.players,finished,used};
}
export function previewBobs27(state,hits=[]){
 const target=state.bobsTarget,value=target===25?50:target*2;
 const darts=hits.map(d=>makeDart(d.number,d.mult));
 const targetHits=darts.filter(d=>d.number===target&&d.mult===2).length;
 const complete=darts.length===3,delta=complete?(targetHits?targetHits*value:-value):targetHits*value;
 const score=state.players[state.active].remaining+delta;
 return {target,value,hits:targetHits,used:darts.length,delta,score,complete,eliminated:complete&&score<=0,finished:complete&&target===25&&score>0};
}
export function applyTurn(state,turn){
 if(state.game==='tenlives')return applyLivesDart(state,turn);
 if(state.game==='bobs27')return applyBobs27Turn(state,turn);
 if(state.game==='gotcha')return applyGotchaTurn(state,turn);
 if(state.training121)return applyTrainingTurn(state,turn);
 if(state.phase!=='playing')throw Error('Deze leg is al afgelopen.');
 const s=structuredClone(state),p=s.players[s.active];
 if(turn.hits){
  if(!Array.isArray(turn.hits)||turn.hits.length<1||turn.hits.length>3)throw Error('Voer één tot drie pijlen in.');
  const hits=turn.hits.map(d=>makeDart(d.number,d.mult));let bust=false,finished=false,credited=0,marks=0;
  for(let i=0;i<hits.length;i++){
   const d=hits[i];
   if(s.game==='x01'){
    const value=d.number===25&&s.bull==='50/50'?50:d.number*d.mult;
    if(!p.opened&&d.number!==0&&allowed(d.mult,s.inMode))p.opened=true;
    if(p.opened){p.remaining-=value;credited+=value;bust=p.remaining<0||(s.out!=='single'&&p.remaining===1)||(p.remaining===0&&!allowed(d.mult,s.out));finished=p.remaining===0&&!bust;}
   }else if(s.numbers.includes(d.number)){
    const result=applyCricketDart(s,d);marks+=result.marks;credited+=result.credited;finished=result.finished;
   }
   if(bust||finished){if(i!==hits.length-1)throw Error('De beurt eindigde eerder. Wis de extra pijlen.');break;}
  }
  if(!bust&&!finished&&hits.length!==3)throw Error('Voer alle drie de pijlen in, of tik Mis.');
  if(bust){p.remaining=state.players[s.active].remaining;p.opened=state.players[s.active].opened;credited=0;}
  const darts=bust?3:hits.length;p.darts+=darts;p.points+=credited;p.totalMarks+=marks;p.best=Math.max(p.best,s.game==='x01'?credited:marks);
  s.history.push({input:structuredClone(turn),name:p.name,score:credited,marks,bust,remaining:p.remaining,leg:s.leg,darts,labels:hits.map(d=>d.label).join(' · ')});
  if(finished)win(s,s.active);else advance(s);return s;
 }
 if(s.game!=='x01')throw Error('Gebruik voor deze spelinstellingen invoer per pijl.');
 const {score,darts=3,forceBust=false}=turn;
 if(!Number.isInteger(darts)||darts<1||darts>3||!possibleTotal(score,darts))throw Error('Deze score is niet mogelijk met dit aantal pijlen.');
 if(!forceBust&&!validX01Total(s,score,darts))throw Error('Deze score is niet mogelijk met de gekozen openingsregel of bull-instelling.');
 const remaining=p.remaining-score,bust=forceBust||remaining<0||(s.out!=='single'&&remaining===1);
 if(!bust&&remaining===0&&!validX01Total(s,score,darts,true))throw Error('Deze finish is niet mogelijk met dit aantal pijlen en de gekozen in-/uitregel.');
 if(!bust&&remaining!==0&&darts!==3)throw Error('Een gewone beurt telt drie pijlen.');
 const credited=bust?0:score;p.points+=credited;p.darts+=bust?3:darts;p.best=Math.max(p.best,credited);if(!bust){p.remaining=remaining;if(score>0)p.opened=true;}
 s.history.push({input:structuredClone(turn),name:p.name,score:credited,bust,remaining:p.remaining,leg:s.leg,darts:bust?3:darts});
 if(!bust&&remaining===0)win(s,s.active);else advance(s);return s;
}
function applyBobs27Turn(state,turn){
 if(state.phase!=='playing')throw Error("Deze Bob's 27-training is afgelopen.");
 if(!Array.isArray(turn.hits)||turn.hits.length!==3)throw Error('Voer alle drie de pijlen in, of tik Mis.');
 const result=previewBobs27(state,turn.hits),s=structuredClone(state),current=state.active,p=s.players[current];
 p.remaining=result.score;p.darts+=3;p.bobsHits=(p.bobsHits||0)+result.hits;
 if(result.hits)p.bobsHighest=result.target;
 p.best=Math.max(p.best,result.hits);
 if(result.eliminated)p.bobsEliminated=true;
 s.history.push({input:structuredClone(turn),name:p.name,score:result.delta,remaining:p.remaining,leg:1,darts:3,
  target:result.target,hits:result.hits,labels:turn.hits.map(d=>makeDart(d.number,d.mult).label).join(' / ')});
 s.turns++;s.bobsRoundPlayed=[...(state.bobsRoundPlayed||[])];s.bobsRoundPlayed[current]=true;
 const survivors=s.players.map((player,i)=>!player.bobsEliminated?i:-1).filter(i=>i>=0);
 if(!survivors.length){s.phase='won';s.winner=null;s.reason='bobs-eliminated';return s;}
 const waiting=survivors.filter(i=>!s.bobsRoundPlayed[i]);
 const nextFrom=(list,from)=>[...Array(s.players.length)].map((_,step)=>(from+step+1)%s.players.length).find(i=>list.includes(i));
 if(waiting.length){s.active=nextFrom(waiting,current);return s;}
 if(result.target===25){
  const best=Math.max(...survivors.map(i=>s.players[i].remaining));
  const leaders=survivors.filter(i=>s.players[i].remaining===best);
  s.phase='won';s.winner=leaders.length===1?leaders[0]:null;s.reason=leaders.length===1?'bobs-complete':'bobs-tie';return s;
 }
 s.bobsTarget=result.target===20?25:result.target+1;s.round++;s.bobsRoundPlayed=[];
 s.active=nextFrom(survivors,(s.starter+s.players.length-1)%s.players.length);
 return s;
}
export function previewGotcha(state,hits=[]){
 const players=structuredClone(state.players),p=players[state.active],resets=[];let bust=false,finished=false,used=0,score=0;
 for(const hit of hits){
  if(bust||finished)break;
  const d=makeDart(hit.number,hit.mult),value=d.number*d.mult;used++;p.remaining+=value;score+=value;
  if(p.remaining>state.start||(state.out!=='single'&&state.start-p.remaining===1)||(p.remaining===state.start&&!allowed(d.mult,state.out))){bust=true;p.remaining=state.players[state.active].remaining;score=0;break;}
  if(value>0)players.forEach((other,i)=>{if(i!==state.active&&other.remaining>0&&other.remaining===p.remaining){other.remaining=0;resets.push(i);}});
  finished=p.remaining===state.start;
 }
 return {players,resets,bust,finished,used,score};
}
function applyGotchaTurn(state,turn){
 if(state.phase!=='playing')throw Error('Deze partij is afgelopen.');
 if(!turn.hits)return applyGotchaTotal(state,turn);
 if(!Array.isArray(turn.hits)||turn.hits.length<1||turn.hits.length>3)throw Error('Voer Gotcha per pijl in.');
 const preview=previewGotcha(state,turn.hits);
 if(preview.used!==turn.hits.length)throw Error('De beurt eindigde eerder. Wis de extra pijlen.');
 if(!preview.bust&&!preview.finished&&preview.used!==3)throw Error('Voer alle drie de pijlen in, of tik Mis.');
 const s=structuredClone(state);s.players=preview.players;const p=s.players[s.active],darts=preview.bust?3:preview.used;
 p.darts+=darts;p.points+=preview.score;p.best=Math.max(p.best,preview.score);
 s.history.push({input:structuredClone(turn),name:p.name,score:preview.score,bust:preview.bust,remaining:p.remaining,leg:s.leg,darts,labels:turn.hits.map(d=>makeDart(d.number,d.mult).label).join(' / '),resets:preview.resets});
 if(preview.finished)win(s,s.active);else advance(s);return s;
}
function applyGotchaTotal(state,turn){
 const {score,darts=3,forceBust=false}=turn;
 if(!Number.isInteger(darts)||darts<1||darts>3||!possibleTotal(score,darts))throw Error('Deze score is niet mogelijk met dit aantal pijlen.');
 const s=structuredClone(state),p=s.players[s.active],end=p.remaining+score;
 const bust=forceBust||end>s.start||(s.out!=='single'&&end===s.start-1);
 const finished=!bust&&end===s.start;
 if(finished&&!checkout(score,s.out,darts))throw Error('Deze finish is niet mogelijk met dit aantal pijlen.');
 if(!bust&&!finished&&darts!==3)throw Error('Een gewone beurt telt drie pijlen.');
 const manual=turn.gotchaRule==='manual',resets=[];
 if(manual){
  if(!Array.isArray(turn.resets))throw Error('Geef de geraakte tegenstanders aan.');
  for(const i of turn.resets){
   if(!Number.isInteger(i)||i<0||i>=s.players.length||i===s.active||s.players[i].remaining<=0)throw Error('Ongeldige Gotcha-treffer.');
   if(!resets.includes(i))resets.push(i);
  }
 }
 if(!bust&&score>0)s.players.forEach((other,i)=>{if(i!==s.active&&other.remaining>0&&other.remaining===end&&!resets.includes(i))resets.push(i);});
 resets.forEach(i=>s.players[i].remaining=0);
 const credited=bust?0:score,used=bust?3:darts;
 if(!bust)p.remaining=end;
 p.points+=credited;p.darts+=used;p.best=Math.max(p.best,credited);
 s.history.push({input:structuredClone(turn),name:p.name,score:credited,bust,remaining:p.remaining,leg:s.leg,darts:used,resets});
 if(finished)win(s,s.active);else advance(s);return s;
}
function applyTrainingTurn(state,turn){
 if(state.phase!=='playing')throw Error('Deze poging is afgelopen.');
 const result=applyTurn({...state,training121:false},turn);
 const used=state.trainingDarts+result.players[state.active].darts-state.players[state.active].darts;
 if(used>9)throw Error('Je hebt maximaal negen darts per poging.');
 const success=result.players[state.active].remaining===0;
 result.training121=true;result.trainingDarts=used;result.active=state.active;
 if(success||used===9){
  const bonus=success?10-used:-1;
  result.trainingNext=Math.max(121,state.start+bonus);
  result.trainingChange=result.trainingNext-state.start;
  result.trainingSuccess=success;result.trainingBest=Math.max(state.trainingBest||121,result.trainingNext);
  result.players[state.active].trainingLevel=result.trainingNext;result.players[state.active].trainingBest=Math.max(state.players[state.active].trainingBest||state.trainingBest||121,result.trainingNext);
  result.phase='leg';result.winner=success?state.active:null;
  result.reason=success?'training-finish':'training-limit';
 }
 return result;
}
export function nextLeg(state){
 if(state.training121){
  if(state.phase!=='leg')throw Error('Deze poging is nog niet afgelopen.');
  const s=structuredClone(state);s.players[s.active].remaining=s.trainingNext;s.players[s.active].trainingLevel=s.trainingNext;s.players[s.active].trainingBest=state.players[state.active].trainingBest||state.trainingBest||121;s.active=(s.active+1)%s.players.length;s.starter=s.active;const p=s.players[s.active];s.start=p.trainingLevel||121;p.remaining=s.start;p.opened=true;s.trainingBest=p.trainingBest||121;s.trainingDarts=0;s.leg++;s.round=1;s.turns=0;s.phase='playing';s.winner=null;s.reason=null;delete s.trainingNext;delete s.trainingChange;delete s.trainingSuccess;return s;
 }
 if(state.phase!=='leg')throw Error('Geen volgende leg beschikbaar.');
 const s=structuredClone(state);s.leg++;s.starter=(s.starter+1)%s.players.length;s.active=s.starter;s.round=1;s.turns=0;s.tiebreak=false;
 if(s.setComplete){s.set++;s.players.forEach(p=>p.setLegs=0);s.setComplete=false;}
 s.players.forEach(p=>{p.remaining=s.start;p.opened=s.inMode==='single';p.marks={};p.cricketPoints=0;});s.phase='playing';s.winner=null;s.reason=null;return s;
}

export function playerStats(state,index){
 const p=state.players[index];
 const visits=state.history.filter(h=>h.leg===state.leg);
 const own=visits.filter((h,i)=>state.training121?state.active===index:(state.starter+i)%state.players.length===index);
 const legDarts=own.reduce((n,h)=>n+h.darts,0);
 const legPoints=own.reduce((n,h)=>n+(state.game!=='cricket'&&state.game!=='tactics'?h.score:(h.marks||0)),0);
 const points=state.game!=='cricket'&&state.game!=='tactics'?p.points:p.totalMarks;
 return {legDarts,gameDarts:p.darts,legAverage:legDarts?legPoints/legDarts*3:null,gameAverage:p.darts?points/p.darts*3:null};
}
