import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { browserName: process.env.BEAMKIT_BROWSER === 'webkit' ? 'webkit' : 'chromium', baseURL: 'http://127.0.0.1:4173', acceptDownloads: true },
  webServer: { command: 'npm run preview -- --host 127.0.0.1', port: 4173, reuseExistingServer: false },
});
