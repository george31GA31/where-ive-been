/* Account presentation only. Existing account-pages.js owns Auth, tokens and forms. */
(() => {
  'use strict';
  const root=new URL('./',document.currentScript?.src||location.href);
  const copy={
    login:['RETURN TO YOUR WORLD','Pick up','the story.','The places you’ve been. The plans you’re making. Right where you left them.'],
    register:['EVERY JOURNEY STARTS HERE','A world','to call yours.','Give your journeys a home, from the first date in your calendar to the places you keep returning to.'],
    'reset-password':['FIND YOUR WAY BACK','Your next','chapter awaits.','Recover access to your personal atlas and get back to the journeys that matter to you.'],
    profile:['YOUR ACCOUNT','Keep it','yours.','Your account, your details, your travel archive. Make room for whatever comes next.']
  };
  function boot(){
    const page=document.body.dataset.accountPage,main=document.querySelector('.account-page');
    if(!copy[page]||!main||main.dataset.motionAccountReady)return;
    main.dataset.motionAccountReady='true';document.documentElement.dataset.heraldMotion='atlas';
    const [kicker,line,emphasis,description]=copy[page];
    const header=document.createElement('header');header.className='motion-account-header';
    const brand=main.querySelector('.brand'),back=main.querySelector('#backToTracker');
    if(brand)header.append(brand);
    const actions=document.createElement('nav');actions.className='motion-account-nav';actions.setAttribute('aria-label','Account navigation');
    const theme=document.createElement('button');theme.type='button';theme.className='motion-account-theme secondary';theme.setAttribute('aria-label','Switch light or dark appearance');
    const updateTheme=()=>{
      const dark=document.documentElement.dataset.theme==='dark';theme.setAttribute('aria-pressed',String(dark));theme.textContent=dark?'☀':'◐';theme.title=dark?'Switch to light appearance':'Switch to dark appearance';
      document.querySelectorAll('.brand-logo-mark').forEach(image=>{image.src=new URL(dark?'assets/herald-logo-light.png':'assets/herald-logo-dark.png',root).href;});
    };
    theme.addEventListener('click',()=>{
      const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
      document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next;
      localStorage.setItem('whereIveBeen.theme.v1',next);localStorage.setItem('herald.experience.theme.v1','manual');updateTheme();
    });
    actions.append(theme);if(back){back.textContent='Back to Herald ↗';actions.append(back);}header.append(actions);
    const layout=document.createElement('div');layout.className='motion-account-layout';
    const scene=document.createElement('aside');scene.className='motion-account-scene';scene.setAttribute('aria-label','Herald Voyages');
    const overline=document.createElement('p');overline.className='eyebrow';overline.textContent=kicker;
    const title=document.createElement('h2');title.append(document.createTextNode(line));const italic=document.createElement('em');italic.textContent=emphasis;title.append(italic);
    const intro=document.createElement('p');intro.className='motion-account-intro';intro.textContent=description;
    const compass=document.createElement('div');compass.className='motion-account-compass';compass.setAttribute('aria-hidden','true');
    compass.innerHTML='<svg viewBox="0 0 460 460"><g fill="none" stroke="currentColor"><circle cx="230" cy="230" r="177"/><circle cx="230" cy="230" r="156" stroke-dasharray="1 7"/><ellipse cx="230" cy="230" rx="216" ry="79" transform="rotate(-25 230 230)"/><path d="M230 28V432M28 230H432" stroke-dasharray="3 8"/><path d="M230 80 254 206 380 230 254 254 230 380 206 254 80 230 206 206Z"/></g><path d="m230 80 24 126-24 24-24-24Z" fill="var(--hv-red)"/><circle cx="230" cy="230" r="7" fill="currentColor"/><text x="230" y="41" text-anchor="middle">N</text><text x="230" y="445" text-anchor="middle">S</text><text x="445" y="234" text-anchor="middle">E</text><text x="15" y="234" text-anchor="middle">W</text></svg><span>HERALD / A LIFE IN MOTION</span>';
    const note=document.createElement('p');note.className='motion-account-footnote';note.textContent='The journey is yours. Keep the story.';
    scene.append(overline,title,intro,compass,note);
    const content=document.createElement('div');content.className='motion-account-content';
    for(const child of [...main.children])if(!child.matches('.brand,.herald-site-footer'))content.append(child);
    layout.append(scene,content);main.prepend(header,layout);
    // Account transfer/recovery panels can be injected later; keep the original nodes/listeners.
    new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element&&!node.matches('.motion-account-header,.motion-account-layout,.herald-site-footer'))content.append(node);}))).observe(main,{childList:true});
    const reduced=matchMedia('(prefers-reduced-motion:reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
    const allow=()=>!reduced.matches&&fine.matches&&localStorage.getItem('herald.experience.motion.v1')!=='off';
    scene.addEventListener('pointermove',event=>{if(!allow())return;const box=scene.getBoundingClientRect();scene.style.setProperty('--account-x',((event.clientX-box.left)/box.width-.5).toFixed(3));scene.style.setProperty('--account-y',((event.clientY-box.top)/box.height-.5).toFixed(3));});
    scene.addEventListener('pointerleave',()=>{scene.style.setProperty('--account-x','0');scene.style.setProperty('--account-y','0');});
    const syncMotion=()=>{scene.dataset.motion=allow()?'on':'off';};reduced.addEventListener('change',syncMotion);syncMotion();updateTheme();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
