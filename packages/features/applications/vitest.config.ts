import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // status.test.ts uses node:test runner — executed via test:model script.
    // Exclude it from vitest to avoid "No test suite found" failures.
    exclude: ['src/model/status.test.ts', '**/node_modules/**'],
  },
});
