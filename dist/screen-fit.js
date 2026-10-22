const main=document.querySelector('main');
function fitScreen(){
 const remote=document.body.classList.contains('remote-control');
 if(document.body.classList.contains('screen-fit')===remote)document.body.classList.toggle('screen-fit',!remote);
 if(remote)return;
 const style=getComputedStyle(main);
 const height=main.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
 const value=`${Math.max(300,height)}px`;
 if(main.style.getPropertyValue('--stage-height')!==value)main.style.setProperty('--stage-height',value);
}
new ResizeObserver(fitScreen).observe(main);
new MutationObserver(fitScreen).observe(document.body,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',fitScreen);
fitScreen();
