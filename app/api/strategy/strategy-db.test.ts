// @ts-nocheck - Test file with extensive mocking
/**
 * STRATEGY DB TESTS
 *
 * Tests for strategy-db.ts:
 * - createSessionInDB: session creation with UUID, attachments, mode
 * - updateSessionPhase: phase transitions, completed_at timestamps
 * - storeProblemData: problem summary and data persistence
 * - getProblemData: retrieval and null handling
 * - storeIntakeMessages / getIntakeMessages: message persistence
 * - storeFinding: finding insertion with sources
 * - storeResultAndUsage: result + usage + token tracking
 * - addUserContext: appending context messages
 * - storeEvent / getStoredEvents: event storage and replay
 * - getSessionFromDB: session retrieval
 * - isUserAdmin: admin check
 * - getUserPlanKey: subscription tier lookup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Finding } from '@/agents/strategy';

// ============================================================================
// MOCKS — Must be defined before imports
// ============================================================================

// Mock chain builder for untypedFrom
const _mockChain = {
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: 'db-uuid-123' }, error: null }),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(() => ({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'db-uuid-123' }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/usage/track', () => ({
  trackTokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
  };
});

import {
  createSessionInDB,
  updateSessionPhase,
  storeProblemData,
  getProblemData,
  storeIntakeMessages,
  getIntakeMessages,
  storeFinding,
  storeResultAndUsage,
  addUserContext,
  storeEvent,
  getStoredEvents,
  getSessionFromDB,
  isUserAdmin,
  getUserPlanKey,
} from './strategy-db';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { trackTokenUsage } from '@/lib/usage/track';

// ============================================================================
// HELPERS
// ============================================================================

function createMockSupabase() {
  return {
    from: vi.fn(),
  } as ReturnType<typeof import('@/lib/supabase/client').createServerClient>;
}

function _buildChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'db-uuid-123' }, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  Object.assign(chain, overrides);
  return chain;
}

// ============================================================================
// TESTS
// ============================================================================

describe('strategy-db', () => {
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabase();
  });

  // --------------------------------------------------------------------------
  // createSessionInDB
  // --------------------------------------------------------------------------
  describe('createSessionInDB', () => {
    it('should create a session and return the db id', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'db-uuid-123' }, error: null }),
        }),
      });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await createSessionInDB(supabase, 'user-1', 'sess-1');
      expect(result).toBe('db-uuid-123');
      expect(untypedFrom).toHaveBeenCalledWith(supabase, 'strategy_sessions');
    });

    it('should pass attachments mapped without content', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'db-1' }, error: null }),
        }),
      });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      const attachments = [
        { id: 'a1', name: 'file.pdf', type: 'application/pdf', size: 1024, content: 'base64data' },
      ];
      await createSessionInDB(supabase, 'user-1', 'sess-1', attachments, 'research');

      const insertArg = insertMock.mock.calls[0][0];
      expect(insertArg.mode).toBe('research');
      expect(insertArg.attachments).toEqual([
        { id: 'a1', name: 'file.pdf', type: 'application/pdf', size: 1024 },
      ]);
      // Content should NOT be included in stored attachments
      expect(insertArg.attachments[0]).not.toHaveProperty('content');
    });

    it('should default mode to strategy when not provided', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'db-1' }, error: null }),
        }),
      });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      await createSessionInDB(supabase, 'user-1', 'sess-1');
      const insertArg = insertMock.mock.calls[0][0];
      expect(insertArg.mode).toBe('strategy');
      expect(insertArg.phase).toBe('intake');
      expect(insertArg.attachments).toEqual([]);
    });

    it('should throw on database error', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate key' },
          }),
        }),
      });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      await expect(createSessionInDB(supabase, 'user-1', 'sess-1')).rejects.toThrow(
        'Failed to create session: duplicate key'
      );
    });
  });

  // --------------------------------------------------------------------------
  // updateSessionPhase
  // --------------------------------------------------------------------------
  describe('updateSessionPhase', () => {
    it('should update session phase', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      await updateSessionPhase(supabase, 'sess-1', 'executing');
      expect(updateMock).toHaveBeenCalledWith({ phase: 'executing' });
      expect(eqMock).toHaveBeenCalledWith('session_id', 'sess-1');
    });

    it('should set completed_at for terminal phases', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      for (const phase of ['complete', 'cancelled', 'error'] as const) {
        await updateSessionPhase(supabase, 'sess-1', phase);
        const updateArg = updateMock.mock.lastCall![0];
        expect(updateArg.phase).toBe(phase);
        expect(updateArg.completed_at).toBeDefined();
        expect(typeof updateArg.completed_at).toBe('string');
      }
    });

    it('should NOT set completed_at for non-terminal phases', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      await updateSessionPhase(supabase, 'sess-1', 'intake');
      const updateArg = updateMock.mock.calls[0][0];
      expect(updateArg.completed_at).toBeUndefined();
    });

    it('should merge additionalData into the update', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      await updateSessionPhase(supabase, 'sess-1', 'executing', { total_agents: 5 });
      const updateArg = updateMock.mock.calls[0][0];
      expect(updateArg.phase).toBe('executing');
      expect(updateArg.total_agents).toBe(5);
    });

    it('should not throw on database error (logs only)', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'connection lost' } });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      // Should not throw
      await expect(updateSessionPhase(supabase, 'sess-1', 'error')).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // storeProblemData / getProblemData
  // --------------------------------------------------------------------------
  describe('storeProblemData', () => {
    it('should store problem summary and data', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      const problemData = { rawInput: 'test problem', clarifyingResponses: [] };
      await storeProblemData(supabase, 'sess-1', 'Summary of problem', problemData);

      expect(updateMock).toHaveBeenCalledWith({
        problem_summary: 'Summary of problem',
        problem_data: problemData,
      });
    });
  });

  describe('getProblemData', () => {
    it('should return problem_data when available', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { problem_data: { rawInput: 'my problem' } },
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getProblemData(supabase, 'sess-1');
      expect(result).toEqual({ rawInput: 'my problem' });
    });

    it('should return null on error', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getProblemData(supabase, 'sess-1');
      expect(result).toBeNull();
    });

    it('should return null when problem_data is falsy', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { problem_data: null },
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getProblemData(supabase, 'sess-1');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // storeIntakeMessages / getIntakeMessages
  // --------------------------------------------------------------------------
  describe('storeIntakeMessages', () => {
    it('should store messages array', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ update: updateMock } as ReturnType<
        typeof untypedFrom
      >);

      const messages = [
        { role: 'user' as const, content: 'I need help' },
        { role: 'assistant' as const, content: 'Tell me more' },
      ];
      await storeIntakeMessages(supabase, 'sess-1', messages);

      expect(updateMock).toHaveBeenCalledWith({ intake_messages: messages });
    });
  });

  describe('getIntakeMessages', () => {
    it('should return messages when available', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      const singleMock = vi.fn().mockResolvedValue({
        data: { intake_messages: messages },
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getIntakeMessages(supabase, 'sess-1');
      expect(result).toEqual(messages);
    });

    it('should return null on error', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'fail' },
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getIntakeMessages(supabase, 'sess-1');
      expect(result).toBeNull();
    });

    it('should return empty array when intake_messages is falsy', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { intake_messages: null },
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getIntakeMessages(supabase, 'sess-1');
      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // storeFinding
  // --------------------------------------------------------------------------
  describe('storeFinding', () => {
    it('should insert a finding with source URL', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      const finding: Finding = {
        id: 'f-1',
        agentId: 'agent-1',
        agentName: 'Housing Scout',
        type: 'fact',
        title: 'Average rent in JC',
        content: '$2500/month',
        confidence: 'high',
        sources: [
          {
            title: 'Zillow',
            url: 'https://zillow.com',
            type: 'web',
            accessedAt: 1000,
            reliability: 'high',
          },
        ],
        timestamp: Date.now(),
        relevanceScore: 0.9,
      };

      await storeFinding(supabase, 'db-sess-1', finding);

      expect(untypedFrom).toHaveBeenCalledWith(supabase, 'strategy_findings');
      expect(insertMock).toHaveBeenCalledWith({
        session_id: 'db-sess-1',
        title: 'Average rent in JC',
        content: '$2500/month',
        source_url: 'https://zillow.com',
        agent_name: 'Housing Scout',
        confidence: 'high',
        category: 'fact',
      });
    });

    it('should handle finding with no sources', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      const finding: Finding = {
        id: 'f-2',
        agentId: 'agent-2',
        agentName: 'Finance Scout',
        type: 'insight',
        title: 'Tax analysis',
        content: 'Lower taxes in NJ',
        confidence: 'medium',
        sources: [],
        timestamp: Date.now(),
        relevanceScore: 0.7,
      };

      await storeFinding(supabase, 'db-sess-1', finding);
      expect(insertMock.mock.calls[0][0].source_url).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // storeResultAndUsage
  // --------------------------------------------------------------------------
  describe('storeResultAndUsage', () => {
    const mockResult = {
      id: 'result-1',
      problem: {} as import('@/agents/strategy').StrategyOutput['problem'],
      recommendation: {} as import('@/agents/strategy').StrategyOutput['recommendation'],
      alternatives: [],
      analysis: {
        byDomain: [],
        riskAssessment: { overallRisk: 'low' as const, risks: [], mitigations: [] },
      },
      actionPlan: [],
      gaps: [],
      nextSteps: [],
      metadata: {
        executionTime: 60000,
        totalAgents: 5,
        totalSearches: 20,
        totalCost: 1.5,
        confidenceScore: 85,
        completedAt: Date.now(),
        modelUsage: {
          opus: { calls: 2, tokens: 1000 },
          sonnet: { calls: 10, tokens: 5000 },
          haiku: { calls: 0, tokens: 0 },
        },
        qualityScore: 90,
      },
    } as import('@/agents/strategy').StrategyOutput;

    it('should store result in strategy_sessions and usage in strategy_usage', async () => {
      const sessionEqMock = vi.fn().mockResolvedValue({ error: null });
      const sessionUpdateMock = vi.fn().mockReturnValue({ eq: sessionEqMock });
      const usageInsertMock = vi.fn().mockResolvedValue({ error: null });

      const _callCount = 0;
      vi.mocked(untypedFrom).mockImplementation((_supabase, table) => {
        if (table === 'strategy_sessions') {
          return { update: sessionUpdateMock } as ReturnType<typeof untypedFrom>;
        }
        if (table === 'strategy_usage') {
          return { insert: usageInsertMock } as ReturnType<typeof untypedFrom>;
        }
        return {} as ReturnType<typeof untypedFrom>;
      });

      await storeResultAndUsage(supabase, 'sess-1', 'db-sess-1', 'user-1', mockResult);

      // Session update
      expect(sessionUpdateMock).toHaveBeenCalled();
      const sessionArg = sessionUpdateMock.mock.calls[0][0];
      expect(sessionArg.phase).toBe('complete');
      expect(sessionArg.total_agents).toBe(5);
      expect(sessionArg.total_searches).toBe(20);
      expect(sessionArg.total_cost).toBe(1.5);

      // Usage insert
      expect(usageInsertMock).toHaveBeenCalledWith({
        user_id: 'user-1',
        session_id: 'db-sess-1',
        opus_tokens: 1000,
        sonnet_tokens: 5000,
        haiku_tokens: 0,
        brave_searches: 20,
        total_cost: 1.5,
      });
    });

    it('should track opus and sonnet tokens but skip haiku when 0', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(untypedFrom).mockImplementation((_supabase, table) => {
        if (table === 'strategy_sessions')
          return { update: updateMock } as ReturnType<typeof untypedFrom>;
        return { insert: insertMock } as ReturnType<typeof untypedFrom>;
      });

      await storeResultAndUsage(supabase, 'sess-1', 'db-sess-1', 'user-1', mockResult);

      // Should call trackTokenUsage for opus and sonnet (tokens > 0), but not haiku (0)
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'claude-opus-4-6',
          inputTokens: 1000,
          source: 'strategy',
        })
      );
      expect(vi.mocked(trackTokenUsage)).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'claude-opus-4-6',
          inputTokens: 5000,
          source: 'strategy',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // addUserContext
  // --------------------------------------------------------------------------
  describe('addUserContext', () => {
    it('should append message to existing context', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { user_context: ['first message'] },
        error: null,
      });
      const selectEqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });

      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      let callCount = 0;
      vi.mocked(untypedFrom).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: selectMock } as ReturnType<typeof untypedFrom>;
        }
        return { update: updateMock } as ReturnType<typeof untypedFrom>;
      });

      await addUserContext(supabase, 'sess-1', 'second message');

      expect(updateMock).toHaveBeenCalledWith({
        user_context: ['first message', 'second message'],
      });
    });

    it('should create new context array when none exists', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { user_context: null },
        error: null,
      });
      const selectEqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });

      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      let callCount = 0;
      vi.mocked(untypedFrom).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectMock } as ReturnType<typeof untypedFrom>;
        return { update: updateMock } as ReturnType<typeof untypedFrom>;
      });

      await addUserContext(supabase, 'sess-1', 'first message');

      expect(updateMock).toHaveBeenCalledWith({
        user_context: ['first message'],
      });
    });
  });

  // --------------------------------------------------------------------------
  // storeEvent / getStoredEvents
  // --------------------------------------------------------------------------
  describe('storeEvent', () => {
    it('should store replayable event types', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      await storeEvent(supabase, 'sess-1', {
        type: 'search_executing',
        message: 'Searching for housing data',
        timestamp: 1700000000000,
        data: { searchQuery: 'JC housing' },
      });

      expect(insertMock).toHaveBeenCalledWith({
        session_id: 'sess-1',
        event_type: 'search_executing',
        message: 'Searching for housing data',
        event_data: { searchQuery: 'JC housing' },
        created_at: expect.any(String),
      });
    });

    it('should skip non-replayable event types', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      await storeEvent(supabase, 'sess-1', {
        type: 'intake_start',
        message: 'Starting intake',
        timestamp: Date.now(),
      });

      expect(insertMock).not.toHaveBeenCalled();
    });

    it('should store all defined replayable types', async () => {
      const replayableTypes = [
        'search_executing',
        'search_complete',
        'browser_visiting',
        'screenshot_captured',
        'code_executing',
        'vision_analyzing',
        'table_extracting',
        'form_filling',
        'paginating',
        'scrolling',
        'pdf_extracting',
        'comparing',
        'agent_spawned',
        'agent_complete',
        'agent_failed',
        'finding_discovered',
      ] as const;

      for (const eventType of replayableTypes) {
        const insertMock = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
          typeof untypedFrom
        >);

        await storeEvent(supabase, 'sess-1', {
          type: eventType,
          message: `Event: ${eventType}`,
          timestamp: Date.now(),
        });

        expect(insertMock).toHaveBeenCalled();
      }
    });

    it('should use empty object when event.data is undefined', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(untypedFrom).mockReturnValue({ insert: insertMock } as ReturnType<
        typeof untypedFrom
      >);

      await storeEvent(supabase, 'sess-1', {
        type: 'agent_spawned',
        message: 'Agent spawned',
        timestamp: 1700000000000,
      });

      expect(insertMock.mock.calls[0][0].event_data).toEqual({});
    });
  });

  describe('getStoredEvents', () => {
    it('should return mapped events', async () => {
      const rows = [
        {
          event_type: 'search_executing',
          message: 'Searching',
          event_data: { query: 'test' },
          created_at: '2026-03-01T00:00:00Z',
        },
        {
          event_type: 'search_complete',
          message: 'Done',
          event_data: {},
          created_at: '2026-03-01T00:01:00Z',
        },
      ];
      const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const events = await getStoredEvents(supabase, 'sess-1');
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('search_executing');
      expect(events[0].message).toBe('Searching');
      expect(events[0].data).toEqual({ query: 'test' });
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('should return empty array on error', async () => {
      const orderMock = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'table missing' } });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const events = await getStoredEvents(supabase, 'sess-1');
      expect(events).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getSessionFromDB
  // --------------------------------------------------------------------------
  describe('getSessionFromDB', () => {
    it('should return session data when found', async () => {
      const sessionData = {
        id: 'db-1',
        session_id: 'sess-1',
        user_id: 'user-1',
        phase: 'intake',
        mode: 'strategy',
        started_at: '2026-03-01T00:00:00Z',
        result: null,
        total_agents: 0,
        completed_agents: 0,
        total_searches: 0,
        total_cost: 0,
      };
      const singleMock = vi.fn().mockResolvedValue({ data: sessionData, error: null });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getSessionFromDB(supabase, 'sess-1');
      expect(result).toEqual(sessionData);
    });

    it('should return null when not found', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(untypedFrom).mockReturnValue({ select: selectMock } as ReturnType<
        typeof untypedFrom
      >);

      const result = await getSessionFromDB(supabase, 'non-existent');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // isUserAdmin
  // --------------------------------------------------------------------------
  describe('isUserAdmin', () => {
    it('should return true when user is admin', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'admin-1' } }),
            }),
          }),
        }),
      };

      const result = await isUserAdmin('user-1', mockSupabase);
      expect(result).toBe(true);
    });

    it('should return false when user is not admin', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };

      const result = await isUserAdmin('user-1', mockSupabase);
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getUserPlanKey
  // --------------------------------------------------------------------------
  describe('getUserPlanKey', () => {
    it('should return subscription tier when available', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { subscription_tier: 'pro' } }),
            }),
          }),
        }),
      };

      const result = await getUserPlanKey('user-1', mockSupabase);
      expect(result).toBe('pro');
    });

    it('should default to free when no subscription_tier', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };

      const result = await getUserPlanKey('user-1', mockSupabase);
      expect(result).toBe('free');
    });

    it('should default to free when subscription_tier is null', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { subscription_tier: null } }),
            }),
          }),
        }),
      };

      const result = await getUserPlanKey('user-1', mockSupabase);
      expect(result).toBe('free');
    });
  });
});
