/**
 * AI PAIR PROGRAMMER - REAL-TIME COLLABORATIVE CODING
 *
 * Unlike traditional AI chat where you ask and receive,
 * this creates a live coding session where Claude watches
 * your edits in real-time and provides suggestions, catches
 * bugs, and completes code AS YOU TYPE.
 *
 * This is the difference between a chatbot and a teammate.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('PairProgrammer');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface CodeEdit {
  timestamp: number;
  file: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  cursorPosition: { line: number; column: number };
}

export interface PairProgrammerContext {
  currentFile: string;
  fileContent: string;
  recentEdits: CodeEdit[];
  cursorLine: number;
  selectedText?: string;
  diagnostics?: Array<{
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'hint';
  }>;
  projectContext?: {
    language: string;
    framework?: string;
    dependencies?: string[];
    recentFiles?: string[];
  };
}

export interface PairProgrammerSuggestion {
  type: 'completion' | 'fix' | 'refactor' | 'explain' | 'warning' | 'optimization';
  content: string;
  code?: string;
  insertAt?: { line: number; column: number };
  replaceRange?: { startLine: number; endLine: number };
  confidence: number;
  reasoning?: string;
}

/**
 * The AI Pair Programmer - thinks alongside you
 */
export class AIPairProgrammer {
  private editHistory: CodeEdit[] = [];
  private analysisDebounce = 500; // ms
  private pendingAnalysis: NodeJS.Timeout | null = null;

  /**
   * Process a code edit and generate intelligent suggestions
   */
  async onEdit(
    edit: CodeEdit,
    context: PairProgrammerContext
  ): Promise<PairProgrammerSuggestion[]> {
    this.editHistory.push(edit);

    // Keep last 20 edits for pattern recognition
    if (this.editHistory.length > 20) {
      this.editHistory = this.editHistory.slice(-20);
    }

    // Debounce analysis to avoid overwhelming the API
    if (this.pendingAnalysis) {
      clearTimeout(this.pendingAnalysis);
    }

    return new Promise((resolve) => {
      this.pendingAnalysis = setTimeout(async () => {
        const suggestions = await this.analyzeAndSuggest(context);
        resolve(suggestions);
      }, this.analysisDebounce);
    });
  }

  /**
   * Analyze current context and generate suggestions
   */
  private async analyzeAndSuggest(
    context: PairProgrammerContext
  ): Promise<PairProgrammerSuggestion[]> {
    const suggestions: PairProgrammerSuggestion[] = [];

    // Analyze edit patterns
    const editPatterns = this.detectEditPatterns();

    // Build intelligent prompt based on context
    const prompt = this.buildAnalysisPrompt(context, editPatterns);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', // Fast model for real-time
        max_tokens: 1024,
        system: `You are an AI pair programmer watching code edits in real-time.
Your role is to:
1. Complete code the user is writing (predict next lines)
2. Catch bugs and errors before they happen
3. Suggest optimizations when you see inefficient patterns
4. Explain complex code when the user hovers/selects it
5. Offer refactoring when you see repeated patterns

Be proactive but not annoying. Only suggest when you're confident.
Return JSON array of suggestions with confidence scores.`,
        messages: [{ role: 'user', content: prompt }],
      });

      let content = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }

      // Parse suggestions
      try {
        const parsed = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
        if (Array.isArray(parsed)) {
          suggestions.push(...parsed.filter((s: PairProgrammerSuggestion) => s.confidence > 0.7));
        }
      } catch {
        // If parsing fails, extract suggestions manually
      }
    } catch (error) {
      log.error('Analysis error', error as Error);
    }

    return suggestions;
  }

  /**
   * Detect patterns in recent edits
   */
  private detectEditPatterns(): {
    isWritingFunction: boolean;
    isDebugging: boolean;
    isRefactoring: boolean;
    repetitivePattern?: string;
    likelyNextAction?: string;
  } {
    const recentEdits = this.editHistory.slice(-5);

    // Check if user is writing a function
    const isWritingFunction = recentEdits.some((e) =>
      /function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|=>\s*{?/.test(e.newContent)
    );

    // Check if user is debugging (lots of console.log or deletes)
    const isDebugging =
      recentEdits.filter(
        (e) =>
          e.newContent.includes('console.log') ||
          e.newContent.includes('debugger') ||
          e.oldContent.length > e.newContent.length * 2
      ).length >= 2;

    // Check if user is refactoring (similar edits in multiple places)
    const editContents = recentEdits.map((e) => e.newContent.trim());
    const repetitivePattern = editContents.find((content, i) =>
      editContents.slice(i + 1).some((other) => this.similarity(content, other) > 0.8)
    );

    // Predict likely next action
    let likelyNextAction: string | undefined;
    const lastEdit = recentEdits[recentEdits.length - 1];
    if (lastEdit) {
      if (lastEdit.newContent.includes('interface ')) {
        likelyNextAction = 'implementing_interface';
      } else if (lastEdit.newContent.includes('import ')) {
        likelyNextAction = 'using_import';
      } else if (lastEdit.newContent.match(/\)\s*{\s*$/)) {
        likelyNextAction = 'writing_function_body';
      }
    }

    return {
      isWritingFunction,
      isDebugging,
      isRefactoring: !!repetitivePattern,
      repetitivePattern,
      likelyNextAction,
    };
  }

  /**
   * Build analysis prompt from context
   */
  private buildAnalysisPrompt(
    context: PairProgrammerContext,
    patterns: ReturnType<typeof this.detectEditPatterns>
  ): string {
    const lines = context.fileContent.split('\n');
    const surroundingLines = lines
      .slice(Math.max(0, context.cursorLine - 10), Math.min(lines.length, context.cursorLine + 10))
      .join('\n');

    let prompt = `Current file: ${context.currentFile}\n`;
    prompt += `Cursor at line ${context.cursorLine}\n\n`;
    prompt += `Code around cursor:\n\`\`\`\n${surroundingLines}\n\`\`\`\n\n`;

    if (context.selectedText) {
      prompt += `Selected text: "${context.selectedText}"\n\n`;
    }

    if (context.diagnostics && context.diagnostics.length > 0) {
      prompt += `Current errors/warnings:\n`;
      context.diagnostics.forEach((d) => {
        prompt += `- Line ${d.line}: [${d.severity}] ${d.message}\n`;
      });
      prompt += '\n';
    }

    prompt += `Edit patterns detected:\n`;
    if (patterns.isWritingFunction) prompt += `- User is writing a function\n`;
    if (patterns.isDebugging) prompt += `- User appears to be debugging\n`;
    if (patterns.isRefactoring)
      prompt += `- User is refactoring (repeated pattern: ${patterns.repetitivePattern})\n`;
    if (patterns.likelyNextAction) prompt += `- Likely next action: ${patterns.likelyNextAction}\n`;

    prompt += `\nRecent edits:\n`;
    this.editHistory.slice(-3).forEach((edit) => {
      prompt += `- Changed "${edit.oldContent.slice(0, 50)}" to "${edit.newContent.slice(0, 50)}"\n`;
    });

    prompt += `\nProvide suggestions as JSON array. Each suggestion should have:
- type: "completion" | "fix" | "refactor" | "explain" | "warning" | "optimization"
- content: Brief description
- code: The actual code to insert (if applicable)
- insertAt: {line, column} or replaceRange: {startLine, endLine}
- confidence: 0-1 score
- reasoning: Why this suggestion`;

    return prompt;
  }

  /**
   * Get proactive suggestions based on file open
   */
  async onFileOpen(context: PairProgrammerContext): Promise<PairProgrammerSuggestion[]> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Quickly scan this file and identify any immediate issues or improvements:

File: ${context.currentFile}
\`\`\`
${context.fileContent.slice(0, 3000)}
\`\`\`

Return JSON array with max 3 most important suggestions.`,
        },
      ],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const parsed = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate inline completion (like Copilot but smarter)
   */
  async getCompletion(
    context: PairProgrammerContext,
    _triggerKind: 'automatic' | 'manual'
  ): Promise<string | null> {
    const lines = context.fileContent.split('\n');
    const linesBefore = lines.slice(Math.max(0, context.cursorLine - 20), context.cursorLine);
    const linesAfter = lines.slice(context.cursorLine, context.cursorLine + 10);
    const currentLine = lines[context.cursorLine] || '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: `You are a code completion engine. Complete the code at the cursor.
Rules:
- Return ONLY the completion, no explanation
- Match the existing code style exactly
- Be concise - complete the current thought, not paragraphs
- If unsure, return empty string`,
      messages: [
        {
          role: 'user',
          content: `Complete this code:

\`\`\`${context.projectContext?.language || 'typescript'}
${linesBefore.join('\n')}
${currentLine}█ // cursor here
${linesAfter.join('\n')}
\`\`\`

Return only the completion text, nothing else.`,
        },
      ],
    });

    let completion = '';
    for (const block of response.content) {
      if (block.type === 'text') completion += block.text;
    }

    // Clean up completion
    completion = completion
      .replace(/^```\w*\n?/, '')
      .replace(/```$/, '')
      .trim();

    return completion || null;
  }

  /**
   * Calculate string similarity (Jaccard)
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }
}

/**
 * Singleton instance for the pair programmer
 */
let pairProgrammerInstance: AIPairProgrammer | null = null;

export function getPairProgrammer(): AIPairProgrammer {
  if (!pairProgrammerInstance) {
    pairProgrammerInstance = new AIPairProgrammer();
  }
  return pairProgrammerInstance;
}
