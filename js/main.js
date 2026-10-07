(function (g) {
  const boot = () => g.YG.ui.init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis);
