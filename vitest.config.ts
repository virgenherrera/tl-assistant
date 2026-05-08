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
        'src/foundation-context/commands/**',
        // Nest Commander adapter: Jira command side effects are covered through services/e2e boundaries.
        'src/jira-context/commands/**',
        // Nest Commander adapter: TL bootstrap command is covered through service/e2e boundaries.
        'src/tl-bootstrap/commands/**',
      ],
    },
  },
});
