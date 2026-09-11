/* Where I've Been — brand, light/dark theme and logo integration */
(() => {
  'use strict';

  const THEME_KEY = 'whereIveBeen.theme.v1';
  const BRAND_MARK = new URL('assets/herald-trumpet.png', document.currentScript.src).href;

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(THEME_KEY, next);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = next === 'dark' ? '#0b1018' : '#f4f5f7';

    const button = document.getElementById('themeToggleBtn');
    if (button) {
      const dark = next === 'dark';
      button.setAttribute('aria-pressed', dark ? 'true' : 'false');
      button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">${dark ? 'Light' : 'Dark'}</span>`;
    }
  }

  function installBrandAssets() {
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = BRAND_MARK;

    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = BRAND_MARK;


    const mark = document.querySelector('.brand-mark');
    if (mark) {
      mark.innerHTML = `<img src="${BRAND_MARK}" alt="Herald Voyages logo" class="brand-logo-mark">`;
      mark.classList.add('has-logo');
    }
  }

  function installThemeToggle() {
    if (document.getElementById('themeToggleBtn')) return;

    const addStay = document.getElementById('addStayBtn') || document.getElementById('backToTracker');
    const topbar = addStay?.closest('.topbar');
    if (!addStay || !topbar) return;

    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      topbar.appendChild(actions);
      actions.appendChild(addStay);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'themeToggleBtn';
    button.className = 'secondary theme-toggle-btn';
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    actions.insertBefore(button, addStay);
    applyTheme(getTheme());
  }

  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', () => {
    installBrandAssets();
    installThemeToggle();
  });
})();
