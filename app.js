/* Where I've Been bootstrap — core app, focused fixes and branding/theme. */
(() => {
  const savedTheme = localStorage.getItem('whereIveBeen.theme.v1');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
})();
document.write('<script src="app-core.js?v=20260910-1"></script><script src="app-fixes.js?v=20260910-1"></script><script src="theme.js?v=20260910-1"></script>');
