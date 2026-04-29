import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // CLI entry has minimal logic; sleep is a trivial setTimeout wrapper (tested via http.ts)
      exclude: ['src/index.ts', 'src/schemas/**', 'src/client/sleep.ts'],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85,
      },
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
