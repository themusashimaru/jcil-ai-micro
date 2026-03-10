/**
 * ERROR ANALYZER
 *
 * The fourth stage of the Code Agent brain.
 * Analyzes build/test errors and figures out how to fix them.
 *
 * This is the TROUBLESHOOTING component - critical thinking on errors.
 * Uses Opus 4.6 for maximum reasoning power.
 */

import { agentChat, ProviderId } from '@/lib/ai/providers';
import {
  CodeError,
  ErrorAnalysis,
  GeneratedFile,
  CodeIntent,
  ProjectPlan,
  SandboxTestResult,
} from '../../core/types';

export class ErrorAnalyzer {
  private provider: ProviderId = 'claude';
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Parse errors from sandbox output
   */
  parseErrors(sandboxResult: SandboxTestResult): CodeError[] {
    const errors: CodeError[] = [];

    for (const output of sandboxResult.outputs) {
      if (output.exitCode !== 0) {
        // Parse TypeScript errors
        errors.push(...this.parseTypeScriptErrors(output.stderr));
        errors.push(...this.parseTypeScriptErrors(output.stdout));

        // Parse Node.js runtime errors
        errors.push(...this.parseNodeErrors(output.stderr));

        // Parse npm errors
        errors.push(...this.parseNpmErrors(output.stderr));

        // Parse Python errors
        errors.push(...this.parsePythonErrors(output.stderr));

        // If no specific errors found, create a generic one
        if (errors.length === 0 && output.stderr.trim()) {
          errors.push({
            file: 'unknown',
            message: output.stderr.substring(0, 500),
            type: 'unknown',
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Parse TypeScript compilation errors
   */
  private parseTypeScriptErrors(output: string): CodeError[] {
    const errors: CodeError[] = [];
    // Pattern: file.ts(line,col): error TS1234: message
    const tsPattern = /([^\s]+\.tsx?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)/g;
    // Alternative pattern: file.ts:line:col - error TS1234: message
    const tsPattern2 = /([^\s]+\.tsx?):(\d+):(\d+)\s*-?\s*error\s+TS\d+:\s*(.+)/g;

    let match;
    while ((match = tsPattern.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[4],
        type: 'type',
        severity: 'error',
      });
    }

    while ((match = tsPattern2.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message: match[4],
        type: 'type',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Parse Node.js runtime errors
   */
  private parseNodeErrors(output: string): CodeError[] {
    const errors: CodeError[] = [];

    // Pattern: at file.js:line:col
    const stackPattern = /at\s+(?:\S+\s+)?\(?([^\s:]+):(\d+):(\d+)\)?/g;
    // Error message pattern
    const errorMsgPattern = /(?:Error|TypeError|ReferenceError|SyntaxError):\s*(.+)/g;

    const errorMessages: string[] = [];
    let match;
    while ((match = errorMsgPattern.exec(output)) !== null) {
      errorMessages.push(match[1]);
    }

    // Get the first stack trace location
    const stackMatch = stackPattern.exec(output);
    if (stackMatch && errorMessages.length > 0) {
      errors.push({
        file: stackMatch[1],
        line: parseInt(stackMatch[2]),
        column: parseInt(stackMatch[3]),
        message: errorMessages[0],
        type: 'runtime',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Parse npm install errors
   */
  private parseNpmErrors(output: string): CodeError[] {
    const errors: CodeError[] = [];

    // Package not found
    const notFoundPattern = /npm ERR! 404\s+'?([^']+)'?\s+is not in/i;
    const match = notFoundPattern.exec(output);
    if (match) {
      errors.push({
        file: 'package.json',
        message: `Package not found: ${match[1]}`,
        type: 'build',
        severity: 'error',
        suggestion: `Check if '${match[1]}' is spelled correctly or use an alternative package`,
      });
    }

    // Peer dependency issues
    if (output.includes('ERESOLVE')) {
      errors.push({
        file: 'package.json',
        message: 'Dependency resolution conflict',
        type: 'build',
        severity: 'error',
        suggestion: 'Try using --legacy-peer-deps or update conflicting packages',
      });
    }

    return errors;
  }

  /**
   * Parse Python errors
   */
  private parsePythonErrors(output: string): CodeError[] {
    const errors: CodeError[] = [];

    // Syntax errors: File "file.py", line X
    const syntaxPattern = /File "([^"]+)", line (\d+)/g;

    // Pre-extract all error messages (avoids regex state collision in nested loops)
    const errorMsgPattern = /(\w*Error):\s*(.+)/g;
    const allErrorMessages: Array<{ type: string; message: string; index: number }> = [];
    let errorMatch;
    while ((errorMatch = errorMsgPattern.exec(output)) !== null) {
      allErrorMessages.push({
        type: errorMatch[1],
        message: errorMatch[2],
        index: errorMatch.index,
      });
    }

    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = syntaxPattern.exec(output)) !== null) {
      const currentMatch = fileMatch;
      // Find the closest error message AFTER this file reference
      const closestError = allErrorMessages.find((e) => e.index > currentMatch.index) ||
        allErrorMessages[allErrorMessages.length - 1] || {
          type: 'Error',
          message: 'Unknown error',
        };

      errors.push({
        file: fileMatch[1],
        line: parseInt(fileMatch[2]),
        message: closestError.message,
        type: closestError.type.includes('Syntax') ? 'syntax' : 'runtime',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Analyze an error deeply and suggest a fix
   */
  async analyzeError(
    error: CodeError,
    files: GeneratedFile[],
    intent: CodeIntent,
    plan: ProjectPlan
  ): Promise<ErrorAnalysis> {
    // Find the relevant file
    const relevantFile = files.find(
      (f) => f.path === error.file || f.path.endsWith(error.file) || error.file.endsWith(f.path)
    );

    const fileContent = relevantFile?.content || 'File not found';
    const context = files
      .filter((f) => f.path !== error.file)
      .slice(0, 3)
      .map((f) => `// ${f.path}\n${f.content.substring(0, 500)}...`)
      .join('\n\n');

    const prompt = `You are a senior software engineer debugging an error. Analyze deeply and provide a fix.

ERROR:
- File: ${error.file}
- Line: ${error.line || 'unknown'}
- Message: ${error.message}
- Type: ${error.type}

PROBLEMATIC FILE:
\`\`\`${relevantFile?.language || 'text'}
${fileContent}
\`\`\`

${context ? `OTHER PROJECT FILES:\n${context}\n` : ''}

PROJECT CONTEXT:
- Description: ${intent.refinedDescription}
- Technologies: ${intent.technologies.primary}
- Dependencies: ${Object.keys(plan.dependencies.production).join(', ')}

Analyze this error like a senior engineer would:
1. What is the ROOT CAUSE? (Not the symptom)
2. What's the EXACT fix needed?
3. Are there RELATED issues we should fix too?

Respond with JSON:
{
  "rootCause": "Clear explanation of why this error occurs",
  "suggestedFix": {
    "file": "path/to/file",
    "oldCode": "The exact code that needs to change (multiple lines if needed)",
    "newCode": "The corrected code",
    "explanation": "Why this fix works"
  },
  "confidence": "high" | "medium" | "low",
  "requiresReplan": boolean,
  "additionalIssues": ["Other problems spotted that should be fixed"]
}

ANALYSIS RULES:
1. oldCode must be EXACT text from the file (for find/replace)
2. Keep changes minimal - fix the error, don't refactor
3. If the file structure is wrong, set requiresReplan: true
4. High confidence = obvious fix, Low = uncertain
5. Check for import errors, typos, missing dependencies

OUTPUT ONLY THE JSON.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 4000 }
      );

      const text = response.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        error,
        rootCause: String(parsed.rootCause || 'Unknown'),
        suggestedFix: {
          file: String(parsed.suggestedFix?.file || error.file),
          oldCode: String(parsed.suggestedFix?.oldCode || ''),
          newCode: String(parsed.suggestedFix?.newCode || ''),
          explanation: String(parsed.suggestedFix?.explanation || ''),
        },
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
          ? parsed.confidence
          : 'medium',
        requiresReplan: Boolean(parsed.requiresReplan),
      };
    } catch (err) {
      console.error('[ErrorAnalyzer] Error analyzing:', err);
      return this.createFallbackAnalysis(error);
    }
  }

  /**
   * Apply a fix to a file
   */
  applyFix(file: GeneratedFile, analysis: ErrorAnalysis): GeneratedFile {
    if (!analysis.suggestedFix.oldCode || !analysis.suggestedFix.newCode) {
      return file;
    }

    // Try exact replacement first
    let newContent = file.content.replace(
      analysis.suggestedFix.oldCode,
      analysis.suggestedFix.newCode
    );

    // If no change, try with normalized whitespace
    if (newContent === file.content) {
      const normalizedOld = analysis.suggestedFix.oldCode.replace(/\s+/g, ' ').trim();
      const normalizedNew = analysis.suggestedFix.newCode;
      const lines = file.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const normalizedLine = lines[i].replace(/\s+/g, ' ').trim();
        if (normalizedLine.includes(normalizedOld)) {
          // Preserve indentation from original line, replace only the matched portion
          const indent = lines[i].match(/^(\s*)/)?.[1] || '';
          const originalTrimmed = lines[i].trim();
          const normalizedOriginal = originalTrimmed.replace(/\s+/g, ' ');
          // Replace the matched portion within the line, not the whole line
          lines[i] = indent + normalizedOriginal.replace(normalizedOld, normalizedNew);
          break;
        }
      }

      newContent = lines.join('\n');
    }

    return {
      ...file,
      content: newContent,
      version: file.version + 1,
      generatedAt: Date.now(),
    };
  }

  /**
   * Analyze multiple errors and prioritize fixes
   */
  async analyzeAllErrors(
    errors: CodeError[],
    files: GeneratedFile[],
    intent: CodeIntent,
    plan: ProjectPlan
  ): Promise<ErrorAnalysis[]> {
    // Limit to first 5 errors to avoid overload
    const limitedErrors = errors.slice(0, 5);

    const analyses = await Promise.all(
      limitedErrors.map((error) => this.analyzeError(error, files, intent, plan))
    );

    // Sort by confidence (high first) and whether it requires replan (no replan first)
    return analyses.sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      const aScore = confidenceOrder[a.confidence] + (a.requiresReplan ? 10 : 0);
      const bScore = confidenceOrder[b.confidence] + (b.requiresReplan ? 10 : 0);
      return aScore - bScore;
    });
  }

  /**
   * Create fallback analysis if LLM fails
   */
  private createFallbackAnalysis(error: CodeError): ErrorAnalysis {
    return {
      error,
      rootCause: 'Unable to determine root cause - manual investigation needed',
      suggestedFix: {
        file: error.file,
        oldCode: '',
        newCode: '',
        explanation: 'Automatic fix not available',
      },
      confidence: 'low',
      requiresReplan: false,
    };
  }

  /**
   * Check if errors are too severe for automatic fixing
   */
  shouldReplan(errors: CodeError[], analyses: ErrorAnalysis[]): boolean {
    // Replan if more than 5 errors
    if (errors.length > 5) return true;

    // Replan if any analysis suggests it
    if (analyses.some((a) => a.requiresReplan)) return true;

    // Replan if all fixes are low confidence
    if (analyses.length > 0 && analyses.every((a) => a.confidence === 'low')) return true;

    return false;
  }
}

export const errorAnalyzer = new ErrorAnalyzer();
