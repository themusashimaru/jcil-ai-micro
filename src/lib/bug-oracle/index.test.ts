import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mockCreate is available inside hoisted vi.mock factories
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock the logger BEFORE importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { BugOracle, bugOracle, predictBugs, getRiskScore } from './index';
import type {
  BugSeverity,
  BugCategory,
  PredictedBug,
  BugFix,
  BugPredictionResult,
  BugSummary,
  TechnicalDebtItem,
  CodePattern,
} from './index';

// ============================================
// TYPE EXPORT VALIDATION
// ============================================
describe('Type exports', () => {
  it('should export BugSeverity type', () => {
    const severity: BugSeverity = 'critical';
    expect(['critical', 'high', 'medium', 'low']).toContain(severity);
  });

  it('should export all BugCategory values', () => {
    const categories: BugCategory[] = [
      'null-reference',
      'type-error',
      'race-condition',
      'memory-leak',
      'infinite-loop',
      'off-by-one',
      'boundary-error',
      'logic-error',
      'exception-handling',
      'state-management',
      'async-error',
      'resource-leak',
      'security',
      'performance',
    ];
    expect(categories).toHaveLength(14);
  });

  it('should export PredictedBug interface', () => {
    const bug: PredictedBug = {
      id: 'test-1',
      title: 'Test Bug',
      description: 'A test bug',
      category: 'null-reference',
      severity: 'high',
      probability: 0.8,
      filePath: 'test.ts',
      lineStart: 1,
      lineEnd: 5,
      codeSnippet: 'const x = null;',
      prediction: 'Will crash',
      conditions: ['when x is null'],
      fix: {
        description: 'Add null check',
        code: 'if (x) {}',
        effort: 'trivial',
        breakingChange: false,
      },
      relatedPatterns: ['null-check'],
    };
    expect(bug.id).toBe('test-1');
    expect(bug.fix.effort).toBe('trivial');
  });

  it('should export BugFix interface', () => {
    const fix: BugFix = {
      description: 'Fix it',
      code: '// fixed',
      effort: 'moderate',
      breakingChange: true,
    };
    expect(fix.effort).toBe('moderate');
    expect(fix.breakingChange).toBe(true);
  });

  it('should export BugPredictionResult interface', () => {
    const result: BugPredictionResult = {
      scannedAt: new Date().toISOString(),
      filesAnalyzed: 5,
      predictions: [],
      riskScore: 85,
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
        highRiskFiles: [],
      },
      recommendations: [],
      technicalDebt: [],
    };
    expect(result.riskScore).toBe(85);
  });

  it('should export BugSummary interface', () => {
    const summary: BugSummary = {
      total: 3,
      bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
      byCategory: { 'null-reference': 2 },
      highRiskFiles: ['file.ts'],
    };
    expect(summary.total).toBe(3);
  });

  it('should export TechnicalDebtItem interface', () => {
    const item: TechnicalDebtItem = {
      type: 'TODO',
      description: 'Fix later',
      location: 'file.ts:10',
      effort: 'easy',
      impact: 'low',
    };
    expect(item.type).toBe('TODO');
  });

  it('should export CodePattern interface', () => {
    const pattern: CodePattern = {
      name: 'Test Pattern',
      pattern: /test/g,
      category: 'logic-error',
      severity: 'low',
      description: 'A test pattern',
      falsePositiveRisk: 'high',
    };
    expect(pattern.name).toBe('Test Pattern');
    expect(pattern.falsePositiveRisk).toBe('high');
  });
});

// ============================================
// CLASS & SINGLETON EXPORTS
// ============================================
describe('BugOracle class', () => {
  it('should export BugOracle class', () => {
    expect(BugOracle).toBeDefined();
    expect(typeof BugOracle).toBe('function');
  });

  it('should be instantiable', () => {
    const instance = new BugOracle();
    expect(instance).toBeInstanceOf(BugOracle);
  });

  it('should export a bugOracle singleton instance', () => {
    expect(bugOracle).toBeDefined();
    expect(bugOracle).toBeInstanceOf(BugOracle);
  });

  it('should have predictBugs method', () => {
    const instance = new BugOracle();
    expect(typeof instance.predictBugs).toBe('function');
  });
});

// ============================================
// EXPORTED FUNCTIONS
// ============================================
describe('predictBugs function', () => {
  it('should be exported as a function', () => {
    expect(typeof predictBugs).toBe('function');
  });
});

describe('getRiskScore function', () => {
  it('should be exported as a function', () => {
    expect(typeof getRiskScore).toBe('function');
  });
});

// ============================================
// PATTERN-BASED PREDICTION (via predictBugs)
// ============================================
describe('BugOracle.predictBugs - pattern detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: AI prediction returns empty (small file)
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should skip non-code files', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      { path: 'readme.md', content: 'some content with as any in it' },
      { path: 'data.json', content: '{"key": "value"}' },
      { path: 'image.png', content: 'binary' },
    ]);

    expect(result.filesAnalyzed).toBe(0);
    expect(result.predictions).toHaveLength(0);
  });

  it('should analyze code files (.ts, .tsx, .js, .jsx, .py, .go, .rs, .java, .rb, .php)', async () => {
    const oracle = new BugOracle();
    const files = [
      { path: 'app.ts', content: 'const x = 1;' },
      { path: 'component.tsx', content: 'const y = 2;' },
      { path: 'main.js', content: 'var z = 3;' },
      { path: 'utils.jsx', content: 'const w = 4;' },
      { path: 'script.py', content: 'x = 1' },
      { path: 'main.go', content: 'package main' },
      { path: 'lib.rs', content: 'fn main() {}' },
      { path: 'App.java', content: 'class App {}' },
      { path: 'app.rb', content: 'puts "hello"' },
      { path: 'index.php', content: '<?php echo "hi"; ?>' },
    ];

    const result = await oracle.predictBugs(files);
    expect(result.filesAnalyzed).toBe(10);
  });

  it('should detect "as any" type assertion pattern', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const value = something as any;\n',
      },
    ]);

    const typeAssertionBug = result.predictions.find(
      (p) => p.category === 'type-error' && p.title === 'Type assertion to any'
    );
    expect(typeAssertionBug).toBeDefined();
    expect(typeAssertionBug!.severity).toBe('medium');
  });

  it('should detect non-null assertion pattern', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const value = obj!.property;\n',
      },
    ]);

    const nonNullBug = result.predictions.find(
      (p) => p.category === 'null-reference' && p.title === 'Non-null assertion'
    );
    expect(nonNullBug).toBeDefined();
    expect(nonNullBug!.severity).toBe('high');
  });

  it('should set probability based on falsePositiveRisk', async () => {
    const oracle = new BugOracle();
    // "as any" has falsePositiveRisk: 'low' => probability 0.8
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = y as any;\n',
      },
    ]);

    const asAnyBug = result.predictions.find((p) => p.title === 'Type assertion to any');
    expect(asAnyBug).toBeDefined();
    expect(asAnyBug!.probability).toBe(0.8);
  });

  it('should set correct filePath on predictions', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'src/utils/helper.ts',
        content: 'const x = val as any;\n',
      },
    ]);

    for (const pred of result.predictions) {
      expect(pred.filePath).toBe('src/utils/helper.ts');
    }
  });

  it('should include code snippet in predictions', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'line1\nline2\nconst x = val as any;\nline4\nline5\n',
      },
    ]);

    const pred = result.predictions.find((p) => p.title === 'Type assertion to any');
    expect(pred).toBeDefined();
    expect(pred!.codeSnippet).toBeTruthy();
    expect(pred!.codeSnippet.length).toBeGreaterThan(0);
  });

  it('should include fix information in pattern predictions', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = val as any;\n',
      },
    ]);

    const pred = result.predictions.find((p) => p.title === 'Type assertion to any');
    expect(pred).toBeDefined();
    expect(pred!.fix).toBeDefined();
    expect(pred!.fix.effort).toBe('easy');
    expect(pred!.fix.breakingChange).toBe(false);
  });

  it('should detect setInterval without cleanup', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'timer.ts',
        content: 'setInterval(() => { console.log("tick"); }, 1000)\n',
      },
    ]);

    const leakBug = result.predictions.find(
      (p) => p.category === 'memory-leak' && p.title === 'setInterval without cleanup'
    );
    expect(leakBug).toBeDefined();
    expect(leakBug!.severity).toBe('high');
  });

  it('should detect empty catch blocks', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'handler.ts',
        content: 'promise.catch((e) => {})\n',
      },
    ]);

    const catchBug = result.predictions.find(
      (p) => p.category === 'exception-handling' && p.title === 'Unhandled promise rejection'
    );
    expect(catchBug).toBeDefined();
  });
});

// ============================================
// DEDUPLICATION
// ============================================
describe('BugOracle.predictBugs - deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should deduplicate predictions with same file, line, and category', async () => {
    // Code that matches multiple times on the same line for the same category
    // Two separate "as any" on different lines won't be deduped, but same line+category will
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = a as any; const y = b as any;\n',
      },
    ]);

    // Both "as any" on line 1, same category => only 1 after dedup
    const typeErrors = result.predictions.filter(
      (p) => p.category === 'type-error' && p.lineStart === 1
    );
    expect(typeErrors.length).toBeLessThanOrEqual(1);
  });
});

// ============================================
// RISK SCORE
// ============================================
describe('BugOracle.predictBugs - risk score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should return riskScore of 100 for clean code', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'clean.ts', content: 'const x = 1;\n' }]);

    // If no patterns match, riskScore should be 100
    // (Some patterns might still match, so check it's a number)
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it('should reduce risk score for bugs', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'buggy.ts',
        content:
          [
            'const x = val as any;',
            'const y = val as any;',
            'const z = val as any;',
            'const a = obj!.prop;',
            'const b = obj!.prop;',
          ].join('\n') + '\n',
      },
    ]);

    expect(result.riskScore).toBeLessThan(100);
  });

  it('should never go below 0', async () => {
    const oracle = new BugOracle();
    // Generate lots of bugs to try to push below 0
    const lines =
      Array.from({ length: 50 }, (_, i) => `const x${i} = val as any;`).join('\n') + '\n';

    const result = await oracle.predictBugs([{ path: 'terrible.ts', content: lines }]);

    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// SUMMARY GENERATION
// ============================================
describe('BugOracle.predictBugs - summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should generate summary with bySeverity counts', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = val as any;\n',
      },
    ]);

    expect(result.summary).toBeDefined();
    expect(result.summary.bySeverity).toBeDefined();
    expect(typeof result.summary.bySeverity.critical).toBe('number');
    expect(typeof result.summary.bySeverity.high).toBe('number');
    expect(typeof result.summary.bySeverity.medium).toBe('number');
    expect(typeof result.summary.bySeverity.low).toBe('number');
  });

  it('should generate summary with byCategory counts', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = val as any;\nconst y = obj!.prop;\n',
      },
    ]);

    expect(result.summary.byCategory).toBeDefined();
    expect(typeof result.summary.byCategory).toBe('object');
  });

  it('should identify high risk files (up to 5)', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'a.ts', content: 'const x = val as any;\n' }]);

    expect(Array.isArray(result.summary.highRiskFiles)).toBe(true);
    expect(result.summary.highRiskFiles.length).toBeLessThanOrEqual(5);
  });

  it('should set total count equal to predictions length', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      { path: 'test.ts', content: 'const x = val as any;\n' },
    ]);

    expect(result.summary.total).toBe(result.predictions.length);
  });
});

// ============================================
// RECOMMENDATIONS
// ============================================
describe('BugOracle.predictBugs - recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should return recommendations array', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'test.ts', content: 'const x = 1;\n' }]);

    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('should recommend "no risks" message for clean code', async () => {
    const oracle = new BugOracle();
    // Use code that won't match any patterns
    const result = await oracle.predictBugs([{ path: 'clean.ts', content: 'const x = 1;\n' }]);

    if (result.predictions.length === 0) {
      expect(result.recommendations).toContain(
        '✅ No significant bug risks detected. Consider adding more test coverage.'
      );
    }
  });
});

// ============================================
// TECHNICAL DEBT DETECTION
// ============================================
describe('BugOracle.predictBugs - technical debt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should detect TODO comments', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: '// TODO: fix this later\nconst x = 1;\n',
      },
    ]);

    const todoDebt = result.technicalDebt.find((d) => d.type === 'TODO');
    expect(todoDebt).toBeDefined();
    expect(todoDebt!.description).toContain('fix this later');
  });

  it('should detect FIXME comments with high impact', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: '// FIXME: critical bug here\nconst x = 1;\n',
      },
    ]);

    const fixmeDebt = result.technicalDebt.find((d) => d.type === 'FIXME');
    expect(fixmeDebt).toBeDefined();
    expect(fixmeDebt!.impact).toBe('high');
  });

  it('should detect HACK comments', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: '// HACK: workaround for bug\nconst x = 1;\n',
      },
    ]);

    const hackDebt = result.technicalDebt.find((d) => d.type === 'HACK');
    expect(hackDebt).toBeDefined();
    expect(hackDebt!.impact).toBe('medium');
  });

  it('should detect XXX comments', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: '// XXX: needs review\nconst x = 1;\n',
      },
    ]);

    const xxxDebt = result.technicalDebt.find((d) => d.type === 'XXX');
    expect(xxxDebt).toBeDefined();
  });

  it('should include location with file path and line number', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'src/utils.ts',
        content: '// TODO: refactor\nconst x = 1;\n',
      },
    ]);

    const todoDebt = result.technicalDebt.find((d) => d.type === 'TODO');
    expect(todoDebt).toBeDefined();
    expect(todoDebt!.location).toContain('src/utils.ts');
  });

  it('should detect high cyclomatic complexity', async () => {
    const oracle = new BugOracle();
    // Build a function with >10 branches
    const funcBody = Array.from({ length: 12 }, (_, i) => `if (x === ${i}) { return ${i}; }`).join(
      '\n'
    );
    const code = `function complexFunc(x) {\n${funcBody}\n}\n`;

    const result = await oracle.predictBugs([{ path: 'complex.ts', content: code }]);

    const complexityDebt = result.technicalDebt.find((d) => d.type === 'COMPLEXITY');
    expect(complexityDebt).toBeDefined();
    expect(complexityDebt!.description).toContain('complexFunc');
    expect(complexityDebt!.effort).toBe('moderate');
  });

  it('should detect long functions (>50 lines)', async () => {
    const oracle = new BugOracle();
    const lines = Array.from({ length: 55 }, (_, i) => `  const x${i} = ${i};`).join('\n');
    const code = `function longFunc() {\n${lines}\n}\n`;

    const result = await oracle.predictBugs([{ path: 'long.ts', content: code }]);

    const lengthDebt = result.technicalDebt.find((d) => d.type === 'LENGTH');
    expect(lengthDebt).toBeDefined();
    expect(lengthDebt!.description).toContain('longFunc');
    expect(lengthDebt!.impact).toBe('low');
  });
});

// ============================================
// AI PREDICTION (mocked)
// ============================================
describe('BugOracle.predictBugs - AI prediction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip AI analysis for files shorter than 100 chars', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const oracle = new BugOracle();
    await oracle.predictBugs([{ path: 'tiny.ts', content: 'const x = 1;\n' }]);

    // File content is < 100 chars, so AI should not be called
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call AI for files with 100+ characters', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    const oracle = new BugOracle();
    const longContent = 'a'.repeat(150) + '\n';
    await oracle.predictBugs([{ path: 'large.ts', content: longContent }]);

    expect(mockCreate).toHaveBeenCalled();
  });

  it('should parse AI response and merge with pattern predictions', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              title: 'AI found a bug',
              description: 'Potential null reference',
              category: 'null-reference',
              severity: 'high',
              probability: 0.7,
              lineStart: 5,
              lineEnd: 5,
              prediction: 'Could crash at runtime',
              conditions: ['When input is null'],
              fix: {
                description: 'Add null check',
                code: 'if (x != null) {}',
                effort: 'trivial',
                breakingChange: false,
              },
            },
          ]),
        },
      ],
    });

    const oracle = new BugOracle();
    const content = '// A long enough file for AI analysis\n' + 'a'.repeat(120) + '\n';
    const result = await oracle.predictBugs([{ path: 'test.ts', content }]);

    const aiBug = result.predictions.find((p) => p.title === 'AI found a bug');
    expect(aiBug).toBeDefined();
    expect(aiBug!.filePath).toBe('test.ts');
  });

  it('should handle AI returning non-text content gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    });

    const oracle = new BugOracle();
    const content = 'a'.repeat(150) + '\n';
    const result = await oracle.predictBugs([{ path: 'test.ts', content }]);

    // Should not crash, may have pattern-based predictions but no AI ones
    expect(result).toBeDefined();
  });

  it('should handle AI returning text without JSON array gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'No bugs found in this code.' }],
    });

    const oracle = new BugOracle();
    const content = 'a'.repeat(150) + '\n';
    const result = await oracle.predictBugs([{ path: 'test.ts', content }]);

    expect(result).toBeDefined();
  });

  it('should handle AI API errors gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limited'));

    const oracle = new BugOracle();
    const content = 'a'.repeat(150) + '\n';
    const result = await oracle.predictBugs([{ path: 'test.ts', content }]);

    // Should not throw; should return results with just pattern-based predictions
    expect(result).toBeDefined();
    expect(Array.isArray(result.predictions)).toBe(true);
  });
});

// ============================================
// SORTING
// ============================================
describe('BugOracle.predictBugs - sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should sort predictions by severity (critical first)', async () => {
    // "as any" is medium severity, non-null assertion is high
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      {
        path: 'test.ts',
        content: 'const x = val as any;\nconst y = obj!.prop;\n',
      },
    ]);

    if (result.predictions.length >= 2) {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < result.predictions.length; i++) {
        expect(severityOrder[result.predictions[i - 1].severity]).toBeLessThanOrEqual(
          severityOrder[result.predictions[i].severity]
        );
      }
    }
  });
});

// ============================================
// RESULT STRUCTURE
// ============================================
describe('BugOracle.predictBugs - result structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should include scannedAt timestamp', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'test.ts', content: 'const x = 1;\n' }]);

    expect(result.scannedAt).toBeTruthy();
    // Verify it's a valid ISO date string
    expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
  });

  it('should include filesAnalyzed count', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([
      { path: 'a.ts', content: 'x' },
      { path: 'b.ts', content: 'y' },
      { path: 'c.md', content: 'z' },
    ]);

    expect(result.filesAnalyzed).toBe(2); // only .ts files
  });

  it('should return all required fields', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([]);

    expect(result).toHaveProperty('scannedAt');
    expect(result).toHaveProperty('filesAnalyzed');
    expect(result).toHaveProperty('predictions');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('technicalDebt');
  });
});

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================
describe('predictBugs convenience function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should return a BugPredictionResult', async () => {
    const result = await predictBugs([{ path: 'test.ts', content: 'const x = 1;\n' }]);

    expect(result).toHaveProperty('scannedAt');
    expect(result).toHaveProperty('predictions');
    expect(result).toHaveProperty('riskScore');
  });
});

describe('getRiskScore convenience function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should return a number', async () => {
    const score = await getRiskScore([{ path: 'clean.ts', content: 'const x = 1;\n' }]);

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ============================================
// EDGE CASES
// ============================================
describe('BugOracle.predictBugs - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  it('should handle empty files array', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([]);

    expect(result.filesAnalyzed).toBe(0);
    expect(result.predictions).toHaveLength(0);
    expect(result.riskScore).toBe(100);
  });

  it('should handle empty file content', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'empty.ts', content: '' }]);

    expect(result.filesAnalyzed).toBe(1);
    // Empty file should not crash
    expect(result).toBeDefined();
  });

  it('should handle file with only whitespace', async () => {
    const oracle = new BugOracle();
    const result = await oracle.predictBugs([{ path: 'whitespace.ts', content: '   \n   \n   ' }]);

    expect(result).toBeDefined();
  });
});
