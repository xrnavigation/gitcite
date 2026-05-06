// Phase 3 — landing screen + import flows. DESIGN_SPEC §6, §7.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Phase 3 — landing screen', () => {
  test.beforeEach(async ({ page }) => {
    // Disable autoLoad so the landing screen renders.
    await page.addInitScript(() => {
      // Override config before app boot.
      Object.defineProperty(window, '__noAutoLoad', { value: true });
    });
    await page.goto('/dist/index.html');
    // Force-disable autoLoad by replacing it after load.
    await page.evaluate(() => {
      if (window.GITCITE_CONFIG) window.GITCITE_CONFIG.autoLoad = null;
    });
    await page.reload();
    // Allow async start() to run.
    await page.waitForLoadState('networkidle');
  });

  test('all four affordances render and are real <button> elements (or files)', async ({ page }) => {
    await expect(page.locator('button[data-import-bib]')).toBeVisible();
    await expect(page.locator('button[data-import-csv]')).toBeVisible();
    await expect(page.locator('button[data-empty-start]')).toBeVisible();
    await expect(page.locator('[data-drop-zone]')).toBeVisible();
  });

  test('Import .bib button precedes the drop zone in tab order (WCAG 2.5.7)', async ({ page }) => {
    const bibIndex = await page.evaluate(() => {
      const btn = document.querySelector('button[data-import-bib]');
      const drop = document.querySelector('[data-drop-zone]');
      const cmp = btn.compareDocumentPosition(drop);
      // 4 = DOCUMENT_POSITION_FOLLOWING — drop is after button → button is earlier
      return Boolean(cmp & 4);
    });
    expect(bibIndex).toBe(true);
  });

  test('drop zone has tabindex=-1 (keyboard substitute is the buttons above)', async ({ page }) => {
    const ti = await page.locator('[data-drop-zone]').getAttribute('tabindex');
    expect(ti).toBe('-1');
  });

  test('Start with empty library shows a toast', async ({ page }) => {
    await page.locator('button[data-empty-start]').click();
    await expect(page.locator('[data-toast]')).toContainText(/empty library/);
  });

  test('axe-core finds zero violations on the landing screen @a11y', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('importing a .bib via JS API shows the entry-count toast', async ({ page }) => {
    await page.evaluate(() => {
      window.GitCiteApp.import.bibText('@article{x, title = {Cities}, year = {2024}}');
    });
    await expect(page.locator('[data-toast]')).toContainText(/1 entries imported/);
  });

  test('CSV mapping dialog renders with one fieldset per column @a11y', async ({ page }) => {
    await page.evaluate(() => {
      window.GitCiteApp.import.csvText('Title,Authors,Publication Year\nCities,"Smith, A.",2024');
    });
    await expect(page.locator('dialog [data-mapping-row]')).toHaveCount(3);
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('CSV mapping dialog auto-maps known headers', async ({ page }) => {
    await page.evaluate(() => {
      window.GitCiteApp.import.csvText('Authors,Title\n"Smith, A.","Cities"');
    });
    const firstSelectValue = await page.locator('dialog select[data-mapping-target]').first().inputValue();
    expect(firstSelectValue).toBe('author');
  });
});
