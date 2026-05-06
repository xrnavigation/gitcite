// Phase 1.C announce — singleton live regions consumed by every later phase.
// WCAG 4.1.3 (Status Messages), 2.2.4 (Interruptions). Discipline rule:
// every later feature must announce through this module — no ad-hoc
// aria-live regions in views/.
//
// Public API (globalThis.GitCiteAnnounce):
//   polite(text)    — write to the polite region; throttled per-message 500ms
//   assertive(text) — write to the assertive region; throttled per-message
//   once(text)      — write once, then set aria-live=off so re-renders never
//                     re-announce the same value (used by the OAuth user
//                     code in §14.2 — DESIGN_SPEC §14.2 hotspot H3)

(function () {
  'use strict';

  if (globalThis.GitCiteAnnounce) return;

  const SR_ONLY_STYLE = [
    'position:absolute',
    'width:1px',
    'height:1px',
    'padding:0',
    'margin:-1px',
    'overflow:hidden',
    'clip:rect(0,0,0,0)',
    'white-space:nowrap',
    'border:0',
  ].join(';');

  function ensureRegion(kind, role, live) {
    let node = document.querySelector(`[data-announce="${kind}"]`);
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-announce', kind);
      node.setAttribute('aria-live', live);
      node.setAttribute('aria-atomic', 'true');
      node.setAttribute('role', role);
      node.style.cssText = SR_ONLY_STYLE;
      document.body.appendChild(node);
    }
    return node;
  }

  function getOrCreateRegions() {
    return {
      polite: ensureRegion('polite', 'status', 'polite'),
      assertive: ensureRegion('assertive', 'alert', 'assertive'),
    };
  }

  // Throttle: { 'polite|hello': lastWriteMs }
  const lastWrite = new Map();
  const THROTTLE_MS = 500;

  function write(region, kind, text) {
    if (!text) return;
    const key = kind + '|' + text;
    const now = Date.now();
    const prev = lastWrite.get(key) || 0;
    if (now - prev < THROTTLE_MS) return;
    lastWrite.set(key, now);
    region.textContent = text;
  }

  function polite(text) {
    write(getOrCreateRegions().polite, 'polite', text);
  }

  function assertive(text) {
    write(getOrCreateRegions().assertive, 'assertive', text);
  }

  // once() uses a separate region so the polite/assertive regions are not
  // muted globally. A new region is mounted (or re-armed) for each call.
  function once(text) {
    if (!text) return;
    let region = document.querySelector('[data-announce="once"]');
    if (!region) {
      region = document.createElement('div');
      region.setAttribute('data-announce', 'once');
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('role', 'status');
      region.style.cssText = SR_ONLY_STYLE;
      document.body.appendChild(region);
    }
    region.setAttribute('aria-live', 'polite');
    region.textContent = text;
    // Mute on next microtask so subsequent re-renders or polls don't re-fire.
    setTimeout(() => {
      region.setAttribute('aria-live', 'off');
    }, 0);
  }

  // Mount regions immediately so first call is synchronous.
  if (document.body) {
    getOrCreateRegions();
  } else {
    document.addEventListener('DOMContentLoaded', getOrCreateRegions);
  }

  globalThis.GitCiteAnnounce = { polite, assertive, once };
})();
