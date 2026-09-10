/* Where I've Been bootstrap — core app, focused fixes, branding, security, map and dashboard enhancements. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="app-core.js?v=20260910-5"><\/script><script src="app-fixes.js?v=20260910-5"><\/script><script src="theme.js?v=20260910-5"><\/script><script src="security-runtime.js?v=20260910-5"><\/script><script src="map-enhancements.js?v=20260910-5"><\/script><script src="dashboard-enhancements.js?v=20260910-5"><\/script>');
