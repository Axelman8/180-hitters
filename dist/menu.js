const actions=document.getElementById('top-actions');
const menu=document.createElement('nav');
menu.id='header-menu';menu.setAttribute('aria-label','Hoofdmenu');
document.getElementById('toggle-toolbar').hidden=true;
document.body.classList.remove('toolbar-collapsed');
actions.before(menu);
const groups={};
for(const [key,label] of [['play','Spelen'],['settings','Instellingen']]){
 const group=document.createElement('details');
 const title=document.createElement('summary');title.textContent=label;
 const panel=document.createElement('div');panel.className='menu-panel';
 group.append(title,panel);menu.append(group);groups[key]=panel;
 title.addEventListener('click',()=>{
  for(const other of menu.children)if(other!==group)other.open=false;
 });
 panel.addEventListener('click',event=>{
  if(event.target.closest('button,a'))group.open=false;
 });
}
const play=new Set(['settings','players-list','open-kiosk','take-control','transfer-to-nuc','match-backups']);
function collect(){
 const camera=document.getElementById('camera-game-controls');
 if(camera&&camera.parentElement!==menu)menu.append(camera);
 for(const node of [...actions.children]){
  if(node.matches('button,a'))groups[play.has(node.id)?'play':'settings'].append(node);
 }
 for(const id of ['android-app-action']){
  const node=document.getElementById(id);
  if(node&&!menu.contains(node))groups.settings.append(node);
 }
 // Keep the main actions in a predictable order, including late-added buttons.
 for(const [panel,ids] of [[groups.play,['settings','players-list']],[groups.settings,['android-app-action']]]){
  let previous=null;
  for(const id of ids){
   const node=document.getElementById(id);
   if(!node||node.parentElement!==panel)continue;
   const next=previous?previous.nextElementSibling:panel.firstElementChild;
   if(next!==node)panel.insertBefore(node,next);
   previous=node;
  }
 }
 const update=document.getElementById('android-update-action')||document.getElementById('desktop-update-action');
 if(update?.parentElement===groups.settings&&groups.settings.lastElementChild!==update)groups.settings.append(update);
}
collect();
new MutationObserver(collect).observe(actions,{childList:true});
document.addEventListener('click',event=>{
 if(!menu.contains(event.target))for(const group of menu.children)group.open=false;
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')for(const group of menu.children)if(group.open){group.open=false;group.querySelector('summary').focus();}
});
