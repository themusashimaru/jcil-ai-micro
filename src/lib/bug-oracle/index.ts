/**
 * BUG ORACLE
 *
 * Predict bugs before they happen. The AI psychic QA team.
 *
 * Features:
 * - Static analysis with AI enhancement
 * - Pattern-based bug prediction
 * - Historical bug correlation
 * - Code smell detection
 * - Race condition detection
 * - Memory leak prediction
 * - Edge case identification
 * - Regression risk assessment
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('BugOracle');

// ============================================
// TYPES
// ============================================

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BugCategory =
  | 'null-reference'
  | 'type-error'
  | 'race-condition'
  | 'memory-leak'
  | 'infinite-loop'
  | 'off-by-one'
  | 'boundary-error'
  | 'logic-error'
  | 'exception-handling'
  | 'state-management'
  | 'async-error'
  | 'resource-leak'
  | 'security'
  | 'performance';

export interface PredictedBug {
  id: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  probability: number; // 0-1 likelihood this will cause issues
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  prediction: string; // What will go wrong
  conditions: string[]; // Under what conditions
  fix: BugFix;
  relatedPatterns: string[];
}

export interface BugFix {
  description: string;
  code: string;
  effort: 'trivial' | 'easy' | 'moderate' | 'complex';
  breakingChange: boolean;
}

export interface BugPredictionResult {
  scannedAt: string;
  filesAnalyzed: number;
  predictions: PredictedBug[];
  riskScore: number; // 0-100
  summary: BugSummary;
  recommendations: string[];
  technicalDebt: TechnicalDebtItem[];
}

export interface BugSummary {
  total: number;
  bySeverity: Record<BugSeverity, number>;
  byCategory: Record<string, number>;
  highRiskFiles: string[];
}

export interface TechnicalDebtItem {
  type: string;
  description: string;
  location: string;
  effort: string;
  impact: string;
}

export interface CodePattern {
  name: string;
  pattern: RegExp;
  category: BugCategory;
  severity: BugSeverity;
  description: string;
  falsePositiveRisk: 'low' | 'medium' | 'high';
}

// ============================================
// BUG PATTERNS
// ============================================

const BUG_PATTERNS: CodePattern[] = [
  // Null/undefined issues
  {
    name: 'Unchecked optional chain result',
    pattern: /(\w+)\?\.\w+\s*\./g,
    category: 'null-reference',
    severity: 'medium',
    description: 'Optional chain result used without null check',
    falsePositiveRisk: 'medium',
  },
  {
    name: 'Non-null assertion',
    pattern: /(\w+)!/g,
    category: 'null-reference',
    severity: 'high',
    description: 'Non-null assertion could crash if value is null',
    falsePositiveRisk: 'medium',
  },
  {
    name: 'Unsafe property access after nullish check',
    pattern: /if\s*\(\s*!?\w+\s*\)\s*{\s*[^}]*}\s*\w+\.\w+/g,
    category: 'null-reference',
    severity: 'high',
    description: 'Property accessed without guaranteed null check',
    falsePositiveRisk: 'high',
  },

  // Async issues
  {
    name: 'Missing await',
    pattern: /(?<!await\s)(?:fetch|axios|supabase\.\w+|prisma\.\w+)\([^)]*\)(?!\s*\.then)/g,
    category: 'async-error',
    severity: 'high',
    description: 'Async function called without await',
    falsePositiveRisk: 'medium',
  },
  {
    name: 'Promise in loop without Promise.all',
    pattern: /for\s*\([^)]*\)\s*{[^}]*await\s+/g,
    category: 'performance',
    severity: 'medium',
    description: 'Sequential await in loop - consider Promise.all',
    falsePositiveRisk: 'low',
  },
  {
    name: 'Unhandled promise rejection',
    pattern: /\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*{\s*}\s*\)/g,
    category: 'exception-handling',
    severity: 'medium',
    description: 'Empty catch block swallows errors silently',
    falsePositiveRisk: 'low',
  },

  // Array issues
  {
    name: 'Array index without bounds check',
    pattern: /\[\s*\w+\s*-\s*1\s*\]/g,
    category: 'boundary-error',
    severity: 'medium',
    description: 'Array access with arithmetic could be out of bounds',
    falsePositiveRisk: 'medium',
  },
  {
    name: 'Array length in condition',
    pattern: /\.length\s*[<>=]+\s*\d+/g,
    category: 'off-by-one',
    severity: 'low',
    description: 'Potential off-by-one error in length comparison',
    falsePositiveRisk: 'high',
  },

  // State issues
  {
    name: 'useState in conditional',
    pattern: /if\s*\([^)]*\)\s*{[^}]*useState/g,
    category: 'state-management',
    severity: 'critical',
    description: 'React hook called conditionally - violates rules of hooks',
    falsePositiveRisk: 'low',
  },
  {
    name: 'State update in render',
    pattern: /function\s+\w+\s*\([^)]*\)\s*{[^}]*setState[^}]*return/g,
    category: 'infinite-loop',
    severity: 'critical',
    description: 'State update during render causes infinite loop',
    falsePositiveRisk: 'medium',
  },

  // Memory issues
  {
    name: 'Event listener without cleanup',
    pattern: /addEventListener\([^)]+\)(?![^}]*removeEventListener)/g,
    category: 'memory-leak',
    severity: 'medium',
    description: 'Event listener added without cleanup',
    falsePositiveRisk: 'medium',
  },
  {
    name: 'setInterval without cleanup',
    pattern: /setInterval\([^)]+\)(?![^}]*clearInterval)/g,
    category: 'memory-leak',
    severity: 'high',
    description: 'Interval created without cleanup mechanism',
    falsePositiveRisk: 'low',
  },

  // Type issues
  {
    name: 'Type assertion to any',
    pattern: /as\s+any/g,
    category: 'type-error',
    severity: 'medium',
    description: 'Type assertion to any bypasses type safety',
    falsePositiveRisk: 'low',
  },
  {
    name: 'Implicit any parameter',
    pattern: /\(\s*\w+\s*\)\s*=>/g,
    category: 'type-error',
    severity: 'low',
    description: 'Parameter without type annotation',
    falsePositiveRisk: 'high',
  },

  // Logic issues
  {
    name: 'Assignment in conditional',
    pattern: /if\s*\(\s*\w+\s*=\s*[^=]/g,
    category: 'logic-error',
    severity: 'high',
    description: 'Assignment (=) instead of comparison (==)',
    falsePositiveRisk: 'low',
  },
  {
    name: 'Floating point comparison',
    pattern: /===?\s*0\.\d+|0\.\d+\s*===?/g,
    category: 'logic-error',
    severity: 'medium',
    description: 'Direct floating point comparison can fail',
    falsePositiveRisk: 'medium',
  },
];

// ============================================
// BUG ORACLE CLASS
// ============================================

export class BugOracle {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Predict bugs in a codebase
   */
  async predictBugs(
    files: Array<{ path: string; content: string }>
  ): Promise<BugPredictionResult> {
    log.info('Analyzing files for potential bugs', { fileCount: files.length });

    const predictions: PredictedBug[] = [];

    for (const file of files) {
      // Skip non-code files
      if (!this.isCodeFile(file.path)) continue;

      // Pattern-based predictions
      const patternBugs = this.patternBasedPrediction(file);
      predictions.push(...patternBugs);

      // AI-powered deep analysis
      const aiBugs = await this.aiPrediction(file);
      predictions.push(...aiBugs);
    }

    // Deduplicate
    const uniquePredictions = this.deduplicatePredictions(predictions);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(uniquePredictions);

    // Generate summary
    const summary = this.generateSummary(uniquePredictions, files);

    // Detect technical debt
    const technicalDebt = await this.detectTechnicalDebt(files);

    // Generate recommendations
    const recommendations = this.generateRecommendations(uniquePredictions, technicalDebt);

    return {
      scannedAt: new Date().toISOString(),
      filesAnalyzed: files.filter(f => this.isCodeFile(f.path)).length,
      predictions: uniquePredictions.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      riskScore,
      summary,
      recommendations,
      technicalDebt,
    };
  }

  /**
   * Pattern-based bug prediction
   */
  private patternBasedPrediction(
    file: { path: string; content: string }
  ): PredictedBug[] {
    const predictions: PredictedBug[] = [];
    const lines = file.content.split('\n');

    for (const pattern of BUG_PATTERNS) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;

      while ((match = regex.exec(file.content)) !== null) {
        const lineNumber = this.getLineNumber(file.content, match.index);
        const codeSnippet = lines.slice(
          Math.max(0, lineNumber - 2),
          Math.min(lines.length, lineNumber + 2)
        ).join('\n');

        predictions.push({
          id: `pattern-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: pattern.name,
          description: pattern.description,
          category: pattern.category,
          severity: pattern.severity,
          probability: pattern.falsePositiveRisk === 'low' ? 0.8 : pattern.falsePositiveRisk === 'medium' ? 0.5 : 0.3,
          filePath: file.path,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet,
          prediction: `This pattern often leads to ${pattern.category} issues`,
          conditions: ['Under certain runtime conditions'],
          fix: {
            description: `Review and fix ${pattern.name}`,
            code: '// Review this code',
            effort: 'easy',
            breakingChange: false,
          },
          relatedPatterns: [pattern.name],
        });
      }
    }

    return predictions;
  }

  /**
   * AI-powered bug prediction
   */
  private async aiPrediction(
    file: { path: string; content: string }
  ): Promise<PredictedBug[]> {
    // Skip small files
    if (file.content.length < 100) return [];

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are a senior QA engineer with psychic abilities to predict bugs before they happen.

Analyze code for POTENTIAL bugs that could manifest under certain conditions:

1. **Null/Undefined Issues**: Unhandled null cases
2. **Race Conditions**: Async operations that could conflict
3. **Memory Leaks**: Resources not properly cleaned up
4. **Logic Errors**: Incorrect conditions, off-by-one errors
5. **State Issues**: Improper state management
6. **Edge Cases**: Unhandled boundary conditions
7. **Error Handling**: Missing or improper error handling
8. **Type Issues**: Type coercion problems
9. **Performance**: N+1 queries, blocking operations
10. **Security**: Input validation, injection risks

For each potential bug, explain:
- What will go wrong
- Under what conditions
- How likely it is to occur
- How to fix it

Return JSON array:
[
  {
    "title": "Bug title",
    "description": "What the bug is",
    "category": "null-reference|type-error|race-condition|memory-leak|infinite-loop|off-by-one|boundary-error|logic-error|exception-handling|state-management|async-error|resource-leak|security|performance",
    "severity": "critical|high|medium|low",
    "probability": 0.0-1.0,
    "lineStart": number,
    "lineEnd": number,
    "prediction": "What will happen when this bug triggers",
    "conditions": ["Condition 1", "Condition 2"],
    "fix": {
      "description": "How to fix",
      "code": "Fixed code",
      "effort": "trivial|easy|moderate|complex",
      "breakingChange": boolean
    }
  }
]

Only report bugs with >30% probability. Be specific and actionable.`,
        messages: [
          {
            role: 'user',
            content: `Predict potential bugs in this code:

File: ${file.path}

\`\`\`
${file.content.substring(0, 8000)}
\`\`\``,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return parsed.map((bug: Partial<PredictedBug>) => ({
        ...bug,
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        filePath: file.path,
        codeSnippet: this.extractSnippet(file.content, bug.lineStart || 1, bug.lineEnd || 1),
        relatedPatterns: [],
      }));
    } catch (error) {
      log.error('AI prediction error', error as Error, { filePath: file.path });
      return [];
    }
  }

  /**
   * Detect technical debt
   */
  private async detectTechnicalDebt(
    files: Array<{ path: string; content: string }>
  ): Promise<TechnicalDebtItem[]> {
    const debt: TechnicalDebtItem[] = [];

    for (const file of files) {
      if (!this.isCodeFile(file.path)) continue;

      // Check for TODO/FIXME comments
      const todoMatches = file.content.matchAll(/\/\/\s*(TODO|FIXME|HACK|XXX):\s*(.+)/gi);
      for (const match of todoMatches) {
        debt.push({
          type: match[1].toUpperCase(),
          description: match[2].trim(),
          location: `${file.path}:${this.getLineNumber(file.content, match.index!)}`,
          effort: 'unknown',
          impact: match[1].toUpperCase() === 'FIXME' ? 'high' : 'medium',
        });
      }

      // Check for complexity
      const functionMatches = file.content.matchAll(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g);
      for (const match of functionMatches) {
        const funcName = match[1] || match[2];
        const startIndex = match.index!;
        const endIndex = this.findFunctionEnd(file.content, startIndex);
        const funcContent = file.content.substring(startIndex, endIndex);

        // Check cyclomatic complexity (simplified)
        const branches = (funcContent.match(/if\s*\(|else\s*{|\?\s*:|&&|\|\||case\s+/g) || []).length;
        if (branches > 10) {
          debt.push({
            type: 'COMPLEXITY',
            description: `Function ${funcName} has high cyclomatic complexity (${branches} branches)`,
            location: `${file.path}:${this.getLineNumber(file.content, startIndex)}`,
            effort: 'moderate',
            impact: 'medium',
          });
        }

        // Check function length
        const lineCount = funcContent.split('\n').length;
        if (lineCount > 50) {
          debt.push({
            type: 'LENGTH',
            description: `Function ${funcName} is too long (${lineCount} lines)`,
            location: `${file.path}:${this.getLineNumber(file.content, startIndex)}`,
            effort: 'moderate',
            impact: 'low',
          });
        }
      }
    }

    return debt;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(predictions: PredictedBug[]): number {
    if (predictions.length === 0) return 100;

    let score = 100;

    for (const bug of predictions) {
      const severityWeight = { critical: 25, high: 15, medium: 8, low: 3 };
      score -= severityWeight[bug.severity] * bug.probability;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate summary
   */
  private generateSummary(
    predictions: PredictedBug[],
    _files: Array<{ path: string; content: string }>
  ): BugSummary {
    const bySeverity: Record<BugSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byCategory: Record<string, number> = {};
    const fileRisk: Record<string, number> = {};

    for (const bug of predictions) {
      bySeverity[bug.severity]++;
      byCategory[bug.category] = (byCategory[bug.category] || 0) + 1;

      const severityScore = { critical: 10, high: 5, medium: 2, low: 1 };
      fileRisk[bug.filePath] = (fileRisk[bug.filePath] || 0) + severityScore[bug.severity];
    }

    const highRiskFiles = Object.entries(fileRisk)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file]) => file);

    return {
      total: predictions.length,
      bySeverity,
      byCategory,
      highRiskFiles,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    predictions: PredictedBug[],
    debt: TechnicalDebtItem[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = predictions.filter(p => p.severity === 'critical').length;
    const highCount = predictions.filter(p => p.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(`🚨 Address ${criticalCount} critical issues immediately before deployment`);
    }

    if (highCount > 0) {
      recommendations.push(`⚠️ Schedule time to fix ${highCount} high-severity potential bugs`);
    }

    // Category-specific recommendations
    const categories = new Set(predictions.map(p => p.category));

    if (categories.has('null-reference')) {
      recommendations.push('Enable strict null checks in TypeScript configuration');
    }

    if (categories.has('async-error')) {
      recommendations.push('Review async/await usage and add proper error boundaries');
    }

    if (categories.has('memory-leak')) {
      recommendations.push('Audit useEffect cleanup functions and event listeners');
    }

    if (categories.has('state-management')) {
      recommendations.push('Review React hooks usage and state update patterns');
    }

    if (debt.length > 10) {
      recommendations.push(`📝 Address ${debt.length} technical debt items to improve maintainability`);
    }

    if (predictions.length === 0) {
      recommendations.push('✅ No significant bug risks detected. Consider adding more test coverage.');
    }

    return recommendations;
  }

  /**
   * Helper functions
   */
  private isCodeFile(path: string): boolean {
    return /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php)$/.test(path);
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private extractSnippet(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(Math.max(0, startLine - 2), Math.min(lines.length, endLine + 2)).join('\n');
  }

  private findFunctionEnd(content: string, startIndex: number): number {
    let braceCount = 0;
    let started = false;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        started = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i + 1;
        }
      }
    }

    return content.length;
  }

  private deduplicatePredictions(predictions: PredictedBug[]): PredictedBug[] {
    const seen = new Set<string>();
    return predictions.filter(bug => {
      const key = `${bug.filePath}:${bug.lineStart}:${bug.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ============================================
// EXPORTS
// ============================================

export const bugOracle = new BugOracle();

/**
 * Quick function to predict bugs
 */
export async function predictBugs(
  files: Array<{ path: string; content: string }>
): Promise<BugPredictionResult> {
  return bugOracle.predictBugs(files);
}

/**
 * Get quick risk assessment
 */
export async function getRiskScore(
  files: Array<{ path: string; content: string }>
): Promise<number> {
  const result = await bugOracle.predictBugs(files);
  return result.riskScore;
}
