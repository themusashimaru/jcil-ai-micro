/**
 * LIVE AI DEBUGGING
 *
 * This is NOT your typical "paste error, get fix" debugging.
 * This watches code execution in real-time, catches errors BEFORE
 * they crash, and provides intelligent fixes with full context.
 *
 * It's like having a senior developer watching over your shoulder
 * who can pause time to fix bugs.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface RuntimeError {
  type: 'error' | 'warning' | 'unhandled_rejection' | 'crash';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  timestamp: number;
}

export interface ExecutionContext {
  code: string;
  language: string;
  file?: string;
  variables?: Record<string, unknown>;
  callStack?: string[];
  previousErrors?: RuntimeError[];
  environment?: 'browser' | 'node' | 'edge';
}

export interface DebugFix {
  id: string;
  type: 'fix' | 'workaround' | 'investigation' | 'prevention';
  title: string;
  explanation: string;
  originalCode: string;
  fixedCode: string;
  confidence: number;
  rootCause: string;
  prevention?: string;
  testCase?: string;
}

export interface DebugSession {
  id: string;
  errors: RuntimeError[];
  fixes: DebugFix[];
  status: 'active' | 'resolved' | 'investigating';
  startTime: number;
  context: ExecutionContext;
}

/**
 * The Live Debugger - catches and fixes errors in real-time
 */
export class LiveDebugger {
  private sessions: Map<string, DebugSession> = new Map();
  private errorPatterns: Map<string, DebugFix[]> = new Map();

  /**
   * Start a debug session
   */
  startSession(context: ExecutionContext): DebugSession {
    const session: DebugSession = {
      id: `debug_${Date.now()}`,
      errors: [],
      fixes: [],
      status: 'active',
      startTime: Date.now(),
      context,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Process a runtime error and generate fix
   */
  async onError(
    sessionId: string,
    error: RuntimeError
  ): Promise<DebugFix | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.errors.push(error);

    // Check if we've seen this error pattern before
    const cachedFix = this.findCachedFix(error);
    if (cachedFix) {
      session.fixes.push(cachedFix);
      return cachedFix;
    }

    // Generate new fix with AI
    const fix = await this.generateFix(error, session.context);
    if (fix) {
      session.fixes.push(fix);

      // Cache for future similar errors
      this.cacheErrorPattern(error, fix);
    }

    return fix;
  }

  /**
   * Generate an intelligent fix for an error
   */
  private async generateFix(
    error: RuntimeError,
    context: ExecutionContext
  ): Promise<DebugFix | null> {
    // Extract relevant code around the error
    const relevantCode = this.extractRelevantCode(error, context);

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101', // Use Opus for complex debugging
      max_tokens: 2048,
      system: `You are an expert debugger. Analyze runtime errors and provide precise fixes.

Your fixes must:
1. Address the ROOT CAUSE, not just the symptom
2. Include the exact code change needed
3. Explain why the error occurred
4. Suggest how to prevent similar errors
5. Optionally include a test case

Be surgical - change only what's necessary.`,
      messages: [{
        role: 'user',
        content: `Debug this ${error.type}:

## Error
\`\`\`
${error.message}
${error.stack || ''}
\`\`\`

${error.file ? `File: ${error.file}:${error.line}:${error.column}` : ''}

## Code Context
\`\`\`${context.language}
${relevantCode}
\`\`\`

${context.variables ? `## Variables at Error Time\n${JSON.stringify(context.variables, null, 2)}` : ''}

${context.callStack ? `## Call Stack\n${context.callStack.join('\n')}` : ''}

Return a JSON object with:
{
  "id": "unique_id",
  "type": "fix" | "workaround" | "investigation" | "prevention",
  "title": "Brief title",
  "explanation": "Detailed explanation of what went wrong",
  "originalCode": "The problematic code",
  "fixedCode": "The corrected code",
  "confidence": 0.0-1.0,
  "rootCause": "The underlying cause",
  "prevention": "How to prevent this in future",
  "testCase": "Optional test to verify fix"
}`,
      }],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const fix = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return fix as DebugFix;
    } catch {
      return null;
    }
  }

  /**
   * Extract code around the error location
   */
  private extractRelevantCode(error: RuntimeError, context: ExecutionContext): string {
    if (!error.line || !context.code) {
      return context.code?.slice(0, 2000) || '';
    }

    const lines = context.code.split('\n');
    const start = Math.max(0, error.line - 10);
    const end = Math.min(lines.length, error.line + 10);

    return lines.slice(start, end)
      .map((line, i) => {
        const lineNum = start + i + 1;
        const marker = lineNum === error.line ? '>>> ' : '    ';
        return `${marker}${lineNum}: ${line}`;
      })
      .join('\n');
  }

  /**
   * Find cached fix for similar error
   */
  private findCachedFix(error: RuntimeError): DebugFix | null {
    const pattern = this.normalizeError(error);
    const fixes = this.errorPatterns.get(pattern);
    return fixes?.[0] || null;
  }

  /**
   * Cache error pattern with its fix
   */
  private cacheErrorPattern(error: RuntimeError, fix: DebugFix): void {
    const pattern = this.normalizeError(error);
    const existing = this.errorPatterns.get(pattern) || [];
    existing.unshift(fix);
    this.errorPatterns.set(pattern, existing.slice(0, 5)); // Keep top 5 fixes
  }

  /**
   * Normalize error for pattern matching
   */
  private normalizeError(error: RuntimeError): string {
    // Remove specific values to create a pattern
    return error.message
      .replace(/['"][^'"]*['"]/g, '""') // Remove string literals
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/at line \d+/gi, 'at line N')
      .toLowerCase()
      .trim();
  }

  /**
   * Explain an error in plain English
   */
  async explainError(error: RuntimeError): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Explain this error in simple terms:

\`\`\`
${error.message}
${error.stack || ''}
\`\`\`

Explain:
1. What happened
2. Why it happened
3. How to fix it

Use simple language, avoid jargon.`,
      }],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }
    return content;
  }

  /**
   * Predict potential errors in code before execution
   */
  async predictErrors(code: string, language: string): Promise<Array<{
    line: number;
    issue: string;
    severity: 'error' | 'warning' | 'potential';
    suggestedFix: string;
  }>> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze this ${language} code for potential runtime errors:

\`\`\`${language}
${code}
\`\`\`

Find:
1. Definite errors (will crash)
2. Potential errors (might crash under conditions)
3. Edge cases not handled

Return JSON array:
[{
  "line": number,
  "issue": "description",
  "severity": "error" | "warning" | "potential",
  "suggestedFix": "code fix"
}]`,
      }],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const predictions = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return Array.isArray(predictions) ? predictions : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate a comprehensive debug report
   */
  async generateDebugReport(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) return 'Session not found';

    let report = `# Debug Session Report\n\n`;
    report += `**Session ID:** ${session.id}\n`;
    report += `**Status:** ${session.status}\n`;
    report += `**Duration:** ${((Date.now() - session.startTime) / 1000).toFixed(1)}s\n\n`;

    report += `## Errors Found (${session.errors.length})\n\n`;
    session.errors.forEach((error, i) => {
      report += `### Error ${i + 1}: ${error.type}\n`;
      report += `\`\`\`\n${error.message}\n\`\`\`\n`;
      if (error.file) {
        report += `Location: ${error.file}:${error.line}:${error.column}\n`;
      }
      report += '\n';
    });

    report += `## Fixes Applied (${session.fixes.length})\n\n`;
    session.fixes.forEach((fix, i) => {
      report += `### Fix ${i + 1}: ${fix.title}\n`;
      report += `**Type:** ${fix.type}\n`;
      report += `**Confidence:** ${(fix.confidence * 100).toFixed(0)}%\n`;
      report += `**Root Cause:** ${fix.rootCause}\n\n`;
      report += `**Original:**\n\`\`\`\n${fix.originalCode}\n\`\`\`\n`;
      report += `**Fixed:**\n\`\`\`\n${fix.fixedCode}\n\`\`\`\n`;
      if (fix.prevention) {
        report += `\n**Prevention:** ${fix.prevention}\n`;
      }
      report += '\n';
    });

    return report;
  }

  /**
   * End a debug session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'resolved';
    }
  }
}

// Singleton instance
let debuggerInstance: LiveDebugger | null = null;

export function getLiveDebugger(): LiveDebugger {
  if (!debuggerInstance) {
    debuggerInstance = new LiveDebugger();
  }
  return debuggerInstance;
}

/**
 * Quick debug helper - one-shot error fix
 */
export async function quickDebug(
  error: string,
  code: string,
  language: string = 'typescript'
): Promise<DebugFix | null> {
  const debugger_ = getLiveDebugger();
  const session = debugger_.startSession({ code, language });
  const fix = await debugger_.onError(session.id, {
    type: 'error',
    message: error,
    timestamp: Date.now(),
  });
  debugger_.endSession(session.id);
  return fix;
}
