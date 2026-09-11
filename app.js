/* Herald Voyages bootstrap — stable data engine plus the rebuilt product shell. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.brand strong').forEach(el => { el.textContent = 'Herald Voyages'; });
  document.querySelectorAll('.brand .brand-wordmark span').forEach(el => { el.textContent = 'Where you’ve been. Where you’re going.'; });
});
