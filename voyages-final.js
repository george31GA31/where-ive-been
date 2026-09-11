/* Herald Voyages final presentation pass.
   Loaded after the legacy theme module so the new product identity wins cleanly. */
(() => {
  'use strict';
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : new URL('voyages-final.js', location.href);
  const rootUrl = new URL('./', scriptUrl);

  if (!document.getElementById('heraldVoyagesOverrides')) {
    const link = document.createElement('link');
    link.id = 'heraldVoyagesOverrides';
    link.rel = 'stylesheet';
    link.href = new URL('voyages-overrides.css?v=voyages-2', rootUrl).href;
    document.head.append(link);
  }

  function finalizeBrand() {
    document.querySelectorAll('.brand strong').forEach((el) => { el.textContent = 'Herald Voyages'; });
    document.querySelectorAll('.brand-logo-mark').forEach((img) => { img.alt = 'Herald Voyages logo'; });
    document.querySelectorAll('.brand > div:last-child > span').forEach((el) => { el.textContent = 'Where you’ve been. Where you’re going.'; });
    const page = document.body?.dataset?.accountPage;
    const accountTitles = { login: 'Log in', register: 'Create account', 'reset-password': 'Reset password', profile: 'My profile' };
    if (page) document.title = `${accountTitles[page] || 'Account'} — Herald Voyages`;
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', finalizeBrand) : finalizeBrand();
})();
