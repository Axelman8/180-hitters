const toggle=document.getElementById('toggle-input');
let collapsed=false,displayBusy=false,displayPolling=false,displaySequence=0;
toggle.disabled=true;
function render(){
 document.body.classList.toggle('input-collapsed',collapsed);
 toggle.textContent=collapsed?'Scherminvoer uitklappen':'Scherminvoer inklappen';
 toggle.setAttribute('aria-expanded',String(!collapsed));
}
async function syncDisplay(){
 if(displayBusy||displayPolling)return;
 displayPolling=true;const sequence=displaySequence;
 try{
  const res=await fetch('/api/display',{cache:'no-store',signal:AbortSignal.timeout(4000)});
  if(!res.ok)throw Error();
  const data=await res.json();
  if(sequence!==displaySequence)return;
  collapsed=data.inputCollapsed===true;toggle.disabled=false;render();
 }catch{}finally{displayPolling=false;}
}
toggle.onclick=async()=>{
 if(displayBusy)return;
 displayBusy=true;displaySequence++;toggle.disabled=true;
 try{
  const res=await fetch('/api/display',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputCollapsed:!collapsed}),signal:AbortSignal.timeout(4000)});
  if(!res.ok)throw Error();
  collapsed=(await res.json()).inputCollapsed===true;render();
 }catch{toggle.textContent='Geen verbinding - probeer opnieuw';}
 finally{displayBusy=false;toggle.disabled=false;}
};
render();syncDisplay();setInterval(syncDisplay,750);

import './menu.js';
