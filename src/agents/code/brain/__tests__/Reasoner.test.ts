// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock agentChat
const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

import { ChainOfThought, TreeOfThought, SelfReflector, Reasoner, reasoner } from '../Reasoner';
import type { ThoughtNode, ReasoningPath, SelfReflection, ReasoningResult } from '../Reasoner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStream() {
  return vi.fn();
}

function createMockIntent() {
  return {
    refinedDescription: 'Build a REST API',
    projectType: 'api',
    complexity: 'medium',
    technologies: { primary: 'Node.js' },
    requirements: { functional: ['CRUD operations', 'Auth'] },
  };
}

function createMockContext() {
  return {
    workspaceId: 'ws-1',
    userId: 'user-1',
  };
}

// ---------------------------------------------------------------------------
// ChainOfThought
// ---------------------------------------------------------------------------

describe('ChainOfThought', () => {
  let cot: ChainOfThought;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    vi.clearAllMocks();
    cot = new ChainOfThought();
    mockStream = createMockStream();
  });

  it('should be instantiable', () => {
    expect(cot).toBeDefined();
  });

  it('should allow setting a provider', () => {
    cot.setProvider('openai');
    // No error thrown
    expect(true).toBe(true);
  });

  it('should parse valid JSON thought array from AI response', async () => {
    const thoughts = [
      {
        type: 'observation',
        content: 'The API needs auth',
        confidence: 0.9,
        reasoning: 'Security',
      },
      { type: 'hypothesis', content: 'Use JWT', confidence: 0.8, reasoning: 'Standard' },
      {
        type: 'decision',
        content: 'Implement JWT auth',
        confidence: 0.85,
        reasoning: 'Best practice',
      },
    ];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    const result = await cot.reason('Add auth', 'API context', mockStream);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('thought-0');
    expect(result[0].content).toBe('The API needs auth');
    expect(result[0].type).toBe('observation');
    expect(result[0].confidence).toBe(0.9);
    expect(result[0].children).toEqual([]);
  });

  it('should stream each thought to the callback', async () => {
    const thoughts = [
      { type: 'observation', content: 'Observed X', confidence: 0.7 },
      { type: 'action', content: 'Do Y', confidence: 0.9 },
    ];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    await cot.reason('Problem', 'Context', mockStream);

    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(mockStream.mock.calls[0][0].type).toBe('thinking');
    expect(mockStream.mock.calls[0][0].message).toContain('OBSERVATION');
    expect(mockStream.mock.calls[1][0].message).toContain('ACTION');
  });

  it('should validate unknown thought types to observation', async () => {
    const thoughts = [{ type: 'unknown_type', content: 'Hmm', confidence: 0.5 }];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result[0].type).toBe('observation');
  });

  it('should default confidence to 0.5 if missing', async () => {
    const thoughts = [{ type: 'analysis', content: 'Analysis here' }];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result[0].confidence).toBe(0.5);
  });

  it('should handle response with extra text around JSON', async () => {
    const thoughts = [{ type: 'decision', content: 'Decide', confidence: 0.8 }];
    const text = `Here is my thinking:\n${JSON.stringify(thoughts)}\nEnd of thoughts.`;
    mockAgentChat.mockResolvedValue({ text });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Decide');
  });

  it('should return empty array when no JSON found in response', async () => {
    mockAgentChat.mockResolvedValue({ text: 'No JSON here at all' });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result).toEqual([]);
  });

  it('should return empty array on AI error', async () => {
    mockAgentChat.mockRejectedValue(new Error('API failure'));

    const result = await cot.reason('P', 'C', mockStream);
    expect(result).toEqual([]);
  });

  it('should handle empty thought content gracefully', async () => {
    const thoughts = [{ type: 'observation', confidence: 0.5 }];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result[0].content).toBe('');
  });

  it('should include reasoning in metadata', async () => {
    const thoughts = [
      { type: 'analysis', content: 'Check', confidence: 0.7, reasoning: 'Because security' },
    ];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    const result = await cot.reason('P', 'C', mockStream);
    expect(result[0].metadata).toEqual({ reasoning: 'Because security' });
  });

  it('should include confidence percentage in stream message', async () => {
    const thoughts = [{ type: 'hypothesis', content: 'Try X', confidence: 0.75 }];
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(thoughts) });

    await cot.reason('P', 'C', mockStream);
    expect(mockStream.mock.calls[0][0].message).toContain('75%');
  });
});

// ---------------------------------------------------------------------------
// TreeOfThought
// ---------------------------------------------------------------------------

describe('TreeOfThought', () => {
  let tot: TreeOfThought;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    vi.clearAllMocks();
    tot = new TreeOfThought();
    mockStream = createMockStream();
  });

  it('should be instantiable', () => {
    expect(tot).toBeDefined();
  });

  it('should allow setting a provider', () => {
    tot.setProvider('openai');
    expect(true).toBe(true);
  });

  it('should parse valid approach JSON from AI response', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'Microservices',
          steps: ['Split', 'Deploy'],
          pros: ['Scalable'],
          cons: ['Complex'],
          effort: 'high',
          risk: 'medium',
          score: 85,
        },
        {
          id: 'a2',
          description: 'Monolith',
          steps: ['Build'],
          pros: ['Simple'],
          cons: ['Less scalable'],
          effort: 'low',
          risk: 'low',
          score: 70,
        },
      ],
      recommendation: 'a1',
      reasoning: 'Better for scale',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const intent = createMockIntent();
    const context = createMockContext();
    const result = await tot.explore('Build API', intent, context, mockStream);

    expect(result.paths).toHaveLength(2);
    expect(result.selected.id).toBe('a1');
    expect(result.selected.description).toBe('Microservices');
    expect(result.selected.score).toBe(85);
  });

  it('should sort paths by score descending', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'Low',
          score: 40,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
        {
          id: 'a2',
          description: 'High',
          score: 90,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
        {
          id: 'a3',
          description: 'Mid',
          score: 65,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
      ],
      recommendation: 'a2',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.paths[0].score).toBe(90);
    expect(result.paths[1].score).toBe(65);
    expect(result.paths[2].score).toBe(40);
  });

  it('should stream exploration start message', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'X',
          score: 70,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(mockStream.mock.calls[0][0].message).toContain('Exploring multiple approaches');
  });

  it('should stream selected approach confirmation', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'REST API',
          score: 80,
          steps: [],
          pros: [],
          cons: [],
          effort: 'medium',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    const lastCall = mockStream.mock.calls[mockStream.mock.calls.length - 1][0];
    expect(lastCall.message).toContain('Selected');
    expect(lastCall.message).toContain('REST API');
  });

  it('should validate effort/risk levels to medium if invalid', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'X',
          score: 70,
          steps: [],
          pros: [],
          cons: [],
          effort: 'extreme',
          risk: 'impossible',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.selected.effort).toBe('medium');
    expect(result.selected.risk).toBe('medium');
  });

  it('should default score to 50 if missing', async () => {
    const response = {
      approaches: [
        { id: 'a1', description: 'X', steps: [], pros: [], cons: [], effort: 'low', risk: 'low' },
      ],
      recommendation: 'a1',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.selected.score).toBe(50);
  });

  it('should convert steps to ThoughtNodes', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'X',
          score: 80,
          steps: ['Setup', 'Implement', 'Test'],
          pros: [],
          cons: [],
          effort: 'medium',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.selected.steps).toHaveLength(3);
    expect(result.selected.steps[0].content).toBe('Setup');
    expect(result.selected.steps[0].type).toBe('action');
    expect(result.selected.steps[0].confidence).toBe(0.8);
  });

  it('should return default path on AI error', async () => {
    mockAgentChat.mockRejectedValue(new Error('API down'));

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.paths).toHaveLength(1);
    expect(result.selected.id).toBe('default');
    expect(result.selected.description).toBe('Standard implementation approach');
    expect(result.selected.score).toBe(70);
  });

  it('should return default path when no JSON in response', async () => {
    mockAgentChat.mockResolvedValue({ text: 'Some random text without JSON' });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    expect(result.selected.id).toBe('default');
  });

  it('should select first path if recommendation not found', async () => {
    const response = {
      approaches: [
        {
          id: 'a1',
          description: 'First',
          score: 90,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
        {
          id: 'a2',
          description: 'Second',
          score: 80,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
      ],
      recommendation: 'nonexistent',
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(response) });

    const result = await tot.explore('Task', createMockIntent(), createMockContext(), mockStream);
    // First by score (sorted) is a1
    expect(result.selected.description).toBe('First');
  });
});

// ---------------------------------------------------------------------------
// SelfReflector
// ---------------------------------------------------------------------------

describe('SelfReflector', () => {
  let sr: SelfReflector;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    vi.clearAllMocks();
    sr = new SelfReflector();
    mockStream = createMockStream();
  });

  it('should be instantiable', () => {
    expect(sr).toBeDefined();
  });

  it('should parse valid reflection JSON', async () => {
    const reflection = {
      strengths: ['Clean code', 'Good error handling'],
      weaknesses: ['No tests'],
      improvements: ['Add unit tests'],
      overallQuality: 75,
      shouldProceed: true,
      blockers: null,
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(reflection) });

    const result = await sr.reflect('Build API', 'const x = 1;', 'Node.js', mockStream);

    expect(result.strengths).toEqual(['Clean code', 'Good error handling']);
    expect(result.weaknesses).toEqual(['No tests']);
    expect(result.improvements).toEqual(['Add unit tests']);
    expect(result.overallQuality).toBe(75);
    expect(result.shouldProceed).toBe(true);
    expect(result.blockers).toBeUndefined();
  });

  it('should handle blockers array', async () => {
    const reflection = {
      strengths: [],
      weaknesses: ['Critical bug'],
      improvements: ['Fix it'],
      overallQuality: 20,
      shouldProceed: false,
      blockers: ['SQL injection vulnerability', 'Missing auth'],
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(reflection) });

    const result = await sr.reflect('T', 'O', 'C', mockStream);
    expect(result.shouldProceed).toBe(false);
    expect(result.blockers).toEqual(['SQL injection vulnerability', 'Missing auth']);
  });

  it('should stream reflection start message', async () => {
    mockAgentChat.mockResolvedValue({
      text: JSON.stringify({
        strengths: [],
        weaknesses: [],
        improvements: [],
        overallQuality: 50,
        shouldProceed: true,
      }),
    });

    await sr.reflect('T', 'O', 'C', mockStream);
    expect(mockStream.mock.calls[0][0].message).toContain('Self-reflecting');
  });

  it('should stream quality bar and details', async () => {
    const reflection = {
      strengths: ['Good architecture'],
      weaknesses: ['Missing validation'],
      improvements: ['Add Zod'],
      overallQuality: 80,
      shouldProceed: true,
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(reflection) });

    await sr.reflect('T', 'O', 'C', mockStream);
    const lastCall = mockStream.mock.calls[mockStream.mock.calls.length - 1][0];
    expect(lastCall.message).toContain('Quality');
    expect(lastCall.message).toContain('80%');
    expect(lastCall.message).toContain('Strengths');
    expect(lastCall.message).toContain('Weaknesses');
  });

  it('should default overallQuality to 50 if missing', async () => {
    mockAgentChat.mockResolvedValue({
      text: JSON.stringify({
        strengths: [],
        weaknesses: [],
        improvements: [],
        shouldProceed: true,
      }),
    });

    const result = await sr.reflect('T', 'O', 'C', mockStream);
    expect(result.overallQuality).toBe(50);
  });

  it('should return fallback reflection on AI error', async () => {
    mockAgentChat.mockRejectedValue(new Error('API error'));

    const result = await sr.reflect('T', 'O', 'C', mockStream);
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toContain('Unable to complete self-reflection');
    expect(result.overallQuality).toBe(50);
    expect(result.shouldProceed).toBe(true);
  });

  it('should handle non-JSON response gracefully', async () => {
    mockAgentChat.mockResolvedValue({ text: 'Just plain text, no JSON' });

    const result = await sr.reflect('T', 'O', 'C', mockStream);
    // Falls back to error handler
    expect(result.shouldProceed).toBe(true);
    expect(result.overallQuality).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Reasoner (main orchestrator)
// ---------------------------------------------------------------------------

describe('Reasoner', () => {
  let r: Reasoner;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    vi.clearAllMocks();
    r = new Reasoner();
    mockStream = createMockStream();
  });

  it('should be instantiable', () => {
    expect(r).toBeDefined();
  });

  it('should allow setting provider on all sub-reasoners', () => {
    r.setProvider('openai');
    // No throw = success
    expect(true).toBe(true);
  });

  it('should run full reasoning pipeline', async () => {
    // Mock CoT response
    const cotThoughts = [
      { type: 'observation', content: 'Need REST endpoints', confidence: 0.8 },
      { type: 'decision', content: 'Use Express', confidence: 0.9 },
    ];

    // Mock ToT response
    const totResponse = {
      approaches: [
        {
          id: 'a1',
          description: 'Express',
          score: 85,
          steps: ['Setup', 'Routes'],
          pros: ['Fast'],
          cons: ['Verbose'],
          effort: 'medium',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };

    // First call = CoT, second call = ToT
    mockAgentChat
      .mockResolvedValueOnce({ text: JSON.stringify(cotThoughts) })
      .mockResolvedValueOnce({ text: JSON.stringify(totResponse) });

    const intent = createMockIntent();
    const context = createMockContext();
    const result = await r.reason('Build API', intent, context, mockStream);

    expect(result.selectedPath).toBeDefined();
    expect(result.selectedPath.description).toBe('Express');
    expect(result.chainOfThought).toHaveLength(2);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.selfReflection).toBeDefined();
  });

  it('should calculate confidence from CoT and ToT scores', async () => {
    const cotThoughts = [
      { type: 'observation', content: 'A', confidence: 0.8 },
      { type: 'decision', content: 'B', confidence: 1.0 },
    ];
    const totResponse = {
      approaches: [
        {
          id: 'a1',
          description: 'X',
          score: 80,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat
      .mockResolvedValueOnce({ text: JSON.stringify(cotThoughts) })
      .mockResolvedValueOnce({ text: JSON.stringify(totResponse) });

    const result = await r.reason('T', createMockIntent(), createMockContext(), mockStream);

    // avgThoughtConfidence = (0.8 + 1.0) / 2 = 0.9
    // confidence = (0.9 + 80/100) / 2 = (0.9 + 0.8) / 2 = 0.85
    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it('should identify low-confidence thoughts as uncertainties', async () => {
    const cotThoughts = [
      { type: 'observation', content: 'Sure thing', confidence: 0.9 },
      { type: 'hypothesis', content: 'Not sure about this', confidence: 0.3 },
      { type: 'analysis', content: 'Uncertain approach', confidence: 0.5 },
    ];
    const totResponse = {
      approaches: [
        {
          id: 'a1',
          description: 'X',
          score: 70,
          steps: [],
          pros: [],
          cons: [],
          effort: 'low',
          risk: 'low',
        },
      ],
      recommendation: 'a1',
    };
    mockAgentChat
      .mockResolvedValueOnce({ text: JSON.stringify(cotThoughts) })
      .mockResolvedValueOnce({ text: JSON.stringify(totResponse) });

    const result = await r.reason('T', createMockIntent(), createMockContext(), mockStream);

    // Uncertainties = thoughts with confidence < 0.6
    expect(result.uncertainties).toContain('Not sure about this');
    expect(result.uncertainties).toContain('Uncertain approach');
    expect(result.uncertainties).not.toContain('Sure thing');
  });

  it('should delegate reflect to SelfReflector', async () => {
    const reflection = {
      strengths: ['Good'],
      weaknesses: [],
      improvements: [],
      overallQuality: 90,
      shouldProceed: true,
    };
    mockAgentChat.mockResolvedValue({ text: JSON.stringify(reflection) });

    const result = await r.reflect('Task', 'Output', 'Context', mockStream);
    expect(result.overallQuality).toBe(90);
    expect(result.shouldProceed).toBe(true);
  });

  it('should handle CoT failure gracefully in pipeline', async () => {
    mockAgentChat.mockRejectedValueOnce(new Error('CoT failed')).mockResolvedValueOnce({
      text: JSON.stringify({
        approaches: [
          {
            id: 'a1',
            description: 'Fallback',
            score: 60,
            steps: [],
            pros: [],
            cons: [],
            effort: 'low',
            risk: 'low',
          },
        ],
        recommendation: 'a1',
      }),
    });

    const result = await r.reason('T', createMockIntent(), createMockContext(), mockStream);
    expect(result.chainOfThought).toEqual([]);
    expect(result.selectedPath).toBeDefined();
    // With empty thoughts, avgConfidence defaults to 0.5
    expect(result.confidence).toBe((0.5 + 0.6) / 2);
  });
});

// ---------------------------------------------------------------------------
// Exported singleton
// ---------------------------------------------------------------------------

describe('reasoner singleton', () => {
  it('should be an instance of Reasoner', () => {
    expect(reasoner).toBeInstanceOf(Reasoner);
  });
});
