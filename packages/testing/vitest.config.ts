import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/harness/setup.ts'],
    include: ['a11y/**/*.test.tsx', '../features/*/src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/src/model/*.test.ts'],
  },
});
