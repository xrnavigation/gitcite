// Phase 1.A — pre-paint theme application. Inlined in <head> BEFORE the
// stylesheet so the correct theme attribute is set when the first paint
// reads CSS custom properties (no FOUC).
(function () {
  try {
    var saved = localStorage.getItem('gitcite:theme');
    var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = (saved === 'light' || saved === 'dark') ? saved : system;
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
