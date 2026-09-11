/* Shared Herald Voyages branding for account pages. */
(() => {
  'use strict';
  const THEME_KEY='whereIveBeen.theme.v1';
  const LOGO=new URL('assets/wib-logo-mark.png',document.currentScript.src).href;
  const titles={login:'Log in',register:'Create account','reset-password':'Reset password',profile:'Profile'};

  function apply(theme){
    const next=theme==='dark'?'dark':'light';
    document.documentElement.dataset.theme=next;
    document.documentElement.style.colorScheme=next;
    localStorage.setItem(THEME_KEY,next);
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
    meta.content=next==='dark'?'#151216':'#2d1b21';
    const btn=document.getElementById('accountThemeToggle');
    if(btn){btn.textContent=next==='dark'?'Light':'Dark';btn.setAttribute('aria-label',`Use ${next==='dark'?'light':'dark'} appearance`)}
  }

  function brand(){
    const page=document.body?.dataset?.accountPage;
    document.title=`${titles[page]||'Account'} — Herald Voyages`;
    document.querySelectorAll('.brand strong').forEach(el=>el.textContent='Herald Voyages');
    document.querySelectorAll('.brand span:not(.brand-mark)').forEach(el=>el.textContent='Where you’ve been. Where you’re going.');
    document.querySelectorAll('.brand-mark').forEach(mark=>{mark.innerHTML=`<img class="brand-logo-mark" src="${LOGO}" alt="">`});
    let icon=document.querySelector('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href=LOGO;icon.type='image/png';
    document.getElementById('accountThemeToggle')?.addEventListener('click',()=>apply(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  }

  apply(localStorage.getItem(THEME_KEY)==='dark'?'dark':'light');
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',brand):brand();
})();
