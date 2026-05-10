// Phase 1.A — theme switcher. Reads localStorage for "gitcite:theme",
// applies data-theme on <html>, mounts a real <button> in the header.
// Pre-paint application happens in src/a11y/theme-bootstrap.js (inline
// in <head>) so there is no flash on initial load.

(function () {
  'use strict';

  const STORAGE_KEY = 'gitcite:theme';

  function readPref() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (_) {}
    return null;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function persistTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    persistTheme(next);
    updateButton(next);
  }

  function updateButton(theme) {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
    btn.textContent = theme === 'dark' ? 'Light theme' : 'Dark theme';
  }

  function mountToggle() {
    // Phase 18 #4 — header theme toggle removed. The theme is now chosen
    // exclusively from Settings → Theme, so we no longer mount a header
    // button. The `apply` / `persist` / `read` API stays public for the
    // pre-paint bootstrap and the settings dialog. If any deployment
    // wants to re-add a header button, they can render it themselves and
    // call GitCiteTheme.toggle().
  }

  // Public API for tests and later phases.
  globalThis.GitCiteTheme = {
    apply: applyTheme,
    persist: persistTheme,
    current: currentTheme,
    toggle: toggleTheme,
    read: readPref,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle);
  } else {
    mountToggle();
  }
})();
