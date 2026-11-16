// One navigation history for ES modules and the separately bundled legacy entries.
const selector='dialog,#tablet-mode-overlay,#tablet-diagnostics-overlay,#tablet-team-overlay,#tablet-match-settings-overlay';
function createNavigation(){
 const frames=new WeakMap(),handlers=new WeakMap(),visible=new WeakMap();
 let transition=null,returning=null,backIntent=null,order=[];
 const shown=root=>!!root?.isConnected&&(root.tagName==='DIALOG'?root.open:!root.hidden&&getComputedStyle(root).display!=='none');
 function snapshot(root){
  const custom=handlers.get(root),frame=frames.get(root);
  return {root,parent:frame?.parent||null,state:custom?.capture?.()||{scroll:root.scrollTop},focus:root.contains(document.activeElement)&&document.activeElement?.tagName==='BUTTON'?document.activeElement:null};
 }
 function opened(root){
  visible.set(root,true);
  order=order.filter(item=>item!==root&&item.isConnected);order.push(root);
  if(returning){if(root===returning.root)frames.set(root,returning);return;}
  let parent=transition?.root!==root?transition:null;
  if(!parent){const candidates=order.filter(other=>other!==root&&shown(other));if(candidates.length)parent=snapshot(candidates[candidates.length-1]);}
  frames.set(root,{root,parent});transition=null;
 }
 function register(root,options){if(options)handlers.set(root,options);}
 function restore(frame){
  if(!frame?.root.isConnected)return;
  returning=frame;frames.set(frame.root,frame);visible.set(frame.root,true);transition=null;
  order=order.filter(root=>root!==frame.root&&root.isConnected);order.push(frame.root);
  try{
   const custom=handlers.get(frame.root);
   if(custom?.restore)custom.restore(frame.state);
   else if(frame.root.tagName==='DIALOG'){if(!frame.root.open)frame.root.showModal();}
   else{frame.root.hidden=false;frame.root.style.display='block';}
   frame.root.scrollTop=frame.state?.scroll||0;
   if(frame.focus?.isConnected&&!frame.focus.disabled)frame.focus.focus({preventScroll:true});
  }finally{returning=null;}
 }
 function finishBack(root){
  if(!backIntent||backIntent.root!==root||shown(root))return;
  const frame=backIntent.frame;backIntent=null;
  if(frame?.parent)restore(frame.parent);
 }
 function beginBack(root){
  backIntent={root,frame:snapshot(root)};transition=null;
  queueMicrotask(()=>finishBack(root));
 }
 function observe(root){
  const now=shown(root),was=visible.get(root);visible.set(root,now);
  if(now&&!was)opened(root);else if(!now&&was)finishBack(root);
 }
 // Capture before action handlers close their source menu. A snapshot carries
 // its section and scroll position even across asynchronous dialog transitions.
 function capture(event){
  const button=event.target.closest?.('button,a,summary,input,select'),root=event.target.closest?.(selector);
  if(button?.closest('.dialog-navigation')&&root&&shown(root)){beginBack(root);return;}
  if(['navigation-back','navigation-close'].includes(button?.id)){backIntent=null;transition=null;return;}
  backIntent=null;transition=root&&shown(root)?snapshot(root):null;
 }
 document.addEventListener('click',capture,true);
 document.addEventListener('touchend',capture,true);
 document.addEventListener('cancel',event=>{if(event.target.matches?.(selector))beginBack(event.target);},true);
 document.addEventListener('close',event=>{if(event.target.matches?.(selector)){visible.set(event.target,false);finishBack(event.target);}},true);
 function back(){
  const open=order.filter(shown),root=open[open.length-1];if(!root)return false;
  const button=root.id==='header-menu'?root.querySelector('#navigation-back:not([hidden]),#navigation-close:not([hidden])'):root.querySelector('.dialog-navigation .dialog-back');
  if(!button)return false;if(button.disabled)return true;button.click();return true;
 }
 document.addEventListener('native-navigation-back',()=>{const parent=transition;transition=null;if(parent)restore(parent);});
 return {register,opened,observe,back};
}
export const navigation=window.__hittersNavigation||(window.__hittersNavigation=createNavigation());
