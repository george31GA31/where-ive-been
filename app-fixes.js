/* Legacy flag compatibility. Page calculations live in the core and shared models. */
(() => {
'use strict';
  // Use a proper non-country icon for At Sea and keep flags dimensionally stable.
  const coreFlagHtml = flagHtml;
  flagHtml = function (code, cls = 'flag-img') {
    if (!code) return '';
    if (String(code).toUpperCase() === 'SEA') {
      return `<span class="${esc(cls)} special-location-icon" title="At Sea" aria-label="At Sea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 9q3-4 6 0t6 0t8 0M2 16q3-4 6 0t6 0t8 0"/></svg></span>`;
    }
    return coreFlagHtml(code, cls);
  };

})();
