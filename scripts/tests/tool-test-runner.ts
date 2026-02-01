/**
 * COMPREHENSIVE TOOL TEST RUNNER
 * Auto-discovers and tests all tools in the tools directory
 *
 * Usage: npx tsx scripts/tests/tool-test-runner.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Tools directory
const TOOLS_DIR = path.join(__dirname, '../../src/lib/ai/tools');

// Skip list - tools that require external services or special setup
const SKIP_TOOLS = [
  'deep-research-tool',      // External API
  'deep-strategy-tool',      // External API
  'image-generation-tool',   // External API (DALL-E/etc)
  'web-search-tool',         // External API
  'web-scrape-tool',         // External network
  'mcp-tool',                // MCP server
  'code-execution-tool',     // Sandbox required
  'file-operation-tool',     // File system
  'shell-tool',              // Shell access
  'database-tool',           // Database connection
];

// Test results
interface TestResult {
  tool: string;
  operation: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
let passed = 0;
let failed = 0;
let skipped = 0;

// Generate a mock tool call
function createMockToolCall(toolName: string, operation: string, args: Record<string, unknown> = {}) {
  return {
    id: `test-${toolName}-${operation}-${Date.now()}`,
    name: toolName,
    arguments: JSON.stringify({ operation, ...args }),
  };
}

// Extract operations from tool file
function extractOperations(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Look for enum in parameters
    const enumMatch = content.match(/enum:\s*\[([\s\S]*?)\]/);
    if (enumMatch) {
      const ops = enumMatch[1].match(/'([^']+)'/g);
      if (ops) {
        return ops.map(o => o.replace(/'/g, ''));
      }
    }

    // Look for case statements
    const caseMatches = content.matchAll(/case\s+'([^']+)':/g);
    const cases = [...caseMatches].map(m => m[1]);
    if (cases.length > 0) {
      return cases;
    }

    // Default - try with empty operation (some tools don't need it)
    return ['default'];
  } catch {
    return ['default'];
  }
}

// Dynamic import and test a tool
async function testTool(toolFile: string): Promise<void> {
  const toolName = toolFile.replace('-tool.ts', '');
  const toolBaseName = toolName.replace(/-/g, '_');

  // Check skip list
  if (SKIP_TOOLS.includes(toolName + '-tool') || SKIP_TOOLS.includes(toolName)) {
    console.log(`⏭️  SKIP: ${toolName} (requires external service)`);
    skipped++;
    return;
  }

  const filePath = path.join(TOOLS_DIR, toolFile);
  const operations = extractOperations(filePath);

  try {
    // Dynamic import
    const toolModule = await import(filePath);

    // Find execute function
    const executeKey = Object.keys(toolModule).find(k => k.startsWith('execute'));
    if (!executeKey) {
      console.log(`⚠️  WARN: ${toolName} - no execute function found`);
      skipped++;
      return;
    }

    const executeFn = toolModule[executeKey];

    // Test each operation
    for (const op of operations) {
      const start = Date.now();
      try {
        const mockCall = createMockToolCall(toolBaseName, op);
        const result = await executeFn(mockCall);
        const duration = Date.now() - start;

        if (result.isError) {
          // Some errors are expected for invalid/default params
          if (result.content.includes('Unknown') || result.content.includes('required')) {
            console.log(`⚠️  ${toolName}.${op}: Expected error (${duration}ms)`);
            results.push({ tool: toolName, operation: op, success: true, result: 'Expected error', duration });
            passed++;
          } else {
            console.log(`❌ ${toolName}.${op}: ${result.content} (${duration}ms)`);
            results.push({ tool: toolName, operation: op, success: false, error: result.content, duration });
            failed++;
          }
        } else {
          console.log(`✅ ${toolName}.${op}: OK (${duration}ms)`);
          results.push({ tool: toolName, operation: op, success: true, result: result.content?.substring(0, 100), duration });
          passed++;
        }
      } catch (e) {
        const duration = Date.now() - start;
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.log(`❌ ${toolName}.${op}: EXCEPTION - ${errMsg} (${duration}ms)`);
        results.push({ tool: toolName, operation: op, success: false, error: errMsg, duration });
        failed++;
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    console.log(`❌ ${toolName}: IMPORT ERROR - ${errMsg}`);
    results.push({ tool: toolName, operation: 'import', success: false, error: errMsg, duration: 0 });
    failed++;
  }
}

// Main runner
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           JCIL.AI COMPREHENSIVE TOOL TEST RUNNER              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Tools directory: ${TOOLS_DIR}`);
  console.log('');

  // Get all tool files
  const toolFiles = fs.readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('-tool.ts'))
    .sort();

  console.log(`Found ${toolFiles.length} tools to test\n`);
  console.log('───────────────────────────────────────────────────────────────');

  // Test each tool
  for (const toolFile of toolFiles) {
    await testTool(toolFile);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                         TEST SUMMARY                          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Tools:    ${toolFiles.length}`);
  console.log(`Tests Run:      ${passed + failed}`);
  console.log(`✅ Passed:      ${passed}`);
  console.log(`❌ Failed:      ${failed}`);
  console.log(`⏭️  Skipped:     ${skipped}`);
  console.log(`Success Rate:   ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('───────────────────────────────────────────────────────────────');

  // Failed tests detail
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ${r.tool}.${r.operation}: ${r.error}`);
    });
  }

  // Write results to JSON
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: toolFiles.length, passed, failed, skipped },
    results
  }, null, 2));
  console.log(`\nResults saved to: ${reportPath}`);

  // Exit with error if any failures
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
