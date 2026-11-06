import { defineConfig, devices } from '@playwright/test';

const PORT = 4310;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, testIdAttribute: 'data-test' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, testIdAttribute: 'data-test' } },
  ],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
