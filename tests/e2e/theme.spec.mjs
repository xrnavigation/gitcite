import { test, expect } from '@playwright/test';

test.describe('Phase 1.A theme switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dist/index.html');
    await page.evaluate(() => localStorage.removeItem('gitcite:theme'));
    await page.reload();
  });

  test('html has data-theme attribute set on first paint', async ({ page }) => {
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(['light', 'dark']).toContain(theme);
  });

  test('theme toggle is a real <button> with accessible name', async ({ page }) => {
    const btn = page.getByRole('button', { name: /theme/i });
    await expect(btn).toBeVisible();
    const tag = await btn.evaluate((el) => el.tagName);
    expect(tag).toBe('BUTTON');
  });

  test('clicking toggle flips data-theme and persists to localStorage', async ({ page }) => {
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: /theme/i }).click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    const stored = await page.evaluate(() => localStorage.getItem('gitcite:theme'));
    expect(stored).toBe(after);
  });

  test('theme persists across reload (no FOUC test approximation)', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('gitcite:theme', 'dark'));
    await page.reload();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('reduced-motion: every transition resolves to none @a11y', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/dist/index.html');
    // Insert a probe element and a transition rule that should be flattened
    const transition = await page.evaluate(() => {
      const probe = document.createElement('button');
      probe.style.transition = 'all 1s ease';
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return computed;
    });
    // The token CSS should set a global rule that flattens transitions under
    // reduce. Accept '0s' or comma-separated zeros.
    expect(transition.replace(/\s/g, '')).toMatch(/^0s(,0s)*$/);
    await ctx.close();
  });

  test('focus-visible ring is set on interactive elements @a11y', async ({ page }) => {
    const btn = page.getByRole('button', { name: /theme/i });
    await btn.focus();
    const outlineWidth = await btn.evaluate((el) => getComputedStyle(el).outlineWidth);
    // outline-width can be reported in px; require >= 2px for 2.4.13
    const px = parseFloat(outlineWidth);
    expect(px).toBeGreaterThanOrEqual(2);
  });
});
