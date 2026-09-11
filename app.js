/* Herald Voyages bootstrap — core travel app, account sync, security, map and presentation layers. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="assets/slaps-countries.js?v=journeys-1"><\/script><script src="assets/flag-manifest.js?v=journeys-1"><\/script><script src="journey-model.js?v=journeys-1"><\/script><script src="atlas-model.js?v=journeys-1"><\/script><script src="app-core.js?v=journeys-1"><\/script><script src="app-fixes.js?v=journeys-1"><\/script><script src="theme.js?v=journeys-1"><\/script><script src="security-runtime.js?v=journeys-1"><\/script><script src="map-enhancements.js?v=journeys-1"><\/script><script src="country-count-model.js?v=journeys-1"><\/script><script src="dashboard-enhancements.js?v=journeys-1"><\/script><script src="account-tracker.js?v=journeys-1"><\/script><script src="herald.js?v=journeys-1"><\/script><script src="voyages.js?v=journeys-1"><\/script><script src="journeys.js?v=journeys-1"><\/script>');
