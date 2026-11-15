// Share a single friends cache/request across ES modules and legacy tablet
// bundles. Only names/ids are cached here; account tokens stay in club storage.
const ACCOUNT='180hitters.club.v1',CACHE='180hitters.onlineFriends.v1';
function createFriends(){
 let fingerprint=null,generation=0,pending=null,lastAttempt=0;
 let state={members:[],phase:'registration',updatedAt:0,hasAccess:false};
 const readAccount=()=>{try{const value=JSON.parse(localStorage.getItem(ACCOUNT)||'{}');return value.accessToken&&value.member?.id&&value.member.status==='approved'?{id:value.member.id,token:value.accessToken}:null;}catch{return null;}};
 const clean=values=>{
  const ids=new Set(),names=new Set();return (Array.isArray(values)?values:[]).filter(member=>{
   if(!member||typeof member.id!=='string'||typeof member.name!=='string'||!member.id||!member.name.trim()||member.name.length>24||(member.status&&member.status!=='approved'))return false;
   const name=member.name.trim().toLocaleLowerCase('nl');if(ids.has(member.id)||names.has(name))return false;ids.add(member.id);names.add(name);return true;
  }).map(member=>({id:member.id,name:member.name.trim()})).sort((a,b)=>a.name.localeCompare(b.name,'nl',{sensitivity:'base'}));
 };
 function reconcile(){
  const account=readAccount(),key=account?account.id+':'+account.token:'';
  if(key!==fingerprint){
   fingerprint=key;generation++;pending=null;lastAttempt=0;
   let cached=null;try{cached=JSON.parse(localStorage.getItem(CACHE)||'null');}catch{}
   if(account&&cached?.accountId===account.id)state={members:clean(cached.members),phase:'cached',updatedAt:Number(cached.updatedAt)||0,hasAccess:true};
   else{state={members:[],phase:account?'idle':'registration',updatedAt:0,hasAccess:!!account};try{localStorage.removeItem(CACHE);}catch{}}
  }
  return account;
 }
 const snapshot=()=>{reconcile();return {...state,members:state.members.map(member=>({...member}))};};
 const emit=()=>document.dispatchEvent(new CustomEvent('online-friends-updated',{detail:snapshot()}));
 function refresh(force=false){
  const account=reconcile();if(!account)return Promise.resolve(snapshot());
  if(pending)return pending;
  if(!force&&Date.now()-lastAttempt<120000)return Promise.resolve(snapshot());
  const ownGeneration=generation;lastAttempt=Date.now();state.phase='loading';emit();
  const request=(async()=>{
   try{
    const response=await fetch('https://180-hitters-online.180-hitters-online.workers.dev/club/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:account.token}),cache:'no-store',signal:AbortSignal.timeout(5000)});
    reconcile();if(generation!==ownGeneration)return snapshot();
    if(response.status===401||response.status===403){state={members:[],phase:'denied',updatedAt:0,hasAccess:false};try{localStorage.removeItem(CACHE);}catch{};emit();return snapshot();}
    if(!response.ok)throw Error('Online vrienden niet bereikbaar');
    const data=await response.json();if(!Array.isArray(data.players))throw Error('Ongeldige vriendenlijst');
    reconcile();if(generation!==ownGeneration)return snapshot();
    state={members:clean(data.players),phase:'ready',updatedAt:Date.now(),hasAccess:true};
    try{localStorage.setItem(CACHE,JSON.stringify({accountId:account.id,members:state.members,updatedAt:state.updatedAt}));}catch{}
   }catch{reconcile();if(generation===ownGeneration)state.phase='offline';}
   if(generation===ownGeneration)emit();return snapshot();
  })();
  pending=request;request.finally(()=>{if(pending===request)pending=null;});return request;
 }
 const accountChanged=()=>{const before=fingerprint;reconcile();if(before!==fingerprint){emit();if(state.hasAccess)void refresh(true);}};
 document.addEventListener('club-account-updated',accountChanged);
 document.addEventListener('online-friends-refresh',()=>void refresh(true));
 window.addEventListener('storage',event=>{if(event.key===ACCOUNT)accountChanged();});
 reconcile();return {snapshot,refresh};
}
const friends=window.__hittersOnlineFriends||(window.__hittersOnlineFriends=createFriends());
export const onlineFriendsState=()=>friends.snapshot();
export const refreshOnlineFriends=(force=false)=>friends.refresh(force);
export const nucRosterLabel=()=>{
 const name=String(window.venueProfile?.playerListName||'').trim();
 return !name||/^(clubspelers|nuc-spelers)$/i.test(name)?'NUC-spelers':`NUC-spelers (${name})`;
};
