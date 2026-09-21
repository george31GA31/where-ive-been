/* Herald Voyages bootstrap — core travel app, account sync, security, map and presentation layers. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="assets/slaps-countries.js?v=completion-2"><\/script><script src="assets/flag-manifest.js?v=completion-2"><\/script><script src="assets/flag-thumbnails.js?v=completion-2"><\/script><script src="journey-model.js?v=completion-2"><\/script><script src="atlas-model.js?v=completion-2"><\/script><script src="app-core.js?v=completion-2"><\/script><script src="app-fixes.js?v=completion-2"><\/script><script src="theme.js?v=completion-2"><\/script><script src="security-runtime.js?v=completion-2"><\/script><script src="map-enhancements.js?v=completion-2"><\/script><script src="country-count-model.js?v=completion-2"><\/script><script src="dashboard-enhancements.js?v=completion-2"><\/script><script src="account-tracker.js?v=completion-2"><\/script><script src="herald.js?v=completion-2"><\/script><script src="voyages.js?v=completion-2"><\/script><script src="journeys.js?v=completion-2"><\/script>');
