// Local presentation preferences. Never sent with a match or NUC control request.
export const appearanceKey='180hitters.appearance.v1';
export const defaultColors=['#5ce0ed','#ff78bc','#c8f56a','#c2a1ff'];
export const symbolNames=['circle','cross','triangle','square'];
export const appearanceDefaults=()=>({space:'auto',board:'standard',focus:false,colorMode:'standard',colors:[...defaultColors],markers:'none',symbols:[...symbolNames],emphasis:'standard',scoreboard:{mode:'standard',average:true,legs:true,best:true,darts:true,last:true}});
export function normalizeAppearance(value){
 const d=appearanceDefaults(),v=value&&typeof value==='object'?value:{};
 const choice=(key,allowed)=>allowed.includes(v[key])?v[key]:d[key];
 const used=new Set(),symbols=symbolNames.map((fallback,i)=>{let s=Array.isArray(v.symbols)&&v.symbols[i];if(!symbolNames.includes(s)||used.has(s))s=symbolNames.find(n=>!used.has(n));used.add(s);return s;});
 return {...d,space:choice('space',['auto','board','input']),board:choice('board',['standard','classic','calm']),focus:v.focus===true,colorMode:choice('colorMode',['standard','custom']),colors:defaultColors.map((fallback,i)=>/^#[\da-f]{6}$/i.test(v.colors?.[i])?v.colors[i].toLowerCase():fallback),markers:choice('markers',['none','shapes','numbers']),symbols,emphasis:choice('emphasis',['standard','strong','contrast']),scoreboard:Object.fromEntries(Object.entries(d.scoreboard).map(([key,fallback])=>[key,key==='mode'?(v.scoreboard?.mode==='custom'?'custom':'standard'):typeof v.scoreboard?.[key]==='boolean'?v.scoreboard[key]:fallback]))};
}
function read(){try{return normalizeAppearance(JSON.parse(localStorage.getItem(appearanceKey)));}catch{return appearanceDefaults();}}
const shared=typeof window!=='undefined'?window:null;
const store=shared?.__hittersAppearance||(shared?(shared.__hittersAppearance={value:read(),colors:[...defaultColors]}):{value:appearanceDefaults(),colors:[...defaultColors]});
function syncColors(){store.colors.splice(0,4,...(store.value.colorMode==='custom'?store.value.colors:defaultColors));}
syncColors();
export const playerColors=store.colors;
export const getAppearance=()=>normalizeAppearance(store.value);
export function saveAppearance(value){
 store.value=normalizeAppearance(value);syncColors();let saved=true;
 try{localStorage.setItem(appearanceKey,JSON.stringify(store.value));}catch{saved=false;}
 if(shared)shared.dispatchEvent(new CustomEvent('hitters-appearance',{detail:{saved}}));return saved;
}
if(shared&&!store.listening){store.listening=true;shared.addEventListener('storage',event=>{if(event.key===appearanceKey){store.value=read();syncColors();shared.dispatchEvent(new CustomEvent('hitters-appearance',{detail:{saved:true}}));}});}
