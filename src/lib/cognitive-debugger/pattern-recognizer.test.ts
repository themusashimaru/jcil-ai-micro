import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { PatternRecognizer } from './pattern-recognizer';

describe('PatternRecognizer', () => {
  let recognizer: PatternRecognizer;

  beforeEach(() => {
    vi.clearAllMocks();
    recognizer = new PatternRecognizer();

    // Default: no semantic patterns found
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  it('should create an instance', () => {
    expect(recognizer).toBeInstanceOf(PatternRecognizer);
  });

  // ==========================================================================
  // findPatterns()
  // ==========================================================================

  describe('findPatterns', () => {
    it('should detect loose equality with null (js-equality-null)', async () => {
      const code = `if (value == null) { return; }`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch).toBeDefined();
      expect(nullMatch?.location.line).toBe(1);
    });

    it('should detect async in forEach (js-async-foreach)', async () => {
      const code = `items.forEach(async (item) => {
  await processItem(item);
});`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const asyncMatch = matches.find((m) => m.pattern.id === 'js-async-foreach');
      expect(asyncMatch).toBeDefined();
    });

    it('should detect direct state mutation (js-state-mutation)', async () => {
      const code = `this.state.count = 5;`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const stateMatch = matches.find((m) => m.pattern.id === 'js-state-mutation');
      expect(stateMatch).toBeDefined();
    });

    it('should detect SQL injection pattern', async () => {
      const code = `db.query("SELECT * FROM users WHERE id = " + userId);`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const sqlMatch = matches.find((m) => m.pattern.id === 'sql-injection');
      expect(sqlMatch).toBeDefined();
      expect(sqlMatch?.pattern.severity).toBe('critical');
    });

    it('should detect type coercion equality', async () => {
      const code = `if (value == false) { return; }`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const typeMatch = matches.find((m) => m.pattern.id === 'type-coercion-equality');
      expect(typeMatch).toBeDefined();
    });

    it('should detect Python mutable default argument', async () => {
      const code = `def add_item(item, items=[]):
    items.append(item)
    return items`;
      const matches = await recognizer.findPatterns(code, 'python');

      const pyMatch = matches.find((m) => m.pattern.id === 'py-mutable-default');
      expect(pyMatch).toBeDefined();
    });

    it('should detect Python bare except', async () => {
      const code = `try:
    do_something()
except: handle_error()`;
      const matches = await recognizer.findPatterns(code, 'python');

      const pyMatch = matches.find((m) => m.pattern.id === 'py-except-bare');
      expect(pyMatch).toBeDefined();
    });

    it('should apply TypeScript patterns including JS patterns', async () => {
      const code = `if (value == null) { return; }`;
      const matches = await recognizer.findPatterns(code, 'typescript');

      // TypeScript should pick up JavaScript patterns
      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch).toBeDefined();
    });

    it('should apply universal patterns to any language', async () => {
      const code = `db.execute("DELETE FROM users WHERE id = " + userId);`;
      const matches = await recognizer.findPatterns(code, 'python');

      const sqlMatch = matches.find((m) => m.pattern.id === 'sql-injection');
      expect(sqlMatch).toBeDefined();
    });

    it('should return empty for clean code', async () => {
      const code = `const x: number = 1;
const y: number = x + 2;`;
      const matches = await recognizer.findPatterns(code, 'typescript');

      // Only semantic matches from AI (mocked to return [])
      const builtInMatches = matches.filter((m) => !m.pattern.id.startsWith('semantic_'));
      expect(builtInMatches).toHaveLength(0);
    });

    it('should respect minSeverity filter', async () => {
      const code = `if (value == null) { return; }
this.state.count = 5;`;
      const matches = await recognizer.findPatterns(code, 'javascript', {
        minSeverity: 'high',
      });

      // js-equality-null is medium severity; should be excluded
      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch).toBeUndefined();

      // js-state-mutation is high severity; should be included
      const stateMatch = matches.find((m) => m.pattern.id === 'js-state-mutation');
      expect(stateMatch).toBeDefined();
    });

    it('should include semantic patterns from AI', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                patternName: 'Off-by-one error',
                line: 3,
                description: 'Loop iterates one too many times',
                severity: 'high',
                confidence: 'high',
                fix: {
                  oldCode: 'i <= arr.length',
                  newCode: 'i < arr.length',
                  explanation: 'Use < instead of <=',
                },
              },
            ]),
          },
        ],
      });

      const code = `for (let i = 0; i <= arr.length; i++) {
  console.log(arr[i]);
}`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const semanticMatch = matches.find((m) => m.pattern.name.includes('Off-by-one'));
      expect(semanticMatch).toBeDefined();
      expect(semanticMatch?.suggestedFix).toBeDefined();
    });

    it('should handle AI semantic pattern failure gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const code = `const x = 1;`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      // Should not throw, just return regex matches
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should deduplicate matches at the same location', async () => {
      // Code that might match the same pattern twice on the same line
      const code = `if (value == null) { return value == null; }`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const nullMatches = matches.filter(
        (m) => m.pattern.id === 'js-equality-null' && m.location.line === 1
      );
      // Should deduplicate to 1
      expect(nullMatches.length).toBeLessThanOrEqual(1);
    });

    it('should include suggested fixes for automatic patterns', async () => {
      const code = `if (value == null) { return; }`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch?.suggestedFix).toBeDefined();
      expect(nullMatch?.suggestedFix?.type).toBe('replace');
    });
  });

  // ==========================================================================
  // learnPattern()
  // ==========================================================================

  describe('learnPattern', () => {
    it('should add a learned pattern', () => {
      const pattern = recognizer.learnPattern(
        'if (x = 1)',
        'if (x === 1)',
        'javascript',
        'Assignment instead of comparison'
      );

      expect(pattern.id).toMatch(/^learned_/);
      expect(pattern.name).toContain('Assignment instead');
      expect(pattern.language).toBe('javascript');
      expect(pattern.category).toBe('semantic');
      expect(pattern.examples).toHaveLength(1);
    });

    it('should make learned patterns findable via getPatterns', () => {
      recognizer.learnPattern(
        'if (x = 1)',
        'if (x === 1)',
        'javascript',
        'Assignment instead of comparison'
      );

      const allPatterns = recognizer.getPatterns();
      const learnedPattern = allPatterns.find((p) => p.id.startsWith('learned_'));
      expect(learnedPattern).toBeDefined();
    });

    it('should include learned patterns in findPatterns by default', async () => {
      recognizer.learnPattern(
        'if (x = 1)',
        'if (x === 1)',
        'javascript',
        'Assignment instead of comparison'
      );

      // Learned patterns are semantic type, so they won't match via regex
      // But they should be in the applicable patterns list
      const patterns = recognizer.getPatterns('javascript');
      const learnedPattern = patterns.find((p) => p.id.startsWith('learned_'));
      expect(learnedPattern).toBeDefined();
    });
  });

  // ==========================================================================
  // getPatterns()
  // ==========================================================================

  describe('getPatterns', () => {
    it('should return all patterns when no language specified', () => {
      const patterns = recognizer.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should filter by language', () => {
      const pyPatterns = recognizer.getPatterns('python');
      for (const p of pyPatterns) {
        expect(p.language === 'python' || p.language === 'universal').toBe(true);
      }
    });

    it('should include universal patterns for any language', () => {
      const jsPatterns = recognizer.getPatterns('javascript');
      const universalPattern = jsPatterns.find((p) => p.language === 'universal');
      expect(universalPattern).toBeDefined();
    });

    it('should include built-in and learned patterns', () => {
      recognizer.learnPattern('bad', 'good', 'javascript', 'test');
      const patterns = recognizer.getPatterns();
      const hasBuiltIn = patterns.some((p) => p.id === 'js-equality-null');
      const hasLearned = patterns.some((p) => p.id.startsWith('learned_'));
      expect(hasBuiltIn).toBe(true);
      expect(hasLearned).toBe(true);
    });
  });

  // ==========================================================================
  // addPattern()
  // ==========================================================================

  describe('addPattern', () => {
    it('should add a custom pattern', () => {
      const customPattern = {
        id: 'custom-pattern-1',
        name: 'Custom Pattern',
        description: 'A custom test pattern',
        language: 'javascript' as const,
        category: 'logic' as const,
        signature: { type: 'regex' as const, pattern: 'customBadCode' },
        severity: 'high' as const,
        frequency: 0.05,
        fix: { automatic: false, template: '', variables: [] as string[] },
        examples: [] as Array<{ bad: string; good: string; explanation: string }>,
      };

      recognizer.addPattern(customPattern);

      const patterns = recognizer.getPatterns('javascript');
      const found = patterns.find((p) => p.id === 'custom-pattern-1');
      expect(found).toBeDefined();
    });

    it('should make custom pattern findable in code', async () => {
      recognizer.addPattern({
        id: 'custom-detect-eval',
        name: 'Eval Usage',
        description: 'eval() is dangerous',
        language: 'javascript',
        category: 'security',
        signature: { type: 'regex', pattern: 'eval\\s*\\(' },
        severity: 'critical',
        frequency: 0.02,
        fix: { automatic: false, template: 'Use JSON.parse or Function instead', variables: [] },
        examples: [
          {
            bad: 'eval(userInput)',
            good: 'JSON.parse(userInput)',
            explanation: 'eval is dangerous',
          },
        ],
      });

      const code = `const result = eval(userInput);`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const evalMatch = matches.find((m) => m.pattern.id === 'custom-detect-eval');
      expect(evalMatch).toBeDefined();
      expect(evalMatch?.pattern.severity).toBe('critical');
    });
  });

  // ==========================================================================
  // UTILITY METHODS (tested indirectly)
  // ==========================================================================

  describe('severity to confidence mapping', () => {
    it('should map critical severity to certain confidence', async () => {
      const code = `db.query("SELECT * FROM users WHERE id = " + userId);`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const sqlMatch = matches.find((m) => m.pattern.id === 'sql-injection');
      expect(sqlMatch?.confidence).toBe('certain');
    });

    it('should map high severity to high confidence', async () => {
      const code = `this.state.count = 5;`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const stateMatch = matches.find((m) => m.pattern.id === 'js-state-mutation');
      expect(stateMatch?.confidence).toBe('high');
    });

    it('should map medium severity to medium confidence', async () => {
      const code = `if (value == null) { return; }`;
      const matches = await recognizer.findPatterns(code, 'javascript');

      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch?.confidence).toBe('medium');
    });
  });

  describe('meetsMinSeverity', () => {
    it('should include critical when minSeverity is critical', async () => {
      const code = `db.query("SELECT * WHERE id = " + id);`;
      const matches = await recognizer.findPatterns(code, 'javascript', {
        minSeverity: 'critical',
      });

      const sqlMatch = matches.find((m) => m.pattern.id === 'sql-injection');
      expect(sqlMatch).toBeDefined();
    });

    it('should exclude medium when minSeverity is high', async () => {
      const code = `if (value == null) { return; }`;
      const matches = await recognizer.findPatterns(code, 'javascript', {
        minSeverity: 'high',
      });

      const nullMatch = matches.find((m) => m.pattern.id === 'js-equality-null');
      expect(nullMatch).toBeUndefined();
    });
  });

  describe('antiPatterns', () => {
    it('should respect antiPatterns in pattern signature', async () => {
      // Add a pattern with antiPatterns
      recognizer.addPattern({
        id: 'test-anti-pattern',
        name: 'Test Anti Pattern',
        description: 'Test with anti-pattern exclusion',
        language: 'javascript',
        category: 'logic',
        signature: {
          type: 'regex',
          pattern: 'console\\.log',
          antiPatterns: ['DEBUG_MODE'],
        },
        severity: 'low',
        frequency: 0.1,
        fix: { automatic: false, template: '', variables: [] },
        examples: [],
      });

      // Code with the anti-pattern present - should NOT match
      const codeWithAnti = `if (DEBUG_MODE) console.log("debug");`;
      const matches = await recognizer.findPatterns(codeWithAnti, 'javascript');
      const antiMatch = matches.find((m) => m.pattern.id === 'test-anti-pattern');
      expect(antiMatch).toBeUndefined();
    });
  });
});
