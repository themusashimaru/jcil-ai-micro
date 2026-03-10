/**
 * CODE AGENT TEST ROUTE
 *
 * Tests the Code Agent components:
 * - Intent detection (build vs review)
 * - Brain modules (IntentAnalyzer, Reasoner, etc.)
 * - Security scanner
 * - Performance analyzer
 *
 * GET /api/code/test
 *
 * PROTECTED: Requires admin authentication
 */

import { successResponse } from '@/lib/api/utils';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

// Code Agent imports
import { isCodeAgentEnabled, shouldUseCodeAgent, isCodeReviewRequest } from '@/agents/code';
import { codeIntentAnalyzer } from '@/agents/code/brain/IntentAnalyzer';
import { reasoner } from '@/agents/code/brain/Reasoner';
import { securityScanner } from '@/agents/code/brain/SecurityScanner';
import { performanceAnalyzer } from '@/agents/code/brain/PerformanceAnalyzer';

const log = logger('CodeAgentTest');

export const maxDuration = 60; // 60 seconds for tests

interface TestResult {
  name: string;
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export async function GET() {
  // Require admin auth
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  log.info('Running Code Agent tests');

  const results: TestResult[] = [];

  // 1. Test Feature Flag
  try {
    const enabled = isCodeAgentEnabled();
    results.push({
      name: 'Feature Flag',
      success: true,
      details: {
        enabled,
        envVar: 'DISABLE_CODE_AGENT',
      },
    });
  } catch (error) {
    results.push({
      name: 'Feature Flag',
      success: false,
      error: (error as Error).message,
    });
  }

  // 2. Test Build Request Detection
  try {
    const buildCases = [
      { query: 'Build me a React app', expected: true },
      { query: 'Create an API with Express', expected: true },
      { query: 'Code a CLI tool in Node.js', expected: true },
      { query: 'Generate a TypeScript project', expected: true },
      { query: 'What is React?', expected: false },
      { query: 'Hello!', expected: false },
    ];

    const detection = buildCases.map((tc) => ({
      query: tc.query,
      expected: tc.expected,
      actual: shouldUseCodeAgent(tc.query),
      pass: shouldUseCodeAgent(tc.query) === tc.expected,
    }));

    const allPassed = detection.every((d) => d.pass);

    results.push({
      name: 'Build Request Detection',
      success: allPassed,
      details: {
        testsRun: buildCases.length,
        passed: detection.filter((d) => d.pass).length,
        failedCases: detection.filter((d) => !d.pass).map((d) => d.query),
      },
    });
  } catch (error) {
    results.push({
      name: 'Build Request Detection',
      success: false,
      error: (error as Error).message,
    });
  }

  // 3. Test Review Request Detection
  try {
    const reviewCases = [
      { query: 'Review my code', expected: true },
      { query: 'Check my repository for bugs', expected: true },
      { query: 'Analyze the code quality', expected: true },
      { query: 'Build me an app', expected: false },
      { query: 'What is Python?', expected: false },
    ];

    const detection = reviewCases.map((tc) => ({
      query: tc.query,
      expected: tc.expected,
      actual: isCodeReviewRequest(tc.query),
      pass: isCodeReviewRequest(tc.query) === tc.expected,
    }));

    const allPassed = detection.every((d) => d.pass);

    results.push({
      name: 'Review Request Detection',
      success: allPassed,
      details: {
        testsRun: reviewCases.length,
        passed: detection.filter((d) => d.pass).length,
        failedCases: detection.filter((d) => !d.pass).map((d) => d.query),
      },
    });
  } catch (error) {
    results.push({
      name: 'Review Request Detection',
      success: false,
      error: (error as Error).message,
    });
  }

  // 4. Test Intent Analyzer
  try {
    const analysis = await codeIntentAnalyzer.analyze('Build a REST API', {
      userId: 'test-user',
    });

    results.push({
      name: 'Intent Analyzer',
      success: !!analysis,
      details: {
        hasProjectType: !!analysis.projectType,
        projectType: analysis.projectType,
        hasTechnologies: !!analysis.technologies?.primary,
        primaryTech: analysis.technologies?.primary,
        hasRequirements: (analysis.requirements?.functional?.length || 0) > 0,
      },
    });
  } catch (error) {
    results.push({
      name: 'Intent Analyzer',
      success: false,
      error: (error as Error).message,
    });
  }

  // 5. Test Reasoner Module (check module loads)
  try {
    // Just test that module loads and has expected methods
    const hasReasonMethod = typeof reasoner.reason === 'function';

    results.push({
      name: 'Reasoner Module',
      success: hasReasonMethod,
      details: {
        moduleLoaded: true,
        hasReasonMethod,
      },
    });
  } catch (error) {
    results.push({
      name: 'Reasoner Module',
      success: false,
      error: (error as Error).message,
    });
  }

  // 6. Test Security Scanner (check module loads)
  try {
    // Just verify the module loads and has expected methods
    const hasScanMethod = typeof securityScanner.scan === 'function';

    results.push({
      name: 'Security Scanner',
      success: hasScanMethod,
      details: {
        moduleLoaded: true,
        hasScanMethod,
      },
    });
  } catch (error) {
    results.push({
      name: 'Security Scanner',
      success: false,
      error: (error as Error).message,
    });
  }

  // 7. Test Performance Analyzer (check module loads)
  try {
    // Just verify the module loads and has expected methods
    const hasAnalyzeMethod = typeof performanceAnalyzer.analyze === 'function';

    results.push({
      name: 'Performance Analyzer',
      success: hasAnalyzeMethod,
      details: {
        moduleLoaded: true,
        hasAnalyzeMethod,
      },
    });
  } catch (error) {
    results.push({
      name: 'Performance Analyzer',
      success: false,
      error: (error as Error).message,
    });
  }

  // Summary
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const allPassed = failed === 0;

  log.info('Code Agent tests complete', {
    passed,
    failed,
    allPassed,
  });

  return successResponse({
    timestamp: new Date().toISOString(),
    agent: 'Code Agent',
    summary: {
      allPassed,
      passed,
      failed,
      total: results.length,
    },
    results,
    authenticatedAs: auth.user.email,
  });
}
