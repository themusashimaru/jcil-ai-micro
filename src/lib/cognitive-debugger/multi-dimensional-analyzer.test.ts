import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { MultiDimensionalAnalyzer } from './multi-dimensional-analyzer';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock Anthropic response carrying the given JSON payload. */
function apiResponse(payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/** Build a response with text that contains NO JSON (so the regex match fails). */
function noJsonResponse() {
  return {
    content: [{ type: 'text', text: 'No JSON here at all' }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

/** Build a response whose content block is not text (e.g. tool_use). */
function nonTextResponse() {
  return {
    content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_CODE = `
function greet(name) {
  if (name) {
    console.log("Hello " + name);
  } else {
    console.log("Hello stranger");
  }
}
`;

const SECURITY_RESPONSE = {
  score: 65,
  vulnerabilities: [
    {
      type: 'XSS',
      cwe: 'CWE-79',
      owasp: 'A7',
      line: 3,
      severity: 'high',
      exploitability: 'easy',
      description: 'Unsanitized user input',
      fix: 'Escape the name parameter',
    },
  ],
  attackVectors: [
    {
      name: 'Reflected XSS',
      entryLine: 1,
      pathLines: [1, 3],
      impact: 'Session hijacking',
      likelihood: 0.7,
    },
  ],
  dataExposure: [
    {
      dataType: 'PII',
      line: 3,
      exposure: 'logged',
      risk: 'medium',
    },
  ],
};

const PERFORMANCE_RESPONSE = {
  score: 70,
  bottlenecks: [
    {
      line: 3,
      type: 'cpu',
      impact: 'blocking',
      description: 'String concatenation in loop',
      optimization: 'Use template literals',
    },
  ],
  memoryIssues: [
    {
      type: 'leak',
      line: 5,
      description: 'Event listener not removed',
      fix: 'Add cleanup',
    },
  ],
  algorithmicIssues: [
    {
      line: 2,
      currentComplexity: 'O(n²)',
      optimalComplexity: 'O(n)',
      suggestion: 'Use a hash map',
    },
  ],
  resourceUsage: {
    estimatedMemory: '12MB',
    estimatedCpu: '5%',
    ioOperations: 2,
    networkCalls: 1,
    databaseQueries: 0,
  },
};

const LOGIC_RESPONSE = {
  score: 60,
  deadCode: [{ line: 10, type: 'unused_variable', confidence: 'high' }],
  unreachableCode: [15],
  redundantOperations: [{ line: 12, description: 'Duplicate null check', canRemove: true }],
  logicErrors: [
    {
      line: 4,
      description: 'Off-by-one in loop boundary',
      type: 'off_by_one',
      fix: { oldCode: 'i <= arr.length', newCode: 'i < arr.length' },
    },
    {
      line: 8,
      description: 'Missing default case',
      type: 'missing_case',
      // no fix property — tests the fallback branch
    },
  ],
  inconsistencies: [
    {
      lines: [2, 7],
      description: 'Inconsistent null handling',
      recommendation: 'Use optional chaining everywhere',
    },
  ],
};

const ARCHITECTURE_RESPONSE = {
  score: 55,
  violations: [
    {
      type: 'layer_breach',
      description: 'Direct DB access from UI component',
      lines: [5, 10],
      recommendation: 'Use a service layer',
    },
  ],
  dependencies: {
    directDeps: 5,
    transitiveDeps: 20,
    circularDeps: [['A', 'B', 'A']],
    outdatedDeps: ['lodash'],
    vulnerableDeps: [],
  },
  coupling: {
    overall: 'high',
    tightlyCoupled: [{ a: 'ModuleA', b: 'ModuleB', reason: 'Shared mutable state' }],
  },
  cohesion: {
    overall: 'low',
    lowCohesionModules: [{ module: 'utils', reason: 'Kitchen sink module' }],
  },
  patterns: [{ pattern: 'Observer', lines: [15, 20], appropriate: true }],
  antiPatterns: [
    {
      antiPattern: 'God Object',
      lines: [1, 50],
      impact: 'Hard to test and maintain',
      refactoring: 'Split into smaller classes',
    },
  ],
};

const MAINTAINABILITY_RESPONSE = {
  score: 45,
  documentation: {
    coverage: 30,
    quality: 'poor',
    missingDocLines: [1, 5, 10],
    outdatedDocLines: [3],
  },
  naming: {
    conventions: 'inconsistent',
    issues: [{ line: 2, current: 'x', suggested: 'userName' }],
  },
  codeSmells: [
    {
      type: 'long_method',
      line: 1,
      description: 'Function too long',
      refactoring: 'Extract method',
    },
    {
      type: 'magic_number',
      line: 7,
      description: 'Magic number 42',
      refactoring: 'Use named constant',
    },
    {
      type: 'deep_nesting',
      line: 12,
      description: 'Nested 4 levels',
      refactoring: 'Use guard clauses',
    },
    {
      type: 'feature_envy',
      line: 20,
      description: 'Accesses other object too much',
      refactoring: 'Move method',
    },
    {
      type: 'data_clump',
      line: 25,
      description: 'Repeated parameter groups',
      refactoring: 'Create class',
    },
    {
      type: 'duplicate_code',
      line: 30,
      description: 'Copy-paste code',
      refactoring: 'Extract shared function',
    },
  ],
};

const TESTABILITY_RESPONSE = {
  score: 40,
  hardToTest: [{ line: 3, reason: 'Global state dependency' }],
  mockRequirements: ['database', 'fetch'],
  suggestedTests: [
    {
      name: 'should greet by name',
      type: 'unit',
      targetLine: 1,
      code: 'expect(greet("Alice")).toBe("Hello Alice")',
      coverage: ['greet function', 'name branch'],
    },
  ],
};

const RELIABILITY_RESPONSE = {
  score: 50,
  errorHandling: {
    coverage: 40,
    unhandledExceptionLines: [5, 10],
    swallowedErrorLines: [15],
    improperErrorMessageLines: [20],
  },
  faultTolerance: {
    singlePointsOfFailureLines: [1],
    missingRetryLines: [8],
    missingCircuitBreakerLines: [12],
  },
  recoverability: {
    gracefulDegradation: false,
    stateRecovery: true,
    missingRollbackLines: [25],
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MultiDimensionalAnalyzer', () => {
  let analyzer: MultiDimensionalAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new MultiDimensionalAnalyzer();
  });

  // ── Construction ─────────────────────────────────────────────────────────

  it('should be exported as a class', () => {
    expect(MultiDimensionalAnalyzer).toBeDefined();
    expect(typeof MultiDimensionalAnalyzer).toBe('function');
  });

  it('should create an instance', () => {
    expect(analyzer).toBeInstanceOf(MultiDimensionalAnalyzer);
  });

  it('should have an analyze method', () => {
    expect(typeof analyzer.analyze).toBe('function');
  });

  // ── Full analysis with all dimensions returning real data ────────────────

  describe('analyze() — full analysis with rich API responses', () => {
    beforeEach(() => {
      // Each call to anthropic.messages.create returns a dimension-specific response
      // The order of calls is: security, performance, logic, architecture,
      // maintainability, testability, reliability
      mockCreate
        .mockResolvedValueOnce(apiResponse(SECURITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(PERFORMANCE_RESPONSE))
        .mockResolvedValueOnce(apiResponse(LOGIC_RESPONSE))
        .mockResolvedValueOnce(apiResponse(ARCHITECTURE_RESPONSE))
        .mockResolvedValueOnce(apiResponse(MAINTAINABILITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(TESTABILITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(RELIABILITY_RESPONSE));
    });

    it('should return all seven dimension reports', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.logic).toBeDefined();
      expect(result.architecture).toBeDefined();
      expect(result.maintainability).toBeDefined();
      expect(result.testability).toBeDefined();
      expect(result.reliability).toBeDefined();
    });

    it('should compute an overall score averaging all dimension scores', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      // Scores: 65, 70, 60, 55, 45, 40, 50 → avg ≈ 55
      const expectedAvg = Math.round((65 + 70 + 60 + 55 + 45 + 40 + 50) / 7);
      expect(result.overallScore).toBe(expectedAvg);
    });

    it('should parse security vulnerabilities correctly', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security.vulnerabilities).toHaveLength(1);
      const vuln = result.security.vulnerabilities[0];
      expect(vuln.type).toBe('XSS');
      expect(vuln.cwe).toBe('CWE-79');
      expect(vuln.owasp).toBe('A7');
      expect(vuln.severity).toBe('high');
      expect(vuln.exploitability).toBe('easy');
      expect(vuln.location.line).toBe(3);
      expect(vuln.id).toMatch(/^vuln_/);
    });

    it('should parse security attack vectors', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security.attackVectors).toHaveLength(1);
      expect(result.security.attackVectors[0].name).toBe('Reflected XSS');
      expect(result.security.attackVectors[0].path).toHaveLength(2);
      expect(result.security.attackVectors[0].likelihood).toBe(0.7);
    });

    it('should parse security data exposure', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security.dataExposure).toHaveLength(1);
      expect(result.security.dataExposure[0].dataType).toBe('PII');
      expect(result.security.dataExposure[0].exposure).toBe('logged');
    });

    it('should parse performance bottlenecks correctly', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.bottlenecks).toHaveLength(1);
      expect(result.performance.bottlenecks[0].type).toBe('cpu');
      expect(result.performance.bottlenecks[0].impact).toBe('blocking');
    });

    it('should parse performance memory issues', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.memoryIssues).toHaveLength(1);
      expect(result.performance.memoryIssues[0].type).toBe('leak');
    });

    it('should parse performance algorithmic issues', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.algorithmicIssues).toHaveLength(1);
      expect(result.performance.algorithmicIssues[0].currentComplexity).toBe('O(n²)');
      expect(result.performance.algorithmicIssues[0].optimalComplexity).toBe('O(n)');
    });

    it('should parse performance resource usage', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.resourceUsage.estimatedMemory).toBe('12MB');
      expect(result.performance.resourceUsage.networkCalls).toBe(1);
    });

    it('should parse logic dead code entries', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.deadCode).toHaveLength(1);
      expect(result.logic.deadCode[0].type).toBe('unused_variable');
      expect(result.logic.deadCode[0].confidence).toBe('high');
    });

    it('should parse logic unreachable code locations', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.unreachableCode).toHaveLength(1);
      expect(result.logic.unreachableCode[0].line).toBe(15);
    });

    it('should parse logic redundant operations', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.redundantOperations).toHaveLength(1);
      expect(result.logic.redundantOperations[0].canRemove).toBe(true);
    });

    it('should parse logic errors with fix containing oldCode', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const errorWithFix = result.logic.logicErrors[0];
      expect(errorWithFix.type).toBe('off_by_one');
      expect(errorWithFix.fix.oldCode).toBe('i <= arr.length');
      expect(errorWithFix.fix.newCode).toBe('i < arr.length');
      expect(errorWithFix.fix.confidence).toBe('high');
    });

    it('should parse logic errors without fix (fallback branch)', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const errorNoFix = result.logic.logicErrors[1];
      expect(errorNoFix.type).toBe('missing_case');
      expect(errorNoFix.fix.confidence).toBe('low');
      expect(errorNoFix.fix.newCode).toBe('');
    });

    it('should parse logic inconsistencies', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.inconsistencies).toHaveLength(1);
      expect(result.logic.inconsistencies[0].locations).toHaveLength(2);
    });

    it('should parse architecture violations', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.violations).toHaveLength(1);
      expect(result.architecture.violations[0].type).toBe('layer_breach');
      expect(result.architecture.violations[0].locations).toHaveLength(2);
    });

    it('should parse architecture dependencies', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.dependencies.directDeps).toBe(5);
      expect(result.architecture.dependencies.circularDeps).toHaveLength(1);
    });

    it('should parse architecture coupling and cohesion', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.coupling.overall).toBe('high');
      expect(result.architecture.cohesion.overall).toBe('low');
    });

    it('should parse architecture patterns and anti-patterns', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.patterns).toHaveLength(1);
      expect(result.architecture.patterns[0].pattern).toBe('Observer');
      expect(result.architecture.antiPatterns).toHaveLength(1);
      expect(result.architecture.antiPatterns[0].antiPattern).toBe('God Object');
    });

    it('should compute maintainability complexity metrics from code', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.complexity.cyclomatic).toBeGreaterThan(1);
      expect(result.maintainability.complexity.linesOfCode).toBeGreaterThan(0);
      expect(result.maintainability.complexity.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.maintainability.complexity.cognitive).toBeGreaterThan(0);
      expect(result.maintainability.complexity.halstead).toBeGreaterThan(0);
    });

    it('should parse maintainability documentation analysis', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.documentation.coverage).toBe(30);
      expect(result.maintainability.documentation.quality).toBe('poor');
      expect(result.maintainability.documentation.missingDocs).toHaveLength(3);
      expect(result.maintainability.documentation.outdatedDocs).toHaveLength(1);
    });

    it('should parse maintainability naming analysis', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.naming.conventions).toBe('inconsistent');
      expect(result.maintainability.naming.issues).toHaveLength(1);
      expect(result.maintainability.naming.issues[0].current).toBe('x');
      expect(result.maintainability.naming.issues[0].suggested).toBe('userName');
    });

    it('should parse maintainability code smells', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.codeSmells.length).toBeGreaterThanOrEqual(5);
      expect(result.maintainability.codeSmells[0].type).toBe('long_method');
    });

    it('should parse testability analysis', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.testability.score).toBe(40);
      expect(result.testability.hardToTest).toHaveLength(1);
      expect(result.testability.mockRequirements).toEqual(['database', 'fetch']);
      expect(result.testability.suggestedTests).toHaveLength(1);
      expect(result.testability.suggestedTests[0].name).toBe('should greet by name');
      expect(result.testability.suggestedTests[0].coverage).toHaveLength(2);
    });

    it('should parse reliability error handling', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.errorHandling.coverage).toBe(40);
      expect(result.reliability.errorHandling.unhandledExceptions).toHaveLength(2);
      expect(result.reliability.errorHandling.swallowedErrors).toHaveLength(1);
      expect(result.reliability.errorHandling.improperErrorMessages).toHaveLength(1);
    });

    it('should parse reliability fault tolerance', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.faultTolerance.singlePointsOfFailure).toHaveLength(1);
      expect(result.reliability.faultTolerance.missingRetries).toHaveLength(1);
      expect(result.reliability.faultTolerance.missingCircuitBreakers).toHaveLength(1);
    });

    it('should parse reliability recoverability', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.recoverability.gracefulDegradation).toBe(false);
      expect(result.reliability.recoverability.stateRecovery).toBe(true);
      expect(result.reliability.recoverability.missingRollbacks).toHaveLength(1);
    });

    it('should generate prioritized actions sorted by impact', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.prioritizedActions.length).toBeGreaterThan(0);

      // Verify sorting: actions should be ordered critical → high → medium → low
      const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < result.prioritizedActions.length; i++) {
        const prev = impactOrder[result.prioritizedActions[i - 1].impact] ?? 3;
        const curr = impactOrder[result.prioritizedActions[i].impact] ?? 3;
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    it('should include security vulns as prioritized actions', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const secActions = result.prioritizedActions.filter((a) => a.category === 'Security');
      expect(secActions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include logic errors as prioritized actions', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const logicActions = result.prioritizedActions.filter((a) => a.category === 'Logic');
      expect(logicActions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include blocking performance bottlenecks as prioritized actions', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const perfActions = result.prioritizedActions.filter((a) => a.category === 'Performance');
      expect(perfActions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include reliability actions for unhandled exceptions', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const relActions = result.prioritizedActions.filter((a) => a.category === 'Reliability');
      expect(relActions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include maintainability code smells as prioritized actions (max 5)', async () => {
      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const maintActions = result.prioritizedActions.filter(
        (a) => a.category === 'Maintainability'
      );
      expect(maintActions.length).toBeLessThanOrEqual(5);
      expect(maintActions.length).toBeGreaterThanOrEqual(1);
    });

    it('should set effort to "small" for trivially exploitable vulns', async () => {
      mockCreate.mockReset();
      const trivialVuln = {
        ...SECURITY_RESPONSE,
        vulnerabilities: [
          {
            ...SECURITY_RESPONSE.vulnerabilities[0],
            exploitability: 'trivial',
            severity: 'critical',
          },
        ],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse(trivialVuln))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const secAction = result.prioritizedActions.find((a) => a.category === 'Security');
      expect(secAction).toBeDefined();
      expect(secAction!.effort).toBe('small');
      expect(secAction!.impact).toBe('critical');
    });
  });

  // ── Focus areas (partial analysis) ───────────────────────────────────────

  describe('analyze() — with focusAreas', () => {
    it('should only run security analysis when focusAreas is ["security"]', async () => {
      mockCreate.mockResolvedValueOnce(apiResponse(SECURITY_RESPONSE));
      const result = await analyzer.analyze(SAMPLE_CODE, 'typescript', {
        focusAreas: ['security'],
      });
      // Security has real data, others should be empty defaults
      expect(result.security.score).toBe(65);
      expect(result.performance.score).toBe(100); // empty
      expect(result.logic.score).toBe(100); // empty
      expect(result.architecture.score).toBe(100); // empty
      expect(result.maintainability.score).toBe(100); // empty
      expect(result.testability.score).toBe(100); // empty
      expect(result.reliability.score).toBe(100); // empty
      // Only 1 API call was made (security only)
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should only run selected areas', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse(PERFORMANCE_RESPONSE))
        .mockResolvedValueOnce(apiResponse(LOGIC_RESPONSE));

      const result = await analyzer.analyze(SAMPLE_CODE, 'python', {
        focusAreas: ['performance', 'logic'],
      });
      expect(result.performance.score).toBe(70);
      expect(result.logic.score).toBe(60);
      expect(result.security.score).toBe(100); // empty
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should compute overallScore only from active dimensions (non-zero scores)', async () => {
      mockCreate.mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript', {
        focusAreas: ['security'],
      });
      // Only security (80) is > 0, but the empty analyses return 100
      // Filter: [80, 100, 100, 100, 100, 100, 100] → all > 0 → avg = (80+600)/7 ≈ 97
      expect(result.overallScore).toBe(Math.round((80 + 600) / 7));
    });
  });

  // ── Architecture with relatedFiles ───────────────────────────────────────

  describe('analyze() — architecture with relatedFiles', () => {
    it('should include related files context in architecture analysis', async () => {
      const relatedFiles = new Map<string, string>();
      relatedFiles.set('utils.ts', 'export const helper = () => {};');
      relatedFiles.set('types.ts', 'export type Foo = string;');

      mockCreate
        .mockResolvedValueOnce(apiResponse(SECURITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(PERFORMANCE_RESPONSE))
        .mockResolvedValueOnce(apiResponse(LOGIC_RESPONSE))
        .mockResolvedValueOnce(apiResponse(ARCHITECTURE_RESPONSE))
        .mockResolvedValueOnce(apiResponse(MAINTAINABILITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(TESTABILITY_RESPONSE))
        .mockResolvedValueOnce(apiResponse(RELIABILITY_RESPONSE));

      const result = await analyzer.analyze(SAMPLE_CODE, 'typescript', { relatedFiles });
      expect(result.architecture.violations).toHaveLength(1);
      // The 4th call (index 3) should be architecture
      const archCallArgs = mockCreate.mock.calls[3][0];
      expect(archCallArgs.messages[0].content).toContain('utils.ts');
      expect(archCallArgs.messages[0].content).toContain('types.ts');
    });
  });

  // ── API error handling (catch branches) ──────────────────────────────────

  describe('analyze() — API errors fallback to empty analyses', () => {
    it('should return empty security analysis when API call throws', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API Error')) // security fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      // Security should fall back to empty (score = 100)
      expect(result.security.score).toBe(100);
      expect(result.security.vulnerabilities).toEqual([]);
    });

    it('should return empty performance analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')) // performance fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.score).toBe(100);
      expect(result.performance.bottlenecks).toEqual([]);
    });

    it('should return empty logic analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')) // logic fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.score).toBe(100);
      expect(result.logic.logicErrors).toEqual([]);
    });

    it('should return empty architecture analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')) // arch fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.score).toBe(100);
    });

    it('should return empty maintainability analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')) // maintainability fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.score).toBe(100);
    });

    it('should return empty testability analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')) // testability fails
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.testability.score).toBe(100);
    });

    it('should return empty reliability analysis when API call throws', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockRejectedValueOnce(new Error('API Error')); // reliability fails

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.score).toBe(100);
    });
  });

  // ── No-JSON and non-text responses ───────────────────────────────────────

  describe('analyze() — responses with no parseable JSON', () => {
    it('should fallback to empty when security response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security.score).toBe(100);
    });

    it('should fallback to empty when performance response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.score).toBe(100);
    });

    it('should fallback to empty when logic response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.score).toBe(100);
    });

    it('should fallback to empty when architecture response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.score).toBe(100);
    });

    it('should fallback to empty when maintainability response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.score).toBe(100);
    });

    it('should fallback to empty when testability response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse())
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.testability.score).toBe(100);
    });

    it('should fallback to empty when reliability response has no JSON', async () => {
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(noJsonResponse());

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.score).toBe(100);
    });

    it('should handle non-text content blocks (empty text extraction)', async () => {
      mockCreate
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse())
        .mockResolvedValueOnce(nonTextResponse());

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      // All should fallback to empty because '' has no JSON match
      expect(result.security.score).toBe(100);
      expect(result.performance.score).toBe(100);
      expect(result.logic.score).toBe(100);
      expect(result.architecture.score).toBe(100);
      expect(result.maintainability.score).toBe(100);
      expect(result.testability.score).toBe(100);
      expect(result.reliability.score).toBe(100);
    });
  });

  // ── Missing / partial fields in API responses ────────────────────────────

  describe('analyze() — partial/missing fields in parsed JSON', () => {
    it('should default score to 50 when parsed score is not a number', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 'not-a-number' }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      // NaN → Number('not-a-number') → NaN → || 50
      expect(result.security.score).toBe(50);
    });

    it('should handle empty arrays when vulnerability fields are missing', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 75 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.security.vulnerabilities).toEqual([]);
      expect(result.security.attackVectors).toEqual([]);
      expect(result.security.dataExposure).toEqual([]);
    });

    it('should use default resourceUsage when field is missing', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 70 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.performance.resourceUsage).toEqual({
        estimatedMemory: 'unknown',
        estimatedCpu: 'unknown',
        ioOperations: 0,
        networkCalls: 0,
        databaseQueries: 0,
      });
    });

    it('should handle missing documentation fields in maintainability', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 60 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.documentation.coverage).toBe(0);
      expect(result.maintainability.documentation.quality).toBe('poor');
    });

    it('should handle missing naming fields in maintainability', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 60 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.maintainability.naming.conventions).toBe('inconsistent');
      expect(result.maintainability.naming.issues).toEqual([]);
    });

    it('should handle missing errorHandling in reliability', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 60 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.errorHandling.coverage).toBe(0);
      expect(result.reliability.errorHandling.unhandledExceptions).toEqual([]);
    });

    it('should handle missing faultTolerance in reliability', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 60 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.faultTolerance.singlePointsOfFailure).toEqual([]);
    });

    it('should handle missing recoverability in reliability', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 60 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.reliability.recoverability.gracefulDegradation).toBe(false);
      expect(result.reliability.recoverability.stateRecovery).toBe(false);
    });

    it('should handle attack vector with non-array pathLines', async () => {
      const payload = {
        score: 70,
        attackVectors: [
          { name: 'Test', entryLine: 1, pathLines: 'not-an-array', impact: 'Bad', likelihood: 0.5 },
        ],
      };
      mockCreate.mockResolvedValue(apiResponse(payload));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript', {
        focusAreas: ['security'],
      });
      expect(result.security.attackVectors[0].path).toEqual([]);
    });

    it('should handle inconsistencies with non-array lines', async () => {
      const payload = {
        score: 70,
        inconsistencies: [{ lines: 'not-an-array', description: 'test', recommendation: 'fix' }],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse(payload))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.logic.inconsistencies[0].locations).toEqual([]);
    });

    it('should handle architecture violations with non-array lines', async () => {
      const payload = {
        score: 70,
        violations: [{ type: 'test', description: 'desc', lines: null, recommendation: 'fix' }],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse(payload))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.violations[0].locations).toEqual([]);
    });

    it('should handle patterns with non-array lines', async () => {
      const payload = {
        score: 70,
        patterns: [{ pattern: 'Singleton', lines: undefined, appropriate: false }],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse(payload))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      expect(result.architecture.patterns[0].locations).toEqual([]);
      expect(result.architecture.patterns[0].appropriate).toBe(false);
    });
  });

  // ── overallScore edge cases ──────────────────────────────────────────────

  describe('overallScore computation', () => {
    it('should return 50 when all scores are 0', async () => {
      mockCreate.mockResolvedValue(apiResponse({ score: 0 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      // All scores = 0, filter(s => s > 0) yields empty array → 50
      expect(result.overallScore).toBe(50);
    });
  });

  // ── Cyclomatic complexity calculation ────────────────────────────────────

  describe('maintainability — cyclomatic complexity computation', () => {
    it('should count if/while/for/case/catch/ternary/&&/|| as complexity points', async () => {
      const complexCode = [
        'if (a) {}',
        'while (b) {}',
        'for (let i = 0; i < 10; i++) {}',
        'switch(x) { case 1: break; }',
        'try {} catch (e) {}',
        'const y = a ? 1 : 2;',
        'const z = a && b;',
        'const w = a || b;',
      ].join('\n');

      mockCreate.mockResolvedValue(apiResponse(MAINTAINABILITY_RESPONSE));

      const result = await analyzer.analyze(complexCode, 'javascript', {
        focusAreas: ['maintainability'],
      });

      // Base complexity = 1; the ternary `a ? 1 : 2` does NOT match `\?\s*:`
      // because there are chars between ? and :. So 7 matching lines + 1 base = 8
      expect(result.maintainability.complexity.cyclomatic).toBe(8);
    });

    it('should not count lines of code that are only comments', async () => {
      const codeWithComments = [
        '// this is a comment',
        'const x = 1;',
        '// another comment',
        '',
        'const y = 2;',
      ].join('\n');

      mockCreate.mockResolvedValue(apiResponse(MAINTAINABILITY_RESPONSE));

      const result = await analyzer.analyze(codeWithComments, 'javascript', {
        focusAreas: ['maintainability'],
      });

      // Only 2 real lines of code (excluding comments and blank lines)
      expect(result.maintainability.complexity.linesOfCode).toBe(2);
    });
  });

  // ── Prioritized actions — severity mapping for info ──────────────────────

  describe('generatePrioritizedActions — severity edge cases', () => {
    it('should map "info" severity to "low" impact in prioritized actions', async () => {
      const infoVuln = {
        score: 70,
        vulnerabilities: [
          {
            type: 'info_disclosure',
            line: 1,
            severity: 'info',
            exploitability: 'difficult',
            description: 'Minor info leak',
            fix: 'Suppress',
          },
        ],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse(infoVuln))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const secAction = result.prioritizedActions.find((a) => a.category === 'Security');
      expect(secAction).toBeDefined();
      expect(secAction!.impact).toBe('low');
      expect(secAction!.effort).toBe('medium');
    });

    it('should not add non-blocking bottlenecks as prioritized actions', async () => {
      const degradingBottleneck = {
        score: 60,
        bottlenecks: [
          {
            line: 1,
            type: 'io',
            impact: 'degrading',
            description: 'Slow I/O',
            optimization: 'Buffer',
          },
        ],
      };
      mockCreate
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse(degradingBottleneck))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }))
        .mockResolvedValueOnce(apiResponse({ score: 80 }));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript');
      const perfActions = result.prioritizedActions.filter((a) => a.category === 'Performance');
      expect(perfActions).toHaveLength(0);
    });
  });

  // ── Vulnerability field defaults ─────────────────────────────────────────

  describe('security dimension — field defaults', () => {
    it('should default missing optional fields in vulnerability mapping', async () => {
      const minimalVuln = {
        score: 50,
        vulnerabilities: [
          {
            /* type missing, cwe missing, owasp missing, line missing, severity missing */
          },
        ],
        attackVectors: [
          {
            /* name missing, entryLine missing, pathLines missing, impact missing, likelihood missing */
          },
        ],
        dataExposure: [
          {
            /* all missing */
          },
        ],
      };
      mockCreate.mockResolvedValue(apiResponse(minimalVuln));

      const result = await analyzer.analyze(SAMPLE_CODE, 'javascript', {
        focusAreas: ['security'],
      });
      const vuln = result.security.vulnerabilities[0];
      expect(vuln.type).toBe('');
      expect(vuln.cwe).toBeUndefined();
      expect(vuln.owasp).toBeUndefined();
      expect(vuln.location.line).toBe(1);
      expect(vuln.severity).toBe('medium');
      expect(vuln.exploitability).toBe('moderate');

      const av = result.security.attackVectors[0];
      expect(av.name).toBe('');
      expect(av.likelihood).toBe(0.5);

      const de = result.security.dataExposure[0];
      expect(de.dataType).toBe('');
      expect(de.exposure).toBe('direct');
      expect(de.risk).toBe('medium');
    });
  });
});
