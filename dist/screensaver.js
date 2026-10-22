import {clearEffect} from './celebration.js';
const saver=document.createElement('dialog');saver.id='club-saver';saver.setAttribute('aria-label','Screensaver VTV de Venhoeve Rotterdam');
saver.innerHTML=`
 <img class="club-photo" src="club-background.jpg" alt="Het clubgebouw van VTV de Venhoeve">
 <div class="club-shade"></div>
 <button type="button" class="club-back">← Terug</button>
 <div class="club-center">
  <svg class="club-patch" viewBox="0 0 600 600" role="img" aria-labelledby="club-patch-title">
   <title id="club-patch-title">Dartvereniging VTV de Venhoeve Rotterdam</title>
   <defs>
    <linearGradient id="club-gold" x2="1" y2="1"><stop stop-color="#f8e4a0"/><stop offset=".5" stop-color="#ccaa58"/><stop offset="1" stop-color="#f8e4a0"/></linearGradient>
    <radialGradient id="club-green"><stop stop-color="#254e43"/><stop offset="1" stop-color="#0a211f"/></radialGradient>
    <clipPath id="club-logo-clip"><circle cx="300" cy="300" r="187"/></clipPath>
    <path id="club-top-arc" d="M 85,305 A 215,215 0 0,1 515,305"/>
    <path id="club-bottom-arc" d="M 85,316 A 215,215 0 0,0 515,316"/>
   </defs>
   <circle cx="300" cy="300" r="280" fill="url(#club-green)" stroke="url(#club-gold)" stroke-width="9"/>
   <circle cx="300" cy="300" r="263" fill="none" stroke="#f0d890" stroke-width="2" stroke-dasharray="3 7"/>
   <image href="club-logo.png" x="110" y="110" width="380" height="380" opacity=".24" clip-path="url(#club-logo-clip)"/>
   <circle cx="300" cy="300" r="190" fill="none" stroke="#c4a762" stroke-width="2"/>
   <text fill="#f7e2a2" font-size="27" font-weight="700" letter-spacing="4"><textPath href="#club-top-arc" startOffset="50%" text-anchor="middle">DARTVERENIGING</textPath></text>
   <text fill="#f7e2a2" font-size="32" font-weight="750" letter-spacing="6"><textPath href="#club-bottom-arc" startOffset="50%" text-anchor="middle">ROTTERDAM</textPath></text>

   <path d="M210 396H390" stroke="#d5bc79" stroke-width="2"/>
  </svg>
 </div>
 <div class="club-actions"><p>Samen aan de oche.</p><button type="button" class="primary club-new">Nieuwe wedstrijd →</button></div>`;
document.body.append(saver);

let busy=false,polling=false,sequence=0,setupTarget=null,phoneSetup=false;
const setup=document.getElementById('setup');
function show(active){
 if(document.body.classList.contains('remote-control')&&!setup.hidden)active=false;
 if(active){clearEffect();if(!saver.open)saver.showModal();}
 else if(saver.open)saver.close();
 document.body.classList.toggle('club-saver-active',active);
}
async function setSaver(active){
 if(busy)return false;busy=true;sequence++;
 try{
  const response=await fetch('/api/display',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screensaverActive:active}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error();show((await response.json()).screensaverActive===true);return true;
 }catch{menu.textContent='Screensaver - probeer opnieuw';return false;}finally{busy=false;}
}
async function syncSaver(){
 if(busy||polling)return;
 if(setupTarget!==null){const target=setupTarget;setupTarget=null;if(!await setSaver(target)&&setupTarget===null)setupTarget=target;return;}
 polling=true;const requested=sequence;
 try{const r=await fetch('/api/display',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(r.ok&&!busy){const data=await r.json();if(!busy&&requested===sequence)show(data.screensaverActive===true);}}catch{}finally{polling=false;}
}
saver.addEventListener('cancel',event=>{event.preventDefault();void setSaver(false);});
saver.querySelector('.club-back').onclick=()=>setSaver(false);
saver.querySelector('.club-new').onclick=async()=>{
 if(!await setSaver(false))return;
 document.getElementById('result-dialog').close();document.getElementById('settings').click();
};
const menu=document.createElement('button');menu.id='open-club-saver';menu.type='button';menu.textContent='Screensaver';menu.onclick=()=>setSaver(true);
document.getElementById('top-actions').append(menu);
const winner=document.createElement('button');winner.id='winner-club-saver';winner.type='button';winner.className='club-saver-tile';
winner.innerHTML='<strong>Screensaver</strong><span>VTV de Venhoeve ? Rotterdam</span>';winner.onclick=()=>setSaver(true);
document.getElementById('continue').after(winner);
// Setup is mirrored separately; it must not activate the screensaver.
new MutationObserver(()=>{
 if(document.body.classList.contains('remote-control')&&!setup.hidden)void setSaver(false);
}).observe(setup,{attributes:true,attributeFilter:['hidden']});
syncSaver();setInterval(syncSaver,750);
