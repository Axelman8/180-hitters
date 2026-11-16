// Shared, DOM-free rules for manual input, camera darts, bots and online lanes.
export const partyIds=['seabattle','golf','shanghai'];
export const partyNames={seabattle:'Zeeslag Darts',golf:'Dartgolf',shanghai:'Shanghai'};
export function resetSeaFleets(state,random=Math.random){
 state.seaFog=false;
 for(const p of state.players){
  const fleet=Array(20).fill(0);
  for(const [id,length] of [[1,3],[2,2],[3,2]]){
   const candidates=[];
   for(let start=0;start<20;start++)for(const step of [1,5]){
    const cells=Array.from({length},(_,n)=>start+step*n);
    if(cells.every(cell=>cell<20&&!fleet[cell]&&(step!==1||Math.floor(cell/5)===Math.floor(start/5))))candidates.push(cells);
   }
   const cells=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
   if(!cells)throw Error('Vloot kon niet worden geplaatst.');cells.forEach(cell=>fleet[cell]=id);
  }
  Object.assign(p,{seaFleet:fleet,seaShots:Array(20).fill(0),seaHull:Array(20).fill(0),seaRemaining:14,seaDamage:0,seaFired:Array(20).fill(0),seaEliminated:false});
 }
 return state;
}
export function initParty(state,options={}){
 if(state.game==='seabattle')return resetSeaFleets(state);
 if(state.game==='golf'){state.golfHoles=Number(options.golfHoles)===18?18:9;state.golfScoring=options.golfScoring==='last'?'last':'best';state.players.forEach(p=>Object.assign(p,{golfStrokes:0,golfScores:[]}));}
 if(state.game==='shanghai'){state.shanghaiRounds=Number(options.shanghaiRounds)===20?20:7;state.players.forEach(p=>Object.assign(p,{shanghaiPoints:0,shanghaiScores:[]}));}
 state.partyTarget=1;state.partyRoundPlayed=[];return state;
}
export function seaSunk(player){return [1,2,3].filter(id=>player.seaFleet.filter((value,cell)=>value===id&&player.seaHull[cell]>=2).length>=({1:3,2:2,3:2}[id])).length;}
export function seaCell(hit){return hit.number>=1&&hit.number<=20?hit.number-1:-1;}
export function golfStroke(hit,target){return hit.number!==target?5:hit.mult===2?1:hit.mult===3?2:3;}
const label=d=>d.number===0?'Mis':d.number===25?(d.mult===2?'BB':'sB'):(d.mult===1?'':d.mult===2?'D':'T')+d.number;
function cleanHit(raw){
 const {number,mult}=raw||{};
 if(!Number.isInteger(number)||!Number.isInteger(mult)||![1,2,3].includes(mult)||(![0,25].includes(number)&&(number<1||number>20))||(number===25&&mult===3)||(number===0&&mult!==1))throw Error('Ongeldige pijl.');
 return {number,mult,label:label(raw),...(Array.isArray(raw.seaShips)?{seaShips:[...raw.seaShips]}:{})};
}
function winner(state,field,low=false){const values=state.players.map(p=>p[field]),best=(low?Math.min:Math.max)(...values),leaders=values.map((v,i)=>v===best?i:-1).filter(i=>i>=0);state.winner=leaders.length===1?leaders[0]:null;state.phase='won';}
function advance(state,actor){
 if(state.game==='seabattle'){for(let n=1;n<=state.players.length;n++){const next=(actor+n)%state.players.length;if(!state.players[next].seaEliminated){state.active=next;break;}}state.round++;return;}
 state.partyRoundPlayed.push(actor);
 if(state.partyRoundPlayed.length===state.players.length){
  if(state.partyTarget===(state.game==='golf'?state.golfHoles:state.shanghaiRounds)){winner(state,state.game==='golf'?'golfStrokes':'shanghaiPoints',state.game==='golf');return;}
  state.partyTarget++;state.round=state.partyTarget;state.partyRoundPlayed=[];
 }
 state.active=(actor+1)%state.players.length;
}
export function applyPartyTurn(state,turn){
 if(state.phase!=='playing')throw Error('Deze partij is al afgelopen.');
 if(!Array.isArray(turn.hits)||!turn.hits.length||turn.hits.length>3)throw Error('Voer één tot drie pijlen in.');
 const hits=turn.hits.map(cleanHit),s=structuredClone(state),actor=s.active,p=s.players[actor],used=[];let score=0;
 for(const hit of hits){
  used.push(hit);
  if(s.game==='seabattle'){
   const cell=seaCell(hit);if(cell<0)continue;p.seaFired[cell]++;
   for(const [index,victim] of s.players.entries()){
    if(index===actor||victim.seaEliminated)continue;
    let ship=victim.seaFleet[cell];
    if(s.seaFog){ship=hit.seaShips?.[index];if(!Number.isInteger(ship)||ship<0||ship>3)throw Error('Wacht op de online uitkomst van deze pijl.');victim.seaFleet[cell]=ship;}
    victim.seaShots[cell]++;
    if(ship){const damage=Math.min(2-victim.seaHull[cell],hit.mult);victim.seaHull[cell]+=damage;victim.seaRemaining-=damage;p.seaDamage+=damage;score+=damage;}
    if(victim.seaRemaining===0)victim.seaEliminated=true;
   }
   if(s.players.filter(other=>!other.seaEliminated).length===1){s.winner=actor;s.phase='won';break;}
  }else if(s.game==='shanghai'){
   if(hit.number===s.partyTarget)score+=hit.number*hit.mult;
   if([1,2,3].every(mult=>used.some(d=>d.number===s.partyTarget&&d.mult===mult))){s.winner=actor;s.phase='won';s.shanghaiFinish=true;break;}
  }
 }
 if(s.game==='golf'){
  const strokes=used.map(hit=>golfStroke(hit,s.partyTarget));score=s.golfScoring==='last'?strokes[strokes.length-1]:Math.min(...strokes);
  p.golfStrokes+=score;p.golfScores.push(score);
 }else if(s.game==='shanghai'){p.shanghaiPoints+=score;p.shanghaiScores.push(score);}
 if(s.phase==='playing'&&used.length!==3&&!(s.game==='golf'&&s.golfScoring==='last'))throw Error('Voer alle drie de pijlen in.');
 p.darts+=used.length;p.points+=s.game==='golf'?0:score;p.best=Math.max(p.best,score);
 s.history.push({input:{hits:used},name:p.name,player:actor,leg:1,darts:used.length,score,target:s.partyTarget??null,role:s.game==='golf'?`Hole ${s.partyTarget}`:s.game==='shanghai'?`Doel ${s.partyTarget}`:'Aanval',labels:used.map(label).join(' / ')});s.turns++;
 if(s.phase==='playing')advance(s,actor);return s;
}
export function partyAutoCommit(state,hits){if(hits.length===3)return true;if(state.game==='seabattle'&&hits.length){try{return applyPartyTurn(state,{hits}).phase==='won';}catch{}}return false;}
export function previewParty(state,hits){if(!hits.length)return state;try{if(state.game==='golf'&&state.golfScoring==='last')return applyPartyTurn(state,{hits});return applyPartyTurn(state,{hits:[...hits,...Array.from({length:3-hits.length},()=>({number:0,mult:1}))]});}catch{return state;}}
// The relay keeps full fleets privately. Only one's own and attacked cells leave it.
export function seaPublicMatch(match,role=-1,revealFinished=true){
 const result=structuredClone(match);if(result.state?.game!=='seabattle')return result;
 result.undo=[];result.future=[];result.state.seaFog=true;
 result.state.players.forEach((p,index)=>{p.seaFleet=p.seaFleet.map((ship,cell)=>index===role||p.seaShots[cell]>0||revealFinished&&result.state.phase==='won'?ship:null);});
 return result;
}
