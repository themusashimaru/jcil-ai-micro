/**
 * RESEARCH AGENT TEST ROUTE
 *
 * Tests the Research Agent components:
 * - Intent detection
 * - Brave Search executor
 * - Document search executor
 * - Brain modules (Synthesizer, QualityControl)
 *
 * GET /api/research/test
 *
 * PROTECTED: Requires admin authentication
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

// Research Agent imports
import { isResearchAgentEnabled, shouldUseResearchAgent } from '@/agents/research';
import { braveExecutor } from '@/agents/research/executors/BraveExecutor';
import { documentExecutor } from '@/agents/research/executors/DocumentExecutor';
import { synthesizer } from '@/agents/research/brain/Synthesizer';
import { qualityControl } from '@/agents/research/brain/QualityControl';

const log = logger('ResearchAgentTest');

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

  log.info('Running Research Agent tests');

  const results: TestResult[] = [];

  // 1. Test Feature Flag
  try {
    const enabled = isResearchAgentEnabled();
    results.push({
      name: 'Feature Flag',
      success: true,
      details: {
        enabled,
        envVar: 'DISABLE_RESEARCH_AGENT',
      },
    });
  } catch (error) {
    results.push({
      name: 'Feature Flag',
      success: false,
      error: (error as Error).message,
    });
  }

  // 2. Test Intent Detection
  try {
    const testCases = [
      { query: 'Research my competitors in AI', expected: true },
      { query: 'Market research for e-commerce', expected: true },
      { query: 'Deep dive into industry trends', expected: true },
      { query: 'Hello, how are you?', expected: false },
      { query: 'What is TypeScript?', expected: false },
      { query: 'Analyze this document', expected: false },
    ];

    const detection = testCases.map((tc) => ({
      query: tc.query,
      expected: tc.expected,
      actual: shouldUseResearchAgent(tc.query),
      pass: shouldUseResearchAgent(tc.query) === tc.expected,
    }));

    const allPassed = detection.every((d) => d.pass);

    results.push({
      name: 'Intent Detection',
      success: allPassed,
      details: {
        testsRun: testCases.length,
        passed: detection.filter((d) => d.pass).length,
        failed: detection.filter((d) => !d.pass).length,
        failedCases: detection.filter((d) => !d.pass).map((d) => d.query),
      },
    });
  } catch (error) {
    results.push({
      name: 'Intent Detection',
      success: false,
      error: (error as Error).message,
    });
  }

  // 3. Test Brave Executor
  try {
    const isAvailable = braveExecutor.isAvailable();

    if (isAvailable) {
      // Perform a minimal test search
      const testQuery = {
        id: 'test-1',
        query: 'test query',
        purpose: 'Testing',
        expectedInfo: [] as string[],
        source: 'brave' as const,
        priority: 1,
      };

      const searchResult = await braveExecutor.execute(testQuery);

      results.push({
        name: 'Brave Executor',
        success: (searchResult.relevanceScore ?? 0) >= 0,
        details: {
          available: true,
          hasContent: !!searchResult.content,
          contentLength: searchResult.content?.length || 0,
          relevanceScore: searchResult.relevanceScore ?? 0,
        },
      });
    } else {
      results.push({
        name: 'Brave Executor',
        success: false,
        details: { available: false },
        error: 'BRAVE_API_KEY not configured',
      });
    }
  } catch (error) {
    results.push({
      name: 'Brave Executor',
      success: false,
      error: (error as Error).message,
    });
  }

  // 4. Test Document Executor (module load only)
  try {
    // Just check if module loads correctly
    const hasDocuments = await documentExecutor.isAvailable('test-user');

    results.push({
      name: 'Document Executor',
      success: true,
      details: {
        moduleLoaded: true,
        testUserHasDocuments: hasDocuments,
      },
    });
  } catch (error) {
    results.push({
      name: 'Document Executor',
      success: false,
      error: (error as Error).message,
    });
  }

  // 5. Test Synthesizer Module (check module loads)
  try {
    // Just verify the module loads and has expected methods
    const hasFormatMethod = typeof synthesizer.formatAsMarkdown === 'function';
    const hasSynthesizeMethod = typeof synthesizer.synthesize === 'function';

    results.push({
      name: 'Synthesizer Module',
      success: hasFormatMethod && hasSynthesizeMethod,
      details: {
        moduleLoaded: true,
        hasFormatMethod,
        hasSynthesizeMethod,
      },
    });
  } catch (error) {
    results.push({
      name: 'Synthesizer Module',
      success: false,
      error: (error as Error).message,
    });
  }

  // 6. Test Quality Control Module
  try {
    // Test question refinement (quick test)
    const refinement = await qualityControl.refineQuestion('Tell me about competitors');

    results.push({
      name: 'Quality Control Module',
      success: !!refinement.refinedQuestion,
      details: {
        originalQuestion: refinement.originalQuestion,
        refinedQuestion: refinement.refinedQuestion?.substring(0, 100),
        clarifyingQuestions: refinement.clarifyingQuestions?.length || 0,
      },
    });
  } catch (error) {
    results.push({
      name: 'Quality Control Module',
      success: false,
      error: (error as Error).message,
    });
  }

  // Summary
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const allPassed = failed === 0;

  log.info('Research Agent tests complete', {
    passed,
    failed,
    allPassed,
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    agent: 'Research Agent',
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
