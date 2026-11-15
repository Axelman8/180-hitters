// Reuse existing close handlers, with one consistent return control at the top.
const selector='dialog,#tablet-mode-overlay,#tablet-diagnostics-overlay,#tablet-team-overlay,#tablet-match-settings-overlay';
const bars=new WeakMap();
const style=document.createElement('link');style.rel='stylesheet';style.href='dialog-navigation.css';document.head.append(style);
function enhance(root){
 if(root.id==='header-menu')return;
 const panel=root.tagName==='DIALOG'?root:root.querySelector('section')||root;
 let bar=bars.get(root);
 if(!bar||!panel.contains(bar)){
  const candidates=[...panel.querySelectorAll('button')].filter(button=>!button.closest('.dialog-navigation'));
  const close=candidates.find(button=>/(?:-close|-cancel)$/.test(button.id))||candidates.find(button=>/^(?:sluiten|terug(?:\s|$)|annuleren)/i.test(button.textContent.trim()));
  bar=document.createElement('div');bar.className='dialog-navigation';
  let back=close;
  if(!back||root.id==='result-dialog'){
   back=document.createElement('button');back.type='button';
   back.onclick=()=>{if(close)close.click();else if(root.tagName==='DIALOG')root.close();else root.style.display='none';};
   if(close)close.classList.add('dialog-back-replaced');
  }
  back.classList.add('dialog-back');back.textContent='TERUG';back.setAttribute('aria-label','TERUG');
  bar.append(back);bars.set(root,bar);
 }
 if(panel.firstElementChild!==bar)panel.prepend(bar);
}
document.querySelectorAll(selector).forEach(enhance);
new MutationObserver(records=>{
 const menus=new Set();
 for(const record of records){
  const enclosing=record.target.nodeType===1?record.target.closest(selector):record.target.parentElement?.closest(selector);
  if(enclosing)menus.add(enclosing);
  for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches(selector))menus.add(node);node.querySelectorAll(selector).forEach(menu=>menus.add(menu));}
 }
 menus.forEach(enhance);
}).observe(document.body,{childList:true,subtree:true});
