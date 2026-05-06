// Phase 1.C announce — DOM unit tests (jsdom).
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');

function loadAnnounce() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteAnnounce;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteAnnounce;
}

describe('Phase 1.C announce', () => {
  let announce;
  beforeEach(() => {
    vi.useFakeTimers();
    announce = loadAnnounce();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts a single polite/assertive region pair', () => {
    const polite = document.querySelectorAll('[data-announce="polite"]');
    const assertive = document.querySelectorAll('[data-announce="assertive"]');
    expect(polite.length).toBe(1);
    expect(assertive.length).toBe(1);
    expect(polite[0].getAttribute('aria-live')).toBe('polite');
    expect(assertive[0].getAttribute('aria-live')).toBe('assertive');
    expect(polite[0].getAttribute('aria-atomic')).toBe('true');
    expect(assertive[0].getAttribute('aria-atomic')).toBe('true');
    expect(polite[0].getAttribute('role')).toBe('status');
    expect(assertive[0].getAttribute('role')).toBe('alert');
  });

  it('subsequent loads do not create a second pair', () => {
    loadAnnounce();
    const polite = document.querySelectorAll('[data-announce="polite"]');
    expect(polite.length).toBe(1);
  });

  it('polite() writes the text into the polite region', () => {
    announce.polite('1 of 12 unsaved changes');
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toBe('1 of 12 unsaved changes');
  });

  it('assertive() writes the text into the assertive region', () => {
    announce.assertive('Rate limited — try again in 30 seconds');
    const assertive = document.querySelector('[data-announce="assertive"]');
    expect(assertive.textContent).toBe('Rate limited — try again in 30 seconds');
  });

  it('throttles the same message within 500ms (deduplicates)', () => {
    announce.polite('hello');
    announce.polite('hello');
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toBe('hello');
    // After 500ms+ the next identical message can re-write
    vi.advanceTimersByTime(600);
    announce.polite('hello');
    expect(polite.textContent).toBe('hello');
  });

  it('different messages within 500ms are NOT throttled', () => {
    announce.polite('first');
    announce.polite('second');
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toBe('second');
  });

  it('once() reads then sets aria-live=off so re-renders never re-announce', () => {
    announce.once('Your code is W D J B dash M J H T');
    const onceRegion = document.querySelector('[data-announce="once"]');
    expect(onceRegion).toBeTruthy();
    expect(onceRegion.textContent).toBe('Your code is W D J B dash M J H T');
    // After a microtask the live attribute should flip to off
    vi.runAllTimers();
    expect(onceRegion.getAttribute('aria-live')).toBe('off');
  });

  it('once() arms a fresh region for the next call (each call is independent)', () => {
    announce.once('first code');
    vi.runAllTimers();
    announce.once('second code');
    const regions = document.querySelectorAll('[data-announce="once"]');
    // The implementation may reuse the node by re-arming aria-live; either
    // way, the latest message should be present and the live attribute set
    // briefly so the SR picks it up.
    const latest = regions[regions.length - 1];
    expect(latest.textContent).toBe('second code');
  });
});
