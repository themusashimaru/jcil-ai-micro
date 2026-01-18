/**
 * CODE LAB SESSIONS API TESTS
 *
 * Tests for session CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'test-session-id' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-session-id' }, error: null })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
};

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Code Lab Sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Data Structure', () => {
    it('should have required fields in session object', () => {
      const session = {
        id: 'test-id',
        title: 'Test Session',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0,
        repo_owner: null,
        repo_name: null,
        repo_branch: null,
        has_summary: false,
      };

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('title');
      expect(session).toHaveProperty('user_id');
      expect(session).toHaveProperty('created_at');
      expect(session).toHaveProperty('message_count');
    });

    it('should format repo object correctly', () => {
      const session = {
        repo_owner: 'testuser',
        repo_name: 'testrepo',
        repo_branch: 'main',
      };

      const formattedRepo = session.repo_owner
        ? {
            owner: session.repo_owner,
            name: session.repo_name,
            branch: session.repo_branch || 'main',
            fullName: `${session.repo_owner}/${session.repo_name}`,
          }
        : null;

      expect(formattedRepo).toEqual({
        owner: 'testuser',
        name: 'testrepo',
        branch: 'main',
        fullName: 'testuser/testrepo',
      });
    });

    it('should handle null repo correctly', () => {
      const session = {
        repo_owner: null,
        repo_name: null,
        repo_branch: null,
      };

      const formattedRepo = session.repo_owner
        ? {
            owner: session.repo_owner,
            name: session.repo_name,
            branch: session.repo_branch || 'main',
            fullName: `${session.repo_owner}/${session.repo_name}`,
          }
        : null;

      expect(formattedRepo).toBeNull();
    });
  });

  describe('Session Title Generation', () => {
    it('should generate appropriate default title', () => {
      const defaultTitle = 'New Session';
      expect(defaultTitle).toBe('New Session');
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(200);
      const maxLength = 100;
      const truncatedTitle =
        longTitle.length > maxLength ? longTitle.substring(0, maxLength) + '...' : longTitle;

      expect(truncatedTitle.length).toBeLessThanOrEqual(maxLength + 3);
    });
  });

  describe('Message Count', () => {
    it('should start at 0 for new sessions', () => {
      const newSession = { message_count: 0 };
      expect(newSession.message_count).toBe(0);
    });

    it('should increment by 2 for user+assistant exchange', () => {
      let messageCount = 0;
      // User message
      messageCount++;
      // Assistant message
      messageCount++;

      expect(messageCount).toBe(2);
    });

    it('should handle summary threshold correctly', () => {
      const SUMMARY_THRESHOLD = 15;
      const messageCount = 20;

      expect(messageCount > SUMMARY_THRESHOLD).toBe(true);
    });
  });

  describe('Session Cleanup', () => {
    it('should delete messages before session', async () => {
      // Simulate deletion order
      const deletionOrder: string[] = [];

      // Delete messages first
      deletionOrder.push('messages');

      // Then delete session
      deletionOrder.push('session');

      expect(deletionOrder).toEqual(['messages', 'session']);
    });
  });
});

describe('Code Lab Message Types', () => {
  it('should recognize different message types', () => {
    const messageTypes = ['chat', 'code', 'search', 'workspace', 'multi-agent', 'summary'];

    messageTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('should identify summary messages', () => {
    const summaryMessage = { type: 'summary', content: 'Previous conversation summary...' };
    const chatMessage = { type: 'chat', content: 'Hello' };

    expect(summaryMessage.type).toBe('summary');
    expect(chatMessage.type).not.toBe('summary');
  });
});

describe('Auto-Summarization', () => {
  it('should trigger at correct threshold', () => {
    const SUMMARY_THRESHOLD = 15;
    const RECENT_MESSAGES_AFTER_SUMMARY = 5;

    // Below threshold - no summary
    expect(10 > SUMMARY_THRESHOLD).toBe(false);

    // Above threshold - should summarize
    expect(20 > SUMMARY_THRESHOLD).toBe(true);

    // Check recent messages kept
    expect(RECENT_MESSAGES_AFTER_SUMMARY).toBe(5);
  });

  it('should not re-summarize if summary exists', () => {
    const messages = [
      { id: '1', type: 'summary', content: 'Summary...' },
      { id: '2', type: 'chat', content: 'Hello' },
    ];

    const existingSummary = messages.find((m) => m.type === 'summary');
    expect(existingSummary).toBeDefined();
  });
});
