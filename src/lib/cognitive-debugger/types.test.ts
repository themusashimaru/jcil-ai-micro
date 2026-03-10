import { describe, it, expect } from 'vitest';

/**
 * types.ts contains only TypeScript type/interface exports (no runtime code).
 * These tests verify that the types are importable and usable at runtime
 * for the few cases where types are used as values (e.g., type guards, default objects).
 */

import type {
  DebugLanguage,
  Severity,
  Confidence,
  SourceLocation,
  CodeContext,
  PredictedIssue,
  PredictiveAnalysisResult,
  CodeHotspot,
  UserIntent,
  IntentFailureMap,
  ExecutionPath,
  ExecutionStep,
  Variable,
  SideEffect,
  BugPattern,
  PatternMatch,
  SecurityVulnerability,
  PerformanceBottleneck,
  CognitiveAnalysis,
  ReasoningStep,
  Hypothesis,
  MentalModel,
  Recommendation,
  CodeFix,
  CognitiveDebugSession,
  UserPreferences,
  CognitiveDebugEvent,
} from './types';

describe('types.ts - Type Definitions', () => {
  describe('Core Types', () => {
    it('DebugLanguage should support common languages', () => {
      const lang: DebugLanguage = 'javascript';
      expect(lang).toBe('javascript');

      const langs: DebugLanguage[] = ['typescript', 'python', 'go', 'rust', 'java', 'unknown'];
      expect(langs).toHaveLength(6);
    });

    it('Severity should have 5 levels', () => {
      const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
      expect(severities).toHaveLength(5);
    });

    it('Confidence should have 5 levels', () => {
      const confidences: Confidence[] = ['certain', 'high', 'medium', 'low', 'speculative'];
      expect(confidences).toHaveLength(5);
    });

    it('SourceLocation should describe a code position', () => {
      const loc: SourceLocation = {
        file: 'test.ts',
        line: 10,
        column: 5,
        endLine: 15,
        endColumn: 20,
        language: 'typescript',
      };
      expect(loc.file).toBe('test.ts');
      expect(loc.line).toBe(10);
    });

    it('CodeContext should describe code with metadata', () => {
      const ctx: CodeContext = {
        code: 'const x = 1;',
        language: 'javascript',
        file: 'test.js',
        startLine: 1,
        imports: ['lodash'],
        exports: ['x'],
        dependencies: ['lodash'],
      };
      expect(ctx.code).toBe('const x = 1;');
    });
  });

  describe('Predictive Analysis Types', () => {
    it('PredictedIssue should describe a predicted bug', () => {
      const issue: PredictedIssue = {
        id: 'issue_1',
        type: 'null_reference',
        location: { file: 'test.ts', line: 5 },
        description: 'Potential null',
        probability: 0.8,
        severity: 'high',
        confidence: 'high',
        conditions: ['when input is null'],
        preventionStrategy: 'Add null check',
      };
      expect(issue.type).toBe('null_reference');
    });

    it('PredictiveAnalysisResult should contain analysis data', () => {
      const result: PredictiveAnalysisResult = {
        issues: [],
        hotspots: [],
        safetyScore: 85,
        analysisDepth: 'deep',
        executionPaths: [],
        dataFlows: [],
      };
      expect(result.safetyScore).toBe(85);
    });

    it('CodeHotspot should describe a risky area', () => {
      const hotspot: CodeHotspot = {
        location: { file: 'test.ts', line: 10 },
        riskLevel: 'high',
        riskFactors: ['complexity', 'side effects'],
        complexity: 15,
      };
      expect(hotspot.riskLevel).toBe('high');
    });
  });

  describe('Intent-to-Failure Types', () => {
    it('UserIntent should describe what user wants', () => {
      const intent: UserIntent = {
        id: 'intent_1',
        description: 'Sort a list',
        goals: ['Sort ascending'],
        constraints: ['Must be stable sort'],
        expectedBehavior: ['Returns sorted array'],
      };
      expect(intent.goals).toHaveLength(1);
    });

    it('IntentFailureMap should map intent to failures', () => {
      const map: IntentFailureMap = {
        intent: { id: '1', description: 'test', goals: [], constraints: [], expectedBehavior: [] },
        possibleFailures: [],
        criticalPaths: [],
        assumptionRisks: [],
        edgeCases: [],
        successProbability: 0.9,
      };
      expect(map.successProbability).toBe(0.9);
    });
  });

  describe('Execution Tracing Types', () => {
    it('ExecutionPath should describe a code path', () => {
      const path: ExecutionPath = {
        id: 'path_1',
        name: 'Main path',
        steps: [],
        probability: 0.8,
        complexity: 5,
        isCritical: true,
      };
      expect(path.isCritical).toBe(true);
    });

    it('ExecutionStep should describe a single step', () => {
      const step: ExecutionStep = {
        location: { file: 'test.ts', line: 1 },
        operation: 'assignment',
        inputs: [],
        outputs: [],
        sideEffects: [],
        branches: [],
      };
      expect(step.operation).toBe('assignment');
    });

    it('Variable should describe a code variable', () => {
      const v: Variable = {
        name: 'x',
        type: 'number',
        value: 42,
        isMutable: true,
        origin: { file: 'test.ts', line: 1 },
      };
      expect(v.name).toBe('x');
    });

    it('SideEffect should describe an effect', () => {
      const se: SideEffect = {
        type: 'network',
        description: 'HTTP request',
        reversible: false,
        idempotent: false,
      };
      expect(se.type).toBe('network');
    });
  });

  describe('Pattern Recognition Types', () => {
    it('BugPattern should describe a known pattern', () => {
      const pattern: BugPattern = {
        id: 'pattern_1',
        name: 'Test Pattern',
        description: 'A test',
        language: 'javascript',
        category: 'logic',
        signature: { type: 'regex', pattern: 'test' },
        severity: 'medium',
        frequency: 0.1,
        fix: { automatic: true, template: 'fix', variables: [] },
        examples: [{ bad: 'bad', good: 'good', explanation: 'why' }],
      };
      expect(pattern.category).toBe('logic');
    });

    it('PatternMatch should describe a found pattern', () => {
      const match: PatternMatch = {
        pattern: {
          id: 'p1',
          name: 'Test',
          description: 'Test',
          language: 'javascript',
          category: 'logic',
          signature: { type: 'regex', pattern: 'x' },
          severity: 'low',
          frequency: 0.1,
          fix: { automatic: false, template: '', variables: [] },
          examples: [],
        },
        location: { file: 'test.ts', line: 1 },
        confidence: 'medium',
        context: 'test context',
      };
      expect(match.confidence).toBe('medium');
    });
  });

  describe('Cognitive Reasoning Types', () => {
    it('CognitiveAnalysis should contain full analysis', () => {
      const analysis: CognitiveAnalysis = {
        reasoning: { steps: [], confidence: 'medium', alternativePaths: [] },
        hypotheses: [],
        conclusions: [],
        uncertainties: [],
        mentalModel: { components: [], relationships: [], invariants: [], assumptions: [] },
        recommendations: [],
      };
      expect(analysis.reasoning.confidence).toBe('medium');
    });

    it('ReasoningStep should describe a reasoning step', () => {
      const step: ReasoningStep = {
        observation: 'Found null check',
        inference: 'Developer is careful',
        evidence: ['line 5: if (x !== null)'],
        confidence: 'high',
      };
      expect(step.confidence).toBe('high');
    });

    it('Hypothesis should describe a hypothesis', () => {
      const h: Hypothesis = {
        statement: 'The code might fail with large inputs',
        probability: 0.7,
        supportingEvidence: ['No pagination'],
        contradictingEvidence: ['Has limit parameter'],
        testable: true,
        testStrategy: 'Test with 1M records',
      };
      expect(h.testable).toBe(true);
    });

    it('MentalModel should describe code structure', () => {
      const model: MentalModel = {
        components: [
          {
            name: 'Parser',
            type: 'class',
            responsibilities: ['Parse input'],
            constraints: ['Must handle UTF-8'],
          },
        ],
        relationships: [{ from: 'Parser', to: 'Formatter', type: 'uses', cardinality: '1:1' }],
        invariants: ['Input is always valid JSON'],
        assumptions: ['Server has enough memory'],
      };
      expect(model.components).toHaveLength(1);
    });
  });

  describe('Code Fix Types', () => {
    it('CodeFix should describe a code fix', () => {
      const fix: CodeFix = {
        type: 'replace',
        location: { file: 'test.ts', line: 5 },
        oldCode: 'if (x == null)',
        newCode: 'if (x === null)',
        explanation: 'Use strict equality',
        confidence: 'certain',
        requiresReview: false,
      };
      expect(fix.type).toBe('replace');
    });

    it('Recommendation should describe an action item', () => {
      const rec: Recommendation = {
        id: 'rec_1',
        title: 'Add error handling',
        description: 'The fetch call has no error handling',
        rationale: 'Network calls can fail',
        priority: 'high',
        type: 'fix',
        action: 'Add try/catch',
      };
      expect(rec.priority).toBe('high');
    });
  });

  describe('Session Types', () => {
    it('CognitiveDebugSession should hold session state', () => {
      const session: CognitiveDebugSession = {
        id: 'session_1',
        workspaceId: 'ws_1',
        userId: 'user_1',
        startTime: Date.now(),
        lastActivity: Date.now(),
        codeContext: new Map(),
        predictedIssues: [],
        executionPaths: [],
        patterns: [],
        intentFailureMaps: new Map(),
        learnedPatterns: [],
        userPreferences: {
          verbosity: 'normal',
          autoFix: false,
          focusAreas: [],
          ignoredRules: [],
        },
      };
      expect(session.id).toBe('session_1');
    });

    it('UserPreferences should describe user settings', () => {
      const prefs: UserPreferences = {
        verbosity: 'verbose',
        autoFix: true,
        focusAreas: ['security'],
        ignoredRules: ['no-console'],
      };
      expect(prefs.autoFix).toBe(true);
    });
  });

  describe('Event Types', () => {
    it('CognitiveDebugEvent should describe different event types', () => {
      const sessionEvent: CognitiveDebugEvent = {
        type: 'session_started',
        session: {
          id: 's1',
          workspaceId: 'ws',
          userId: 'u1',
          startTime: 0,
          lastActivity: 0,
          codeContext: new Map(),
          predictedIssues: [],
          executionPaths: [],
          patterns: [],
          intentFailureMaps: new Map(),
          learnedPatterns: [],
          userPreferences: {
            verbosity: 'normal',
            autoFix: false,
            focusAreas: [],
            ignoredRules: [],
          },
        },
      };
      expect(sessionEvent.type).toBe('session_started');

      const fixEvent: CognitiveDebugEvent = {
        type: 'fix_applied',
        fix: {
          type: 'replace',
          location: { file: 'test.ts', line: 1 },
          newCode: 'fixed',
          explanation: 'test',
          confidence: 'high',
          requiresReview: false,
        },
        result: 'success',
      };
      expect(fixEvent.type).toBe('fix_applied');
    });
  });

  describe('Multi-Dimensional Analysis Types', () => {
    it('SecurityVulnerability should describe a vulnerability', () => {
      const vuln: SecurityVulnerability = {
        id: 'vuln_1',
        type: 'xss',
        location: { file: 'test.ts', line: 10 },
        severity: 'critical',
        exploitability: 'easy',
        description: 'XSS vulnerability',
        fix: {
          type: 'replace',
          location: { file: 'test.ts', line: 10 },
          newCode: 'sanitized',
          explanation: 'Sanitize input',
          confidence: 'certain',
          requiresReview: true,
        },
      };
      expect(vuln.exploitability).toBe('easy');
    });

    it('PerformanceBottleneck should describe a bottleneck', () => {
      const bottleneck: PerformanceBottleneck = {
        location: { file: 'test.ts', line: 20 },
        type: 'cpu',
        impact: 'blocking',
        description: 'N+1 query',
        optimization: {
          type: 'replace',
          location: { file: 'test.ts', line: 20 },
          newCode: 'batch query',
          explanation: 'Use batch query',
          confidence: 'high',
          requiresReview: true,
        },
      };
      expect(bottleneck.impact).toBe('blocking');
    });
  });
});
