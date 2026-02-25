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
        // Baseline thresholds — enforced across ALL source files (not just tested ones)
        // Current actual coverage: ~5.9% (Feb 22, 2026)
        // Ramp plan: 5% → 15% (Phase 1) → 40% (Phase 2) → 60% (Phase 3)
        statements: 5,
        branches: 4,
        functions: 5,
        lines: 5,
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
