import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must be declared before importing the module under test
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

const mockPredictiveAnalyzerAnalyze = vi.fn().mockResolvedValue({
  issues: [],
  hotspots: [],
  safetyScore: 100,
  analysisDepth: 'surface' as const,
  executionPaths: [],
  dataFlows: [],
});

vi.mock('./predictive-analyzer', () => ({
  PredictiveAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: mockPredictiveAnalyzerAnalyze,
  })),
}));

const mockMapIntentToFailures = vi.fn().mockResolvedValue({
  intent: {
    id: 'test-intent',
    description: 'test',
    goals: [],
    constraints: [],
    expectedBehavior: [],
  },
  possibleFailures: [],
  criticalPaths: [],
  assumptionRisks: [],
  edgeCases: [],
  successProbability: 0.9,
});

vi.mock('./intent-failure-mapper', () => ({
  IntentFailureMapper: vi.fn().mockImplementation(() => ({
    mapIntentToFailures: mockMapIntentToFailures,
  })),
}));

const mockTraceExecutionPaths = vi.fn().mockResolvedValue([]);

vi.mock('./deep-execution-tracer', () => ({
  DeepExecutionTracer: vi.fn().mockImplementation(() => ({
    traceExecutionPaths: mockTraceExecutionPaths,
  })),
}));

const mockFindPatterns = vi.fn().mockResolvedValue([]);

vi.mock('./pattern-recognizer', () => ({
  PatternRecognizer: vi.fn().mockImplementation(() => ({
    findPatterns: mockFindPatterns,
  })),
}));

const mockMultiDimensionalAnalyze = vi.fn().mockResolvedValue({
  security: {
    score: 80,
    vulnerabilities: [],
    attackVectors: [],
    dataExposure: [],
    complianceIssues: [],
  },
  performance: {
    score: 80,
    bottlenecks: [],
    memoryIssues: [],
    algorithmicIssues: [],
    resourceUsage: {
      estimatedMemory: '10MB',
      estimatedCpu: 'low',
      ioOperations: 0,
      networkCalls: 0,
      databaseQueries: 0,
    },
  },
  logic: {
    score: 90,
    deadCode: [],
    unreachableCode: [],
    redundantOperations: [],
    logicErrors: [],
    inconsistencies: [],
  },
  architecture: {
    score: 70,
    violations: [],
    dependencies: {
      directDeps: 0,
      transitiveDeps: 0,
      circularDeps: [],
      outdatedDeps: [],
      vulnerableDeps: [],
    },
    coupling: { overall: 'low' as const, tightlyCoupled: [] },
    cohesion: { overall: 'high' as const, lowCohesionModules: [] },
    patterns: [],
    antiPatterns: [],
  },
  maintainability: {
    score: 75,
    complexity: {
      cyclomatic: 5,
      cognitive: 3,
      halstead: 10,
      linesOfCode: 50,
      maintainabilityIndex: 80,
    },
    documentation: {
      coverage: 0.5,
      quality: 'adequate' as const,
      missingDocs: [],
      outdatedDocs: [],
    },
    naming: { conventions: 'consistent' as const, issues: [] },
    codeSmells: [],
  },
  testability: {
    score: 60,
    untestedPaths: [],
    hardToTest: [],
    mockRequirements: [],
    suggestedTests: [],
  },
  reliability: {
    score: 70,
    errorHandling: {
      coverage: 0.5,
      unhandledExceptions: [],
      swallowedErrors: [],
      improperErrorMessages: [],
    },
    faultTolerance: { singlePointsOfFailure: [], missingRetries: [], missingCircuitBreakers: [] },
    recoverability: { gracefulDegradation: false, stateRecovery: false, missingRollbacks: [] },
  },
  overallScore: 75,
  prioritizedActions: [],
});

vi.mock('./multi-dimensional-analyzer', () => ({
  MultiDimensionalAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: mockMultiDimensionalAnalyze,
  })),
}));

const mockReasoningEngineAnalyze = vi.fn().mockResolvedValue({
  reasoning: { steps: [], confidence: 'medium' as const, alternativePaths: [] },
  hypotheses: [],
  conclusions: [],
  uncertainties: [],
  mentalModel: { components: [], relationships: [], invariants: [], assumptions: [] },
  recommendations: [],
});

vi.mock('./cognitive-reasoning-engine', () => ({
  CognitiveReasoningEngine: vi.fn().mockImplementation(() => ({
    analyze: mockReasoningEngineAnalyze,
  })),
}));

const mockVisualize = vi.fn().mockResolvedValue({
  mermaid: 'graph TD\n  A --> B',
  ascii: 'A -> B',
  hotspots: [],
});
const mockGeneratePathDiagram = vi.fn().mockResolvedValue('path diagram');

vi.mock('./code-flow-visualizer', () => ({
  CodeFlowVisualizer: vi.fn().mockImplementation(() => ({
    visualize: mockVisualize,
    generatePathDiagram: mockGeneratePathDiagram,
  })),
}));

vi.mock('./universal-debugger', () => ({
  UniversalDebugger: vi.fn().mockImplementation(() => ({
    startSession: vi.fn(),
    endSession: vi.fn(),
  })),
}));

// ============================================================================
// IMPORTS — after all mocks
// ============================================================================

import { CognitiveDebugger, getCognitiveDebugger } from './cognitive-debugger';
import type { CodeFix, UserIntent, PredictedIssue, PatternMatch, SourceLocation } from './types';

// ============================================================================
// TESTS
// ============================================================================

describe('CognitiveDebugger', () => {
  let debugger_: CognitiveDebugger;

  beforeEach(() => {
    vi.clearAllMocks();
    debugger_ = new CognitiveDebugger();
  });

  // --------------------------------------------------------------------------
  // Export validation
  // --------------------------------------------------------------------------

  describe('exports', () => {
    it('should export CognitiveDebugger as a class', () => {
      expect(CognitiveDebugger).toBeDefined();
      expect(typeof CognitiveDebugger).toBe('function');
    });

    it('should export getCognitiveDebugger as a function', () => {
      expect(getCognitiveDebugger).toBeDefined();
      expect(typeof getCognitiveDebugger).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create an instance with default config', () => {
      const instance = new CognitiveDebugger();
      expect(instance).toBeInstanceOf(CognitiveDebugger);
    });

    it('should accept partial config overrides', () => {
      const instance = new CognitiveDebugger({
        maxConcurrentAnalyses: 10,
        enablePrediction: false,
        depth: 'surface',
      });
      expect(instance).toBeInstanceOf(CognitiveDebugger);
    });

    it('should be an EventEmitter', () => {
      expect(typeof debugger_.on).toBe('function');
      expect(typeof debugger_.emit).toBe('function');
      expect(typeof debugger_.removeListener).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // Session management
  // --------------------------------------------------------------------------

  describe('startSession', () => {
    it('should create a new session with correct fields', () => {
      const session = debugger_.startSession('workspace-1', 'user-1');

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^cognitive_/);
      expect(session.workspaceId).toBe('workspace-1');
      expect(session.userId).toBe('user-1');
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.lastActivity).toBeGreaterThan(0);
    });

    it('should initialize empty collections', () => {
      const session = debugger_.startSession('ws', 'u');

      expect(session.codeContext).toBeInstanceOf(Map);
      expect(session.codeContext.size).toBe(0);
      expect(session.predictedIssues).toEqual([]);
      expect(session.executionPaths).toEqual([]);
      expect(session.patterns).toEqual([]);
      expect(session.intentFailureMaps).toBeInstanceOf(Map);
      expect(session.intentFailureMaps.size).toBe(0);
      expect(session.learnedPatterns).toEqual([]);
    });

    it('should initialize default user preferences', () => {
      const session = debugger_.startSession('ws', 'u');

      expect(session.userPreferences).toEqual({
        verbosity: 'normal',
        autoFix: false,
        focusAreas: [],
        ignoredRules: [],
      });
    });

    it('should emit session_started event', () => {
      const handler = vi.fn();
      debugger_.on('session_started', handler);

      const session = debugger_.startSession('ws', 'u');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: 'session_started',
        session,
      });
    });

    it('should also emit a generic event event', () => {
      const handler = vi.fn();
      debugger_.on('event', handler);

      debugger_.startSession('ws', 'u');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should store the session for later retrieval', () => {
      const session = debugger_.startSession('ws', 'u');
      const retrieved = debugger_.getSession(session.id);
      expect(retrieved).toBe(session);
    });
  });

  describe('getSession', () => {
    it('should return null for unknown session ID', () => {
      expect(debugger_.getSession('nonexistent')).toBeNull();
    });

    it('should return the correct session', () => {
      const session1 = debugger_.startSession('ws1', 'u1');
      const session2 = debugger_.startSession('ws2', 'u2');

      expect(debugger_.getSession(session1.id)).toBe(session1);
      expect(debugger_.getSession(session2.id)).toBe(session2);
    });
  });

  describe('endSession', () => {
    it('should remove the session', () => {
      const session = debugger_.startSession('ws', 'u');
      debugger_.endSession(session.id);
      expect(debugger_.getSession(session.id)).toBeNull();
    });

    it('should emit session_ended event', () => {
      const handler = vi.fn();
      debugger_.on('session_ended', handler);

      const session = debugger_.startSession('ws', 'u');
      debugger_.endSession(session.id);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: 'session_ended',
        session,
      });
    });

    it('should not emit event for unknown session ID', () => {
      const handler = vi.fn();
      debugger_.on('session_ended', handler);

      debugger_.endSession('nonexistent');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getUniversalDebugger', () => {
    it('should return the universal debugger instance', () => {
      const ud = debugger_.getUniversalDebugger();
      expect(ud).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // analyzeCode
  // --------------------------------------------------------------------------

  describe('analyzeCode', () => {
    it('should throw when session is not found', async () => {
      await expect(
        debugger_.analyzeCode('nonexistent', 'const x = 1;', 'javascript')
      ).rejects.toThrow('Session not found: nonexistent');
    });

    it('should return analysis results for a valid session', async () => {
      const session = debugger_.startSession('ws', 'u');

      const result = await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('fixes');
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(Array.isArray(result.patterns)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.fixes)).toBe(true);
    });

    it('should call predictive analyzer when enabled', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'typescript');

      expect(mockPredictiveAnalyzerAnalyze).toHaveBeenCalled();
    });

    it('should call pattern recognizer when enabled', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'typescript');

      expect(mockFindPatterns).toHaveBeenCalledWith('const x = 1;', 'typescript');
    });

    it('should call execution tracer', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(mockTraceExecutionPaths).toHaveBeenCalledWith('const x = 1;', 'javascript');
    });

    it('should call multi-dimensional analyzer when enabled', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(mockMultiDimensionalAnalyze).toHaveBeenCalled();
    });

    it('should call reasoning engine when enabled', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(mockReasoningEngineAnalyze).toHaveBeenCalled();
    });

    it('should skip prediction when disabled', async () => {
      const instance = new CognitiveDebugger({ enablePrediction: false });
      const session = instance.startSession('ws', 'u');

      const result = await instance.analyzeCode(session.id, 'const x = 1;', 'javascript');

      // When prediction is disabled, it uses Promise.resolve fallback
      expect(result.predictions).toEqual([]);
    });

    it('should skip pattern recognition when disabled', async () => {
      const instance = new CognitiveDebugger({ enablePatternRecognition: false });
      const session = instance.startSession('ws', 'u');

      await instance.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(mockFindPatterns).not.toHaveBeenCalled();
    });

    it('should skip multi-dimensional analysis when disabled', async () => {
      const instance = new CognitiveDebugger({ enableMultiDimensional: false });
      const session = instance.startSession('ws', 'u');

      const result = await instance.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(result.multiDimensional).toBeUndefined();
      expect(mockMultiDimensionalAnalyze).not.toHaveBeenCalled();
    });

    it('should skip reasoning when disabled', async () => {
      const instance = new CognitiveDebugger({ enableReasoning: false });
      const session = instance.startSession('ws', 'u');

      const result = await instance.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(result.reasoning).toBeUndefined();
      expect(mockReasoningEngineAnalyze).not.toHaveBeenCalled();
    });

    it('should store code context in session', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'typescript', {
        file: 'test.ts',
      });

      expect(session.codeContext.get('test.ts')).toEqual({
        code: 'const x = 1;',
        language: 'typescript',
        file: 'test.ts',
        startLine: 1,
      });
    });

    it('should use "main" as default context key when no file is specified', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(session.codeContext.has('main')).toBe(true);
    });

    it('should emit events for predicted issues', async () => {
      const mockIssue: PredictedIssue = {
        id: 'issue-1',
        type: 'null_reference',
        location: { file: 'test.ts', line: 1 },
        description: 'Potential null reference',
        probability: 0.8,
        severity: 'high',
        confidence: 'high',
        conditions: ['when value is null'],
        preventionStrategy: 'Add null check',
      };

      mockPredictiveAnalyzerAnalyze.mockResolvedValueOnce({
        issues: [mockIssue],
        hotspots: [],
        safetyScore: 70,
        analysisDepth: 'deep' as const,
        executionPaths: [],
        dataFlows: [],
      });

      const handler = vi.fn();
      debugger_.on('issue_predicted', handler);

      const session = debugger_.startSession('ws', 'u');
      await debugger_.analyzeCode(session.id, 'const x = null; x.foo;', 'javascript');

      expect(handler).toHaveBeenCalledWith({
        type: 'issue_predicted',
        issue: mockIssue,
      });
    });

    it('should emit events for detected patterns', async () => {
      const mockPattern: PatternMatch = {
        pattern: {
          id: 'pat-1',
          name: 'Test Pattern',
          description: 'A test pattern',
          language: 'javascript',
          category: 'logic',
          signature: { type: 'regex', pattern: '.*' },
          severity: 'medium',
          frequency: 0.5,
          fix: { automatic: false, template: '', variables: [] },
          examples: [],
        },
        location: { file: 'test.ts', line: 1 },
        confidence: 'high',
        context: 'test context',
      };

      mockFindPatterns.mockResolvedValueOnce([mockPattern]);

      const handler = vi.fn();
      debugger_.on('pattern_detected', handler);

      const session = debugger_.startSession('ws', 'u');
      await debugger_.analyzeCode(session.id, 'const x = 1;', 'javascript');

      expect(handler).toHaveBeenCalledWith({
        type: 'pattern_detected',
        match: mockPattern,
      });
    });

    it('should accumulate issues in the session', async () => {
      const mockIssue: PredictedIssue = {
        id: 'issue-1',
        type: 'null_reference',
        location: { file: 'test.ts', line: 1 },
        description: 'Potential null reference',
        probability: 0.8,
        severity: 'high',
        confidence: 'high',
        conditions: [],
        preventionStrategy: 'Add null check',
      };

      mockPredictiveAnalyzerAnalyze.mockResolvedValueOnce({
        issues: [mockIssue],
        hotspots: [],
        safetyScore: 70,
        analysisDepth: 'deep' as const,
        executionPaths: [],
        dataFlows: [],
      });

      const session = debugger_.startSession('ws', 'u');
      await debugger_.analyzeCode(session.id, 'code', 'javascript');

      expect(session.predictedIssues).toContain(mockIssue);
    });
  });

  // --------------------------------------------------------------------------
  // analyzeWithIntent
  // --------------------------------------------------------------------------

  describe('analyzeWithIntent', () => {
    it('should throw when session not found', async () => {
      const intent: UserIntent = {
        id: 'intent-1',
        description: 'sort an array',
        goals: ['sort'],
        constraints: [],
        expectedBehavior: ['sorted output'],
      };

      await expect(
        debugger_.analyzeWithIntent('nonexistent', 'arr.sort()', 'javascript', intent)
      ).rejects.toThrow('Session not found: nonexistent');
    });

    it('should call intent failure mapper and return the result', async () => {
      const session = debugger_.startSession('ws', 'u');
      const intent: UserIntent = {
        id: 'intent-1',
        description: 'sort an array',
        goals: ['sort'],
        constraints: [],
        expectedBehavior: ['sorted output'],
      };

      const result = await debugger_.analyzeWithIntent(
        session.id,
        'arr.sort()',
        'javascript',
        intent
      );

      expect(mockMapIntentToFailures).toHaveBeenCalled();
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('possibleFailures');
      expect(result).toHaveProperty('criticalPaths');
      expect(result).toHaveProperty('assumptionRisks');
      expect(result).toHaveProperty('edgeCases');
      expect(result).toHaveProperty('successProbability');
    });

    it('should store the intent failure map in the session', async () => {
      const session = debugger_.startSession('ws', 'u');
      const intent: UserIntent = {
        id: 'intent-42',
        description: 'test',
        goals: [],
        constraints: [],
        expectedBehavior: [],
      };

      await debugger_.analyzeWithIntent(session.id, 'code', 'javascript', intent);

      expect(session.intentFailureMaps.has('intent-42')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // quickPredict
  // --------------------------------------------------------------------------

  describe('quickPredict', () => {
    it('should call predictive analyzer with surface depth', async () => {
      await debugger_.quickPredict('const x = 1;', 'javascript');

      expect(mockPredictiveAnalyzerAnalyze).toHaveBeenCalledWith(
        'const x = 1;',
        'javascript',
        expect.objectContaining({ depth: 'surface' })
      );
    });

    it('should return an array of predicted issues', async () => {
      const result = await debugger_.quickPredict('const x = 1;', 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass cursor position focus area when provided', async () => {
      await debugger_.quickPredict('const x = 1;', 'javascript', {
        line: 5,
        column: 10,
      });

      expect(mockPredictiveAnalyzerAnalyze).toHaveBeenCalledWith(
        'const x = 1;',
        'javascript',
        expect.objectContaining({
          depth: 'surface',
          focusArea: { line: 5, radius: 10 },
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // applyFix
  // --------------------------------------------------------------------------

  describe('applyFix', () => {
    const makeLocation = (): SourceLocation => ({
      file: 'test.ts',
      line: 1,
    });

    it('should replace code for a replace fix', async () => {
      const fix: CodeFix = {
        type: 'replace',
        location: makeLocation(),
        oldCode: 'var x = 1',
        newCode: 'const x = 1',
        explanation: 'Use const',
        confidence: 'certain',
        requiresReview: false,
      };

      const result = await debugger_.applyFix('session', fix, 'var x = 1;\nconsole.log(x);');

      expect(result.success).toBe(true);
      expect(result.newCode).toBe('const x = 1;\nconsole.log(x);');
    });

    it('should fail when old code not found for replace', async () => {
      const fix: CodeFix = {
        type: 'replace',
        location: makeLocation(),
        oldCode: 'not found code',
        newCode: 'replacement',
        explanation: 'test',
        confidence: 'high',
        requiresReview: false,
      };

      const result = await debugger_.applyFix('session', fix, 'const x = 1;');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not find the code to replace');
      expect(result.newCode).toBe('const x = 1;');
    });

    it('should insert code at the specified line', async () => {
      const fix: CodeFix = {
        type: 'insert',
        location: { file: 'test.ts', line: 2 },
        newCode: '// inserted comment',
        explanation: 'Add comment',
        confidence: 'certain',
        requiresReview: false,
      };

      const result = await debugger_.applyFix('session', fix, 'line1\nline2\nline3');

      expect(result.success).toBe(true);
      expect(result.newCode).toBe('line1\n// inserted comment\nline2\nline3');
    });

    it('should delete code for a delete fix', async () => {
      const fix: CodeFix = {
        type: 'delete',
        location: makeLocation(),
        oldCode: 'remove this',
        newCode: '',
        explanation: 'Remove dead code',
        confidence: 'certain',
        requiresReview: false,
      };

      const result = await debugger_.applyFix(
        'session',
        fix,
        'keep this remove this keep this too'
      );

      expect(result.success).toBe(true);
      expect(result.newCode).toBe('keep this  keep this too');
    });

    it('should emit fix_applied success event', async () => {
      const handler = vi.fn();
      debugger_.on('fix_applied', handler);

      const fix: CodeFix = {
        type: 'replace',
        location: makeLocation(),
        oldCode: 'old',
        newCode: 'new',
        explanation: 'test',
        confidence: 'high',
        requiresReview: false,
      };

      await debugger_.applyFix('session', fix, 'old code');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fix_applied',
          fix,
          result: 'success',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // visualizeCodeFlow
  // --------------------------------------------------------------------------

  describe('visualizeCodeFlow', () => {
    it('should delegate to the flow visualizer', async () => {
      const result = await debugger_.visualizeCodeFlow('session', 'const x = 1;', 'javascript');

      expect(mockVisualize).toHaveBeenCalledWith('const x = 1;', 'javascript');
      expect(result).toHaveProperty('mermaid');
      expect(result).toHaveProperty('ascii');
      expect(result).toHaveProperty('hotspots');
    });
  });

  describe('visualizeExecutionPaths', () => {
    it('should return empty string for unknown session', async () => {
      const result = await debugger_.visualizeExecutionPaths('nonexistent');
      expect(result).toBe('');
    });

    it('should delegate to flow visualizer for valid session', async () => {
      const session = debugger_.startSession('ws', 'u');

      await debugger_.visualizeExecutionPaths(session.id);

      expect(mockGeneratePathDiagram).toHaveBeenCalledWith(session.executionPaths);
    });
  });
});

// ============================================================================
// getCognitiveDebugger singleton
// ============================================================================

describe('getCognitiveDebugger', () => {
  it('should return a CognitiveDebugger instance', () => {
    const instance = getCognitiveDebugger();
    expect(instance).toBeInstanceOf(CognitiveDebugger);
  });

  it('should return the same instance on subsequent calls', () => {
    const a = getCognitiveDebugger();
    const b = getCognitiveDebugger();
    expect(a).toBe(b);
  });
});
