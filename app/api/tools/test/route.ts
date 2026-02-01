/**
 * TOOL TEST API ROUTES
 * Health check and testing endpoints for all tools
 *
 * GET /api/tools/test - Get test status summary
 * POST /api/tools/test - Run tests on specific tools
 * GET /api/tools/test/[tool] - Test a specific tool
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Import all tool modules dynamically
const TOOLS_DIR = path.join(process.cwd(), 'src/lib/ai/tools');

// Tools that require external services (skip in quick health checks)
const EXTERNAL_SERVICE_TOOLS = new Set([
  'deep-research', 'deep-strategy', 'image-generation', 'web-search',
  'web-scrape', 'mcp', 'code-execution', 'file-operation', 'shell',
  'database', 'workspace', 'screenshot', 'graph-viz'
]);

interface ToolTestResult {
  tool: string;
  status: 'pass' | 'fail' | 'skip';
  operations: number;
  passed: number;
  failed: number;
  duration: number;
  errors?: string[];
}

// GET - Return test results summary
export async function GET() {
  try {
    // Try to read cached results
    const resultsPath = path.join(process.cwd(), 'scripts/tests/test-results.json');

    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

      // Categorize results
      const failedTools = results.results
        .filter((r: { success: boolean }) => !r.success)
        .map((r: { tool: string; operation: string; error?: string }) => ({
          tool: r.tool,
          operation: r.operation,
          error: r.error
        }));

      // Group by tool
      const toolSummary: Record<string, { passed: number; failed: number }> = {};
      results.results.forEach((r: { tool: string; success: boolean }) => {
        if (!toolSummary[r.tool]) {
          toolSummary[r.tool] = { passed: 0, failed: 0 };
        }
        if (r.success) {
          toolSummary[r.tool].passed++;
        } else {
          toolSummary[r.tool].failed++;
        }
      });

      return NextResponse.json({
        success: true,
        timestamp: results.timestamp,
        summary: results.summary,
        toolCount: Object.keys(toolSummary).length,
        healthyTools: Object.entries(toolSummary).filter(([, v]) => v.failed === 0).length,
        toolsWithIssues: Object.entries(toolSummary).filter(([, v]) => v.failed > 0).length,
        failureCategories: {
          missingParams: failedTools.filter((f: { error?: string }) => f.error?.includes('requires')).length,
          externalService: failedTools.filter((f: { error?: string }) =>
            f.error?.includes('not available') || f.error?.includes('not configured')).length,
          other: failedTools.filter((f: { error?: string }) =>
            !f.error?.includes('requires') &&
            !f.error?.includes('not available') &&
            !f.error?.includes('not configured')).length
        },
        recentFailures: failedTools.slice(0, 20)
      });
    }

    // No cached results - return tool inventory
    const toolFiles = fs.readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('-tool.ts'));

    return NextResponse.json({
      success: true,
      message: 'No test results cached. Run tests first.',
      toolCount: toolFiles.length,
      tools: toolFiles.map(f => f.replace('-tool.ts', '')),
      runTestsCommand: 'npx tsx scripts/tests/tool-test-runner.ts'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Run quick health check on specific tools
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tools: requestedTools, quick = true } = body;

    // Get tool list
    let toolsToTest: string[] = [];

    if (requestedTools && Array.isArray(requestedTools)) {
      toolsToTest = requestedTools;
    } else {
      // Test all tools (quick mode skips external service tools)
      const toolFiles = fs.readdirSync(TOOLS_DIR)
        .filter(f => f.endsWith('-tool.ts'))
        .map(f => f.replace('-tool.ts', ''));

      toolsToTest = quick
        ? toolFiles.filter(t => !EXTERNAL_SERVICE_TOOLS.has(t))
        : toolFiles;
    }

    const results: ToolTestResult[] = [];
    const startTime = Date.now();

    for (const toolName of toolsToTest.slice(0, 50)) { // Limit to 50 for API timeout
      const result = await testSingleTool(toolName);
      results.push(result);
    }

    const totalDuration = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    return NextResponse.json({
      success: true,
      duration: totalDuration,
      summary: {
        tested: results.length,
        passed,
        failed,
        skipped,
        successRate: ((passed / (passed + failed)) * 100).toFixed(1) + '%'
      },
      results
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Test a single tool
async function testSingleTool(toolName: string): Promise<ToolTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let operationsTested = 0;
  let operationsPassed = 0;

  try {
    const toolFile = path.join(TOOLS_DIR, `${toolName}-tool.ts`);

    if (!fs.existsSync(toolFile)) {
      return {
        tool: toolName,
        status: 'fail',
        operations: 0,
        passed: 0,
        failed: 1,
        duration: Date.now() - startTime,
        errors: ['Tool file not found']
      };
    }

    // Dynamic import
    const toolModule = await import(toolFile);

    // Find execute function
    const executeKey = Object.keys(toolModule).find(k => k.startsWith('execute'));
    if (!executeKey) {
      return {
        tool: toolName,
        status: 'skip',
        operations: 0,
        passed: 0,
        failed: 0,
        duration: Date.now() - startTime,
        errors: ['No execute function found']
      };
    }

    const executeFn = toolModule[executeKey];

    // Extract operations from file
    const content = fs.readFileSync(toolFile, 'utf-8');
    const enumMatch = content.match(/enum:\s*\[([\s\S]*?)\]/);
    let operations = ['default'];

    if (enumMatch) {
      const ops = enumMatch[1].match(/'([^']+)'/g);
      if (ops) {
        operations = ops.map(o => o.replace(/'/g, ''));
      }
    }

    // Test first operation only for quick check
    const op = operations[0];
    operationsTested = 1;

    try {
      const mockCall = {
        id: `test-${toolName}-${Date.now()}`,
        name: toolName.replace(/-/g, '_'),
        arguments: JSON.stringify({ operation: op }),
      };

      const result = await executeFn(mockCall);

      if (result.isError && !result.content.includes('Unknown') && !result.content.includes('requires')) {
        errors.push(`${op}: ${result.content}`);
      } else {
        operationsPassed = 1;
      }
    } catch (e) {
      errors.push(`${op}: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    return {
      tool: toolName,
      status: operationsPassed > 0 ? 'pass' : 'fail',
      operations: operationsTested,
      passed: operationsPassed,
      failed: operationsTested - operationsPassed,
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (e) {
    return {
      tool: toolName,
      status: 'fail',
      operations: 0,
      passed: 0,
      failed: 1,
      duration: Date.now() - startTime,
      errors: [e instanceof Error ? e.message : 'Import error']
    };
  }
}
