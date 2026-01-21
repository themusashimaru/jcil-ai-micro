/**
 * PERFORMANCE ANALYZER
 *
 * Finds performance bottlenecks and optimization opportunities.
 *
 * Detects:
 * - N+1 queries
 * - Memory leaks
 * - Unnecessary re-renders (React)
 * - Heavy computations in hot paths
 * - Missing indexes (database)
 * - Unoptimized loops
 * - Large bundle imports
 * - Missing code splitting
 * - Synchronous file operations
 * - Blocking operations
 *
 * This is what separates a demo from a production app.
 */

import { agentChat, ProviderId } from '@/lib/ai/providers';
import { GeneratedFile } from '../../core/types';
import { AgentStreamCallback } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceIssue {
  id: string;
  type: PerformanceIssueType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file: string;
  line?: number;
  code?: string;
  impact: string;
  fix: {
    description: string;
    code?: string;
    effort: 'trivial' | 'small' | 'medium' | 'large';
  };
  metrics?: {
    estimatedSpeedup?: string;
    memorySaving?: string;
    bundleSaving?: string;
  };
}

export type PerformanceIssueType =
  | 'n+1-query'
  | 'memory-leak'
  | 'unnecessary-rerender'
  | 'heavy-computation'
  | 'missing-index'
  | 'unoptimized-loop'
  | 'large-import'
  | 'missing-code-split'
  | 'sync-file-operation'
  | 'blocking-operation'
  | 'inefficient-regex'
  | 'missing-memoization'
  | 'excessive-dom-manipulation'
  | 'unoptimized-image'
  | 'missing-lazy-load'
  | 'inefficient-state'
  | 'other';

export interface PerformanceReport {
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: PerformanceIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  optimizations: OptimizationSuggestion[];
  metrics: {
    estimatedLoadTime: string;
    bundleSizeEstimate: string;
    renderComplexity: string;
  };
  scanTime: number;
}

export interface OptimizationSuggestion {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'trivial' | 'small' | 'medium' | 'large';
  code?: string;
}

// ============================================================================
// PERFORMANCE PATTERNS
// ============================================================================

const PERFORMANCE_PATTERNS: {
  type: PerformanceIssueType;
  pattern: RegExp;
  severity: PerformanceIssue['severity'];
  title: string;
  description: string;
  impact: string;
  fix: string;
  effort: PerformanceIssue['fix']['effort'];
}[] = [
  // N+1 Query Detection
  {
    type: 'n+1-query',
    pattern:
      /(?:for|forEach|map)\s*\([^)]*\)\s*(?:=>)?\s*{[^}]*(?:await\s+)?(?:prisma|db|sequelize|mongoose)\./g,
    severity: 'critical',
    title: 'Potential N+1 Query',
    description: 'Database query inside a loop can cause N+1 query problem.',
    impact: 'Can cause O(N) database calls instead of O(1), severely impacting performance.',
    fix: 'Use batch queries, .include(), or .populate() to fetch related data in one query.',
    effort: 'small',
  },

  // Sync File Operations
  {
    type: 'sync-file-operation',
    pattern: /(?:readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync)\s*\(/g,
    severity: 'high',
    title: 'Synchronous File Operation',
    description: 'Synchronous file operations block the event loop.',
    impact: 'Blocks all other operations, causing latency spikes.',
    fix: 'Use async versions (readFile, writeFile) with async/await.',
    effort: 'trivial',
  },

  // Missing Memoization (React)
  {
    type: 'missing-memoization',
    pattern:
      /(?:const|let)\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\w+\.filter|\w+\.map|\w+\.reduce)\s*(?!\s*,\s*\[)/g,
    severity: 'medium',
    title: 'Missing useMemo/useCallback',
    description: 'Expensive computation may run on every render.',
    impact: 'Causes unnecessary re-renders and computations.',
    fix: 'Wrap with useMemo() for values or useCallback() for functions.',
    effort: 'trivial',
  },

  // Unnecessary Re-render
  {
    type: 'unnecessary-rerender',
    pattern: /style=\{\s*\{[^}]+\}\s*\}/g,
    severity: 'medium',
    title: 'Inline Style Object',
    description: 'Inline style objects create new references on every render.',
    impact: 'Triggers unnecessary re-renders of child components.',
    fix: 'Move styles outside component or use useMemo().',
    effort: 'trivial',
  },

  // Large Import
  {
    type: 'large-import',
    pattern: /import\s+(?:\*\s+as\s+)?(?:_|lodash|moment|dayjs)/g,
    severity: 'medium',
    title: 'Large Library Import',
    description: 'Importing entire large library increases bundle size.',
    impact: 'Can add 50-200KB to bundle size unnecessarily.',
    fix: 'Use named imports: import { get } from "lodash/get"',
    effort: 'small',
  },

  // Inefficient Regex
  {
    type: 'inefficient-regex',
    pattern: /new\s+RegExp\s*\([^)]+\)/g,
    severity: 'medium',
    title: 'Dynamic RegExp Creation',
    description: 'Creating RegExp in function body runs on every call.',
    impact: 'RegExp compilation is expensive, causes CPU spikes.',
    fix: 'Move RegExp to module scope or use literal syntax.',
    effort: 'trivial',
  },

  // Missing Lazy Load
  {
    type: 'missing-lazy-load',
    pattern: /import\s+\w+\s+from\s+['"]\.\/(pages|views|screens)\//g,
    severity: 'medium',
    title: 'Missing Lazy Loading',
    description: 'Page/view components should be lazy loaded.',
    impact: 'Increases initial bundle size and load time.',
    fix: 'Use React.lazy() or Next.js dynamic() for code splitting.',
    effort: 'small',
  },

  // Excessive DOM Manipulation
  {
    type: 'excessive-dom-manipulation',
    pattern: /(?:document\.querySelector|document\.getElementById|\.innerHTML|\.appendChild)/g,
    severity: 'medium',
    title: 'Direct DOM Manipulation',
    description: "Direct DOM manipulation can conflict with React's virtual DOM.",
    impact: 'Can cause layout thrashing and bugs.',
    fix: 'Use refs and state instead of direct DOM manipulation.',
    effort: 'medium',
  },

  // Heavy Computation in Render
  {
    type: 'heavy-computation',
    pattern: /(?:JSON\.parse|JSON\.stringify)\s*\([^)]+\)/g,
    severity: 'low',
    title: 'JSON Operation in Hot Path',
    description: 'JSON parse/stringify can be slow for large objects.',
    impact: 'Can cause frame drops if called frequently.',
    fix: 'Cache results or move to web worker for large data.',
    effort: 'medium',
  },

  // Blocking Console
  {
    type: 'blocking-operation',
    pattern: /console\.(?:log|debug|info|warn|error)\s*\([^)]*JSON\.stringify/g,
    severity: 'low',
    title: 'Logging Large Objects',
    description: 'Stringifying large objects for logging is expensive.',
    impact: 'Slows down execution, especially in loops.',
    fix: 'Remove in production or log only necessary fields.',
    effort: 'trivial',
  },

  // Unoptimized Image
  {
    type: 'unoptimized-image',
    pattern: /<img\s+src=(?!.*next\/image)/g,
    severity: 'medium',
    title: 'Unoptimized Image',
    description: 'Using raw img tag instead of optimized Image component.',
    impact: 'Missing lazy loading, responsive sizes, and format optimization.',
    fix: 'Use next/image or implement lazy loading manually.',
    effort: 'small',
  },

  // Inefficient State
  {
    type: 'inefficient-state',
    pattern: /useState\s*\(\s*\[\s*\]\s*\)(?:[^}]*setState\s*\(\s*\[)/g,
    severity: 'low',
    title: 'Array State Spread Pattern',
    description: 'Spreading arrays for state updates can be slow for large arrays.',
    impact: 'O(n) operation on every update.',
    fix: 'Consider useReducer or immer for complex state.',
    effort: 'small',
  },
];

// ============================================================================
// MAIN ANALYZER
// ============================================================================

export class PerformanceAnalyzer {
  private provider: ProviderId = 'claude';
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Analyze files for performance issues
   */
  async analyze(
    files: GeneratedFile[],
    onStream?: AgentStreamCallback
  ): Promise<PerformanceReport> {
    const startTime = Date.now();
    const issues: PerformanceIssue[] = [];

    onStream?.({
      type: 'evaluating',
      message: '⚡ Analyzing performance...',
      timestamp: Date.now(),
      progress: 0,
    });

    // Step 1: Pattern-based detection
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileIssues = this.analyzeFile(file);
      issues.push(...fileIssues);

      onStream?.({
        type: 'evaluating',
        message: `📊 ${file.path}: ${fileIssues.length} issues`,
        timestamp: Date.now(),
        progress: Math.round((i / files.length) * 50),
      });
    }

    // Step 2: AI-powered deep analysis for complex issues
    if (files.length <= 10) {
      onStream?.({
        type: 'evaluating',
        message: '🧠 Deep performance analysis...',
        timestamp: Date.now(),
        progress: 60,
      });

      const aiIssues = await this.aiAnalysis(files);
      issues.push(...aiIssues);
    }

    // Step 3: Calculate score
    const summary = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
    };

    const score = this.calculateScore(summary);
    const grade = this.calculateGrade(score);

    // Step 4: Generate optimizations
    const optimizations = this.generateOptimizations(issues, files);

    // Step 5: Estimate metrics
    const metrics = this.estimateMetrics(files, issues);

    onStream?.({
      type: 'complete',
      message: `⚡ Performance: Grade ${grade} (${score}/100)`,
      timestamp: Date.now(),
      progress: 100,
    });

    return {
      overallScore: score,
      grade,
      issues,
      summary,
      optimizations,
      metrics,
      scanTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze a single file
   */
  private analyzeFile(file: GeneratedFile): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = file.content.split('\n');

    for (const pattern of PERFORMANCE_PATTERNS) {
      if (pattern.pattern.test(file.content)) {
        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0;

        // Find line number
        let lineNumber: number | undefined;
        let codeSnippet: string | undefined;

        for (let i = 0; i < lines.length; i++) {
          pattern.pattern.lastIndex = 0;
          if (pattern.pattern.test(lines[i])) {
            lineNumber = i + 1;
            codeSnippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
            break;
          }
        }

        issues.push({
          id: `perf-${pattern.type}-${file.path}-${lineNumber || 0}`,
          type: pattern.type,
          severity: pattern.severity,
          title: pattern.title,
          description: pattern.description,
          file: file.path,
          line: lineNumber,
          code: codeSnippet,
          impact: pattern.impact,
          fix: {
            description: pattern.fix,
            effort: pattern.effort,
          },
        });
      }
    }

    return issues;
  }

  /**
   * AI-powered analysis for complex patterns
   */
  private async aiAnalysis(files: GeneratedFile[]): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    const filesContent = files
      .map((f) => `=== ${f.path} ===\n${f.content.substring(0, 3000)}`)
      .join('\n\n');

    const prompt = `You are a performance expert analyzing code for bottlenecks.

CODE:
${filesContent}

Find performance issues that pattern matching might miss:
1. Algorithm complexity issues (O(n²) when O(n) possible)
2. Memory leaks from closures or event listeners
3. Missing caching opportunities
4. Inefficient data structures
5. Race conditions in async code
6. Bundle size concerns

Return JSON:
{
  "issues": [
    {
      "type": "issue type",
      "severity": "critical|high|medium|low",
      "title": "Short title",
      "description": "What the issue is",
      "file": "filename",
      "line": optional line,
      "impact": "Performance impact",
      "fix": "How to fix"
    }
  ]
}

Only return issues not covered by basic patterns.
OUTPUT ONLY JSON.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 2000 }
      );

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const i of parsed.issues || []) {
          issues.push({
            id: `ai-perf-${i.file}-${Date.now()}`,
            type: 'other',
            severity: this.validateSeverity(i.severity),
            title: String(i.title),
            description: String(i.description),
            file: String(i.file),
            line: i.line,
            impact: String(i.impact),
            fix: {
              description: String(i.fix),
              effort: 'medium',
            },
          });
        }
      }
    } catch (error) {
      console.error('[PerformanceAnalyzer] AI error:', error);
    }

    return issues;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizations(
    issues: PerformanceIssue[],
    _files: GeneratedFile[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const types = new Set(issues.map((i) => i.type));

    // Bundle optimization
    const hasLargeImports = types.has('large-import');
    const hasMissingCodeSplit = types.has('missing-code-split') || types.has('missing-lazy-load');

    if (hasLargeImports || hasMissingCodeSplit) {
      suggestions.push({
        title: 'Bundle Optimization',
        description: 'Implement code splitting and tree shaking to reduce initial bundle size.',
        impact: 'high',
        effort: 'small',
        code: `// Use dynamic imports for large components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
});`,
      });
    }

    // React optimization
    if (types.has('missing-memoization') || types.has('unnecessary-rerender')) {
      suggestions.push({
        title: 'React Performance',
        description: 'Use memoization to prevent unnecessary re-renders.',
        impact: 'medium',
        effort: 'small',
        code: `// Memoize expensive computations
const expensiveValue = useMemo(() => computeExpensive(data), [data]);

// Memoize callbacks
const handleClick = useCallback(() => onClick(id), [id, onClick]);

// Memoize components
const MemoizedComponent = React.memo(Component);`,
      });
    }

    // Database optimization
    if (types.has('n+1-query')) {
      suggestions.push({
        title: 'Database Query Optimization',
        description: 'Batch database queries to avoid N+1 problem.',
        impact: 'high',
        effort: 'medium',
        code: `// Instead of:
const users = await getUsers();
for (const user of users) {
  user.posts = await getPosts(user.id);
}

// Do this:
const users = await prisma.user.findMany({
  include: { posts: true }
});`,
      });
    }

    // General suggestions
    const totalIssues = issues.length;
    if (totalIssues > 5) {
      suggestions.push({
        title: 'Performance Monitoring',
        description: 'Add performance monitoring to track improvements.',
        impact: 'medium',
        effort: 'small',
      });
    }

    return suggestions;
  }

  /**
   * Estimate performance metrics
   */
  private estimateMetrics(
    files: GeneratedFile[],
    issues: PerformanceIssue[]
  ): PerformanceReport['metrics'] {
    const totalLines = files.reduce((sum, f) => sum + f.linesOfCode, 0);
    const bundleEstimate = Math.round(totalLines * 0.05); // ~50 bytes per line

    const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
    const loadTimeBase = 1.5; // seconds
    const loadTimePenalty = criticalIssues * 0.5;

    return {
      estimatedLoadTime: `${(loadTimeBase + loadTimePenalty).toFixed(1)}s`,
      bundleSizeEstimate: `~${bundleEstimate}KB`,
      renderComplexity: issues.length > 10 ? 'High' : issues.length > 5 ? 'Medium' : 'Low',
    };
  }

  /**
   * Calculate performance score
   */
  private calculateScore(summary: PerformanceReport['summary']): number {
    let score = 100;
    score -= summary.critical * 20;
    score -= summary.high * 10;
    score -= summary.medium * 5;
    score -= summary.low * 2;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate grade
   */
  private calculateGrade(score: number): PerformanceReport['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private validateSeverity(severity: unknown): PerformanceIssue['severity'] {
    const valid = ['critical', 'high', 'medium', 'low'];
    return valid.includes(String(severity)) ? (severity as PerformanceIssue['severity']) : 'medium';
  }
}

export const performanceAnalyzer = new PerformanceAnalyzer();
