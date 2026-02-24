import { describe, it, expect } from 'vitest';
import {
  executeSequenceAnalyze,
  isSequenceAnalyzeAvailable,
  sequenceAnalyzeTool,
} from './sequence-analyze-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'sequence_analyze', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeSequenceAnalyze(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('sequenceAnalyzeTool metadata', () => {
  it('should have correct name', () => {
    expect(sequenceAnalyzeTool.name).toBe('sequence_analyze');
  });

  it('should require operation', () => {
    expect(sequenceAnalyzeTool.parameters.required).toContain('operation');
  });
});

describe('isSequenceAnalyzeAvailable', () => {
  it('should return true', () => {
    expect(isSequenceAnalyzeAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Analyze operation
// -------------------------------------------------------------------
describe('analyze - arithmetic progressions', () => {
  it('should detect arithmetic progression', async () => {
    const result = await getResult({ operation: 'analyze', terms: [2, 4, 6, 8, 10] });
    expect(result.pattern).toBe('arithmetic_progression');
    expect(result.arithmetic.isArithmetic).toBe(true);
    expect(result.arithmetic.commonDiff).toBe(2);
  });

  it('should detect negative arithmetic progression', async () => {
    const result = await getResult({ operation: 'analyze', terms: [10, 7, 4, 1, -2] });
    expect(result.arithmetic.isArithmetic).toBe(true);
    expect(result.arithmetic.commonDiff).toBe(-3);
  });
});

describe('analyze - geometric progressions', () => {
  it('should detect geometric progression', async () => {
    const result = await getResult({ operation: 'analyze', terms: [2, 4, 8, 16, 32] });
    expect(result.geometric.isGeometric).toBe(true);
    expect(result.geometric.commonRatio).toBe(2);
  });

  it('should detect geometric progression with ratio 3', async () => {
    const result = await getResult({ operation: 'analyze', terms: [1, 3, 9, 27, 81] });
    expect(result.geometric.isGeometric).toBe(true);
    expect(result.geometric.commonRatio).toBe(3);
  });
});

describe('analyze - polynomial patterns', () => {
  it('should detect square numbers (degree 2)', async () => {
    const result = await getResult({ operation: 'analyze', terms: [0, 1, 4, 9, 16, 25] });
    expect(result.polynomial).toBeDefined();
    expect(result.polynomial.degree).toBe(2);
  });

  it('should detect cube numbers (degree 3)', async () => {
    const result = await getResult({ operation: 'analyze', terms: [0, 1, 8, 27, 64, 125] });
    expect(result.polynomial).toBeDefined();
    expect(result.polynomial.degree).toBe(3);
  });
});

describe('analyze - known sequences', () => {
  it('should identify Fibonacci numbers', async () => {
    const result = await getResult({ operation: 'analyze', terms: [0, 1, 1, 2, 3, 5, 8, 13] });
    expect(result.known_sequences).toBeDefined();
    const names = result.known_sequences.map((s: { name: string }) => s.name);
    expect(names).toContain('Fibonacci numbers');
  });

  it('should identify prime numbers', async () => {
    const result = await getResult({ operation: 'analyze', terms: [2, 3, 5, 7, 11, 13, 17] });
    expect(result.known_sequences).toBeDefined();
    const names = result.known_sequences.map((s: { name: string }) => s.name);
    expect(names).toContain('Prime numbers');
  });

  it('should identify triangular numbers', async () => {
    const result = await getResult({ operation: 'analyze', terms: [0, 1, 3, 6, 10, 15, 21] });
    expect(result.known_sequences).toBeDefined();
    const names = result.known_sequences.map((s: { name: string }) => s.name);
    expect(names).toContain('Triangular numbers');
  });
});

describe('analyze - statistics', () => {
  it('should compute basic statistics', async () => {
    const result = await getResult({ operation: 'analyze', terms: [1, 2, 3, 4, 5] });
    expect(result.statistics.sum).toBe(15);
    expect(result.statistics.min).toBe(1);
    expect(result.statistics.max).toBe(5);
    expect(result.statistics.mean).toBe(3);
  });
});

describe('analyze - differences', () => {
  it('should compute difference table', async () => {
    const result = await getResult({ operation: 'analyze', terms: [1, 4, 9, 16, 25] });
    expect(result.differences).toBeDefined();
    expect(result.differences.length).toBeGreaterThan(0);
  });
});

describe('analyze - errors', () => {
  it('should require at least 3 terms', async () => {
    const res = await executeSequenceAnalyze(makeCall({ operation: 'analyze', terms: [1, 2] }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('at least 3');
  });
});

// -------------------------------------------------------------------
// Differences operation
// -------------------------------------------------------------------
describe('differences operation', () => {
  it('should compute differences for constant sequence', async () => {
    const result = await getResult({ operation: 'differences', terms: [5, 5, 5, 5] });
    expect(result.difference_table).toBeDefined();
    expect(result.polynomial_degree).toBe(0);
  });

  it('should compute differences for linear sequence', async () => {
    const result = await getResult({ operation: 'differences', terms: [1, 3, 5, 7, 9] });
    expect(result.difference_table).toBeDefined();
    expect(result.polynomial_degree).toBe(1);
  });

  it('should require at least 2 terms', async () => {
    const res = await executeSequenceAnalyze(makeCall({ operation: 'differences', terms: [1] }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Generate operation
// -------------------------------------------------------------------
describe('generate operation', () => {
  it('should generate sequence from formula', async () => {
    const result = await getResult({ operation: 'generate', formula: 'n*n', count: 5 });
    expect(result.terms).toEqual([0, 1, 4, 9, 16]);
  });

  it('should generate Fibonacci-like with custom start', async () => {
    const result = await getResult({ operation: 'generate', formula: 'n', count: 5, start: 3 });
    expect(result.terms).toEqual([3, 4, 5, 6, 7]);
  });

  it('should require formula', async () => {
    const res = await executeSequenceAnalyze(makeCall({ operation: 'generate' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('formula');
  });
});

// -------------------------------------------------------------------
// Partial sums operation
// -------------------------------------------------------------------
describe('partial_sums operation', () => {
  it('should compute partial sums', async () => {
    const result = await getResult({ operation: 'partial_sums', terms: [1, 2, 3, 4, 5] });
    expect(result.partial_sums).toEqual([1, 3, 6, 10, 15]);
    expect(result.total).toBe(15);
  });

  it('should handle single term', async () => {
    const result = await getResult({ operation: 'partial_sums', terms: [42] });
    expect(result.partial_sums).toEqual([42]);
    expect(result.total).toBe(42);
  });
});

// -------------------------------------------------------------------
// Identify operation
// -------------------------------------------------------------------
describe('identify operation', () => {
  it('should identify known sequence', async () => {
    const result = await getResult({ operation: 'identify', terms: [1, 2, 4, 8, 16, 32] });
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.best_match).toBeDefined();
  });

  it('should return null for unknown sequence', async () => {
    const result = await getResult({ operation: 'identify', terms: [17, 42, 99, 7, 3] });
    expect(result.best_match).toBeNull();
  });
});

// -------------------------------------------------------------------
// Extend operation
// -------------------------------------------------------------------
describe('extend operation', () => {
  it('should extend arithmetic sequence', async () => {
    const result = await getResult({ operation: 'extend', terms: [2, 4, 6, 8, 10] });
    expect(result.predictions.length).toBeGreaterThan(0);
    const arith = result.predictions.find((p: { method: string }) => p.method === 'arithmetic');
    expect(arith).toBeDefined();
    expect(arith.next_terms[0]).toBe(12);
    expect(arith.next_terms[1]).toBe(14);
  });

  it('should extend geometric sequence', async () => {
    const result = await getResult({ operation: 'extend', terms: [2, 4, 8, 16, 32] });
    const geom = result.predictions.find((p: { method: string }) => p.method === 'geometric');
    expect(geom).toBeDefined();
    expect(geom.next_terms[0]).toBe(64);
  });

  it('should require at least 3 terms', async () => {
    const res = await executeSequenceAnalyze(makeCall({ operation: 'extend', terms: [1, 2] }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('error handling', () => {
  it('should handle unknown operation', async () => {
    const res = await executeSequenceAnalyze(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown operation');
  });

  it('should return toolCallId', async () => {
    const res = await executeSequenceAnalyze({
      id: 'my-id',
      name: 'sequence_analyze',
      arguments: { operation: 'partial_sums', terms: [1, 2, 3] },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
