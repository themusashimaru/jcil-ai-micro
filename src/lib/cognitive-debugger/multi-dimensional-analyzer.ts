/**
 * MULTI-DIMENSIONAL ANALYZER
 *
 * Analyzes code from MULTIPLE perspectives simultaneously:
 * - Security: Is it safe from attacks?
 * - Performance: Is it efficient?
 * - Logic: Is it correct?
 * - Architecture: Is it well-designed?
 * - Maintainability: Can others understand it?
 * - Testability: Can it be tested?
 * - Reliability: Will it handle failures?
 *
 * This is like having 7 senior engineers review your code at once.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  MultiDimensionalReport,
  SecurityAnalysis,
  PerformanceAnalysis,
  LogicAnalysis,
  ArchitectureAnalysis,
  MaintainabilityAnalysis,
  TestabilityAnalysis,
  ReliabilityAnalysis,
  PrioritizedAction,
  DebugLanguage,
  Severity,
  SecurityVulnerability,
  PerformanceBottleneck,
  LogicError,
  SourceLocation,
} from './types';

const log = logger('MultiDimensionalAnalyzer');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// MULTI-DIMENSIONAL ANALYZER
// ============================================================================

export class MultiDimensionalAnalyzer {
  /**
   * Run full multi-dimensional analysis
   */
  async analyze(
    code: string,
    language: DebugLanguage,
    options: {
      focusAreas?: (
        | 'security'
        | 'performance'
        | 'logic'
        | 'architecture'
        | 'maintainability'
        | 'testability'
        | 'reliability'
      )[];
      relatedFiles?: Map<string, string>;
    } = {}
  ): Promise<MultiDimensionalReport> {
    const focusAreas = options.focusAreas || [
      'security',
      'performance',
      'logic',
      'architecture',
      'maintainability',
      'testability',
      'reliability',
    ];

    log.info('Starting multi-dimensional analysis', { language, focusAreas });

    // Run analyses in parallel for speed
    const [security, performance, logic, architecture, maintainability, testability, reliability] =
      await Promise.all([
        focusAreas.includes('security')
          ? this.analyzeSecurityDimension(code, language)
          : this.emptySecurityAnalysis(),
        focusAreas.includes('performance')
          ? this.analyzePerformanceDimension(code, language)
          : this.emptyPerformanceAnalysis(),
        focusAreas.includes('logic')
          ? this.analyzeLogicDimension(code, language)
          : this.emptyLogicAnalysis(),
        focusAreas.includes('architecture')
          ? this.analyzeArchitectureDimension(code, language, options.relatedFiles)
          : this.emptyArchitectureAnalysis(),
        focusAreas.includes('maintainability')
          ? this.analyzeMaintainabilityDimension(code, language)
          : this.emptyMaintainabilityAnalysis(),
        focusAreas.includes('testability')
          ? this.analyzeTestabilityDimension(code, language)
          : this.emptyTestabilityAnalysis(),
        focusAreas.includes('reliability')
          ? this.analyzeReliabilityDimension(code, language)
          : this.emptyReliabilityAnalysis(),
      ]);

    // Calculate overall score
    const scores = [
      security.score,
      performance.score,
      logic.score,
      architecture.score,
      maintainability.score,
      testability.score,
      reliability.score,
    ].filter((s) => s > 0);
    const overallScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

    // Generate prioritized actions
    const prioritizedActions = this.generatePrioritizedActions({
      security,
      performance,
      logic,
      architecture,
      maintainability,
      testability,
      reliability,
    });

    log.info('Multi-dimensional analysis complete', {
      overallScore,
      actionCount: prioritizedActions.length,
    });

    return {
      security,
      performance,
      logic,
      architecture,
      maintainability,
      testability,
      reliability,
      overallScore,
      prioritizedActions,
    };
  }

  // ==========================================================================
  // SECURITY DIMENSION
  // ==========================================================================

  private async analyzeSecurityDimension(
    code: string,
    language: DebugLanguage
  ): Promise<SecurityAnalysis> {
    const prompt = `Analyze this ${language} code for SECURITY vulnerabilities.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for OWASP Top 10 and common security issues:
1. Injection (SQL, NoSQL, OS, LDAP)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

Also check for:
- Hardcoded secrets/credentials
- Unsafe regex (ReDoS)
- Path traversal
- CSRF vulnerabilities
- Insecure random number generation

Return JSON:
{
  "score": 0-100,
  "vulnerabilities": [{
    "type": "vulnerability type",
    "cwe": "CWE-XXX if applicable",
    "owasp": "A1-A10 if applicable",
    "line": line_number,
    "severity": "critical" | "high" | "medium" | "low",
    "exploitability": "trivial" | "easy" | "moderate" | "difficult",
    "description": "what's wrong",
    "fix": "how to fix"
  }],
  "attackVectors": [{
    "name": "attack name",
    "entryLine": line_number,
    "pathLines": [line_numbers],
    "impact": "what damage",
    "likelihood": 0.0-1.0
  }],
  "dataExposure": [{
    "dataType": "passwords/PII/etc",
    "line": line_number,
    "exposure": "direct" | "indirect" | "logged" | "transmitted",
    "risk": "critical" | "high" | "medium" | "low"
  }]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptySecurityAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        vulnerabilities: (parsed.vulnerabilities || []).map((v: Record<string, unknown>) => ({
          id: `vuln_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: String(v.type || ''),
          cwe: v.cwe ? String(v.cwe) : undefined,
          owasp: v.owasp ? String(v.owasp) : undefined,
          location: { file: 'current', line: Number(v.line) || 1 },
          severity: (v.severity as Severity) || 'medium',
          exploitability:
            (v.exploitability as SecurityVulnerability['exploitability']) || 'moderate',
          description: String(v.description || ''),
          fix: {
            type: 'replace' as const,
            location: { file: 'current', line: Number(v.line) || 1 },
            newCode: String(v.fix || ''),
            explanation: String(v.description || ''),
            confidence: 'high' as const,
            requiresReview: true,
          },
        })),
        attackVectors: (parsed.attackVectors || []).map((a: Record<string, unknown>) => ({
          name: String(a.name || ''),
          entryPoint: { file: 'current', line: Number(a.entryLine) || 1 },
          path: (Array.isArray(a.pathLines) ? a.pathLines : []).map((l: unknown) => ({
            file: 'current',
            line: Number(l),
          })),
          impact: String(a.impact || ''),
          likelihood: Number(a.likelihood) || 0.5,
        })),
        dataExposure: (parsed.dataExposure || []).map((d: Record<string, unknown>) => ({
          dataType: String(d.dataType || ''),
          location: { file: 'current', line: Number(d.line) || 1 },
          exposure: (d.exposure as 'direct' | 'indirect' | 'logged' | 'transmitted') || 'direct',
          risk: (d.risk as Severity) || 'medium',
        })),
        complianceIssues: [],
      };
    } catch (error) {
      log.warn('Security analysis failed', { error });
      return this.emptySecurityAnalysis();
    }
  }

  // ==========================================================================
  // PERFORMANCE DIMENSION
  // ==========================================================================

  private async analyzePerformanceDimension(
    code: string,
    language: DebugLanguage
  ): Promise<PerformanceAnalysis> {
    const prompt = `Analyze this ${language} code for PERFORMANCE issues.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for:
1. Algorithmic inefficiency (O(n²) when O(n) possible)
2. N+1 query problems
3. Memory leaks
4. Unnecessary allocations
5. Blocking I/O
6. Missing caching opportunities
7. Unnecessary re-renders (React/Vue)
8. Heavy computations in hot paths
9. Unoptimized loops
10. Missing lazy loading

Return JSON:
{
  "score": 0-100,
  "bottlenecks": [{
    "line": line_number,
    "type": "cpu" | "memory" | "io" | "network" | "database",
    "impact": "blocking" | "degrading" | "inefficient",
    "description": "what's slow",
    "optimization": "how to fix"
  }],
  "memoryIssues": [{
    "type": "leak" | "unbounded_growth" | "unnecessary_retention" | "large_allocation",
    "line": line_number,
    "description": "what's wrong",
    "fix": "how to fix"
  }],
  "algorithmicIssues": [{
    "line": line_number,
    "currentComplexity": "O(n²)",
    "optimalComplexity": "O(n)",
    "suggestion": "how to improve"
  }],
  "resourceUsage": {
    "estimatedMemory": "XMB",
    "estimatedCpu": "X%",
    "ioOperations": number,
    "networkCalls": number,
    "databaseQueries": number
  }
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyPerformanceAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        bottlenecks: (parsed.bottlenecks || []).map((b: Record<string, unknown>) => ({
          location: { file: 'current', line: Number(b.line) || 1 },
          type: (b.type as PerformanceBottleneck['type']) || 'cpu',
          impact: (b.impact as PerformanceBottleneck['impact']) || 'inefficient',
          description: String(b.description || ''),
          optimization: {
            type: 'replace' as const,
            location: { file: 'current', line: Number(b.line) || 1 },
            newCode: String(b.optimization || ''),
            explanation: String(b.description || ''),
            confidence: 'medium' as const,
            requiresReview: true,
          },
        })),
        memoryIssues: (parsed.memoryIssues || []).map((m: Record<string, unknown>) => ({
          type:
            (m.type as
              | 'leak'
              | 'unbounded_growth'
              | 'unnecessary_retention'
              | 'large_allocation') || 'leak',
          location: { file: 'current', line: Number(m.line) || 1 },
          description: String(m.description || ''),
          fix: {
            type: 'replace' as const,
            location: { file: 'current', line: Number(m.line) || 1 },
            newCode: String(m.fix || ''),
            explanation: String(m.description || ''),
            confidence: 'medium' as const,
            requiresReview: true,
          },
        })),
        algorithmicIssues: (parsed.algorithmicIssues || []).map((a: Record<string, unknown>) => ({
          location: { file: 'current', line: Number(a.line) || 1 },
          currentComplexity: String(a.currentComplexity || 'unknown'),
          optimalComplexity: String(a.optimalComplexity || 'unknown'),
          suggestion: String(a.suggestion || ''),
        })),
        resourceUsage: parsed.resourceUsage || {
          estimatedMemory: 'unknown',
          estimatedCpu: 'unknown',
          ioOperations: 0,
          networkCalls: 0,
          databaseQueries: 0,
        },
      };
    } catch (error) {
      log.warn('Performance analysis failed', { error });
      return this.emptyPerformanceAnalysis();
    }
  }

  // ==========================================================================
  // LOGIC DIMENSION
  // ==========================================================================

  private async analyzeLogicDimension(
    code: string,
    language: DebugLanguage
  ): Promise<LogicAnalysis> {
    const prompt = `Analyze this ${language} code for LOGIC issues.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for:
1. Off-by-one errors
2. Incorrect boolean logic
3. Inverted conditions
4. Missing cases in switches
5. Null check after use (too late)
6. Dead code / unreachable code
7. Redundant operations
8. Type confusion
9. Inconsistent behavior
10. Wrong operator usage

Return JSON:
{
  "score": 0-100,
  "deadCode": [{
    "line": line_number,
    "type": "unreachable" | "unused_variable" | "unused_function" | "unused_import",
    "confidence": "certain" | "high" | "medium" | "low"
  }],
  "unreachableCode": [line_numbers],
  "redundantOperations": [{
    "line": line_number,
    "description": "what's redundant",
    "canRemove": boolean
  }],
  "logicErrors": [{
    "line": line_number,
    "description": "what's wrong",
    "type": "off_by_one" | "wrong_operator" | "inverted_condition" | "missing_case" | "null_check_after_use" | "type_confusion" | "other",
    "fix": {
      "oldCode": "the wrong code",
      "newCode": "the correct code"
    }
  }],
  "inconsistencies": [{
    "lines": [line_numbers],
    "description": "what's inconsistent",
    "recommendation": "how to fix"
  }]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyLogicAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        deadCode: (parsed.deadCode || []).map((d: Record<string, unknown>) => ({
          location: { file: 'current', line: Number(d.line) || 1 },
          type:
            (d.type as 'unreachable' | 'unused_variable' | 'unused_function' | 'unused_import') ||
            'unreachable',
          confidence: (d.confidence as 'certain' | 'high' | 'medium' | 'low') || 'medium',
        })),
        unreachableCode: (parsed.unreachableCode || []).map((l: unknown) => ({
          file: 'current',
          line: Number(l),
        })),
        redundantOperations: (parsed.redundantOperations || []).map(
          (r: Record<string, unknown>) => ({
            location: { file: 'current', line: Number(r.line) || 1 },
            description: String(r.description || ''),
            canRemove: Boolean(r.canRemove),
          })
        ),
        logicErrors: (parsed.logicErrors || []).map((e: Record<string, unknown>) => ({
          location: { file: 'current', line: Number(e.line) || 1 },
          description: String(e.description || ''),
          type: (e.type as LogicError['type']) || 'other',
          fix: e.fix
            ? {
                type: 'replace' as const,
                location: { file: 'current', line: Number(e.line) || 1 },
                oldCode: (e.fix as { oldCode?: string }).oldCode,
                newCode: String((e.fix as { newCode?: string }).newCode || ''),
                explanation: String(e.description || ''),
                confidence: 'high' as const,
                requiresReview: true,
              }
            : {
                type: 'replace' as const,
                location: { file: 'current', line: Number(e.line) || 1 },
                newCode: '',
                explanation: String(e.description || ''),
                confidence: 'low' as const,
                requiresReview: true,
              },
        })),
        inconsistencies: (parsed.inconsistencies || []).map((i: Record<string, unknown>) => ({
          locations: (Array.isArray(i.lines) ? i.lines : []).map((l: unknown) => ({
            file: 'current',
            line: Number(l),
          })),
          description: String(i.description || ''),
          recommendation: String(i.recommendation || ''),
        })),
      };
    } catch (error) {
      log.warn('Logic analysis failed', { error });
      return this.emptyLogicAnalysis();
    }
  }

  // ==========================================================================
  // ARCHITECTURE DIMENSION
  // ==========================================================================

  private async analyzeArchitectureDimension(
    code: string,
    language: DebugLanguage,
    relatedFiles?: Map<string, string>
  ): Promise<ArchitectureAnalysis> {
    const relatedContext = relatedFiles
      ? Array.from(relatedFiles.entries())
          .slice(0, 3)
          .map(([path, content]) => `// ${path}\n${content.slice(0, 500)}...`)
          .join('\n\n')
      : '';

    const prompt = `Analyze this ${language} code for ARCHITECTURE issues.

CODE:
\`\`\`${language}
${code}
\`\`\`

${relatedContext ? `RELATED FILES:\n${relatedContext}\n` : ''}

Check for:
1. Architecture violations (layer breaches, wrong dependencies)
2. Circular dependencies
3. Tight coupling
4. Low cohesion
5. God classes/functions
6. Design pattern misuse
7. Anti-patterns (Singleton abuse, Service Locator, etc.)

Return JSON:
{
  "score": 0-100,
  "violations": [{
    "type": "violation type",
    "description": "what's wrong",
    "lines": [line_numbers],
    "recommendation": "how to fix"
  }],
  "dependencies": {
    "directDeps": number,
    "transitiveDeps": number,
    "circularDeps": [["A", "B", "A"]],
    "outdatedDeps": [],
    "vulnerableDeps": []
  },
  "coupling": {
    "overall": "low" | "medium" | "high",
    "tightlyCoupled": [{"a": "ModuleA", "b": "ModuleB", "reason": "why"}]
  },
  "cohesion": {
    "overall": "low" | "medium" | "high",
    "lowCohesionModules": [{"module": "name", "reason": "why"}]
  },
  "patterns": [{
    "pattern": "pattern name",
    "lines": [line_numbers],
    "appropriate": boolean
  }],
  "antiPatterns": [{
    "antiPattern": "name",
    "lines": [line_numbers],
    "impact": "what's wrong",
    "refactoring": "how to fix"
  }]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyArchitectureAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        violations: (parsed.violations || []).map((v: Record<string, unknown>) => ({
          type: String(v.type || ''),
          description: String(v.description || ''),
          locations: (Array.isArray(v.lines) ? v.lines : []).map((l: unknown) => ({
            file: 'current',
            line: Number(l),
          })),
          recommendation: String(v.recommendation || ''),
        })),
        dependencies: parsed.dependencies || {
          directDeps: 0,
          transitiveDeps: 0,
          circularDeps: [],
          outdatedDeps: [],
          vulnerableDeps: [],
        },
        coupling: parsed.coupling || { overall: 'medium', tightlyCoupled: [] },
        cohesion: parsed.cohesion || { overall: 'medium', lowCohesionModules: [] },
        patterns: (parsed.patterns || []).map((p: Record<string, unknown>) => ({
          pattern: String(p.pattern || ''),
          locations: (Array.isArray(p.lines) ? p.lines : []).map((l: unknown) => ({
            file: 'current',
            line: Number(l),
          })),
          appropriate: Boolean(p.appropriate),
        })),
        antiPatterns: (parsed.antiPatterns || []).map((a: Record<string, unknown>) => ({
          antiPattern: String(a.antiPattern || ''),
          locations: (Array.isArray(a.lines) ? a.lines : []).map((l: unknown) => ({
            file: 'current',
            line: Number(l),
          })),
          impact: String(a.impact || ''),
          refactoring: String(a.refactoring || ''),
        })),
      };
    } catch (error) {
      log.warn('Architecture analysis failed', { error });
      return this.emptyArchitectureAnalysis();
    }
  }

  // ==========================================================================
  // MAINTAINABILITY DIMENSION
  // ==========================================================================

  private async analyzeMaintainabilityDimension(
    code: string,
    language: DebugLanguage
  ): Promise<MaintainabilityAnalysis> {
    // Calculate basic metrics
    const lines = code.split('\n');
    const linesOfCode = lines.filter((l) => l.trim() && !l.trim().startsWith('//')).length;

    // Count complexity indicators
    let cyclomaticComplexity = 1;
    lines.forEach((line) => {
      if (/\bif\b|\bwhile\b|\bfor\b|\bcase\b|\bcatch\b|\?\s*:|\&\&|\|\|/.test(line)) {
        cyclomaticComplexity++;
      }
    });

    const prompt = `Analyze this ${language} code for MAINTAINABILITY.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for:
1. Complex functions (too long, too many parameters)
2. Missing/poor documentation
3. Inconsistent naming
4. Code smells (long method, feature envy, data clumps)
5. Magic numbers/strings
6. Deep nesting
7. Commented-out code

Return JSON:
{
  "score": 0-100,
  "documentation": {
    "coverage": 0-100,
    "quality": "poor" | "adequate" | "good" | "excellent",
    "missingDocLines": [line_numbers],
    "outdatedDocLines": [line_numbers]
  },
  "naming": {
    "conventions": "consistent" | "inconsistent",
    "issues": [{"line": line_number, "current": "badName", "suggested": "goodName"}]
  },
  "codeSmells": [{
    "type": "smell type",
    "line": line_number,
    "description": "what's wrong",
    "refactoring": "how to fix"
  }]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyMaintainabilityAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        complexity: {
          cyclomatic: cyclomaticComplexity,
          cognitive: cyclomaticComplexity * 1.2, // Approximation
          halstead: linesOfCode * 2, // Approximation
          linesOfCode,
          maintainabilityIndex: Math.max(
            0,
            171 -
              5.2 * Math.log(cyclomaticComplexity * linesOfCode) -
              0.23 * cyclomaticComplexity -
              16.2 * Math.log(linesOfCode)
          ),
        },
        documentation: parsed.documentation
          ? {
              coverage: Number(parsed.documentation.coverage) || 0,
              quality: parsed.documentation.quality || 'poor',
              missingDocs: (parsed.documentation.missingDocLines || []).map((l: unknown) => ({
                file: 'current',
                line: Number(l),
              })),
              outdatedDocs: (parsed.documentation.outdatedDocLines || []).map((l: unknown) => ({
                file: 'current',
                line: Number(l),
              })),
            }
          : { coverage: 0, quality: 'poor' as const, missingDocs: [], outdatedDocs: [] },
        naming: parsed.naming
          ? {
              conventions: parsed.naming.conventions || 'inconsistent',
              issues: (parsed.naming.issues || []).map((i: Record<string, unknown>) => ({
                location: { file: 'current', line: Number(i.line) || 1 },
                current: String(i.current || ''),
                suggested: String(i.suggested || ''),
              })),
            }
          : { conventions: 'inconsistent' as const, issues: [] },
        codeSmells: (parsed.codeSmells || []).map((s: Record<string, unknown>) => ({
          type: String(s.type || ''),
          location: { file: 'current', line: Number(s.line) || 1 },
          description: String(s.description || ''),
          refactoring: String(s.refactoring || ''),
        })),
      };
    } catch (error) {
      log.warn('Maintainability analysis failed', { error });
      return this.emptyMaintainabilityAnalysis();
    }
  }

  // ==========================================================================
  // TESTABILITY DIMENSION
  // ==========================================================================

  private async analyzeTestabilityDimension(
    code: string,
    language: DebugLanguage
  ): Promise<TestabilityAnalysis> {
    const prompt = `Analyze this ${language} code for TESTABILITY.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for:
1. Functions that are hard to test (too many dependencies, side effects)
2. Missing dependency injection
3. Global state
4. Untestable private methods
5. Missing test hooks

Return JSON:
{
  "score": 0-100,
  "hardToTest": [{
    "line": line_number,
    "reason": "why it's hard to test"
  }],
  "mockRequirements": ["what needs to be mocked"],
  "suggestedTests": [{
    "name": "test name",
    "type": "unit" | "integration" | "e2e",
    "targetLine": line_number,
    "code": "test code",
    "coverage": ["what it covers"]
  }]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyTestabilityAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Number(parsed.score) || 50,
        untestedPaths: [],
        hardToTest: (parsed.hardToTest || []).map((h: Record<string, unknown>) => ({
          location: { file: 'current', line: Number(h.line) || 1 },
          reason: String(h.reason || ''),
        })),
        mockRequirements: parsed.mockRequirements || [],
        suggestedTests: (parsed.suggestedTests || []).map((t: Record<string, unknown>) => ({
          name: String(t.name || ''),
          type: (t.type as 'unit' | 'integration' | 'e2e') || 'unit',
          target: { file: 'current', line: Number(t.targetLine) || 1 },
          code: String(t.code || ''),
          coverage: Array.isArray(t.coverage) ? t.coverage.map(String) : [],
        })),
      };
    } catch (error) {
      log.warn('Testability analysis failed', { error });
      return this.emptyTestabilityAnalysis();
    }
  }

  // ==========================================================================
  // RELIABILITY DIMENSION
  // ==========================================================================

  private async analyzeReliabilityDimension(
    code: string,
    language: DebugLanguage
  ): Promise<ReliabilityAnalysis> {
    const prompt = `Analyze this ${language} code for RELIABILITY.

CODE:
\`\`\`${language}
${code}
\`\`\`

Check for:
1. Missing error handling
2. Swallowed errors (catch without handling)
3. Single points of failure
4. Missing retries for transient failures
5. Missing circuit breakers
6. Lack of graceful degradation
7. Missing rollback mechanisms

Return JSON:
{
  "score": 0-100,
  "errorHandling": {
    "coverage": 0-100,
    "unhandledExceptionLines": [line_numbers],
    "swallowedErrorLines": [line_numbers],
    "improperErrorMessageLines": [line_numbers]
  },
  "faultTolerance": {
    "singlePointsOfFailureLines": [line_numbers],
    "missingRetryLines": [line_numbers],
    "missingCircuitBreakerLines": [line_numbers]
  },
  "recoverability": {
    "gracefulDegradation": boolean,
    "stateRecovery": boolean,
    "missingRollbackLines": [line_numbers]
  }
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyReliabilityAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);

      const toLocations = (lines: unknown[]): SourceLocation[] =>
        (lines || []).map((l: unknown) => ({ file: 'current', line: Number(l) }));

      return {
        score: Number(parsed.score) || 50,
        errorHandling: parsed.errorHandling
          ? {
              coverage: Number(parsed.errorHandling.coverage) || 0,
              unhandledExceptions: toLocations(parsed.errorHandling.unhandledExceptionLines),
              swallowedErrors: toLocations(parsed.errorHandling.swallowedErrorLines),
              improperErrorMessages: toLocations(parsed.errorHandling.improperErrorMessageLines),
            }
          : {
              coverage: 0,
              unhandledExceptions: [],
              swallowedErrors: [],
              improperErrorMessages: [],
            },
        faultTolerance: parsed.faultTolerance
          ? {
              singlePointsOfFailure: toLocations(parsed.faultTolerance.singlePointsOfFailureLines),
              missingRetries: toLocations(parsed.faultTolerance.missingRetryLines),
              missingCircuitBreakers: toLocations(parsed.faultTolerance.missingCircuitBreakerLines),
            }
          : { singlePointsOfFailure: [], missingRetries: [], missingCircuitBreakers: [] },
        recoverability: parsed.recoverability
          ? {
              gracefulDegradation: Boolean(parsed.recoverability.gracefulDegradation),
              stateRecovery: Boolean(parsed.recoverability.stateRecovery),
              missingRollbacks: toLocations(parsed.recoverability.missingRollbackLines),
            }
          : { gracefulDegradation: false, stateRecovery: false, missingRollbacks: [] },
      };
    } catch (error) {
      log.warn('Reliability analysis failed', { error });
      return this.emptyReliabilityAnalysis();
    }
  }

  // ==========================================================================
  // PRIORITIZED ACTIONS
  // ==========================================================================

  private generatePrioritizedActions(
    report: Omit<MultiDimensionalReport, 'overallScore' | 'prioritizedActions'>
  ): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];
    let priority = 1;

    // Security vulnerabilities are highest priority
    for (const vuln of report.security.vulnerabilities) {
      actions.push({
        priority: priority++,
        category: 'Security',
        description: `Fix ${vuln.type}: ${vuln.description}`,
        location: vuln.location,
        fix: vuln.fix,
        effort: vuln.exploitability === 'trivial' ? 'small' : 'medium',
        impact:
          vuln.severity === 'critical'
            ? 'critical'
            : vuln.severity === 'info'
              ? 'low'
              : vuln.severity,
      });
    }

    // Logic errors
    for (const error of report.logic.logicErrors) {
      actions.push({
        priority: priority++,
        category: 'Logic',
        description: `Fix ${error.type}: ${error.description}`,
        location: error.location,
        fix: error.fix,
        effort: 'small',
        impact: 'high',
      });
    }

    // Performance bottlenecks
    for (const bottleneck of report.performance.bottlenecks) {
      if (bottleneck.impact === 'blocking') {
        actions.push({
          priority: priority++,
          category: 'Performance',
          description: `Optimize: ${bottleneck.description}`,
          location: bottleneck.location,
          fix: bottleneck.optimization,
          effort: 'medium',
          impact: 'high',
        });
      }
    }

    // Error handling gaps
    for (const loc of report.reliability.errorHandling.unhandledExceptions) {
      actions.push({
        priority: priority++,
        category: 'Reliability',
        description: 'Add error handling',
        location: loc,
        effort: 'small',
        impact: 'medium',
      });
    }

    // Code smells
    for (const smell of report.maintainability.codeSmells.slice(0, 5)) {
      actions.push({
        priority: priority++,
        category: 'Maintainability',
        description: `Refactor: ${smell.type}`,
        location: smell.location,
        effort: 'medium',
        impact: 'low',
      });
    }

    return actions.sort((a, b) => {
      const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
    });
  }

  // ==========================================================================
  // EMPTY ANALYSIS HELPERS
  // ==========================================================================

  private emptySecurityAnalysis(): SecurityAnalysis {
    return {
      score: 100,
      vulnerabilities: [],
      attackVectors: [],
      dataExposure: [],
      complianceIssues: [],
    };
  }

  private emptyPerformanceAnalysis(): PerformanceAnalysis {
    return {
      score: 100,
      bottlenecks: [],
      memoryIssues: [],
      algorithmicIssues: [],
      resourceUsage: {
        estimatedMemory: 'N/A',
        estimatedCpu: 'N/A',
        ioOperations: 0,
        networkCalls: 0,
        databaseQueries: 0,
      },
    };
  }

  private emptyLogicAnalysis(): LogicAnalysis {
    return {
      score: 100,
      deadCode: [],
      unreachableCode: [],
      redundantOperations: [],
      logicErrors: [],
      inconsistencies: [],
    };
  }

  private emptyArchitectureAnalysis(): ArchitectureAnalysis {
    return {
      score: 100,
      violations: [],
      dependencies: {
        directDeps: 0,
        transitiveDeps: 0,
        circularDeps: [],
        outdatedDeps: [],
        vulnerableDeps: [],
      },
      coupling: { overall: 'low', tightlyCoupled: [] },
      cohesion: { overall: 'high', lowCohesionModules: [] },
      patterns: [],
      antiPatterns: [],
    };
  }

  private emptyMaintainabilityAnalysis(): MaintainabilityAnalysis {
    return {
      score: 100,
      complexity: {
        cyclomatic: 1,
        cognitive: 1,
        halstead: 1,
        linesOfCode: 0,
        maintainabilityIndex: 100,
      },
      documentation: { coverage: 100, quality: 'good', missingDocs: [], outdatedDocs: [] },
      naming: { conventions: 'consistent', issues: [] },
      codeSmells: [],
    };
  }

  private emptyTestabilityAnalysis(): TestabilityAnalysis {
    return {
      score: 100,
      untestedPaths: [],
      hardToTest: [],
      mockRequirements: [],
      suggestedTests: [],
    };
  }

  private emptyReliabilityAnalysis(): ReliabilityAnalysis {
    return {
      score: 100,
      errorHandling: {
        coverage: 100,
        unhandledExceptions: [],
        swallowedErrors: [],
        improperErrorMessages: [],
      },
      faultTolerance: { singlePointsOfFailure: [], missingRetries: [], missingCircuitBreakers: [] },
      recoverability: { gracefulDegradation: true, stateRecovery: true, missingRollbacks: [] },
    };
  }
}
