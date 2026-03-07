/**
 * E2B VISUALIZATION TOOL
 *
 * Generates charts and visualizations by executing Python code (matplotlib, plotly, seaborn)
 * in an E2B sandbox. Returns actual rendered PNG/SVG images, not just chart specs.
 *
 * This is the heavy-duty visualization tool — it can produce:
 * - Matplotlib charts (line, bar, scatter, histogram, pie, heatmap, etc.)
 * - Seaborn statistical visualizations
 * - Plotly interactive charts (returned as static PNG)
 * - Multi-panel figures with subplots
 * - Custom styled charts with brand colors
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('E2BChartTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.02; // $0.02 per chart
const EXECUTION_TIMEOUT_MS = 45000; // 45 seconds
const SANDBOX_TIMEOUT_MS = 300000; // 5 min
const SANDBOX_IDLE_CLEANUP_MS = 120000; // 2 min idle

// E2B lazy loading
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;
let chartSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const e2bChartTool: UnifiedTool = {
  name: 'e2b_visualize',
  description: `Generate data visualizations by running Python code in a sandbox. Use this when:
- User wants a chart, graph, or visualization
- You need to plot data (line charts, bar charts, scatter plots, histograms, pie charts, heatmaps)
- User provides data and asks for visual analysis
- You want to create publication-quality figures

The sandbox has matplotlib, seaborn, numpy, and pandas pre-installed.

IMPORTANT: Your Python code MUST save the figure to a file. Use:
  plt.savefig('/tmp/chart.png', dpi=150, bbox_inches='tight')

The tool will read the saved file and return it as a base64 PNG.

Tips:
- Always call plt.figure(figsize=(10, 6)) for good sizing
- Use plt.tight_layout() before saving
- For multiple charts, use subplots
- Seaborn is available as 'import seaborn as sns'`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description:
          'Python code that generates a chart. Must save to /tmp/chart.png using plt.savefig().',
      },
      title: {
        type: 'string',
        description: 'Brief description of what the chart shows (for logging/context)',
      },
      output_path: {
        type: 'string',
        description: 'Custom output file path (default: /tmp/chart.png)',
        default: '/tmp/chart.png',
      },
    },
    required: ['code'],
  },
};

// ============================================================================
// E2B INITIALIZATION
// ============================================================================

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) {
    return e2bAvailable;
  }

  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - E2B chart tool disabled');
      e2bAvailable = false;
      return false;
    }

    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('E2B visualization tool available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B for charts', {
      error: (error as Error).message,
    });
    e2bAvailable = false;
    return false;
  }
}

async function getChartSandbox(): Promise<
  InstanceType<typeof import('@e2b/code-interpreter').Sandbox>
> {
  if (!Sandbox) throw new Error('E2B not initialized');

  const now = Date.now();

  if (chartSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await chartSandbox.kill();
    } catch {
      /* ignore */
    }
    chartSandbox = null;
  }

  if (!chartSandbox) {
    log.info('Creating new sandbox for chart generation');
    chartSandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });

    // Pre-install visualization packages
    chartSandbox.commands
      .run('pip install matplotlib seaborn pandas numpy plotly kaleido', {
        timeoutMs: 180000,
      })
      .catch((err) => {
        log.warn('Chart package installation failed (non-fatal)', {
          error: (err as Error).message,
        });
      });
  }

  sandboxLastUsed = now;
  return chartSandbox;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeE2BChart(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'e2b_visualize') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const available = await initE2B();
  if (!available) {
    return {
      toolCallId: id,
      content: 'E2B visualization tool not available. E2B_API_KEY not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const code = args.code as string;
  const title = (args.title as string) || 'Chart';
  const outputPath = (args.output_path as string) || '/tmp/chart.png';

  if (!code) {
    return { toolCallId: id, content: 'No code provided.', isError: true };
  }

  if (code.length > 50000) {
    return { toolCallId: id, content: 'Code too long (max 50KB).', isError: true };
  }

  const sessionId = toolCall.sessionId || `chart_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'e2b_visualize', TOOL_COST);
  if (!costCheck.allowed) {
    return { toolCallId: id, content: `Cannot execute: ${costCheck.reason}`, isError: true };
  }

  try {
    const sandbox = await getChartSandbox();

    log.info('Generating chart', { title, codeLength: code.length });

    // Execute the chart code
    const result = await sandbox.runCode(code, {
      timeoutMs: EXECUTION_TIMEOUT_MS,
    });

    // Check for errors
    if (result.error) {
      log.warn('Chart generation error', { error: result.error.value });
      return {
        toolCallId: id,
        content: `Chart generation failed:\n\`\`\`\n${result.error.name}: ${result.error.value}\n\`\`\`\n\nTraceback:\n${result.error.traceback}`,
        isError: true,
      };
    }

    // Check if the E2B result has inline images (matplotlib in Jupyter kernel)
    const inlineImages = result.results?.filter(
      (r: { png?: string; svg?: string }) => r.png || r.svg
    );

    if (inlineImages && inlineImages.length > 0) {
      // Use inline image from Jupyter kernel output
      const img = inlineImages[0];
      const imageData = img.png || img.svg || '';
      const mimeType = img.png ? 'image/png' : 'image/svg+xml';

      recordToolCost(sessionId, 'e2b_visualize', TOOL_COST);
      log.info('Chart generated via inline output', { title });

      return {
        toolCallId: id,
        content: `Chart "${title}" generated successfully.\n\ndata:${mimeType};base64,${imageData}`,
        isError: false,
      };
    }

    // Fallback: read the saved file
    try {
      const fileContent = await sandbox.files.read(outputPath);
      const base64 = Buffer.from(fileContent, 'binary').toString('base64');

      recordToolCost(sessionId, 'e2b_visualize', TOOL_COST);
      log.info('Chart generated via file output', { title, path: outputPath });

      return {
        toolCallId: id,
        content: `Chart "${title}" generated successfully.\n\ndata:image/png;base64,${base64}`,
        isError: false,
      };
    } catch {
      // File not found — maybe code didn't save to the expected path
      const stdout = result.logs?.stdout?.join('\n') || '';
      const stderr = result.logs?.stderr?.join('\n') || '';
      return {
        toolCallId: id,
        content: `Chart code ran but no image file was found at ${outputPath}.\n\nMake sure your code calls plt.savefig('${outputPath}').\n\nStdout: ${stdout}\nStderr: ${stderr}`,
        isError: true,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Chart generation failed', { title, error: errMsg });
    return {
      toolCallId: id,
      content: `Chart generation failed: ${errMsg}`,
      isError: true,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export async function isE2BChartAvailable(): Promise<boolean> {
  return initE2B();
}

export async function cleanupChartSandbox(): Promise<void> {
  if (chartSandbox) {
    try {
      await chartSandbox.kill();
      chartSandbox = null;
      log.info('Chart sandbox cleaned up');
    } catch (error) {
      log.warn('Error cleaning up chart sandbox', { error: (error as Error).message });
    }
  }
}
