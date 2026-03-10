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

import { CognitiveReasoningEngine } from './cognitive-reasoning-engine';

describe('CognitiveReasoningEngine', () => {
  let engine: CognitiveReasoningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new CognitiveReasoningEngine();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  it('should create an instance', () => {
    expect(engine).toBeInstanceOf(CognitiveReasoningEngine);
  });

  // ==========================================================================
  // analyze()
  // ==========================================================================

  describe('analyze', () => {
    it('should return a CognitiveAnalysis object with all fields', async () => {
      // Mock performDeepReasoning response (thinking + text)
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'thinking',
              thinking: 'thinking about the code...',
            },
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  {
                    observation: 'Variable x is declared',
                    inference: 'Simple assignment',
                    evidence: ['line 1'],
                    confidence: 'certain',
                  },
                ],
                mainConclusion: 'Simple code',
                alternativeInterpretations: ['Could be a constant'],
              }),
            },
          ],
        })
        // Mock generateHypotheses response
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  statement: 'Variable might be unused',
                  probability: 0.6,
                  supportingEvidence: ['No usage found'],
                  contradictingEvidence: [],
                  testable: true,
                  testStrategy: 'Search for usage',
                },
              ]),
            },
          ],
        })
        // Mock buildMentalModel response
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                components: [
                  {
                    name: 'x',
                    type: 'variable',
                    responsibilities: ['holds value'],
                    constraints: ['const'],
                  },
                ],
                relationships: [],
                invariants: ['x is always 1'],
                assumptions: ['x is needed'],
              }),
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('hypotheses');
      expect(result).toHaveProperty('conclusions');
      expect(result).toHaveProperty('uncertainties');
      expect(result).toHaveProperty('mentalModel');
      expect(result).toHaveProperty('recommendations');
    });

    it('should include predictions in reasoning prompt', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
        predictions: [
          {
            id: 'pred_1',
            type: 'null_reference',
            location: { file: 'test.ts', line: 1 },
            description: 'Possible null',
            probability: 0.8,
            severity: 'high',
            confidence: 'high',
            conditions: ['when x is null'],
            preventionStrategy: 'Add null check',
          },
        ],
      });

      // First call is performDeepReasoning, which should include predictions
      const firstCallArg = mockCreate.mock.calls[0][0];
      expect(firstCallArg.messages[0].content).toContain('null_reference');
    });

    it('should include userIntent in reasoning prompt', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
        userIntent: 'Sort an array of numbers',
      });

      const firstCallArg = mockCreate.mock.calls[0][0];
      expect(firstCallArg.messages[0].content).toContain('Sort an array of numbers');
    });

    it('should use fallback reasoning when API fails', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result.reasoning.steps).toHaveLength(1);
      expect(result.reasoning.confidence).toBe('low');
    });

    it('should use fallback reasoning when no JSON match found', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'No JSON here, just plain text analysis' }],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result.reasoning.confidence).toBe('low');
    });

    it('should handle empty hypotheses from API', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockRejectedValueOnce(new Error('hypothesis gen failed'))
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result.hypotheses).toEqual([]);
    });

    it('should handle empty mental model from API', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockRejectedValueOnce(new Error('mental model failed'));

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result.mentalModel).toEqual({
        components: [],
        relationships: [],
        invariants: [],
        assumptions: [],
      });
    });
  });

  // ==========================================================================
  // drawConclusions (tested indirectly through analyze)
  // ==========================================================================

  describe('conclusions from high-confidence reasoning', () => {
    it('should create conclusions from high confidence steps', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  {
                    observation: 'Missing null check',
                    inference: 'Will crash on null input',
                    evidence: ['line 5: param.name'],
                    confidence: 'certain',
                  },
                  {
                    observation: 'Performance concern',
                    inference: 'Slow loop',
                    evidence: [],
                    confidence: 'low',
                  },
                ],
                mainConclusion: 'Null safety issue',
                alternativeInterpretations: [],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'function f(param) { return param.name; }',
        language: 'javascript',
      });

      // The certain step should produce a conclusion
      const nullConclusion = result.conclusions.find((c) => c.statement.includes('crash on null'));
      expect(nullConclusion).toBeDefined();
      expect(nullConclusion?.confidence).toBe('certain');
    });

    it('should create conclusions from high-probability hypotheses', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  statement: 'Memory leak likely',
                  probability: 0.95,
                  supportingEvidence: ['No cleanup'],
                  contradictingEvidence: [],
                  testable: true,
                  testStrategy: 'Run memory profiler',
                },
                {
                  statement: 'Minor style issue',
                  probability: 0.3,
                  supportingEvidence: [],
                  contradictingEvidence: [],
                  testable: false,
                },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      const leakConclusion = result.conclusions.find((c) => c.statement.includes('Memory leak'));
      expect(leakConclusion).toBeDefined();

      // Low probability hypothesis should NOT be a conclusion
      const styleConclusion = result.conclusions.find((c) => c.statement.includes('style issue'));
      expect(styleConclusion).toBeUndefined();
    });
  });

  // ==========================================================================
  // identifyUncertainties (tested indirectly)
  // ==========================================================================

  describe('uncertainty identification', () => {
    it('should flag missing user intent as uncertainty', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
        // No userIntent provided
      });

      const intentUncertainty = result.uncertainties.find((u) => u.aspect === 'User intent');
      expect(intentUncertainty).toBeDefined();
      expect(intentUncertainty?.impact).toBe('significant');
    });

    it('should flag external dependencies as uncertainty', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const data = await fetch("/api/data");',
        language: 'javascript',
        userIntent: 'Fetch data from API',
      });

      const extUncertainty = result.uncertainties.find((u) => u.aspect === 'External dependencies');
      expect(extUncertainty).toBeDefined();
    });

    it('should include low-confidence steps as uncertainties', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  {
                    observation: 'Unclear logic',
                    inference: 'Might be intentional',
                    evidence: [],
                    confidence: 'low',
                  },
                ],
                mainConclusion: '',
                alternativeInterpretations: [],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
        userIntent: 'test',
      });

      const lowConfUncertainty = result.uncertainties.find((u) => u.aspect === 'Unclear logic');
      expect(lowConfUncertainty).toBeDefined();
    });
  });

  // ==========================================================================
  // generateRecommendations (tested indirectly)
  // ==========================================================================

  describe('recommendations', () => {
    it('should generate recommendations from conclusions with implications', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  {
                    observation: 'Critical vulnerability',
                    inference: 'Must patch immediately',
                    evidence: ['XSS at line 10'],
                    confidence: 'certain',
                  },
                ],
                mainConclusion: 'Security flaw',
                alternativeInterpretations: [],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  statement: 'Sanitization missing',
                  probability: 0.9,
                  supportingEvidence: ['No escaping of user input'],
                  contradictingEvidence: [],
                  testable: true,
                  testStrategy: 'Test with XSS payload',
                },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'element.innerHTML = userInput;',
        language: 'javascript',
        predictions: [
          {
            id: 'sec_1',
            type: 'security_vuln',
            location: { file: 'test.ts', line: 1 },
            description: 'XSS vulnerability',
            probability: 0.95,
            severity: 'critical',
            confidence: 'certain',
            conditions: ['Any user input'],
            preventionStrategy: 'Sanitize input',
          },
        ],
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should sort recommendations by priority', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  statement: 'Low priority',
                  probability: 0.7,
                  supportingEvidence: [],
                  contradictingEvidence: [],
                  testable: true,
                  testStrategy: 'test',
                },
                {
                  statement: 'High priority',
                  probability: 0.95,
                  supportingEvidence: ['Strong evidence'],
                  contradictingEvidence: [],
                  testable: true,
                  testStrategy: 'test',
                },
              ]),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      if (result.recommendations.length >= 2) {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < result.recommendations.length; i++) {
          expect(priorityOrder[result.recommendations[i].priority]).toBeGreaterThanOrEqual(
            priorityOrder[result.recommendations[i - 1].priority]
          );
        }
      }
    });
  });

  // ==========================================================================
  // explainPotentialFailure()
  // ==========================================================================

  describe('explainPotentialFailure', () => {
    it('should return an explanation string', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'This code fails because the array might be empty.',
          },
        ],
      });

      const result = await engine.explainPotentialFailure(
        'const first = arr[0].name;',
        'javascript',
        'When array is empty'
      );

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty string when API returns non-text content', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });

      const result = await engine.explainPotentialFailure('code', 'javascript', 'scenario');

      expect(result).toBe('');
    });
  });

  // ==========================================================================
  // calculateOverallConfidence (tested indirectly)
  // ==========================================================================

  describe('overall confidence calculation', () => {
    it('should return low confidence for empty steps', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"steps":[], "mainConclusion":"", "alternativeInterpretations":[]}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      // Empty steps should yield 'low' confidence
      expect(result.reasoning.confidence).toBe('low');
    });

    it('should return certain confidence for all certain steps', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                steps: [
                  { observation: 'a', inference: 'b', evidence: [], confidence: 'certain' },
                  { observation: 'c', inference: 'd', evidence: [], confidence: 'certain' },
                ],
                mainConclusion: '',
                alternativeInterpretations: [],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '[]' }],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"components":[],"relationships":[],"invariants":[],"assumptions":[]}',
            },
          ],
        });

      const result = await engine.analyze({
        code: 'const x = 1;',
        language: 'javascript',
      });

      expect(result.reasoning.confidence).toBe('certain');
    });
  });
});
