import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use the setup file to mock dependencies
    setupFiles: ['./test/setup.ts'],

    // Enable globals (describe, it, expect)
    globals: true,

    // Test environment
    environment: 'node',

    // Include test files
    include: ['test/**/*.test.ts'],

    // Exclude node_modules
    exclude: ['node_modules', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'test', 'dist', '**/*.d.ts'],
    },

    // Timeout for tests
    testTimeout: 10000,

    // Reporter
    reporters: ['verbose'],
  },
});
