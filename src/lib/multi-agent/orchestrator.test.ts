/**
 * Tests for the multi-agent orchestrator.
 *
 * Covers: planOrchestration, executeAgent, executeMultiAgent,
 *         orchestrate, orchestrateStream, shouldUseMultiAgent,
 *         getSuggestedAgents
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ───────────────────────────────────────────────

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

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
    messages: { create: mockCreate },
  })),
}));

// ── Now import the module under test ────────────────────────────

import {
  planOrchestration,
  executeAgent,
  executeMultiAgent,
  orchestrate,
  orchestrateStream,
  shouldUseMultiAgent,
  getSuggestedAgents,
} from './orchestrator';
import type { AgentContext, AgentResponse, AgentRole } from './types';

// ── Helpers ─────────────────────────────────────────────────────

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: 'u1',
    sessionId: 's1',
    ...overrides,
  };
}

function makeAnthropicTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

// ─────────────────────────────────────────────────────────────────

describe('multi-agent/orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── planOrchestration ─────────────────────────────────────────

  describe('planOrchestration()', () => {
    it('should short-circuit to reviewer for "review code" messages', async () => {
      const result = await planOrchestration('Please review my code', makeContext());
      expect(result.agents).toEqual(['reviewer']);
      expect(result.sequence).toBe('sequential');
      expect(result.reasoning).toContain('review');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].agent).toBe('reviewer');
    });

    it('should short-circuit to reviewer for "review this PR" messages', async () => {
      const result = await planOrchestration('Review this PR please', makeContext());
      expect(result.agents).toEqual(['reviewer']);
    });

    it('should short-circuit to test for "write tests" messages', async () => {
      const result = await planOrchestration('Write tests for the button', makeContext());
      expect(result.agents).toEqual(['test']);
      expect(result.sequence).toBe('sequential');
      expect(result.reasoning).toContain('test');
    });

    it('should short-circuit to test for "create tests" messages', async () => {
      const result = await planOrchestration('Create tests for login', makeContext());
      expect(result.agents).toEqual(['test']);
    });

    it('should short-circuit to test for "add test" messages', async () => {
      const result = await planOrchestration('Add test coverage for utils', makeContext());
      expect(result.agents).toEqual(['test']);
    });

    it('should call Anthropic API for complex messages and parse JSON response', async () => {
      const decision = {
        agents: ['frontend', 'backend'],
        sequence: 'parallel',
        reasoning: 'Full-stack feature',
        tasks: [
          { agent: 'frontend', instruction: 'Build UI' },
          { agent: 'backend', instruction: 'Build API' },
        ],
      };
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(decision)));

      const result = await planOrchestration('Build a dashboard with APIs', makeContext());
      expect(result.agents).toEqual(['frontend', 'backend']);
      expect(result.sequence).toBe('parallel');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle JSON wrapped in markdown code fences', async () => {
      const decision = {
        agents: ['frontend'],
        sequence: 'sequential',
        reasoning: 'UI task',
        tasks: [{ agent: 'frontend', instruction: 'Build it' }],
      };
      mockCreate.mockResolvedValueOnce(
        makeAnthropicTextResponse('```json\n' + JSON.stringify(decision) + '\n```')
      );

      const result = await planOrchestration('Build a modal dialog', makeContext());
      expect(result.agents).toEqual(['frontend']);
    });

    it('should fall back to keyword analysis when API returns invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAnthropicTextResponse('I think you should use the frontend agent.')
      );

      const result = await planOrchestration('Build a react component please', makeContext());
      // "component" and "react" are frontend keywords
      expect(result.agents).toContain('frontend');
      expect(result.reasoning).toContain('keyword');
    });

    it('should fall back to keyword analysis when Anthropic API throws', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit'));

      const result = await planOrchestration('Create an api endpoint', makeContext());
      // "api" and "endpoint" are backend keywords
      expect(result.agents).toContain('backend');
    });

    it('should fall back when agents array is empty in parsed response', async () => {
      const decision = {
        agents: [],
        sequence: 'sequential',
        reasoning: 'No agents',
        tasks: [],
      };
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(decision)));

      const result = await planOrchestration('Help me with styling and css', makeContext());
      // Falls back — "css" and "style" are frontend keywords
      expect(result.agents.length).toBeGreaterThan(0);
    });

    it('should include repo information in the prompt when provided', async () => {
      const decision = {
        agents: ['frontend'],
        sequence: 'sequential',
        reasoning: 'UI',
        tasks: [{ agent: 'frontend', instruction: 'do it' }],
      };
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(decision)));

      await planOrchestration(
        'something complex',
        makeContext({
          repo: { owner: 'acme', name: 'app', branch: 'main', fullName: 'acme/app' },
        })
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userContent = callArgs.messages[0].content;
      expect(userContent).toContain('acme/app');
    });

    it('should include file names in the prompt when provided', async () => {
      const decision = {
        agents: ['frontend'],
        sequence: 'sequential',
        reasoning: 'UI',
        tasks: [{ agent: 'frontend', instruction: 'do it' }],
      };
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(decision)));

      await planOrchestration(
        'something complex',
        makeContext({
          files: [{ path: 'src/Button.tsx', content: 'export const Button = () => {}' }],
        })
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userContent = callArgs.messages[0].content;
      expect(userContent).toContain('src/Button.tsx');
    });
  });

  // ── executeAgent ──────────────────────────────────────────────

  describe('executeAgent()', () => {
    it('should call the Anthropic API with the correct agent config', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Here is your component.'));

      const result = await executeAgent('frontend', 'Build a button', makeContext());

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-6');
      expect(callArgs.max_tokens).toBe(8192);
      expect(result.role).toBe('frontend');
      expect(result.content).toBe('Here is your component.');
      expect(result.confidence).toBe(0.85);
    });

    it('should return an error response when the API throws', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network failure'));

      const result = await executeAgent('backend', 'Create endpoint', makeContext());

      expect(result.role).toBe('backend');
      expect(result.confidence).toBe(0);
      expect(result.content).toContain('error');
    });

    it('should include repo context in the prompt when provided', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Done.'));

      await executeAgent(
        'frontend',
        'Do something',
        makeContext({
          repo: { owner: 'x', name: 'y', branch: 'dev', fullName: 'x/y' },
        })
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userMsg = callArgs.messages[callArgs.messages.length - 1].content;
      expect(userMsg).toContain('x/y');
      expect(userMsg).toContain('dev');
    });

    it('should include file contents in the prompt (truncated at 2000 chars)', async () => {
      const longContent = 'a'.repeat(3000);
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Reviewed.'));

      await executeAgent(
        'reviewer',
        'Review this',
        makeContext({
          files: [{ path: 'long.ts', content: longContent }],
        })
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userMsg = callArgs.messages[callArgs.messages.length - 1].content;
      expect(userMsg).toContain('long.ts');
      expect(userMsg).toContain('(truncated)');
    });

    it('should limit file attachments to the first 5 files', async () => {
      const files = Array.from({ length: 8 }, (_, i) => ({
        path: `file-${i}.ts`,
        content: `content-${i}`,
      }));
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Done.'));

      await executeAgent('frontend', 'Check all files', makeContext({ files }));

      const callArgs = mockCreate.mock.calls[0][0];
      const userMsg = callArgs.messages[callArgs.messages.length - 1].content;
      expect(userMsg).toContain('file-0.ts');
      expect(userMsg).toContain('file-4.ts');
      expect(userMsg).not.toContain('file-5.ts');
    });

    it('should include previous responses in the prompt', async () => {
      const prev: AgentResponse[] = [
        { role: 'frontend', content: 'Component built.', confidence: 0.9 },
      ];
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Tests written.'));

      await executeAgent('test', 'Write tests', makeContext(), prev);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMsg = callArgs.messages[callArgs.messages.length - 1].content;
      expect(userMsg).toContain('FRONTEND AGENT');
      expect(userMsg).toContain('Component built.');
    });

    it('should include conversation history as earlier messages', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Response.'));

      await executeAgent(
        'frontend',
        'Continue',
        makeContext({
          previousMessages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
          ],
        })
      );

      const callArgs = mockCreate.mock.calls[0][0];
      // 2 history messages + 1 current instruction = 3
      expect(callArgs.messages).toHaveLength(3);
      expect(callArgs.messages[0].content).toBe('Hello');
    });

    it('should limit conversation history to the last 5 messages', async () => {
      const previousMessages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg-${i}`,
      }));
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Response.'));

      await executeAgent('frontend', 'Latest', makeContext({ previousMessages }));

      const callArgs = mockCreate.mock.calls[0][0];
      // 5 history + 1 current = 6
      expect(callArgs.messages).toHaveLength(6);
      expect(callArgs.messages[0].content).toBe('msg-5');
    });

    it('should extract files from code blocks in the response', async () => {
      const responseText = [
        'Here is the code:',
        '```tsx:components/Button.tsx',
        'export const Button = () => <button>Click</button>;',
        '```',
      ].join('\n');
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(responseText));

      const result = await executeAgent('frontend', 'Build a button', makeContext());

      expect(result.files).toHaveLength(1);
      expect(result.files![0].path).toBe('components/Button.tsx');
      expect(result.files![0].language).toBe('tsx');
      expect(result.files![0].content).toContain('Button');
    });

    it('should extract files when filename is in a comment on the first line', async () => {
      const responseText = [
        'Here:',
        '```typescript',
        '// filename: utils/helpers.ts',
        'export function add(a: number, b: number) { return a + b; }',
        '```',
      ].join('\n');
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(responseText));

      const result = await executeAgent('backend', 'Create helper', makeContext());

      expect(result.files).toHaveLength(1);
      expect(result.files![0].path).toBe('utils/helpers.ts');
    });
  });

  // ── executeMultiAgent ─────────────────────────────────────────

  describe('executeMultiAgent()', () => {
    it('should execute tasks in parallel when sequence is "parallel"', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnthropicTextResponse('Frontend done'))
        .mockResolvedValueOnce(makeAnthropicTextResponse('Backend done'));

      const plan = {
        agents: ['frontend' as AgentRole, 'backend' as AgentRole],
        sequence: 'parallel' as const,
        reasoning: 'Independent',
        tasks: [
          { agent: 'frontend' as AgentRole, instruction: 'Build UI' },
          { agent: 'backend' as AgentRole, instruction: 'Build API' },
        ],
      };

      const { responses, summary } = await executeMultiAgent(plan, makeContext());

      expect(responses).toHaveLength(2);
      expect(responses[0].content).toBe('Frontend done');
      expect(responses[1].content).toBe('Backend done');
      expect(summary).toContain('Multi-Agent Summary');
      expect(summary).toContain('2');
    });

    it('should execute tasks sequentially when sequence is "sequential"', async () => {
      mockCreate
        .mockResolvedValueOnce(makeAnthropicTextResponse('First'))
        .mockResolvedValueOnce(makeAnthropicTextResponse('Second'));

      const plan = {
        agents: ['frontend' as AgentRole, 'test' as AgentRole],
        sequence: 'sequential' as const,
        reasoning: 'Dependent',
        tasks: [
          { agent: 'frontend' as AgentRole, instruction: 'Build component' },
          { agent: 'test' as AgentRole, instruction: 'Test component' },
        ],
      };

      const { responses } = await executeMultiAgent(plan, makeContext());

      expect(responses).toHaveLength(2);
      expect(responses[0].content).toBe('First');
      expect(responses[1].content).toBe('Second');

      // The second call should have received the first response as context
      const secondCallArgs = mockCreate.mock.calls[1][0];
      const userMsg = secondCallArgs.messages[secondCallArgs.messages.length - 1].content;
      expect(userMsg).toContain('FRONTEND AGENT');
    });

    it('should not generate a summary for a single-agent plan', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Done'));

      const plan = {
        agents: ['frontend' as AgentRole],
        sequence: 'sequential' as const,
        reasoning: 'Single',
        tasks: [{ agent: 'frontend' as AgentRole, instruction: 'Build it' }],
      };

      const { responses, summary } = await executeMultiAgent(plan, makeContext());

      expect(responses).toHaveLength(1);
      expect(summary).toBe('');
    });
  });

  // ── orchestrate ───────────────────────────────────────────────

  describe('orchestrate()', () => {
    it('should plan, execute, and return combined content for a review request', async () => {
      // Review request short-circuits planning, so only 1 API call for execution
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Code looks good overall.'));

      const result = await orchestrate('Review my code please', makeContext());

      expect(result.agentsUsed).toEqual(['reviewer']);
      expect(result.content).toContain('Code looks good overall.');
      expect(result.files).toEqual([]);
    });

    it('should combine multi-agent responses with agent headers', async () => {
      // Complex message that triggers API call for planning
      const planDecision = {
        agents: ['frontend', 'backend'],
        sequence: 'parallel',
        reasoning: 'Full-stack',
        tasks: [
          { agent: 'frontend', instruction: 'Build UI' },
          { agent: 'backend', instruction: 'Build API' },
        ],
      };
      mockCreate
        // Planning call
        .mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(planDecision)))
        // Frontend agent
        .mockResolvedValueOnce(makeAnthropicTextResponse('UI built.'))
        // Backend agent
        .mockResolvedValueOnce(makeAnthropicTextResponse('API built.'));

      const result = await orchestrate('Build a dashboard feature', makeContext());

      expect(result.agentsUsed).toEqual(['frontend', 'backend']);
      expect(result.content).toContain('Frontend Architect');
      expect(result.content).toContain('Backend Engineer');
      expect(result.content).toContain('UI built.');
      expect(result.content).toContain('API built.');
      expect(result.content).toContain('Multi-Agent Summary');
    });

    it('should collect files from all agent responses', async () => {
      const responseWithFile = [
        'Created:',
        '```tsx:src/Button.tsx',
        'export const Button = () => <button />;',
        '```',
      ].join('\n');

      // Short-circuit to test agent (write tests)
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(responseWithFile));

      const result = await orchestrate('Write tests for the button', makeContext());

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/Button.tsx');
    });
  });

  // ── orchestrateStream ─────────────────────────────────────────

  describe('orchestrateStream()', () => {
    it('should yield agent output for a single-agent review', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('LGTM.'));

      const chunks: string[] = [];
      for await (const chunk of orchestrateStream('Review code', makeContext())) {
        chunks.push(chunk);
      }

      // Single agent: initial status message + content
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const combined = chunks.join('');
      expect(combined).toContain('LGTM.');
    });

    it('should yield headers and a summary for multi-agent tasks', async () => {
      const planDecision = {
        agents: ['frontend', 'backend'],
        sequence: 'sequential',
        reasoning: 'Full-stack',
        tasks: [
          { agent: 'frontend', instruction: 'Build' },
          { agent: 'backend', instruction: 'Build' },
        ],
      };
      mockCreate
        .mockResolvedValueOnce(makeAnthropicTextResponse(JSON.stringify(planDecision)))
        .mockResolvedValueOnce(makeAnthropicTextResponse('UI done'))
        .mockResolvedValueOnce(makeAnthropicTextResponse('API done'));

      const chunks: string[] = [];
      for await (const chunk of orchestrateStream('Build full stack dashboard', makeContext())) {
        chunks.push(chunk);
      }

      const combined = chunks.join('');
      expect(combined).toContain('Frontend Architect');
      expect(combined).toContain('Backend Engineer');
      expect(combined).toContain('UI done');
      expect(combined).toContain('API done');
      expect(combined).toContain('agents completed');
    });

    it('should yield a single-agent status line for single-agent plans', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Tests written.'));

      const chunks: string[] = [];
      for await (const chunk of orchestrateStream('Write tests for utils', makeContext())) {
        chunks.push(chunk);
      }

      const combined = chunks.join('');
      // Single agent: "Test Engineer is working on this..."
      expect(combined).toContain('Test Engineer');
      expect(combined).toContain('Tests written.');
    });
  });

  // ── shouldUseMultiAgent ───────────────────────────────────────

  describe('shouldUseMultiAgent()', () => {
    it('should return true for messages containing "multi-agent"', () => {
      expect(shouldUseMultiAgent('Use multi-agent mode')).toBe(true);
    });

    it('should return true for messages containing "multiagent"', () => {
      expect(shouldUseMultiAgent('Enable multiagent system')).toBe(true);
    });

    it('should return true for "build a full feature"', () => {
      expect(shouldUseMultiAgent('Build a full feature for users')).toBe(true);
    });

    it('should return true for "create a complete stack"', () => {
      expect(shouldUseMultiAgent('Create a complete stack for the project')).toBe(true);
    });

    it('should return true for "build and test"', () => {
      expect(shouldUseMultiAgent('Build and test the login page')).toBe(true);
    });

    it('should return true for "create with tests"', () => {
      expect(shouldUseMultiAgent('Create the form with tests')).toBe(true);
    });

    it('should return true for "frontend and backend"', () => {
      expect(shouldUseMultiAgent('I need both frontend and backend work')).toBe(true);
    });

    it('should return true for "api and ui"', () => {
      expect(shouldUseMultiAgent('Build api and ui together')).toBe(true);
    });

    it('should return true for "build and review"', () => {
      expect(shouldUseMultiAgent('Build and review the module')).toBe(true);
    });

    it('should return false for simple single-domain messages', () => {
      expect(shouldUseMultiAgent('Fix a typo in the readme')).toBe(false);
    });

    it('should return false for a plain question', () => {
      expect(shouldUseMultiAgent('How do I use useState?')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(shouldUseMultiAgent('')).toBe(false);
    });
  });

  // ── getSuggestedAgents ────────────────────────────────────────

  describe('getSuggestedAgents()', () => {
    it('should suggest frontend for a React component message', () => {
      const agents = getSuggestedAgents('Build a React component');
      expect(agents).toContain('frontend');
    });

    it('should suggest backend for an API message', () => {
      const agents = getSuggestedAgents('Create an API endpoint');
      expect(agents).toContain('backend');
    });

    it('should suggest test for a testing message', () => {
      const agents = getSuggestedAgents('Write unit tests');
      expect(agents).toContain('test');
    });

    it('should suggest reviewer for a review message', () => {
      const agents = getSuggestedAgents('Review this code for security issues');
      expect(agents).toContain('reviewer');
    });

    it('should suggest multiple agents for messages with multiple domains', () => {
      const agents = getSuggestedAgents('Build a react component with api endpoint');
      expect(agents).toContain('frontend');
      expect(agents).toContain('backend');
    });

    it('should default to frontend when no keywords match', () => {
      const agents = getSuggestedAgents('Do something random');
      expect(agents).toEqual(['frontend']);
    });

    it('should detect CSS/style keywords as frontend', () => {
      const agents = getSuggestedAgents('Fix the CSS styling');
      expect(agents).toContain('frontend');
    });

    it('should detect database keywords as backend', () => {
      const agents = getSuggestedAgents('Create a database query for users');
      expect(agents).toContain('backend');
    });

    it('should detect "mock" as a test keyword', () => {
      const agents = getSuggestedAgents('Set up mock data');
      expect(agents).toContain('test');
    });

    it('should detect "refactor" as a review keyword', () => {
      const agents = getSuggestedAgents('Refactor the auth module');
      expect(agents).toContain('reviewer');
    });
  });

  // ── extractFilesFromResponse (indirectly tested via executeAgent) ──

  describe('file extraction (via executeAgent)', () => {
    it('should return empty files array when response has no code blocks', async () => {
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse('Just plain text, no code.'));

      const result = await executeAgent('frontend', 'Explain something', makeContext());
      expect(result.files).toEqual([]);
    });

    it('should skip code blocks without a filename', async () => {
      const text = '```typescript\nconsole.log("hi");\n```';
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(text));

      const result = await executeAgent('frontend', 'Show example', makeContext());
      expect(result.files).toEqual([]);
    });

    it('should extract multiple files from a single response', async () => {
      const text = [
        '```tsx:src/A.tsx',
        'export const A = () => <div />;',
        '```',
        'And also:',
        '```ts:src/utils.ts',
        'export const greet = () => "hello";',
        '```',
      ].join('\n');
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(text));

      const result = await executeAgent('frontend', 'Build two files', makeContext());
      expect(result.files).toHaveLength(2);
      expect(result.files![0].path).toBe('src/A.tsx');
      expect(result.files![1].path).toBe('src/utils.ts');
    });

    it('should strip the filename comment from the file content', async () => {
      const text = [
        '```typescript',
        '// filename: src/helper.ts',
        'export function helper() {}',
        '```',
      ].join('\n');
      mockCreate.mockResolvedValueOnce(makeAnthropicTextResponse(text));

      const result = await executeAgent('backend', 'Create helper', makeContext());
      expect(result.files).toHaveLength(1);
      expect(result.files![0].content).not.toContain('filename:');
      expect(result.files![0].content).toContain('export function helper');
    });
  });
});
