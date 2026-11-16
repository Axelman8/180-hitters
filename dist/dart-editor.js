import {draftView,patchView} from './render-view.js';
export function renderDartSlots(root,hits,{editing=false,selected=null,select=()=>{},placeholder=index=>'—'}={}){
 const liveRoot=root;root=draftView(root);
 for(let index=0;index<3;index++){
  const slot=document.createElement(editing?'button':'span'),hit=hits[index];
  slot.className='dart-slot';
  slot.textContent=editing?`Pijl ${index+1}: ${hit?.label||'—'}`:hit?.label||placeholder(index);
  if(editing){slot.type='button';slot.disabled=index>hits.length;slot.setAttribute('aria-pressed',String(index===selected));slot.onclick=()=>select(index);}
  else if(index===hits.length){slot.classList.add('current');slot.setAttribute('aria-current','step');}
  root.append(slot);
 }
 patchView(liveRoot,root);
}
