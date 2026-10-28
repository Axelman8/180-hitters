const defaults={venueName:'180 Hitters',city:'',playerListName:'Clubspelers',slogan:'Samen aan de oche.',screensaverEnabled:false,logoData:'',backgroundData:'',clubWifiName:'',clubWifiQr:'',hotspotName:'180 Hitters wifi',hotspotPassword:''};
window.venueProfile={...defaults};

function publish(value){
 window.venueProfile={...defaults,...value};
 document.documentElement.dataset.venue=window.venueProfile.venueName;
 document.dispatchEvent(new CustomEvent('venue-profile-ready',{detail:window.venueProfile}));
 return window.venueProfile;
}

window.venueReady=fetch('/api/venue',{cache:'no-store',signal:AbortSignal.timeout(6000)})
 .then(response=>response.ok?response.json():Promise.reject()).then(publish).catch(()=>publish(defaults));

const android=window.DartsAndroid&&typeof window.DartsAndroid.getControlToken==='function';
const local=['127.0.0.1','localhost','::1'].includes(location.hostname);
if(android||local){
 const dialog=document.createElement('dialog');dialog.id='venue-dialog';dialog.setAttribute('aria-labelledby','venue-title');
 dialog.innerHTML=`<h2 id="venue-title">Locatie instellen</h2><p>Dit profiel blijft op dit apparaat of deze NUC staan en wordt niet door updates overschreven.</p>
 <form id="venue-form">
  <label>Naam locatie<input name="venueName" maxlength="60" required></label>
  <label>Plaats<input name="city" maxlength="60"></label>
  <label>Naam clubspelerslijst<input name="playerListName" maxlength="40" required></label>
  <label>Slogan<input name="slogan" maxlength="100"></label>
  <label>Logo (PNG, JPG of WebP)<input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <button name="removeLogo" type="button">Logo verwijderen</button>
  <label>Achtergrond (PNG, JPG of WebP)<input name="backgroundFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <button name="removeBackground" type="button">Achtergrond verwijderen</button>
  <fieldset><legend>Optionele wifi van de locatie</legend>
   <label>Wifi-naam<input name="clubWifiName" maxlength="80"></label>
   <label>Wifi-QR-tekst<input name="clubWifiQr" maxlength="500" placeholder="WIFI:T:WPA;S:naam;P:wachtwoord;;"></label>
  </fieldset>
  <fieldset><legend>180 Hitters-hotspot</legend>
   <label>Wifi-naam<input name="hotspotName" maxlength="80" readonly></label>
   <label>Wachtwoord (via netwerkbeheer)<input name="hotspotPassword" maxlength="100" readonly></label>
  </fieldset>
  <button type="button" id="venue-connections" class="wide">Wifi en Bluetooth beheren</button>
  <p id="venue-message" role="status"></p>
  <div class="venue-actions"><button type="button" id="venue-neutral">Neutraal profiel</button><button type="submit" class="primary">Opslaan</button><button type="button" id="venue-close">Sluiten</button></div>
 </form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),message=dialog.querySelector('#venue-message');
 let working={...defaults};
 const fill=profile=>{working={...defaults,...profile};for(const key of ['venueName','city','playerListName','slogan','clubWifiName','clubWifiQr','hotspotName','hotspotPassword'])form.elements[key].value=working[key];};
 const image=async input=>{
  const file=input.files[0];if(!file)return null;
  if(file.size>1800000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Gebruik een PNG-, JPG- of WebP-afbeelding van maximaal 1,8 MB.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Afbeelding kon niet worden gelezen.'));reader.readAsDataURL(file);});
 };
 form.elements.removeLogo.onclick=()=>{working.logoData='';form.elements.logoFile.value='';message.textContent='Logo wordt bij Opslaan verwijderd.';};
 form.elements.removeBackground.onclick=()=>{working.backgroundData='';form.elements.backgroundFile.value='';message.textContent='Achtergrond wordt bij Opslaan verwijderd.';};
 dialog.querySelector('#venue-neutral').onclick=()=>{fill(defaults);message.textContent='Neutraal profiel klaar. Kies Opslaan om te bevestigen.';};
 dialog.querySelector('#venue-close').onclick=()=>dialog.close();
 dialog.querySelector('#venue-connections').onclick=()=>{dialog.close();setTimeout(()=>document.getElementById('bluetooth-open')?.click(),0);};
 form.onsubmit=async event=>{
  event.preventDefault();message.textContent='Locatieprofiel opslaan…';
  try{
   const logo=await image(form.elements.logoFile),background=await image(form.elements.backgroundFile);
   const value={...working};for(const key of ['venueName','city','playerListName','slogan','clubWifiName','clubWifiQr','hotspotName','hotspotPassword'])value[key]=form.elements[key].value.trim();
   value.screensaverEnabled=false;if(logo)value.logoData=logo;if(background)value.backgroundData=background;
   const headers={'Content-Type':'application/json'};if(android)headers['X-Darts-Control']=window.DartsAndroid.getControlToken();
   const response=await fetch('/api/venue',{method:'POST',headers,body:JSON.stringify(value),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Opslaan is mislukt.');
   publish(data);fill(data);form.elements.logoFile.value='';form.elements.backgroundFile.value='';message.textContent='Locatieprofiel opgeslagen.';
  }catch(error){message.textContent=error.message||'Opslaan is mislukt.';}
 };
 const open=document.createElement('button');open.id='venue-open';open.type='button';open.textContent='Locatie';open.onclick=async()=>{fill(await window.venueReady);message.textContent='';dialog.showModal();};
 document.getElementById('top-actions').append(open);
}
