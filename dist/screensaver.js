import {clearEffect} from './celebration.js';
const saver=document.createElement('dialog');saver.id='club-saver';
saver.innerHTML=`
 <img class="club-photo" hidden alt="">
 <div class="club-shade"></div>
 <button type="button" class="club-back">← Terug</button>
 <div class="club-center"><div class="club-patch"><img class="club-logo" src="avatar.jpg" alt=""><h1>180 Hitters</h1><h2 hidden></h2></div></div>
 <div class="club-actions"><p>Samen aan de oche.</p><button type="button" class="primary club-new">Nieuwe wedstrijd →</button></div>`;
document.body.append(saver);

let busy=false,polling=false,sequence=0,setupTarget=null,enabled=true;
const setup=document.getElementById('setup');
function show(active){
 if(!enabled)active=false;
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
saver.querySelector('.club-new').onclick=async()=>{if(!await setSaver(false))return;document.getElementById('result-dialog').close();document.getElementById('settings').click();};
const menu=document.createElement('button');menu.id='open-club-saver';menu.type='button';menu.textContent='Screensaver';menu.onclick=()=>setSaver(true);document.getElementById('top-actions').append(menu);
const winner=document.createElement('button');winner.id='winner-club-saver';winner.type='button';winner.className='club-saver-tile';winner.innerHTML='<strong>Screensaver</strong><span>180 Hitters</span>';winner.onclick=()=>setSaver(true);document.getElementById('continue').after(winner);
function applyVenue(profile){
 const name=profile.venueName||'180 Hitters',city=profile.city||'';
 saver.setAttribute('aria-label','Screensaver '+name+(city?' '+city:''));
 const logo=saver.querySelector('.club-logo'),photo=saver.querySelector('.club-photo');logo.src=profile.logoData||'avatar.jpg';logo.alt='Logo van '+name;
 photo.hidden=!profile.backgroundData;photo.src=profile.backgroundData||'';photo.alt=profile.backgroundData?'Achtergrond van '+name:'';
 saver.querySelector('h1').textContent=name;saver.querySelector('h2').textContent=city;saver.querySelector('h2').hidden=!city;
 saver.querySelector('.club-actions p').textContent=profile.slogan||'Samen aan de oche.';winner.querySelector('span').textContent=[name,city].filter(Boolean).join(' · ');
 enabled=profile.screensaverEnabled!==false;menu.hidden=winner.hidden=!enabled;if(!enabled)show(false);
}
document.addEventListener('venue-profile-ready',event=>applyVenue(event.detail));applyVenue(window.venueProfile||{});
new MutationObserver(()=>{if(document.body.classList.contains('remote-control')&&!setup.hidden)void setSaver(false);}).observe(setup,{attributes:true,attributeFilter:['hidden']});
syncSaver();setInterval(syncSaver,750);
