/**
 * PATTERN RECOGNIZER
 *
 * Learns from past bugs to predict future ones.
 * This is the "experience" module - it has seen thousands of bugs
 * and recognizes the patterns that lead to them.
 *
 * "History doesn't repeat itself, but it often rhymes." - Mark Twain
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { BugPattern, PatternMatch, PatternFix, DebugLanguage, Severity, Confidence } from './types';

const log = logger('PatternRecognizer');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// BUILT-IN BUG PATTERNS
// ============================================================================

const BUILT_IN_PATTERNS: BugPattern[] = [
  // JavaScript/TypeScript patterns
  {
    id: 'js-equality-null',
    name: 'Loose Equality with Null',
    description: 'Using == instead of === when checking for null can lead to unexpected matches',
    language: 'javascript',
    category: 'logic',
    signature: { type: 'regex', pattern: '==\\s*null(?!\\s*[=!])' },
    severity: 'medium',
    frequency: 0.15,
    fix: {
      automatic: true,
      template: '=== null',
      variables: [],
    },
    examples: [
      {
        bad: 'if (value == null)',
        good: 'if (value === null)',
        explanation: '== null matches both null and undefined, use === for exact match',
      },
    ],
  },
  {
    id: 'js-typeof-undefined',
    name: 'Typeof String Comparison',
    description: 'Using typeof with string literals is error-prone',
    language: 'javascript',
    category: 'logic',
    signature: {
      type: 'regex',
      pattern:
        'typeof\\s+\\w+\\s*===?\\s*[\'"](?!undefined|string|number|boolean|object|function|symbol|bigint)[^\'"]+[\'"]',
    },
    severity: 'high',
    frequency: 0.05,
    fix: {
      automatic: false,
      template: 'Correct the typeof comparison string',
      variables: [],
    },
    examples: [
      {
        bad: 'typeof x === "undefned"',
        good: 'typeof x === "undefined"',
        explanation: 'Typo in typeof comparison - will always be false',
      },
    ],
  },
  {
    id: 'js-async-foreach',
    name: 'Async in forEach',
    description: 'Using async/await inside forEach does not work as expected',
    language: 'javascript',
    category: 'logic',
    signature: { type: 'regex', pattern: '\\.forEach\\s*\\(\\s*async' },
    severity: 'high',
    frequency: 0.1,
    fix: {
      automatic: true,
      template: 'for (const item of array) { await ... }',
      variables: ['array', 'item'],
    },
    examples: [
      {
        bad: 'items.forEach(async (item) => { await process(item); })',
        good: 'for (const item of items) { await process(item); }',
        explanation: 'forEach does not await - use for...of for sequential async',
      },
    ],
  },
  {
    id: 'js-promise-no-catch',
    name: 'Unhandled Promise Rejection',
    description: 'Promise without .catch() or try/catch can lead to unhandled rejections',
    language: 'javascript',
    category: 'semantic',
    signature: {
      type: 'regex',
      pattern: 'new\\s+Promise\\s*\\([^)]*\\)(?!\\s*\\.catch|\\s*\\.finally)',
    },
    severity: 'medium',
    frequency: 0.2,
    fix: {
      automatic: true,
      template: '.catch((error) => { console.error(error); })',
      variables: [],
    },
    examples: [
      {
        bad: 'new Promise((resolve) => fetch(url))',
        good: 'new Promise((resolve) => fetch(url)).catch(handleError)',
        explanation: 'Always handle promise rejections',
      },
    ],
  },
  {
    id: 'js-array-callback-return',
    name: 'Missing Return in Array Callback',
    description: 'Array methods like map/filter expect a return value',
    language: 'javascript',
    category: 'logic',
    signature: {
      type: 'regex',
      pattern:
        '\\.(map|filter|find|some|every)\\s*\\(\\s*(?:function\\s*)?\\([^)]*\\)\\s*(?:=>)?\\s*\\{(?!\\s*return)[^}]*\\}\\s*\\)',
    },
    severity: 'high',
    frequency: 0.12,
    fix: {
      automatic: false,
      template: 'Add return statement or use arrow function shorthand',
      variables: [],
    },
    examples: [
      {
        bad: 'items.map((x) => { x * 2 })',
        good: 'items.map((x) => x * 2)',
        explanation: 'map callback must return a value',
      },
    ],
  },
  {
    id: 'js-state-mutation',
    name: 'Direct State Mutation',
    description: 'Mutating state directly instead of using setState/dispatch',
    language: 'javascript',
    category: 'semantic',
    signature: { type: 'regex', pattern: '(?:this\\.state|state)\\s*\\.\\s*\\w+\\s*=' },
    severity: 'high',
    frequency: 0.15,
    fix: {
      automatic: false,
      template: 'Use setState() or dispatch() instead',
      variables: [],
    },
    examples: [
      {
        bad: 'this.state.count = 5',
        good: 'this.setState({ count: 5 })',
        explanation: 'Direct state mutation bypasses React rendering',
      },
    ],
  },

  // Python patterns
  {
    id: 'py-mutable-default',
    name: 'Mutable Default Argument',
    description: 'Using mutable objects as default arguments leads to shared state',
    language: 'python',
    category: 'semantic',
    signature: {
      type: 'regex',
      pattern: 'def\\s+\\w+\\s*\\([^)]*=\\s*(?:\\[\\]|\\{\\}|set\\(\\))',
    },
    severity: 'high',
    frequency: 0.08,
    fix: {
      automatic: true,
      template: '=None and initialize inside function',
      variables: [],
    },
    examples: [
      {
        bad: 'def add_item(item, items=[]): items.append(item)',
        good: 'def add_item(item, items=None): items = items or []',
        explanation: 'Default list is shared across calls',
      },
    ],
  },
  {
    id: 'py-except-bare',
    name: 'Bare Except Clause',
    description: 'Catching all exceptions hides bugs and catches system exits',
    language: 'python',
    category: 'semantic',
    signature: { type: 'regex', pattern: 'except\\s*:(?!\\s*pass)' },
    severity: 'medium',
    frequency: 0.1,
    fix: {
      automatic: true,
      template: 'except Exception:',
      variables: [],
    },
    examples: [
      {
        bad: 'except:',
        good: 'except Exception:',
        explanation: 'Bare except catches KeyboardInterrupt and SystemExit',
      },
    ],
  },

  // SQL patterns
  {
    id: 'sql-injection',
    name: 'SQL Injection Vulnerability',
    description: 'String concatenation in SQL queries enables injection attacks',
    language: 'universal',
    category: 'security',
    signature: { type: 'regex', pattern: '(?:execute|query|raw)\\s*\\([^)]*[+`$]' },
    severity: 'critical',
    frequency: 0.05,
    fix: {
      automatic: false,
      template: 'Use parameterized queries',
      variables: [],
    },
    examples: [
      {
        bad: 'db.query("SELECT * FROM users WHERE id = " + userId)',
        good: 'db.query("SELECT * FROM users WHERE id = ?", [userId])',
        explanation: 'User input can modify query structure',
      },
    ],
  },

  // Concurrency patterns
  {
    id: 'race-check-then-act',
    name: 'Check-Then-Act Race Condition',
    description: 'Checking a condition then acting on it without synchronization',
    language: 'universal',
    category: 'concurrency',
    signature: { type: 'semantic', pattern: 'check-then-act' },
    severity: 'high',
    frequency: 0.08,
    fix: {
      automatic: false,
      template: 'Use atomic operations or locks',
      variables: [],
    },
    examples: [
      {
        bad: 'if (!file.exists()) { file.create(); }',
        good: 'try { file.createExclusive(); } catch { /* exists */ }',
        explanation: 'Another thread might create file between check and create',
      },
    ],
  },

  // Memory patterns
  {
    id: 'memory-leak-closure',
    name: 'Closure Memory Leak',
    description: 'Closure retaining reference to large object',
    language: 'javascript',
    category: 'performance',
    signature: {
      type: 'regex',
      pattern: 'addEventListener\\s*\\([^)]+,\\s*(?:function|\\([^)]*\\)\\s*=>)',
    },
    severity: 'medium',
    frequency: 0.1,
    fix: {
      automatic: false,
      template: 'Remove event listener on cleanup',
      variables: [],
    },
    examples: [
      {
        bad: 'element.addEventListener("click", () => { use(largeObject) })',
        good: 'const handler = () => use(largeObject); element.addEventListener("click", handler); // later: removeEventListener',
        explanation: 'Event listener keeps closure and referenced objects alive',
      },
    ],
  },

  // API patterns
  {
    id: 'api-no-error-handling',
    name: 'API Call Without Error Handling',
    description: 'Network requests should always handle errors',
    language: 'javascript',
    category: 'semantic',
    signature: {
      type: 'regex',
      pattern: 'fetch\\s*\\([^)]+\\)(?!\\.catch|\\s*\\.then\\s*\\([^)]+\\)\\s*\\.catch)',
    },
    severity: 'medium',
    frequency: 0.15,
    fix: {
      automatic: true,
      template: '.catch((error) => { /* handle error */ })',
      variables: [],
    },
    examples: [
      {
        bad: 'fetch(url).then(r => r.json())',
        good: 'fetch(url).then(r => r.json()).catch(handleError)',
        explanation: 'Network errors will be unhandled',
      },
    ],
  },

  // Type patterns
  {
    id: 'type-coercion-equality',
    name: 'Type Coercion in Comparison',
    description: 'Comparing values of different types leads to unexpected results',
    language: 'javascript',
    category: 'logic',
    signature: {
      type: 'regex',
      pattern: '(?:==|!=)\\s*(?:0|1|true|false|null|undefined|""|\'\'|\\[\\]|\\{\\})',
    },
    severity: 'medium',
    frequency: 0.1,
    fix: {
      automatic: true,
      template: 'Use === or !== for strict comparison',
      variables: [],
    },
    examples: [
      {
        bad: 'if (value == false)',
        good: 'if (value === false)',
        explanation: '0, "", [], and null all == false',
      },
    ],
  },
];

// ============================================================================
// PATTERN RECOGNIZER
// ============================================================================

export class PatternRecognizer {
  private patterns: BugPattern[] = [...BUILT_IN_PATTERNS];
  private learnedPatterns: BugPattern[] = [];

  /**
   * Find patterns in code
   */
  async findPatterns(
    code: string,
    language: DebugLanguage,
    options: {
      includeLearnedPatterns?: boolean;
      minSeverity?: Severity;
    } = {}
  ): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    // Get applicable patterns
    const applicablePatterns = this.getApplicablePatterns(
      language,
      options.includeLearnedPatterns !== false
    );

    // Apply each pattern
    for (const pattern of applicablePatterns) {
      // Skip if below minimum severity
      if (options.minSeverity && !this.meetsMinSeverity(pattern.severity, options.minSeverity)) {
        continue;
      }

      const patternMatches = this.applyPattern(pattern, code, language);
      matches.push(...patternMatches);
    }

    // Use AI to find semantic patterns that regex can't catch
    const semanticMatches = await this.findSemanticPatterns(code, language);
    matches.push(...semanticMatches);

    return this.deduplicateMatches(matches);
  }

  /**
   * Get patterns applicable to a language
   */
  private getApplicablePatterns(language: DebugLanguage, includeLearned: boolean): BugPattern[] {
    const allPatterns = includeLearned
      ? [...this.patterns, ...this.learnedPatterns]
      : this.patterns;

    return allPatterns.filter(
      (p) =>
        p.language === language ||
        p.language === 'universal' ||
        (language === 'typescript' && p.language === 'javascript')
    );
  }

  /**
   * Apply a pattern to code
   */
  private applyPattern(
    pattern: BugPattern,
    code: string,
    _language: DebugLanguage
  ): PatternMatch[] {
    const matches: PatternMatch[] = [];

    if (pattern.signature.type === 'regex') {
      const regex = new RegExp(pattern.signature.pattern as string, 'gm');
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        if (regex.test(line)) {
          // Check anti-patterns
          if (pattern.signature.antiPatterns) {
            const hasAnti = pattern.signature.antiPatterns.some((ap) => new RegExp(ap).test(line));
            if (hasAnti) return;
          }

          matches.push(this.createMatch(pattern, i + 1, line, code));
        }
        // Reset regex state
        regex.lastIndex = 0;
      });
    }

    return matches;
  }

  /**
   * Find semantic patterns using AI
   */
  private async findSemanticPatterns(
    code: string,
    language: DebugLanguage
  ): Promise<PatternMatch[]> {
    const prompt = `Identify BUG PATTERNS in this ${language} code that can't be caught with simple regex.

CODE:
\`\`\`${language}
${code}
\`\`\`

Look for:
1. Logic errors (off-by-one, wrong operator, inverted condition)
2. Resource leaks (unclosed handles, missing cleanup)
3. Race conditions (check-then-act, shared mutable state)
4. Type confusion (wrong type assumptions)
5. API misuse (wrong method, missing required calls)
6. Security issues (injection, exposure)

Return JSON array:
[{
  "patternName": "name of the pattern",
  "line": line_number,
  "description": "what's wrong",
  "severity": "critical" | "high" | "medium" | "low",
  "confidence": "certain" | "high" | "medium" | "low",
  "fix": {
    "oldCode": "the problematic code",
    "newCode": "the fixed code",
    "explanation": "why this fixes it"
  }
}]

Only report issues you're confident about. Include line numbers.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        pattern: {
          id: `semantic_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: String(item.patternName || 'Semantic Pattern'),
          description: String(item.description || ''),
          language,
          category: 'semantic' as const,
          signature: { type: 'semantic' as const, pattern: '' },
          severity: (item.severity as Severity) || 'medium',
          frequency: 0.1,
          fix: {
            automatic: Boolean(item.fix),
            template: (item.fix as { newCode?: string })?.newCode || '',
            variables: [],
          },
          examples: [],
        },
        location: { file: 'current', line: Number(item.line) || 1 },
        confidence: (item.confidence as Confidence) || 'medium',
        context: String(item.description || ''),
        suggestedFix: item.fix
          ? {
              type: 'replace' as const,
              location: { file: 'current', line: Number(item.line) || 1 },
              oldCode: (item.fix as { oldCode?: string }).oldCode,
              newCode: String((item.fix as { newCode?: string }).newCode || ''),
              explanation: String((item.fix as { explanation?: string }).explanation || ''),
              confidence: (item.confidence as Confidence) || 'medium',
              requiresReview: true,
            }
          : undefined,
      }));
    } catch (error) {
      log.warn('Failed to find semantic patterns', { error });
      return [];
    }
  }

  /**
   * Create a pattern match object
   */
  private createMatch(
    pattern: BugPattern,
    line: number,
    matchedLine: string,
    _fullCode: string
  ): PatternMatch {
    return {
      pattern,
      location: { file: 'current', line },
      confidence: this.severityToConfidence(pattern.severity),
      context: matchedLine.trim(),
      suggestedFix: pattern.fix.automatic
        ? {
            type: 'replace',
            location: { file: 'current', line },
            oldCode: matchedLine.trim(),
            newCode: this.applyFixTemplate(pattern.fix, matchedLine),
            explanation: pattern.description,
            confidence: 'high',
            requiresReview: !pattern.fix.automatic,
          }
        : undefined,
    };
  }

  /**
   * Apply fix template to code
   */
  private applyFixTemplate(fix: PatternFix, code: string): string {
    // Simple template application
    // In production, this would be more sophisticated
    return fix.template || code;
  }

  /**
   * Learn a new pattern from a bug fix
   */
  learnPattern(
    buggyCode: string,
    fixedCode: string,
    language: DebugLanguage,
    description: string
  ): BugPattern {
    const pattern: BugPattern = {
      id: `learned_${Date.now()}`,
      name: `Learned: ${description.slice(0, 50)}`,
      description,
      language,
      category: 'semantic',
      signature: {
        type: 'semantic',
        pattern: buggyCode,
      },
      severity: 'medium',
      frequency: 0.05,
      fix: {
        automatic: false,
        template: fixedCode,
        variables: [],
      },
      examples: [
        {
          bad: buggyCode,
          good: fixedCode,
          explanation: description,
        },
      ],
    };

    this.learnedPatterns.push(pattern);
    log.info('Learned new pattern', { patternId: pattern.id });

    return pattern;
  }

  /**
   * Get all known patterns
   */
  getPatterns(language?: DebugLanguage): BugPattern[] {
    const all = [...this.patterns, ...this.learnedPatterns];
    if (!language) return all;
    return all.filter((p) => p.language === language || p.language === 'universal');
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: BugPattern): void {
    this.patterns.push(pattern);
    log.info('Added custom pattern', { patternId: pattern.id });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private severityToConfidence(severity: Severity): Confidence {
    const map: Record<Severity, Confidence> = {
      critical: 'certain',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'speculative',
    };
    return map[severity];
  }

  private meetsMinSeverity(actual: Severity, minimum: Severity): boolean {
    const order = ['info', 'low', 'medium', 'high', 'critical'];
    return order.indexOf(actual) >= order.indexOf(minimum);
  }

  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Set<string>();
    return matches.filter((match) => {
      const key = `${match.pattern.id}_${match.location.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
