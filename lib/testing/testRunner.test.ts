import { describe, it, expect } from 'vitest';
import {
  generateTests,
  runTests,
  generateReport,
  validateForDeployment,
  type TestCase,
  type TestResult,
  type TestReport,
} from './testRunner';

describe('lib/testing/testRunner', () => {
  // ── generateTests ─────────────────────────────────────────────

  describe('generateTests', () => {
    it('generates tests for API routes', () => {
      const files = [{ path: 'app/api/users/route.ts', content: 'export async function GET() {}' }];
      const tests = generateTests(files);
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].type).toBe('integration');
    });

    it('generates tests for React components', () => {
      const files = [
        { path: 'components/Button.tsx', content: 'export default function Button() {}' },
      ];
      const tests = generateTests(files);
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].type).toBe('unit');
    });

    it('generates tests for utility files', () => {
      const files = [{ path: 'lib/utils/format.ts', content: 'export function format() {}' }];
      const tests = generateTests(files);
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].type).toBe('unit');
    });

    it('skips non-code files', () => {
      const files = [{ path: 'README.md', content: '# Readme' }];
      const tests = generateTests(files);
      expect(tests).toHaveLength(0);
    });

    it('skips existing test files', () => {
      const files = [{ path: 'lib/utils/format.test.ts', content: 'test code' }];
      const tests = generateTests(files);
      expect(tests).toHaveLength(0);
    });

    it('skips spec files', () => {
      const files = [{ path: 'lib/utils/format.spec.ts', content: 'spec code' }];
      const tests = generateTests(files);
      expect(tests).toHaveLength(0);
    });

    it('generates unique test IDs', () => {
      const files = [
        { path: 'lib/a.ts', content: 'export function a() {}' },
        { path: 'lib/b.ts', content: 'export function b() {}' },
      ];
      const tests = generateTests(files);
      if (tests.length >= 2) {
        expect(tests[0].id).not.toBe(tests[1].id);
      }
    });

    it('handles empty files array', () => {
      const tests = generateTests([]);
      expect(tests).toHaveLength(0);
    });
  });

  // ── runTests ──────────────────────────────────────────────────

  describe('runTests', () => {
    it('returns results for each test', async () => {
      const tests: TestCase[] = [
        { id: 't1', name: 'Test 1', description: 'First test', type: 'unit', code: 'test code' },
      ];
      const results = await runTests(tests);
      expect(results).toHaveLength(1);
      expect(results[0].testId).toBe('t1');
    });

    it('returns results with required fields', async () => {
      const tests: TestCase[] = [
        { id: 't1', name: 'Test 1', description: 'Desc', type: 'unit', code: 'code' },
      ];
      const results = await runTests(tests);
      expect(results[0].name).toBeDefined();
      expect(typeof results[0].passed).toBe('boolean');
      expect(typeof results[0].duration).toBe('number');
    });

    it('handles empty test array', async () => {
      const results = await runTests([]);
      expect(results).toHaveLength(0);
    });
  });

  // ── generateReport ────────────────────────────────────────────

  describe('generateReport', () => {
    it('generates report from results', () => {
      const results: TestResult[] = [
        { testId: 't1', name: 'Test 1', passed: true, duration: 100 },
        { testId: 't2', name: 'Test 2', passed: false, duration: 50, error: 'Failed' },
      ];
      const report = generateReport('TestProject', results);
      expect(report.projectName).toBe('TestProject');
      expect(report.totalTests).toBe(2);
      expect(report.passed).toBe(1);
      expect(report.failed).toBe(1);
    });

    it('calculates total duration', () => {
      const results: TestResult[] = [
        { testId: 't1', name: 'Test 1', passed: true, duration: 100 },
        { testId: 't2', name: 'Test 2', passed: true, duration: 200 },
      ];
      const report = generateReport('TestProject', results);
      expect(report.duration).toBeGreaterThanOrEqual(300);
    });

    it('handles empty results', () => {
      const report = generateReport('Empty', []);
      expect(report.totalTests).toBe(0);
      expect(report.passed).toBe(0);
      expect(report.failed).toBe(0);
    });
  });

  // ── validateForDeployment ─────────────────────────────────────

  describe('validateForDeployment', () => {
    it('validates deployment readiness', async () => {
      const result = await validateForDeployment([]);
      expect(result).toBeDefined();
    });
  });

  // ── Types ─────────────────────────────────────────────────────

  describe('type exports', () => {
    it('TestCase has required shape', () => {
      const tc: TestCase = { id: 't1', name: 'T', description: 'D', type: 'unit', code: 'c' };
      expect(tc.type).toBe('unit');
    });

    it('TestResult has required shape', () => {
      const tr: TestResult = { testId: 't1', name: 'T', passed: true, duration: 10 };
      expect(tr.passed).toBe(true);
    });

    it('TestReport has required shape', () => {
      const report: TestReport = {
        projectName: 'P',
        totalTests: 0,
        passed: 0,
        failed: 0,
        coverage: 0,
        duration: 0,
        results: [],
        generatedAt: new Date(),
      };
      expect(report.totalTests).toBe(0);
    });
  });
});
