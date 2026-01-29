/**
 * QUALITY CONTROL MODULE
 *
 * Lightweight verification layer for chat tool outputs.
 * Uses Haiku for quick checks, Vision for document verification.
 *
 * Only triggers for high-value operations to avoid unnecessary cost.
 */

import { logger } from '@/lib/logger';

const log = logger('QualityControl');

// ============================================================================
// CONFIGURATION
// ============================================================================

const QC_COST = 0.005; // $0.005 per QC check (Haiku is cheap)
// Timeout configured inline in fetch calls

// When to trigger QC (only for high-value ops)
const QC_TRIGGERS = [
  'run_code', // Verify code output makes sense
  'parallel_research', // Verify synthesis is coherent
  'extract_table', // Verify table extraction accuracy
];

// Anthropic lazy load
let AnthropicClient: typeof import('@anthropic-ai/sdk').default | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initAnthropic(): Promise<boolean> {
  if (AnthropicClient !== null) {
    return true;
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return false;
    }
    const anthropicModule = await import('@anthropic-ai/sdk');
    AnthropicClient = anthropicModule.default;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// QC CHECK INTERFACE
// ============================================================================

export interface QCResult {
  passed: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  suggestions: string[];
  verifiedOutput?: string;
}

// ============================================================================
// CODE OUTPUT VERIFICATION
// ============================================================================

export async function verifyCodeOutput(
  code: string,
  output: string,
  language: string
): Promise<QCResult> {
  const available = await initAnthropic();
  if (!available) {
    return { passed: true, confidence: 'low', issues: [], suggestions: ['QC not available'] };
  }

  try {
    const client = new AnthropicClient!({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Quickly verify this code execution result.

CODE (${language}):
\`\`\`${language}
${code.slice(0, 2000)}
\`\`\`

OUTPUT:
\`\`\`
${output.slice(0, 2000)}
\`\`\`

Check for:
1. Does the output look reasonable for this code?
2. Any obvious errors or warnings?
3. Does the output format make sense?

Return JSON only:
{
  "passed": true/false,
  "confidence": "high"/"medium"/"low",
  "issues": ["issue1", ...],
  "suggestions": ["suggestion1", ...]
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      return JSON.parse(text);
    } catch {
      return { passed: true, confidence: 'medium', issues: [], suggestions: [] };
    }
  } catch (error) {
    log.warn('QC check failed', { error: (error as Error).message });
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }
}

// ============================================================================
// RESEARCH SYNTHESIS VERIFICATION
// ============================================================================

export async function verifyResearchSynthesis(
  question: string,
  synthesis: string
): Promise<QCResult> {
  const available = await initAnthropic();
  if (!available) {
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }

  try {
    const client = new AnthropicClient!({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Verify this research synthesis answers the question.

QUESTION: ${question}

SYNTHESIS:
${synthesis.slice(0, 3000)}

Check:
1. Does it actually answer the question?
2. Is it coherent and well-organized?
3. Are there any obvious gaps or contradictions?

Return JSON only:
{
  "passed": true/false,
  "confidence": "high"/"medium"/"low",
  "issues": ["issue1", ...],
  "suggestions": ["suggestion1", ...]
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      return JSON.parse(text);
    } catch {
      return { passed: true, confidence: 'medium', issues: [], suggestions: [] };
    }
  } catch (error) {
    log.warn('Synthesis QC failed', { error: (error as Error).message });
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }
}

// ============================================================================
// TABLE EXTRACTION VERIFICATION
// ============================================================================

export async function verifyTableExtraction(
  extractedTable: string,
  imageDescription?: string
): Promise<QCResult> {
  const available = await initAnthropic();
  if (!available) {
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }

  try {
    const client = new AnthropicClient!({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Verify this extracted table data looks correct.

EXTRACTED TABLE:
${extractedTable.slice(0, 2000)}

${imageDescription ? `Original was described as: ${imageDescription}` : ''}

Check:
1. Does the table structure look valid?
2. Are headers and data aligned?
3. Any obvious extraction errors?

Return JSON only:
{
  "passed": true/false,
  "confidence": "high"/"medium"/"low",
  "issues": ["issue1", ...],
  "suggestions": ["suggestion1", ...]
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      return JSON.parse(text);
    } catch {
      return { passed: true, confidence: 'medium', issues: [], suggestions: [] };
    }
  } catch (error) {
    log.warn('Table QC failed', { error: (error as Error).message });
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }
}

// ============================================================================
// GENERIC OUTPUT VERIFICATION
// ============================================================================

export async function verifyOutput(
  toolName: string,
  input: string,
  output: string
): Promise<QCResult> {
  // Only run QC for specific tools
  if (!QC_TRIGGERS.includes(toolName)) {
    return { passed: true, confidence: 'high', issues: [], suggestions: [] };
  }

  const available = await initAnthropic();
  if (!available) {
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }

  try {
    const client = new AnthropicClient!({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Quick quality check on this tool output.

TOOL: ${toolName}
INPUT: ${input.slice(0, 500)}
OUTPUT: ${output.slice(0, 1500)}

Is this output reasonable and correct? Any issues?

Return JSON: {"passed": bool, "confidence": "high/medium/low", "issues": [], "suggestions": []}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      return JSON.parse(text);
    } catch {
      return { passed: true, confidence: 'medium', issues: [], suggestions: [] };
    }
  } catch {
    return { passed: true, confidence: 'low', issues: [], suggestions: [] };
  }
}

// ============================================================================
// SHOULD RUN QC HELPER
// ============================================================================

export function shouldRunQC(toolName: string): boolean {
  return QC_TRIGGERS.includes(toolName);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { QC_COST, QC_TRIGGERS };
