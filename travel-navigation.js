/* Existing upcoming tools remain informational; working tools use their own routes. */
(() => {
  'use strict';
  const names = ['Road Trip Planner', 'Currency Converter'];
  function boot() {
    if (document.body.dataset.accountPage) return;
    const tools = document.getElementById('toolsView') || window.HVPages?.get('toolsView');
    if (!tools) return;
    // Keep the existing page nodes, utility links and workspace navigation intact.
    tools.addEventListener('click', event => {
      const button = event.target.closest('[data-coming-tool]');
      const name = button && names[Number(button.dataset.comingTool)];
      if (!name) return;
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog small-dialog';
      dialog.setAttribute('aria-label', name);
      dialog.innerHTML = '<div class="dialog-card"><p class="eyebrow">COMING SOON</p><h2></h2><p>This travel tool is on its way.</p><button class="secondary" type="button">Close</button></div>';
      dialog.querySelector('h2').textContent = name;
      document.body.append(dialog);
      dialog.querySelector('button').onclick = () => dialog.close();
      dialog.onclose = () => { dialog.remove(); button.focus(); };
      dialog.showModal();
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
