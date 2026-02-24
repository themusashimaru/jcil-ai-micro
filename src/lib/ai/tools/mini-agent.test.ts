import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMiniAgent, miniAgentTool } from './mini-agent';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock safety
vi.mock('./safety', () => ({
  canExecuteTool: vi.fn().mockReturnValue({ allowed: true }),
  recordToolCost: vi.fn(),
  CHAT_COST_LIMITS: {
    maxCostPerSession: Infinity,
    maxCostPerTool: Infinity,
    maxToolCallsPerSession: 1000,
    maxMiniAgents: 5,
  },
}));

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'mini-1', name: 'parallel_research', arguments: args, sessionId: 'test-session' };
}

function mockAnthropicResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  });
}

beforeEach(() => {
  mockCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('miniAgentTool metadata', () => {
  it('should have correct name', () => {
    expect(miniAgentTool.name).toBe('parallel_research');
  });

  it('should require question', () => {
    expect(miniAgentTool.parameters.required).toContain('question');
  });

  it('should have depth enum', () => {
    const props = miniAgentTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.depth.enum).toContain('quick');
    expect(props.depth.enum).toContain('standard');
    expect(props.depth.enum).toContain('thorough');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeMiniAgent - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeMiniAgent({
      id: 'x',
      name: 'wrong_tool',
      arguments: { question: 'test' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error when no question provided', async () => {
    const res = await executeMiniAgent(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No question');
  });

  it('should return toolCallId', async () => {
    const res = await executeMiniAgent(makeCall({}));
    expect(res.toolCallId).toBe('mini-1');
  });
});

// -------------------------------------------------------------------
// Cost control
// -------------------------------------------------------------------
describe('executeMiniAgent - cost control', () => {
  it('should reject when cost budget exceeded', async () => {
    const { canExecuteTool } = await import('./safety');
    (canExecuteTool as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: false,
      reason: 'Budget exceeded',
    });
    const res = await executeMiniAgent(makeCall({ question: 'What is AI?' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Budget exceeded');
  });
});

// -------------------------------------------------------------------
// Successful execution with provided aspects
// -------------------------------------------------------------------
describe('executeMiniAgent - with aspects', () => {
  it('should run research with provided aspects', async () => {
    // With provided aspects, it skips auto-planning.
    // Each agent call (2 agents) + synthesis = 3 Anthropic calls

    // Agent 1 response
    mockAnthropicResponse('AI is used in healthcare for diagnosis and drug discovery.');
    // Agent 2 response
    mockAnthropicResponse('AI in education enables personalized learning.');
    // Synthesis response
    mockAnthropicResponse(
      'AI has transformative applications in both healthcare (diagnosis, drug discovery) and education (personalized learning).'
    );

    const res = await executeMiniAgent(
      makeCall({
        question: 'How does AI impact society?',
        aspects: ['Healthcare applications', 'Education applications'],
        num_agents: 2,
      })
    );

    expect(res.isError).toBe(false);
    expect(res.content).toContain('Parallel Research Complete');
    expect(res.content).toContain('2/2 agents succeeded');
    expect(res.content).toContain('healthcare');
  });
});

// -------------------------------------------------------------------
// Auto-planning flow
// -------------------------------------------------------------------
describe('executeMiniAgent - auto-planning', () => {
  it('should auto-plan agents when no aspects provided', async () => {
    // Plan response (generates agent plans)
    mockAnthropicResponse(
      JSON.stringify([
        {
          id: 'agent_1',
          focus: 'Environmental impact',
          searchQueries: ['climate change solutions'],
          expectedOutput: 'Research on environmental impact',
        },
        {
          id: 'agent_2',
          focus: 'Economic impact',
          searchQueries: ['economic implications'],
          expectedOutput: 'Research on economic impact',
        },
      ])
    );

    // Agent 1
    mockAnthropicResponse('Environmental findings here.');
    // Agent 2
    mockAnthropicResponse('Economic findings here.');
    // Synthesis
    mockAnthropicResponse('Combined analysis of environmental and economic impacts.');

    const res = await executeMiniAgent(
      makeCall({ question: 'What are the impacts of renewable energy?', num_agents: 2 })
    );

    expect(res.isError).toBe(false);
    expect(res.content).toContain('Parallel Research Complete');
  });
});

// -------------------------------------------------------------------
// Agent failures
// -------------------------------------------------------------------
describe('executeMiniAgent - agent failures', () => {
  it('should handle all agents failing', async () => {
    // Planning
    mockAnthropicResponse(
      JSON.stringify([
        { id: 'agent_1', focus: 'test', searchQueries: ['q1'], expectedOutput: 'x' },
        { id: 'agent_2', focus: 'test2', searchQueries: ['q2'], expectedOutput: 'x' },
      ])
    );

    // Both agents fail
    mockCreate.mockRejectedValueOnce(new Error('API error 1'));
    mockCreate.mockRejectedValueOnce(new Error('API error 2'));

    const res = await executeMiniAgent(makeCall({ question: 'failing question', num_agents: 2 }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('All research agents failed');
  });

  it('should handle partial agent success', async () => {
    // Planning with aspects (skip auto-plan)
    // Agent 1 succeeds
    mockAnthropicResponse('Success findings.');
    // Agent 2 fails
    mockCreate.mockRejectedValueOnce(new Error('Agent 2 failed'));
    // Synthesis
    mockAnthropicResponse('Partial synthesis based on available findings.');

    const res = await executeMiniAgent(
      makeCall({
        question: 'Test partial',
        aspects: ['Aspect 1', 'Aspect 2'],
        num_agents: 2,
      })
    );

    expect(res.isError).toBe(false);
    expect(res.content).toContain('1/2 agents succeeded');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeMiniAgent - errors', () => {
  it('should handle planning failure gracefully', async () => {
    // Planning call fails
    mockCreate.mockRejectedValueOnce(new Error('Planning failed'));

    const res = await executeMiniAgent(makeCall({ question: 'test question', num_agents: 2 }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Planning failed');
  });

  it('should handle synthesis failure', async () => {
    // With aspects (skip planning)
    // Agent 1 succeeds
    mockAnthropicResponse('Findings here.');
    // Agent 2 succeeds
    mockAnthropicResponse('More findings.');
    // Synthesis fails
    mockCreate.mockRejectedValueOnce(new Error('Synthesis API error'));

    const res = await executeMiniAgent(
      makeCall({
        question: 'Test synthesis failure',
        aspects: ['A1', 'A2'],
        num_agents: 2,
      })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('synthesis failed');
  });
});
