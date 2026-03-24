import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8081',
    headless: true,
  },
  webServer: {
    command: 'node scripts/host-web.mjs',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !process.env.CI,
  },
});
