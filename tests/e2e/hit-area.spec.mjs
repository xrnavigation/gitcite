// Phase 1.H — hit-area audit. Asserts every interactive element on the page
// is at least 44 × 44 CSS px. WCAG 2.5.5 (AAA).
import { test, expect } from '@playwright/test';

test.describe('Phase 1.H hit-area audit', () => {
  for (const theme of ['light', 'dark']) {
    test(`every interactive element is >= 44x44 in ${theme} theme @a11y`, async ({ page }) => {
      await page.goto('/dist/index.html');
      await page.evaluate((t) => {
        localStorage.setItem('gitcite:theme', t);
      }, theme);
      await page.reload();

      const offenders = await page.evaluate(() => {
        const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="menuitem"]';
        const out = [];
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          // Skip elements that aren't visible at all (off-screen sr-only)
          const cs = getComputedStyle(el);
          if (cs.position === 'absolute' && parseInt(cs.left, 10) <= -1000) return;
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          if (r.width === 0 && r.height === 0) return;
          if (r.width < 44 || r.height < 44) {
            out.push({ tag: el.tagName, text: (el.textContent || '').slice(0, 40), w: r.width, h: r.height });
          }
        });
        return out;
      });

      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});
