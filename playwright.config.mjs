import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:7118',
    trace: 'retain-on-failure',
    // Headless so tests don't steal focus from other windows / tabs.
    headless: true,
    launchOptions: {
      // Belt-and-suspenders: keep any Chromium windows out of the way even
      // on platforms where a process briefly surfaces in headless mode.
      args: ['--window-position=10000,10000', '--window-size=1280,720'],
    },
  },
  webServer: {
    command: 'node tools/static-server.mjs',
    url: 'http://127.0.0.1:7118/dist/index.html',
    reuseExistingServer: true,
    timeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
