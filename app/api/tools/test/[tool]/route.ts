/**
 * INDIVIDUAL TOOL TEST ENDPOINT
 * Test a specific tool by name
 *
 * GET /api/tools/test/[tool] - Test all operations for a tool
 * POST /api/tools/test/[tool] - Test with custom parameters
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { requireAdmin } from '@/lib/auth/admin-guard';

const TOOLS_DIR = path.join(process.cwd(), 'src/lib/ai/tools');

interface TestOperation {
  operation: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

// GET - Test all operations for a specific tool
export async function GET(_request: Request, { params }: { params: Promise<{ tool: string }> }) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tool: toolName } = await params;

  try {
    const toolFile = path.join(TOOLS_DIR, `${toolName}-tool.ts`);

    if (!fs.existsSync(toolFile)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tool '${toolName}' not found`,
          availableTools: fs
            .readdirSync(TOOLS_DIR)
            .filter((f) => f.endsWith('-tool.ts'))
            .map((f) => f.replace('-tool.ts', ''))
            .filter((t) => t.startsWith(toolName.charAt(0)))
            .slice(0, 10),
        },
        { status: 404 }
      );
    }

    // Dynamic import
    const toolModule = await import(toolFile);

    // Find execute function
    const executeKey = Object.keys(toolModule).find((k) => k.startsWith('execute'));
    if (!executeKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No execute function found in tool',
        },
        { status: 400 }
      );
    }

    const executeFn = toolModule[executeKey];

    // Find tool definition
    const toolDefKey = Object.keys(toolModule).find(
      (k) => k.endsWith('Tool') && !k.startsWith('execute')
    );
    const toolDef = toolDefKey ? toolModule[toolDefKey] : null;

    // Extract operations from file
    const content = fs.readFileSync(toolFile, 'utf-8');
    const enumMatch = content.match(/enum:\s*\[([\s\S]*?)\]/);
    let operations = ['default'];

    if (enumMatch) {
      const ops = enumMatch[1].match(/'([^']+)'/g);
      if (ops) {
        operations = ops.map((o) => o.replace(/'/g, ''));
      }
    }

    // Test each operation
    const results: TestOperation[] = [];
    let passed = 0;
    let failed = 0;

    for (const op of operations) {
      const startTime = Date.now();
      try {
        const mockCall = {
          id: `test-${toolName}-${op}-${Date.now()}`,
          name: toolName.replace(/-/g, '_'),
          arguments: JSON.stringify({ operation: op }),
        };

        const result = await executeFn(mockCall);
        const duration = Date.now() - startTime;

        if (result.isError) {
          // Check if it's an expected error (missing params)
          const isExpected =
            result.content.includes('requires') || result.content.includes('Unknown');

          results.push({
            operation: op,
            success: isExpected,
            error: result.content,
            duration,
          });

          if (isExpected) passed++;
          else failed++;
        } else {
          let parsedResult;
          try {
            parsedResult = JSON.parse(result.content);
          } catch {
            parsedResult = result.content;
          }

          results.push({
            operation: op,
            success: true,
            result: parsedResult,
            duration,
          });
          passed++;
        }
      } catch (e) {
        const duration = Date.now() - startTime;
        results.push({
          operation: op,
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          duration,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      tool: toolName,
      description: toolDef?.description || 'No description',
      parameters: toolDef?.parameters || {},
      summary: {
        operations: operations.length,
        passed,
        failed,
        successRate: ((passed / operations.length) * 100).toFixed(1) + '%',
      },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Test with custom parameters
export async function POST(request: Request, { params }: { params: Promise<{ tool: string }> }) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { tool: toolName } = await params;

  try {
    const body = await request.json();
    const { operation, ...customParams } = body;

    const toolFile = path.join(TOOLS_DIR, `${toolName}-tool.ts`);

    if (!fs.existsSync(toolFile)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tool '${toolName}' not found`,
        },
        { status: 404 }
      );
    }

    // Dynamic import
    const toolModule = await import(toolFile);
    const executeKey = Object.keys(toolModule).find((k) => k.startsWith('execute'));

    if (!executeKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No execute function found',
        },
        { status: 400 }
      );
    }

    const executeFn = toolModule[executeKey];

    // Execute with custom params
    const startTime = Date.now();
    const mockCall = {
      id: `test-${toolName}-${Date.now()}`,
      name: toolName.replace(/-/g, '_'),
      arguments: JSON.stringify({ operation, ...customParams }),
    };

    const result = await executeFn(mockCall);
    const duration = Date.now() - startTime;

    let parsedResult;
    try {
      parsedResult = JSON.parse(result.content);
    } catch {
      parsedResult = result.content;
    }

    return NextResponse.json({
      success: !result.isError,
      tool: toolName,
      operation,
      input: customParams,
      result: parsedResult,
      duration,
      isError: result.isError || false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
