import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/i18n/**/*.spec.ts', 'src/core/**/*.spec.ts', 'src/sim/**/*.spec.ts', 'src/theme/**/*.spec.ts', 'src/app/**/*.model.spec.ts', 'src/app/position/**/*.spec.ts'],
    testTimeout: 30000,
  },
});
