/* Consolidate contextual planning links after all shared editor modules load. */
(() => {
  'use strict';
  function boot() {
    if (document.body.dataset.accountPage) return;
    document.documentElement.dataset.heraldShell = 'simple';
    const announcement = document.createElement('p');
    announcement.className = 'sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    document.body.append(announcement);
    window.addEventListener('hv-route', () => {
      announcement.textContent = document.getElementById('pageTitle')?.textContent || 'Herald';
    });
    if (window.HVTravelActions) {
      window.HVTravelActions.plan = context => window.HVTripPlanner.create(context);
      const add = window.HVTravelActions.add;
      window.HVTravelActions.add = (kind, context) => kind === 'trip'
        ? window.HVTripPlanner.create(context) : add(kind, context);
    }
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-plan-trip]');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.HVTripPlanner.create();
    }, true);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
