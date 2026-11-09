import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const PORT = 4320;

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx ng build && node e2e/serve-dist.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
