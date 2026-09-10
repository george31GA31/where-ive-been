/* Where I've Been bootstrap — core app, focused fixes, branding and security runtime. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="app-core.js?v=20260910-2"><\/script><script src="app-fixes.js?v=20260910-2"><\/script><script src="theme.js?v=20260910-2"><\/script><script src="security-runtime.js?v=20260910-2"><\/script>');
