window.addEventListener?.('travel-libs-ready', () => {
  if (els.mapFallback) {
    renderWorldMap();
    initCloudFromConfig();
  }
});
document.addEventListener('DOMContentLoaded', init);
