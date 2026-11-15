import {botDart,botVisit,botLevel,botDifficulty} from './bot.js';
let panel;
// Hitters Challenge commits every physical dart immediately. Reconstruct the
// current group from that shared history so a new revision does not erase the
// preceding slots, including after a reload or controller takeover.
export function botDisplayDarts(state,pending=[]){
 if(state?.game!=='tenlives')return pending;
 const recent=[],history=state.history||[];let recorded=0;
 for(let index=history.length-1;index>=0;index--){
  const turn=history[index];if(turn.player!==state.active||!turn.input?.botDart||(recorded&&turn.ended))break;
  recorded++;if(recent.length<3)recent.unshift(turn);
 }
 if(!recent.length)return pending;
 const ended=recent.at(-1).ended,count=recorded%3;
 const confirmed=pending.length&&ended?[]:recent.slice(-(count||3));
 // A fourth dart starts a new group; keep all three visible until it arrives.
 return [...(pending.length&&!count?[]:confirmed.map(turn=>turn.input.botDart)),...pending].slice(0,3);
}
export function paintBot(state,hits=[],correcting=false){
 const playing=!correcting&&state?.phase==='playing'&&!!botLevel(state.players[state.active]);
 document.body.classList.toggle('bot-turn',playing);
 if(!panel){panel=document.createElement('section');panel.id='bot-status';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');document.getElementById('game').prepend(panel);const css=document.createElement('link');css.rel='stylesheet';css.href='bot.css';document.head.append(css);}
 panel.hidden=!playing;if(!playing)return;
 panel.replaceChildren();const label=document.createElement('strong'),name=document.createElement('b'),level=document.createElement('small'),difficulty=botDifficulty(state);
 name.textContent=`${state.players[state.active].name} gooit`;level.textContent=`Niveau ${difficulty.level.toLocaleString('nl-NL',{maximumFractionDigits:1})} · basis ${difficulty.base}`;
 label.title=difficulty.adaptive?`Bijgestuurd op ${difficulty.reference.toFixed(2)} ${difficulty.metric} van de sterkste menselijke speler (${difficulty.samples} darts).`:'Basisniveau; bijsturing start na negen darts van een menselijke speler in X01, 121, Gotcha, Cricket en Tactics.';
 label.append(name,level);panel.append(label);
 const shown=botDisplayDarts(state,hits);
 for(let index=0;index<3;index++){const dart=document.createElement('span');dart.textContent=shown[index]?.label||`Pijl ${index+1}`;dart.setAttribute('aria-label',`Pijl ${index+1}${shown[index]?': '+shown[index].label:''}`);dart.className=shown[index]?'thrown':index===shown.length?'aiming':'';panel.append(dart);}
}
// The server lease makes the NUC and its controllers a single bot executor.
// Every visible dart is saved before proceeding; reconnects resume that draft.
export function startBots(adapter,{delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,interval=400}={}){
 let running=false,stopped=false,retryAt=0;
 const eligible=()=>{const value=adapter.current();return value.ready&&value.allowed&&value.state?.phase==='playing'&&botLevel(value.state.players[value.state.active])&&!value.correcting&&!document.hidden&&!document.querySelector('dialog[open]')&&document.getElementById('setup').hidden;};
 async function tick(){
  if(stopped||running||Date.now()<retryAt||!eligible())return;
  running=true;const base=adapter.current(),state=structuredClone(base.state),revision=base.revision;
  const same=()=>!stopped&&eligible()&&adapter.current().revision===revision;
  const claim=async()=>{if(!same())return null;const response=await fetch('/api/bot/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,owner:adapter.owner}),signal:AbortSignal.timeout(4000)});if(!response.ok)return null;const value=await response.json();return value.granted?value:null;};
  try{
   const acquired=await claim();if(!acquired)return;
   let hits=structuredClone(acquired.draft?.revision===revision?acquired.draft.hits||[]:[]);
   for(let attempt=0;attempt<100&&same();attempt++){
    let turn=hits.length?botVisit(state,hits):null;
    if(turn){await delay(800+random()*500);if(!same()||!await claim())return;await adapter.commit(turn);return;}
    // Killer's assignment is a single physical dart, retried when invalid.
    if(state.game==='killer'&&state.killerStage==='assigning'&&hits.length){await delay(1000);hits=[];}
    await delay((hits.length?1300:1000)+random()*700);
    if(!same()||!await claim())return;
    hits.push(botDart(state,hits,random));
    if(!await adapter.publish(hits))return;
   }
  }catch(error){adapter.error?.(error);retryAt=Date.now()+3000;}
  finally{running=false;}
 }
 const timer=setInterval(()=>void tick(),interval);
 return {tick,stop:()=>{stopped=true;clearInterval(timer);}};
}
