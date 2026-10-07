/* Where I've Been — small browser security/runtime hardening. */
(() => {
  'use strict';

  // Broken remote flag images fail closed without needing an inline onerror.
  document.addEventListener('error', event => {
    const target = event.target;
    if (target instanceof HTMLImageElement && target.classList.contains('flag-img')) {
      target.style.display = 'none';
    }
  }, true);
})();
