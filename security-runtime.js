/* Where I've Been — small browser security/runtime hardening. */
(() => {
  'use strict';

  // Avoid inline event-handler attributes in generated flag markup so the
  // site's Content-Security-Policy can keep inline JavaScript disabled.
  const currentFlagHtml = flagHtml;
  flagHtml = function (code, cls = 'flag-img') {
    if (!code) return '';

    const normalized = String(code).toUpperCase();
    if (normalized === 'SEA') return currentFlagHtml(code, cls);

    const name = countryByCode(normalized)?.name || normalized;
    return `<img class="${esc(cls)}" src="${flagUrl(normalized)}" alt="${esc(name)} flag" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  };

  // Broken remote flag images fail closed without needing an inline onerror.
  document.addEventListener('error', event => {
    const target = event.target;
    if (target instanceof HTMLImageElement && target.classList.contains('flag-img')) {
      target.style.display = 'none';
    }
  }, true);
})();
