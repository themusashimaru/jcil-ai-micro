/**
 * LATEX RENDER TOOL
 *
 * LaTeX mathematical typesetting and rendering.
 * Converts LaTeX expressions to various output formats.
 *
 * Features:
 * - LaTeX to MathML conversion
 * - LaTeX to SVG rendering
 * - Equation validation
 * - Mathematical expression formatting
 * - Support for common LaTeX packages
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// LAZY LOADED DEPENDENCIES
// ============================================================================

let mjAPI: typeof import('mathjax-node') | null = null;
let mjInitialized = false;

async function getMathJax(): Promise<typeof import('mathjax-node')> {
  if (!mjAPI) {
    mjAPI = await import('mathjax-node');
  }
  if (!mjInitialized) {
    mjAPI.config({
      MathJax: {
        loader: { load: ['input/tex', 'output/svg', 'output/mml'] },
      },
    });
    mjAPI.start();
    mjInitialized = true;
  }
  return mjAPI;
}

// ============================================================================
// LATEX TEMPLATES
// ============================================================================

const TEMPLATES: Record<string, string> = {
  // Algebra
  quadratic_formula: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  binomial_theorem: '(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k',

  // Calculus
  derivative: '\\frac{d}{dx} f(x)',
  integral: '\\int_{a}^{b} f(x) \\, dx',
  limit: '\\lim_{x \\to a} f(x)',
  taylor_series: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n',
  euler_formula: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta',

  // Linear Algebra
  matrix_2x2: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
  matrix_3x3:
    '\\begin{pmatrix} a_{11} & a_{12} & a_{13} \\\\ a_{21} & a_{22} & a_{23} \\\\ a_{31} & a_{32} & a_{33} \\end{pmatrix}',
  determinant: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc',
  eigenvalue: 'A\\mathbf{v} = \\lambda\\mathbf{v}',

  // Physics
  einstein_mass_energy: 'E = mc^2',
  schrodinger: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi',
  maxwell_gauss: '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}',
  maxwell_faraday: '\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}',
  newton_gravity: 'F = G\\frac{m_1 m_2}{r^2}',

  // Statistics
  normal_distribution:
    'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}',
  bayes_theorem: 'P(A|B) = \\frac{P(B|A)P(A)}{P(B)}',
  variance: '\\sigma^2 = \\frac{1}{N}\\sum_{i=1}^{N}(x_i - \\mu)^2',

  // Trigonometry
  pythagorean_identity: '\\sin^2\\theta + \\cos^2\\theta = 1',
  law_of_cosines: 'c^2 = a^2 + b^2 - 2ab\\cos C',

  // Number Theory
  euler_product: '\\zeta(s) = \\sum_{n=1}^{\\infty}\\frac{1}{n^s} = \\prod_p \\frac{1}{1-p^{-s}}',
  prime_counting: '\\pi(x) \\sim \\frac{x}{\\ln x}',

  // Set Theory
  demorgan: '(A \\cup B)^c = A^c \\cap B^c',
};

// ============================================================================
// LATEX VALIDATION
// ============================================================================

function validateLatex(latex: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check balanced braces
  let braceCount = 0;
  for (const char of latex) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) {
      errors.push('Unbalanced braces: too many closing braces');
      break;
    }
  }
  if (braceCount > 0) {
    errors.push(`Unbalanced braces: ${braceCount} unclosed opening brace(s)`);
  }

  // Check balanced environments
  const beginMatches = latex.match(/\\begin\{(\w+)\}/g) || [];
  const endMatches = latex.match(/\\end\{(\w+)\}/g) || [];

  const beginEnvs = beginMatches.map((m) => m.match(/\\begin\{(\w+)\}/)![1]);
  const endEnvs = endMatches.map((m) => m.match(/\\end\{(\w+)\}/)![1]);

  const envStack: string[] = [];
  for (let i = 0; i < beginEnvs.length; i++) {
    envStack.push(beginEnvs[i]);
  }

  for (const env of endEnvs) {
    const lastBegin = envStack.pop();
    if (lastBegin !== env) {
      errors.push(
        `Mismatched environment: \\begin{${lastBegin || 'none'}} closed with \\end{${env}}`
      );
    }
  }

  if (envStack.length > 0) {
    errors.push(`Unclosed environment(s): ${envStack.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// LATEX FORMATTING
// ============================================================================

function formatMatrix(
  matrix: number[][],
  style: 'pmatrix' | 'bmatrix' | 'vmatrix' = 'pmatrix'
): string {
  const rows = matrix.map((row) => row.join(' & ')).join(' \\\\ ');
  return `\\begin{${style}} ${rows} \\end{${style}}`;
}

function formatFraction(numerator: string, denominator: string): string {
  return `\\frac{${numerator}}{${denominator}}`;
}

function formatSum(lower: string, upper: string, expression: string): string {
  return `\\sum_{${lower}}^{${upper}} ${expression}`;
}

function formatIntegral(
  lower: string,
  upper: string,
  expression: string,
  variable: string
): string {
  return `\\int_{${lower}}^{${upper}} ${expression} \\, d${variable}`;
}

function formatLimit(variable: string, approach: string, expression: string): string {
  return `\\lim_{${variable} \\to ${approach}} ${expression}`;
}

function formatDerivative(expression: string, variable: string, order: number = 1): string {
  if (order === 1) {
    return `\\frac{d}{d${variable}} \\left( ${expression} \\right)`;
  }
  return `\\frac{d^{${order}}}{d${variable}^{${order}}} \\left( ${expression} \\right)`;
}

// ============================================================================
// EQUATION BUILDER
// ============================================================================

function buildEquation(parts: Array<{ type: string; value: unknown }>): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case 'text':
          return String(part.value);
        case 'fraction':
          const frac = part.value as { num: string; den: string };
          return formatFraction(frac.num, frac.den);
        case 'matrix':
          const mat = part.value as { data: number[][]; style?: string };
          return formatMatrix(
            mat.data,
            (mat.style as 'pmatrix' | 'bmatrix' | 'vmatrix') || 'pmatrix'
          );
        case 'sum':
          const sum = part.value as { lower: string; upper: string; expr: string };
          return formatSum(sum.lower, sum.upper, sum.expr);
        case 'integral':
          const int = part.value as { lower: string; upper: string; expr: string; var: string };
          return formatIntegral(int.lower, int.upper, int.expr, int.var);
        case 'limit':
          const lim = part.value as { var: string; approach: string; expr: string };
          return formatLimit(lim.var, lim.approach, lim.expr);
        default:
          return String(part.value);
      }
    })
    .join(' ');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const latexRenderTool: UnifiedTool = {
  name: 'latex_render',
  description: `LaTeX mathematical typesetting and rendering.

Available operations:
- render: Convert LaTeX to MathML or SVG
- validate: Check LaTeX syntax validity
- template: Get common equation templates
- format_matrix: Generate LaTeX matrix
- format_fraction: Generate fraction
- format_sum: Generate summation
- format_integral: Generate integral
- format_limit: Generate limit
- format_derivative: Generate derivative
- build_equation: Build complex equation from parts
- list_templates: List all available templates

Templates include: quadratic formula, binomial theorem, Taylor series, Euler's formula, Schrödinger equation, Maxwell's equations, normal distribution, and more.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'render',
          'validate',
          'template',
          'format_matrix',
          'format_fraction',
          'format_sum',
          'format_integral',
          'format_limit',
          'format_derivative',
          'build_equation',
          'list_templates',
        ],
        description: 'LaTeX operation',
      },
      latex: {
        type: 'string',
        description: 'LaTeX expression to render or validate',
      },
      format: {
        type: 'string',
        enum: ['mathml', 'svg'],
        description: 'Output format for rendering',
      },
      template_name: {
        type: 'string',
        description: 'Name of template to retrieve',
      },
      matrix: {
        type: 'array',
        description: '2D array for matrix formatting',
      },
      matrix_style: {
        type: 'string',
        enum: ['pmatrix', 'bmatrix', 'vmatrix'],
        description: 'Matrix bracket style',
      },
      numerator: {
        type: 'string',
        description: 'Fraction numerator',
      },
      denominator: {
        type: 'string',
        description: 'Fraction denominator',
      },
      lower: {
        type: 'string',
        description: 'Lower bound for sum/integral',
      },
      upper: {
        type: 'string',
        description: 'Upper bound for sum/integral',
      },
      expression: {
        type: 'string',
        description: 'Mathematical expression',
      },
      variable: {
        type: 'string',
        description: 'Variable for limit/derivative/integral',
      },
      approach: {
        type: 'string',
        description: 'Limit approach value',
      },
      order: {
        type: 'number',
        description: 'Derivative order',
      },
      parts: {
        type: 'array',
        description: 'Array of equation parts for building',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isLatexRenderAvailable(): boolean {
  // MathJax-node is loaded lazily on first use
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeLatexRender(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as Record<string, unknown>;
  const operation = args.operation as string;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'render': {
        const latex = args.latex as string;
        const format = (args.format as string) || 'mathml';

        const mj = await getMathJax();

        const renderResult = await new Promise<{
          mml?: string;
          svg?: string;
          errors?: string[];
        }>((resolve, reject) => {
          mj.typeset(
            {
              math: latex,
              format: 'TeX',
              mml: format === 'mathml',
              svg: format === 'svg',
            },
            (data: { mml?: string; svg?: string; errors?: string[] }) => {
              if (data.errors && data.errors.length > 0) {
                reject(new Error(data.errors.join(', ')));
              } else {
                resolve(data);
              }
            }
          );
        });

        result.input = latex;
        result.format = format;
        result.output = format === 'mathml' ? renderResult.mml : renderResult.svg;
        break;
      }

      case 'validate': {
        const latex = args.latex as string;
        const validation = validateLatex(latex);
        result.latex = latex;
        result.valid = validation.valid;
        result.errors = validation.errors;
        break;
      }

      case 'template': {
        const templateName = args.template_name as string;
        const template = TEMPLATES[templateName];
        if (!template) {
          throw new Error(
            `Template "${templateName}" not found. Use list_templates to see available templates.`
          );
        }
        result.template_name = templateName;
        result.latex = template;
        break;
      }

      case 'format_matrix': {
        const matrix = args.matrix as number[][];
        const style = (args.matrix_style as 'pmatrix' | 'bmatrix' | 'vmatrix') || 'pmatrix';
        result.latex = formatMatrix(matrix, style);
        result.style = style;
        break;
      }

      case 'format_fraction': {
        const num = args.numerator as string;
        const den = args.denominator as string;
        result.latex = formatFraction(num, den);
        break;
      }

      case 'format_sum': {
        const lower = args.lower as string;
        const upper = args.upper as string;
        const expr = args.expression as string;
        result.latex = formatSum(lower, upper, expr);
        break;
      }

      case 'format_integral': {
        const lower = args.lower as string;
        const upper = args.upper as string;
        const expr = args.expression as string;
        const variable = args.variable as string;
        result.latex = formatIntegral(lower, upper, expr, variable);
        break;
      }

      case 'format_limit': {
        const variable = args.variable as string;
        const approach = args.approach as string;
        const expr = args.expression as string;
        result.latex = formatLimit(variable, approach, expr);
        break;
      }

      case 'format_derivative': {
        const expr = args.expression as string;
        const variable = args.variable as string;
        const order = (args.order as number) || 1;
        result.latex = formatDerivative(expr, variable, order);
        break;
      }

      case 'build_equation': {
        const parts = args.parts as Array<{ type: string; value: unknown }>;
        result.latex = buildEquation(parts);
        break;
      }

      case 'list_templates': {
        result.templates = Object.keys(TEMPLATES);
        result.count = Object.keys(TEMPLATES).length;
        result.categories = {
          algebra: ['quadratic_formula', 'binomial_theorem'],
          calculus: ['derivative', 'integral', 'limit', 'taylor_series', 'euler_formula'],
          linear_algebra: ['matrix_2x2', 'matrix_3x3', 'determinant', 'eigenvalue'],
          physics: [
            'einstein_mass_energy',
            'schrodinger',
            'maxwell_gauss',
            'maxwell_faraday',
            'newton_gravity',
          ],
          statistics: ['normal_distribution', 'bayes_theorem', 'variance'],
          trigonometry: ['pythagorean_identity', 'law_of_cosines'],
          number_theory: ['euler_product', 'prime_counting'],
          set_theory: ['demorgan'],
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
