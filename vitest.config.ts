import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'lib/**/*.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts'],
      exclude: ['node_modules', '.next', '**/*.d.ts', '**/*.test.ts', '**/*.test.tsx', 'tests/**'],
      thresholds: {
        // Coverage thresholds — enforced across ALL source files
        // Current actual: 41.25% statements/lines, 80.71% branches, 72.57% functions (Feb 27, 2026)
        // Ramp plan: 5% → 15% (Phase 1) → 40% (Phase 2, done) → 60% (Phase 3)
        statements: 35,
        branches: 60,
        functions: 60,
        lines: 35,
      },
    },
  },
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './app'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
