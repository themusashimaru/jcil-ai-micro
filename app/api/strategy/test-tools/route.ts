/**
 * STRATEGY TOOLS TEST ROUTE
 *
 * Tests all the E2B tools to verify they're working:
 * - Brave Search
 * - E2B Browser Visit
 * - E2B Screenshot
 * - E2B Code Execution
 */

import { NextResponse } from 'next/server';
import { executeScoutTool, getClaudeToolDefinitions } from '@/agents/strategy/tools';
import type { ScoutToolCall } from '@/agents/strategy/tools/types';
import { logger } from '@/lib/logger';

const log = logger('StrategyToolsTest');

export const maxDuration = 120; // 2 minutes for E2B operations

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // 1. Test tool definitions exist
  try {
    const toolDefs = getClaudeToolDefinitions();
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      toolDefinitions: {
        success: true,
        count: toolDefs.length,
        tools: toolDefs.map((t: { name: string }) => t.name),
      },
    };
  } catch (error) {
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      toolDefinitions: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // 2. Test Brave Search
  try {
    log.info('Testing Brave Search...');
    const braveCall: ScoutToolCall = {
      tool: 'brave_search',
      input: {
        query: 'test query weather today',
        count: 3,
      },
    };

    const braveResult = await executeScoutTool(braveCall);
    const braveOutput = braveResult.output as unknown as Record<string, unknown> | null;
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      braveSearch: {
        success: braveResult.success,
        hasResults: !!braveResult.output,
        resultCount: Array.isArray(braveOutput?.webResults)
          ? (braveOutput.webResults as unknown[]).length
          : 0,
        costIncurred: braveResult.costIncurred,
        error: braveOutput?.error,
      },
    };
  } catch (error) {
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      braveSearch: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // 3. Test E2B Browser Visit
  try {
    log.info('Testing E2B Browser Visit...');
    const browserCall: ScoutToolCall = {
      tool: 'browser_visit',
      input: {
        url: 'https://example.com',
        extractText: true,
        extractLinks: false,
      },
    };

    const browserResult = await executeScoutTool(browserCall);
    const output = browserResult.output as {
      title?: string;
      textContent?: string;
      error?: string;
    } | null;
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      browserVisit: {
        success: browserResult.success,
        hasTitle: !!output?.title,
        hasContent: !!output?.textContent,
        contentLength: output?.textContent?.length || 0,
        costIncurred: browserResult.costIncurred,
        error: output?.error,
      },
    };
  } catch (error) {
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      browserVisit: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // 4. Test E2B Screenshot
  try {
    log.info('Testing E2B Screenshot...');
    const screenshotCall: ScoutToolCall = {
      tool: 'screenshot',
      input: {
        url: 'https://example.com',
        fullPage: false,
        width: 800,
        height: 600,
      },
    };

    const screenshotResult = await executeScoutTool(screenshotCall);
    const ssOutput = screenshotResult.output as { imageBase64?: string; error?: string } | null;
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      screenshot: {
        success: screenshotResult.success,
        hasImage: !!ssOutput?.imageBase64,
        imageSize: ssOutput?.imageBase64?.length || 0,
        costIncurred: screenshotResult.costIncurred,
        error: ssOutput?.error,
      },
    };
  } catch (error) {
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      screenshot: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // 5. Test E2B Code Execution
  try {
    log.info('Testing E2B Code Execution...');
    const codeCall: ScoutToolCall = {
      tool: 'run_code',
      input: {
        language: 'python',
        code: 'print("Hello from E2B!")\nresult = 2 + 2\nprint(f"2 + 2 = {result}")',
      },
    };

    const codeResult = await executeScoutTool(codeCall);
    const codeOutput = codeResult.output as {
      stdout?: string;
      result?: unknown;
      error?: string;
    } | null;
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      codeExecution: {
        success: codeResult.success,
        hasOutput: !!codeOutput?.stdout || !!codeOutput?.result,
        stdout: codeOutput?.stdout,
        costIncurred: codeResult.costIncurred,
        error: codeOutput?.error,
      },
    };
  } catch (error) {
    results.tests = {
      ...(results.tests as Record<string, unknown>),
      codeExecution: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // Summary
  const tests = results.tests as Record<string, { success: boolean }>;
  const allPassed = Object.values(tests).every((t) => t.success);
  const passedCount = Object.values(tests).filter((t) => t.success).length;

  results.summary = {
    allPassed,
    passed: passedCount,
    total: Object.keys(tests).length,
    status: allPassed ? 'ALL TOOLS WORKING' : 'SOME TOOLS FAILED',
  };

  log.info('Strategy tools test complete', results.summary as Record<string, unknown>);

  return NextResponse.json(results);
}
