// All mobile devices use the responsive layout, including older saved preferences.
document.body.dataset.mobileLayout='adaptive';
try{localStorage.removeItem('axelman8.mobileLayout');}catch{}
