/**
 * PREDICTIVE ANALYZER
 *
 * This analyzer predicts runtime issues BEFORE code executes.
 * It's like having a senior engineer review your code and tell you
 * "this is going to break when..."
 *
 * Capabilities:
 * - Static analysis for runtime predictions
 * - Data flow analysis for null/undefined tracking
 * - Type inference for dynamic languages
 * - Resource leak detection
 * - Concurrency issue prediction
 * - API misuse detection
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  DebugLanguage,
  PredictiveAnalysisResult,
  PredictedIssue,
  CodeHotspot,
  ExecutionPath,
  DataFlowPath,
  Severity,
  Confidence,
} from './types';

const log = logger('PredictiveAnalyzer');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// PREDICTIVE PATTERNS
// ============================================================================

interface PredictivePattern {
  id: string;
  name: string;
  languages: DebugLanguage[];
  detect: (code: string, language: DebugLanguage) => PatternDetection[];
  issueType: PredictedIssue['type'];
  severity: Severity;
  confidence: Confidence;
}

interface PatternDetection {
  line: number;
  column?: number;
  match: string;
  context: string;
  conditions?: string[];
}

// Built-in patterns for common issues
const PREDICTIVE_PATTERNS: PredictivePattern[] = [
  // Null/Undefined Access
  {
    id: 'null-access',
    name: 'Potential Null Access',
    languages: ['javascript', 'typescript'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // Accessing property without null check after fetch/find/get
        if (/\.(find|get|querySelector|getElementById)\([^)]*\)\s*\./.test(line)) {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'Accessing property on potentially null result',
            conditions: ['Result might be null/undefined'],
          });
        }
        // Optional chaining missing after async operation result
        if (/await\s+\w+\([^)]*\)\s*\.(?!\?)/.test(line)) {
          const match = line.match(/await\s+(\w+)\([^)]*\)/);
          if (match && !line.includes('?.')) {
            detections.push({
              line: i + 1,
              match: line.trim(),
              context: `Accessing property on async result without null check`,
              conditions: [`${match[1]} might return null/undefined`],
            });
          }
        }
      });

      return detections;
    },
    issueType: 'null_reference',
    severity: 'high',
    confidence: 'high',
  },

  // Array Index Out of Bounds
  {
    id: 'array-bounds',
    name: 'Potential Array Index Error',
    languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp'],
    detect: (code, _language) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // Accessing array with calculated index without bounds check
        if (/\[\s*\w+\s*[+\-*/%]\s*\d+\s*\]/.test(line) || /\[\s*\w+\s*\-\s*1\s*\]/.test(line)) {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'Array access with calculated index',
            conditions: ['Index might be out of bounds', 'Array might be empty'],
          });
        }
        // Loop accessing array[i+1] pattern
        if (/\[\s*i\s*\+\s*1\s*\]/.test(line) || /\[\s*j\s*\+\s*1\s*\]/.test(line)) {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'Loop accessing next element',
            conditions: ['Last iteration will access beyond array bounds'],
          });
        }
      });

      return detections;
    },
    issueType: 'runtime_error',
    severity: 'high',
    confidence: 'medium',
  },

  // Race Condition
  {
    id: 'race-condition',
    name: 'Potential Race Condition',
    languages: ['javascript', 'typescript', 'python', 'go', 'java'],
    detect: (code, _language) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      // Check-then-act pattern
      let checkLine = -1;
      let checkVar = '';
      lines.forEach((line, i) => {
        // Found a check
        if (/if\s*\(\s*(\w+)(?:\s*[!=]==?\s*(?:null|undefined|true|false|0))?\s*\)/.test(line)) {
          const match = line.match(/if\s*\(\s*(\w+)/);
          if (match) {
            checkLine = i;
            checkVar = match[1];
          }
        }
        // Found an action on the checked variable within 5 lines
        if (checkLine >= 0 && i - checkLine <= 5 && checkVar) {
          if (
            new RegExp(`${checkVar}\\s*=`).test(line) ||
            new RegExp(`${checkVar}\\.`).test(line)
          ) {
            // Check for async context
            if (code.includes('async') || code.includes('Promise') || code.includes('setTimeout')) {
              detections.push({
                line: i + 1,
                match: line.trim(),
                context: `Check-then-act on '${checkVar}' in async context`,
                conditions: [
                  'Value might change between check and use',
                  'Concurrent operations might interfere',
                ],
              });
            }
          }
        }
      });

      // Multiple awaits on shared state
      const sharedStateAccess: { line: number; var: string }[] = [];
      lines.forEach((line, i) => {
        if (/await\s+/.test(line)) {
          const varMatch = line.match(/(\w+)\s*=/);
          if (varMatch) {
            sharedStateAccess.push({ line: i + 1, var: varMatch[1] });
          }
        }
      });

      if (sharedStateAccess.length > 2) {
        const vars = [...new Set(sharedStateAccess.map((s) => s.var))];
        if (vars.some((v) => sharedStateAccess.filter((s) => s.var === v).length > 1)) {
          detections.push({
            line: sharedStateAccess[0].line,
            match: 'Multiple async operations on shared state',
            context: 'Shared state accessed by multiple async operations',
            conditions: ['Operations might complete out of order', 'Final state is unpredictable'],
          });
        }
      }

      return detections;
    },
    issueType: 'race_condition',
    severity: 'high',
    confidence: 'medium',
  },

  // Memory Leak
  {
    id: 'memory-leak',
    name: 'Potential Memory Leak',
    languages: ['javascript', 'typescript'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      // Event listener without cleanup
      const addListenerLines: number[] = [];
      const removeListenerLines: number[] = [];
      lines.forEach((line, i) => {
        if (/addEventListener\s*\(/.test(line)) {
          addListenerLines.push(i + 1);
        }
        if (/removeEventListener\s*\(/.test(line)) {
          removeListenerLines.push(i + 1);
        }
      });

      if (addListenerLines.length > removeListenerLines.length) {
        addListenerLines.forEach((line) => {
          detections.push({
            line,
            match: lines[line - 1].trim(),
            context: 'Event listener added without corresponding removal',
            conditions: [
              'Component unmount/cleanup might not remove listener',
              'Listener will persist and accumulate',
            ],
          });
        });
      }

      // setInterval without clearInterval
      const setIntervalLines: number[] = [];
      const clearIntervalLines: number[] = [];
      lines.forEach((line, i) => {
        if (/setInterval\s*\(/.test(line)) {
          setIntervalLines.push(i + 1);
        }
        if (/clearInterval\s*\(/.test(line)) {
          clearIntervalLines.push(i + 1);
        }
      });

      if (setIntervalLines.length > clearIntervalLines.length) {
        setIntervalLines.forEach((line) => {
          detections.push({
            line,
            match: lines[line - 1].trim(),
            context: 'setInterval without clearInterval',
            conditions: [
              'Interval will keep running after component unmount',
              'Multiple intervals might accumulate',
            ],
          });
        });
      }

      // Closure capturing large objects in loops
      lines.forEach((line, i) => {
        if (/for\s*\(/.test(line) || /\.forEach\s*\(/.test(line) || /\.map\s*\(/.test(line)) {
          // Look for closure creation inside
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (/=>\s*\{/.test(lines[j]) || /function\s*\(/.test(lines[j])) {
              // Check if closure references outer variable
              if (/this\./.test(lines[j]) || /\bself\b/.test(lines[j])) {
                detections.push({
                  line: j + 1,
                  match: lines[j].trim(),
                  context: 'Closure in loop capturing outer context',
                  conditions: [
                    'Each iteration creates a new closure',
                    'Closures might retain references preventing GC',
                  ],
                });
                break;
              }
            }
          }
        }
      });

      return detections;
    },
    issueType: 'memory_leak',
    severity: 'medium',
    confidence: 'medium',
  },

  // Infinite Loop
  {
    id: 'infinite-loop',
    name: 'Potential Infinite Loop',
    languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // while(true) without break
        if (/while\s*\(\s*true\s*\)/.test(line) || /while\s*\(\s*1\s*\)/.test(line)) {
          // Check next 20 lines for break
          let hasBreak = false;
          for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
            if (/\bbreak\b/.test(lines[j]) || /\breturn\b/.test(lines[j])) {
              hasBreak = true;
              break;
            }
          }
          if (!hasBreak) {
            detections.push({
              line: i + 1,
              match: line.trim(),
              context: 'while(true) without visible break/return',
              conditions: ['Loop might never terminate'],
            });
          }
        }

        // for loop without increment
        const forMatch = line.match(/for\s*\([^;]*;\s*([^;]*);\s*\)/);
        if (forMatch && forMatch[1].trim() === '') {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'for loop with empty increment',
            conditions: ['Loop counter never changes'],
          });
        }
      });

      return detections;
    },
    issueType: 'infinite_loop',
    severity: 'critical',
    confidence: 'high',
  },

  // Resource Exhaustion
  {
    id: 'resource-exhaustion',
    name: 'Potential Resource Exhaustion',
    languages: ['javascript', 'typescript', 'python', 'java', 'go'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // Recursive function without base case
        const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          // Look for recursive call
          for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
            if (new RegExp(`${funcName}\\s*\\(`).test(lines[j])) {
              // Check for base case
              let hasBaseCase = false;
              for (let k = i + 1; k < j; k++) {
                if (/if\s*\(/.test(lines[k]) && /return\b/.test(lines[k + 1] || '')) {
                  hasBaseCase = true;
                  break;
                }
              }
              if (!hasBaseCase) {
                detections.push({
                  line: j + 1,
                  match: lines[j].trim(),
                  context: `Recursive call to '${funcName}' without visible base case`,
                  conditions: ['Recursion might not terminate', 'Stack overflow possible'],
                });
              }
              break;
            }
          }
        }

        // Unbounded array growth
        if (/\.push\s*\(/.test(line)) {
          // Check if inside a loop
          for (let k = Math.max(0, i - 5); k < i; k++) {
            if (/while\s*\(/.test(lines[k]) || /for\s*\(/.test(lines[k])) {
              detections.push({
                line: i + 1,
                match: line.trim(),
                context: 'Array push inside loop',
                conditions: ['Array size grows with iterations', 'Memory usage unbounded'],
              });
              break;
            }
          }
        }
      });

      return detections;
    },
    issueType: 'resource_exhaustion',
    severity: 'high',
    confidence: 'medium',
  },

  // API Misuse
  {
    id: 'api-misuse',
    name: 'API Misuse',
    languages: ['javascript', 'typescript'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // Using await on non-Promise
        if (/await\s+\w+(?!\.|\()/.test(line)) {
          const match = line.match(/await\s+(\w+)/);
          if (match && !['fetch', 'axios', 'Promise'].some((p) => line.includes(p))) {
            detections.push({
              line: i + 1,
              match: line.trim(),
              context: `await on '${match[1]}' which might not be a Promise`,
              conditions: ['If value is not a Promise, await has no effect'],
            });
          }
        }

        // JSON.parse without try-catch
        if (/JSON\.parse\s*\(/.test(line)) {
          // Check if wrapped in try
          let inTry = false;
          for (let k = Math.max(0, i - 5); k < i; k++) {
            if (/try\s*\{/.test(lines[k])) {
              inTry = true;
              break;
            }
          }
          if (!inTry) {
            detections.push({
              line: i + 1,
              match: line.trim(),
              context: 'JSON.parse without error handling',
              conditions: ['Invalid JSON will throw SyntaxError'],
            });
          }
        }

        // parseInt without radix
        if (/parseInt\s*\(\s*[^,)]+\s*\)/.test(line) && !line.includes(',')) {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'parseInt without radix parameter',
            conditions: ['Strings starting with 0 might be parsed as octal'],
          });
        }
      });

      return detections;
    },
    issueType: 'api_misuse',
    severity: 'medium',
    confidence: 'high',
  },

  // Security: SQL Injection Pattern
  {
    id: 'sql-injection',
    name: 'Potential SQL Injection',
    languages: ['javascript', 'typescript', 'python', 'java', 'php', 'ruby'],
    detect: (code) => {
      const detections: PatternDetection[] = [];
      const lines = code.split('\n');

      lines.forEach((line, i) => {
        // String concatenation in SQL query
        if (
          /(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\s+.*\+\s*\w+/.test(line) ||
          /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/i.test(line) ||
          /f["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/i.test(line)
        ) {
          detections.push({
            line: i + 1,
            match: line.trim(),
            context: 'SQL query with string interpolation',
            conditions: ['User input can modify query structure', 'SQL injection is possible'],
          });
        }
      });

      return detections;
    },
    issueType: 'security_vuln',
    severity: 'critical',
    confidence: 'high',
  },
];

// ============================================================================
// PREDICTIVE ANALYZER
// ============================================================================

export class PredictiveAnalyzer {
  private patterns: PredictivePattern[] = PREDICTIVE_PATTERNS;

  /**
   * Perform predictive analysis on code
   */
  async analyze(
    code: string,
    language: DebugLanguage,
    options: {
      depth?: 'surface' | 'shallow' | 'deep' | 'exhaustive';
      relatedFiles?: Map<string, string>;
      focusArea?: { line: number; radius: number };
    } = {}
  ): Promise<PredictiveAnalysisResult> {
    const depth = options.depth || 'deep';

    log.info('Starting predictive analysis', { language, depth, codeLength: code.length });

    // Phase 1: Pattern-based detection (fast)
    const patternIssues = this.runPatternDetection(code, language, options.focusArea);

    // Phase 2: AI-powered analysis (deeper, slower)
    let aiIssues: PredictedIssue[] = [];
    if (depth === 'deep' || depth === 'exhaustive') {
      aiIssues = await this.runAIAnalysis(code, language, depth);
    }

    // Phase 3: Data flow analysis
    const dataFlows = await this.analyzeDataFlows(code, language);

    // Phase 4: Execution path analysis
    const executionPaths = await this.analyzeExecutionPaths(code, language);

    // Merge and deduplicate issues
    const allIssues = this.mergeAndDeduplicateIssues([...patternIssues, ...aiIssues]);

    // Identify hotspots
    const hotspots = this.identifyHotspots(allIssues, code);

    // Calculate safety score
    const safetyScore = this.calculateSafetyScore(allIssues);

    log.info('Predictive analysis complete', {
      issues: allIssues.length,
      hotspots: hotspots.length,
      safetyScore,
    });

    return {
      issues: allIssues,
      hotspots,
      safetyScore,
      analysisDepth: depth,
      executionPaths,
      dataFlows,
    };
  }

  /**
   * Run pattern-based detection
   */
  private runPatternDetection(
    code: string,
    language: DebugLanguage,
    focusArea?: { line: number; radius: number }
  ): PredictedIssue[] {
    const issues: PredictedIssue[] = [];

    for (const pattern of this.patterns) {
      // Skip patterns that don't apply to this language
      if (!pattern.languages.includes(language) && !pattern.languages.includes('unknown')) {
        continue;
      }

      const detections = pattern.detect(code, language);

      for (const detection of detections) {
        // Skip if outside focus area
        if (focusArea) {
          const distance = Math.abs(detection.line - focusArea.line);
          if (distance > focusArea.radius) continue;
        }

        issues.push({
          id: `${pattern.id}_${detection.line}`,
          type: pattern.issueType,
          location: {
            file: 'current',
            line: detection.line,
            column: detection.column,
          },
          description: `${pattern.name}: ${detection.context}`,
          probability: this.confidenceToProbability(pattern.confidence),
          severity: pattern.severity,
          confidence: pattern.confidence,
          conditions: detection.conditions || [],
          preventionStrategy: this.getPreventionStrategy(pattern.id),
        });
      }
    }

    return issues;
  }

  /**
   * Run AI-powered deep analysis
   */
  private async runAIAnalysis(
    code: string,
    language: DebugLanguage,
    depth: 'deep' | 'exhaustive'
  ): Promise<PredictedIssue[]> {
    const prompt = `As a senior software engineer, analyze this ${language} code for potential runtime issues.

\`\`\`${language}
${code}
\`\`\`

Predict issues that could occur at runtime. For each issue, assess:
1. What specific problem could occur?
2. Under what conditions?
3. How likely is it (0.0-1.0)?
4. How severe if it occurs?
5. How to prevent it?

Focus on:
- Null/undefined access
- Type errors at runtime
- Race conditions
- Memory leaks
- Infinite loops
- Resource exhaustion
- Logic errors
- Edge cases not handled
- API misuse
- Security vulnerabilities

Analysis depth: ${depth}

Return JSON array:
[{
  "id": "unique_id",
  "type": "runtime_error" | "logic_error" | "type_error" | "null_reference" | "race_condition" | "memory_leak" | "security_vuln" | "performance" | "edge_case" | "integration_failure" | "data_corruption" | "deadlock" | "infinite_loop" | "resource_exhaustion" | "api_misuse",
  "line": number,
  "description": "clear description",
  "probability": 0.0-1.0,
  "severity": "critical" | "high" | "medium" | "low",
  "confidence": "certain" | "high" | "medium" | "low" | "speculative",
  "conditions": ["condition 1", "condition 2"],
  "preventionStrategy": "how to prevent"
}]

Only include issues you're reasonably confident about.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        id: `ai_${item.id || Math.random().toString(36).slice(2)}`,
        type: (item.type as PredictedIssue['type']) || 'runtime_error',
        location: {
          file: 'current',
          line: Number(item.line) || 1,
        },
        description: String(item.description || ''),
        probability: Number(item.probability) || 0.5,
        severity: (item.severity as Severity) || 'medium',
        confidence: (item.confidence as Confidence) || 'medium',
        conditions: Array.isArray(item.conditions) ? item.conditions.map(String) : [],
        preventionStrategy: String(item.preventionStrategy || ''),
      }));
    } catch (error) {
      log.warn('AI analysis failed', { error });
      return [];
    }
  }

  /**
   * Analyze data flows for taint tracking
   */
  private async analyzeDataFlows(code: string, _language: DebugLanguage): Promise<DataFlowPath[]> {
    // Simplified data flow analysis
    // In a full implementation, this would use AST analysis
    const flows: DataFlowPath[] = [];
    const lines = code.split('\n');

    // Track user input sources
    const inputSources = [
      'req.body',
      'req.query',
      'req.params',
      'request.body',
      'input',
      'stdin',
      'prompt',
      'readline',
      'argv',
      'document.getElementById',
      'querySelector',
      'formData',
    ];

    // Track dangerous sinks
    const dangerousSinks = [
      'eval',
      'exec',
      'query',
      'execute',
      'innerHTML',
      'outerHTML',
      'document.write',
      'child_process',
      'spawn',
      'shell',
    ];

    lines.forEach((line, i) => {
      // Check for input sources
      for (const source of inputSources) {
        if (line.includes(source)) {
          // Track where this data goes
          const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
          if (varMatch) {
            const varName = varMatch[1];
            // Look for usage of this variable
            for (let j = i + 1; j < lines.length; j++) {
              for (const sink of dangerousSinks) {
                if (lines[j].includes(sink) && lines[j].includes(varName)) {
                  flows.push({
                    source: {
                      type: 'user_input',
                      location: { file: 'current', line: i + 1 },
                      trusted: false,
                    },
                    transformations: [],
                    sink: {
                      type:
                        sink.includes('query') || sink.includes('execute')
                          ? 'query'
                          : sink.includes('eval') || sink.includes('exec')
                            ? 'eval'
                            : 'output',
                      location: { file: 'current', line: j + 1 },
                      dangerous: true,
                    },
                    tainted: true,
                    validations: [],
                  });
                }
              }
            }
          }
        }
      }
    });

    return flows;
  }

  /**
   * Analyze execution paths
   */
  private async analyzeExecutionPaths(
    code: string,
    _language: DebugLanguage
  ): Promise<ExecutionPath[]> {
    const paths: ExecutionPath[] = [];
    const lines = code.split('\n');

    // Identify branch points
    const branchPoints: number[] = [];
    lines.forEach((line, i) => {
      if (
        /\bif\s*\(/.test(line) ||
        /\bswitch\s*\(/.test(line) ||
        /\?.*:/.test(line) ||
        /\|\|/.test(line) ||
        /&&/.test(line)
      ) {
        branchPoints.push(i + 1);
      }
    });

    // Create paths (simplified - full implementation would trace actual paths)
    if (branchPoints.length > 0) {
      paths.push({
        id: 'main_path',
        name: 'Main Execution Path',
        steps: branchPoints.map((line) => ({
          location: { file: 'current', line },
          operation: 'branch',
          inputs: [],
          outputs: [],
          sideEffects: [],
          branches: [],
        })),
        probability: 0.5,
        complexity: branchPoints.length,
        isCritical: true,
      });
    }

    return paths;
  }

  /**
   * Identify code hotspots (high-risk areas)
   */
  private identifyHotspots(issues: PredictedIssue[], code: string): CodeHotspot[] {
    const hotspotMap = new Map<number, CodeHotspot>();

    for (const issue of issues) {
      const line = issue.location.line;
      const existing = hotspotMap.get(line);

      if (existing) {
        existing.riskFactors.push(issue.description);
        if (this.severityToNumber(issue.severity) > this.severityToNumber(existing.riskLevel)) {
          existing.riskLevel = issue.severity;
        }
      } else {
        hotspotMap.set(line, {
          location: issue.location,
          riskLevel: issue.severity,
          riskFactors: [issue.description],
          complexity: this.estimateLineComplexity(code, line),
        });
      }
    }

    return Array.from(hotspotMap.values()).sort(
      (a, b) => this.severityToNumber(b.riskLevel) - this.severityToNumber(a.riskLevel)
    );
  }

  /**
   * Calculate overall code safety score
   */
  private calculateSafetyScore(issues: PredictedIssue[]): number {
    if (issues.length === 0) return 100;

    let deductions = 0;
    for (const issue of issues) {
      const severityWeight = this.severityToNumber(issue.severity);
      const probabilityFactor = issue.probability;
      deductions += severityWeight * probabilityFactor * 5;
    }

    return Math.max(0, Math.min(100, 100 - deductions));
  }

  /**
   * Merge and deduplicate issues
   */
  private mergeAndDeduplicateIssues(issues: PredictedIssue[]): PredictedIssue[] {
    const seen = new Set<string>();
    const unique: PredictedIssue[] = [];

    for (const issue of issues) {
      const key = `${issue.type}_${issue.location.line}_${issue.description.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(issue);
      }
    }

    // Sort by severity and probability
    return unique.sort((a, b) => {
      const severityDiff = this.severityToNumber(b.severity) - this.severityToNumber(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return b.probability - a.probability;
    });
  }

  private confidenceToProbability(confidence: Confidence): number {
    const map: Record<Confidence, number> = {
      certain: 0.95,
      high: 0.8,
      medium: 0.5,
      low: 0.3,
      speculative: 0.1,
    };
    return map[confidence] || 0.5;
  }

  private severityToNumber(severity: Severity): number {
    const map: Record<Severity, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };
    return map[severity] || 3;
  }

  private estimateLineComplexity(code: string, line: number): number {
    const lines = code.split('\n');
    const targetLine = lines[line - 1] || '';

    let complexity = 1;
    if (/\bif\b/.test(targetLine)) complexity++;
    if (/\bfor\b/.test(targetLine)) complexity++;
    if (/\bwhile\b/.test(targetLine)) complexity++;
    if (/\bswitch\b/.test(targetLine)) complexity++;
    if (/\bcatch\b/.test(targetLine)) complexity++;
    if (/\?.*:/.test(targetLine)) complexity++;
    if (/&&|\|\|/.test(targetLine)) complexity++;

    return complexity;
  }

  private getPreventionStrategy(patternId: string): string {
    const strategies: Record<string, string> = {
      'null-access':
        'Use optional chaining (?.) or explicit null checks before accessing properties',
      'array-bounds':
        'Check array length before accessing by index, use .at() for negative indices',
      'race-condition':
        'Use mutex/locks, atomic operations, or redesign to avoid shared mutable state',
      'memory-leak': 'Always pair add/remove operations, use cleanup functions in useEffect',
      'infinite-loop': 'Ensure loop has reachable exit condition, add iteration limit as safeguard',
      'resource-exhaustion':
        'Add base case for recursion, bound array growth, use streaming for large data',
      'api-misuse': 'Read API documentation, wrap risky operations in try-catch, validate inputs',
      'sql-injection': 'Use parameterized queries, never concatenate user input into SQL',
    };
    return strategies[patternId] || 'Review code for edge cases and add appropriate handling';
  }
}
