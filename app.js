/* Herald Voyages bootstrap — stable data engine plus the rebuilt product shell. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';

  // map-enhancements.js owns map behaviour, while styles.css owns presentation.
  // Pre-registering this style marker prevents the legacy module from injecting
  // its former component CSS over the Herald Voyages design system.
  if (!document.getElementById('wibMapEnhancementStyles')) {
    const marker = document.createElement('style');
    marker.id = 'wibMapEnhancementStyles';
    document.head.appendChild(marker);
  }

  // The established country-count module adds its Edit control into the element
  // containing the headline number. Convert that interactive dashboard block from
  // a button to an article before any renderer boots, so the edit control remains
  // valid, accessible markup rather than a button nested inside another button.
  document.addEventListener('DOMContentLoaded', () => {
    const score = document.querySelector('button.world-score');
    if (!score) return;
    const replacement = document.createElement('article');
    for (const {name, value} of [...score.attributes]) if (name !== 'type') replacement.setAttribute(name, value);
    replacement.setAttribute('role', 'button');
    replacement.tabIndex = 0;
    while (score.firstChild) replacement.appendChild(score.firstChild);
    replacement.addEventListener('click', event => {
      if (event.target.closest('#editCountryCountBtn')) event.stopImmediatePropagation();
    });
    score.replaceWith(replacement);
  });
})();

document.write(
  '<script src="app-core.js?v=voyages-v2"><\/script>' +
  '<script src="app-fixes.js?v=voyages-v2"><\/script>' +
  '<script src="map-enhancements.js?v=voyages-v2"><\/script>' +
  '<script src="country-count-model.js?v=voyages-v2"><\/script>' +
  '<script src="account-tracker.js?v=voyages-v2"><\/script>' +
  '<script src="herald.js?v=voyages-v2"><\/script>' +
  '<script src="ui-shell.js?v=voyages-v2"><\/script>'
);

// The old tracker used an emoji for the special At Sea location. Keep At Sea
// fully compatible with the existing data model, but render it with the same
// line-icon language as the rest of Herald Voyages.
(() => {
  if (typeof flagHtml !== 'function') return;
  const inheritedFlagHtml = flagHtml;
  flagHtml = function (code, cls = 'flag-img') {
    if (String(code || '').toUpperCase() !== 'SEA') return inheritedFlagHtml(code, cls);
    return `<span class="${esc(cls)} special-location-icon" title="At Sea" aria-label="At Sea"><svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 6c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2S20.8 4 23 4"/><path d="M1 11c2.2 0 2.2-2 4.4-2s2.2 2 4.4 2 2.2-2 4.4-2 2.2 2 4.4 2S20.8 9 23 9"/></svg></span>`;
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.brand strong').forEach(el => { el.textContent = 'Herald Voyages'; });
  document.querySelectorAll('.brand .brand-wordmark span').forEach(el => { el.textContent = 'Where you’ve been. Where you’re going.'; });
});
