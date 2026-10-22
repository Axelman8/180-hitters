const key='axelman8.mobileLayout';
const dialog=document.getElementById('layout-dialog');
let choice='auto';
try{const saved=localStorage.getItem(key);if(['auto','compact','large'].includes(saved))choice=saved;}catch{}
function render(){
 const layout=choice==='auto'?'adaptive':choice;
 document.body.dataset.mobileLayout=layout;
 for(const button of dialog.querySelectorAll('[data-layout]'))button.setAttribute('aria-pressed',String(button.dataset.layout===choice));
 document.getElementById('layout-description').textContent=choice==='auto'?'Automatisch: de bediening vult de beschikbare schermruimte.':choice==='compact'?'Compacte indeling geselecteerd.':'Grote knoppen geselecteerd.';
}
for(const button of dialog.querySelectorAll('[data-layout]'))button.onclick=()=>{
 choice=button.dataset.layout;try{localStorage.setItem(key,choice);}catch{}render();
};
document.getElementById('layout-open').onclick=()=>dialog.showModal();
document.getElementById('layout-close').onclick=()=>dialog.close();
render();
