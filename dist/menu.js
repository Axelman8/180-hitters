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
const play=new Set(['settings','players-list','open-kiosk']);
function collect(){
 for(const node of [...actions.children]){
  if(node.matches('button,a'))groups[play.has(node.id)?'play':'settings'].append(node);
 }
 for(const id of ['android-app-action']){
  const node=document.getElementById(id);
  if(node&&!menu.contains(node))groups.settings.append(node);
 }
}
collect();
new MutationObserver(collect).observe(actions,{childList:true});
document.addEventListener('click',event=>{
 if(!menu.contains(event.target))for(const group of menu.children)group.open=false;
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')for(const group of menu.children)if(group.open){group.open=false;group.querySelector('summary').focus();}
});
