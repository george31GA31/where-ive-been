/* Herald Voyages bootstrap — core travel app, account sync, security, map and presentation layers. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="assets/slaps-countries.js?v=slaps-flags-1"><\/script><script src="atlas-model.js?v=atlas-3"><\/script><script src="app-core.js?v=atlas-3"><\/script><script src="app-fixes.js?v=atlas-3"><\/script><script src="theme.js?v=atlas-3"><\/script><script src="security-runtime.js?v=accounts-1"><\/script><script src="map-enhancements.js?v=accounts-1"><\/script><script src="country-count-model.js?v=accounts-1"><\/script><script src="dashboard-enhancements.js?v=atlas-3"><\/script><script src="account-tracker.js?v=accounts-1"><\/script><script src="herald.js?v=atlas-3"><\/script><script src="voyages.js?v=atlas-3"><\/script>');
