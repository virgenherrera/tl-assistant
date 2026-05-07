import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        '.tl-assistant/**',
        // Nest Commander adapter: validated by smoke/CLI usage, not the e2e domain flow.
        'src/dogma-context/commands/**',
      ],
    },
  },
});
