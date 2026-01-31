/**
 * CALCULATOR / MATH TOOL
 *
 * Advanced math capabilities using Wolfram Alpha API.
 * Handles calculations, equations, unit conversions, and more.
 *
 * Features:
 * - Complex mathematical calculations
 * - Symbolic math (derivatives, integrals, equations)
 * - Unit conversions
 * - Statistical computations
 * - Scientific data lookup
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('CalculatorTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const WOLFRAM_API_BASE = 'https://api.wolframalpha.com/v2';
const FETCH_TIMEOUT_MS = 20000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const calculatorTool: UnifiedTool = {
  name: 'calculator',
  description: `Perform advanced mathematical calculations and get factual answers. Use this when:
- User asks for any mathematical calculation (arithmetic, algebra, calculus)
- Solving equations or systems of equations
- Unit conversions (miles to km, Celsius to Fahrenheit, etc.)
- Statistical calculations (mean, median, standard deviation)
- Scientific/engineering computations
- Derivative or integral calculations
- Financial calculations (compound interest, loan payments)
- Factual questions about quantities, measurements, dates

Examples:
- "What is the derivative of x^3 + 2x?"
- "Convert 100 miles to kilometers"
- "Solve x^2 + 5x + 6 = 0"
- "Calculate compound interest on $10000 at 5% for 10 years"
- "What is the distance from Earth to Mars?"`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The math question, calculation, or conversion to perform',
      },
      include_steps: {
        type: 'boolean',
        description: 'Include step-by-step solution when available. Default: true',
        default: true,
      },
    },
    required: ['query'],
  },
};

// ============================================================================
// WOLFRAM ALPHA API
// ============================================================================

interface WolframPod {
  title: string;
  subpods: Array<{
    title: string;
    plaintext: string;
    img?: { src: string };
  }>;
  primary?: boolean;
}

interface WolframResponse {
  queryresult: {
    success: boolean;
    error: boolean;
    pods?: WolframPod[];
    didyoumeans?: Array<{ val: string }>;
  };
}

async function queryWolfram(
  input: string,
  includeSteps: boolean
): Promise<{ success: boolean; result?: string; error?: string }> {
  const apiKey = process.env.WOLFRAM_APP_ID;

  if (!apiKey) {
    // Fall back to simple calculation if no Wolfram key
    return fallbackCalculation(input);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      appid: apiKey,
      input,
      format: 'plaintext',
      output: 'json',
      podstate: includeSteps ? 'Step-by-step solution' : '',
    });

    const response = await fetch(`${WOLFRAM_API_BASE}/query?${params}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Wolfram API error: ${response.status}` };
    }

    const data: WolframResponse = await response.json();

    if (!data.queryresult.success) {
      if (data.queryresult.didyoumeans && data.queryresult.didyoumeans.length > 0) {
        return {
          success: false,
          error: `Could not understand query. Did you mean: "${data.queryresult.didyoumeans[0].val}"?`,
        };
      }
      return { success: false, error: 'Could not compute an answer for this query.' };
    }

    if (!data.queryresult.pods || data.queryresult.pods.length === 0) {
      return { success: false, error: 'No results found.' };
    }

    // Format the results
    let result = '';

    for (const pod of data.queryresult.pods) {
      if (pod.subpods && pod.subpods.length > 0) {
        const text = pod.subpods
          .map((sp) => sp.plaintext)
          .filter(Boolean)
          .join('\n');

        if (text) {
          result += `**${pod.title}:**\n${text}\n\n`;
        }
      }
    }

    if (!result) {
      return { success: false, error: 'No readable results returned.' };
    }

    return { success: true, result: result.trim() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('aborted')) {
      return { success: false, error: 'Request timed out.' };
    }

    log.error('Wolfram query failed', { error: errorMessage });

    // Fall back to simple calculation
    return fallbackCalculation(input);
  }
}

// ============================================================================
// FALLBACK CALCULATOR (when Wolfram is unavailable)
// ============================================================================

function fallbackCalculation(input: string): { success: boolean; result?: string; error?: string } {
  try {
    // Sanitize input - only allow safe math characters
    const sanitized = input
      .replace(/[^0-9+\-*/().^%\s,epixsqrtsincoantlog]/gi, '')
      .replace(/\^/g, '**') // Convert ^ to **
      .replace(/sqrt/gi, 'Math.sqrt')
      .replace(/sin/gi, 'Math.sin')
      .replace(/cos/gi, 'Math.cos')
      .replace(/tan/gi, 'Math.tan')
      .replace(/log/gi, 'Math.log10')
      .replace(/ln/gi, 'Math.log')
      .replace(/pi/gi, 'Math.PI')
      .replace(/e(?![a-z])/gi, 'Math.E');

    // Basic safety check
    if (/[a-zA-Z_$]/.test(sanitized.replace(/Math\.(sqrt|sin|cos|tan|log10|log|PI|E)/g, ''))) {
      return {
        success: false,
        error: 'Complex calculations require Wolfram Alpha. Set WOLFRAM_APP_ID for advanced math.',
      };
    }

    // Evaluate safely using Function constructor with Math context
    const calculate = new Function('Math', `"use strict"; return (${sanitized})`);
    const result = calculate(Math);

    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: 'Calculation resulted in an invalid number.' };
    }

    // Format result nicely
    let formatted: string;
    if (Number.isInteger(result)) {
      formatted = result.toLocaleString();
    } else {
      // Round to reasonable precision
      formatted = parseFloat(result.toPrecision(10)).toString();
    }

    return {
      success: true,
      result: `**Input:** ${input}\n**Result:** ${formatted}`,
    };
  } catch {
    return {
      success: false,
      error:
        'Could not evaluate expression. For complex math, set WOLFRAM_APP_ID environment variable.',
    };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeCalculator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'calculator') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const query = args.query as string;
  const includeSteps = args.include_steps !== false;

  if (!query) {
    return {
      toolCallId: id,
      content: 'No query provided. Please specify a math problem or calculation.',
      isError: true,
    };
  }

  log.info('Executing calculation', { query, includeSteps });

  const result = await queryWolfram(query, includeSteps);

  if (!result.success) {
    return {
      toolCallId: id,
      content: result.error || 'Calculation failed',
      isError: true,
    };
  }

  log.info('Calculation completed', { query });

  return {
    toolCallId: id,
    content: result.result || 'No result',
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCalculatorAvailable(): boolean {
  // Always available - has fallback for basic math
  return true;
}
