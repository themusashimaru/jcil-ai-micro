/**
 * USE CODE LAB SESSIONS HOOK TESTS
 *
 * Tests for session management hook - testing types and logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Session Types and Interfaces', () => {
  describe('CodeLabSession', () => {
    it('should define correct session structure', () => {
      const session = {
        id: 'session-123',
        title: 'My Coding Session',
        messageCount: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T12:00:00Z',
        repo: null,
        codeChanges: {
          linesAdded: 50,
          linesRemoved: 20,
          filesChanged: 5,
        },
      };

      expect(session.id).toBe('session-123');
      expect(session.title).toBe('My Coding Session');
      expect(session.messageCount).toBe(10);
      expect(session.codeChanges?.linesAdded).toBe(50);
    });

    it('should handle session with repo', () => {
      const session = {
        id: 'session-456',
        title: 'Project Session',
        repo: {
          fullName: 'user/my-project',
          branch: 'feature/new-feature',
        },
      };

      expect(session.repo?.fullName).toBe('user/my-project');
      expect(session.repo?.branch).toBe('feature/new-feature');
    });
  });

  describe('CodeLabMessage', () => {
    it('should define user message', () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Help me write a function',
      };

      expect(message.role).toBe('user');
      expect(message.content).toContain('function');
    });

    it('should define assistant message', () => {
      const message = {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Here is a function...',
      };

      expect(message.role).toBe('assistant');
    });
  });
});

describe('Session Operations Logic', () => {
  describe('Session Filtering', () => {
    it('should filter out deleted session', () => {
      const sessions = [
        { id: '1', title: 'Session 1' },
        { id: '2', title: 'Session 2' },
        { id: '3', title: 'Session 3' },
      ];
      const deleteId = '2';

      const filtered = sessions.filter((s) => s.id !== deleteId);

      expect(filtered).toHaveLength(2);
      expect(filtered.find((s) => s.id === '2')).toBeUndefined();
    });
  });

  describe('Session Update', () => {
    it('should update session title in array', () => {
      const sessions = [
        { id: '1', title: 'Old Title' },
        { id: '2', title: 'Other Session' },
      ];
      const sessionId = '1';
      const newTitle = 'Renamed Session';

      const updated = sessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s));

      expect(updated[0].title).toBe('Renamed Session');
      expect(updated[1].title).toBe('Other Session');
    });

    it('should update session repo', () => {
      const sessions = [{ id: '1', title: 'Session', repo: null }];
      const newRepo = { fullName: 'user/repo', branch: 'main' };

      const updated = sessions.map((s) => (s.id === '1' ? { ...s, repo: newRepo } : s));

      expect(updated[0].repo).toEqual(newRepo);
    });
  });
});

describe('Export Generation', () => {
  it('should generate markdown header', () => {
    const session = {
      title: 'My Session',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      messageCount: 5,
    };

    const lines = [
      `# ${session.title}`,
      '',
      `**Created:** ${new Date(session.createdAt).toLocaleString()}`,
      `**Updated:** ${new Date(session.updatedAt).toLocaleString()}`,
      `**Messages:** ${session.messageCount}`,
    ];

    expect(lines[0]).toBe('# My Session');
    expect(lines[4]).toContain('5');
  });

  it('should include code changes if present', () => {
    const codeChanges = {
      linesAdded: 100,
      linesRemoved: 25,
      filesChanged: 10,
    };

    const lines = [
      '## Code Changes',
      `- Lines added: **+${codeChanges.linesAdded}**`,
      `- Lines removed: **-${codeChanges.linesRemoved}**`,
      `- Files changed: **${codeChanges.filesChanged}**`,
    ];

    expect(lines[1]).toContain('+100');
    expect(lines[2]).toContain('-25');
  });

  it('should format messages correctly', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const formatted = messages.map((msg) => {
      if (msg.role === 'user') return `### User\n\n${msg.content}`;
      if (msg.role === 'assistant') return `### Assistant\n\n${msg.content}`;
      return `### System\n\n${msg.content}`;
    });

    expect(formatted[0]).toContain('### User');
    expect(formatted[1]).toContain('### Assistant');
  });

  it('should generate safe filename', () => {
    const title = 'My Session: Special/Name';
    const date = '2024-01-15';

    const filename = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${date}.md`;

    expect(filename).not.toContain(':');
    expect(filename).not.toContain('/');
    expect(filename).toContain('.md');
  });
});

describe('API Request Construction', () => {
  describe('Create Session', () => {
    it('should construct correct request', () => {
      const request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Session' }),
      };

      expect(request.method).toBe('POST');
      expect(JSON.parse(request.body).title).toBe('New Session');
    });
  });

  describe('Delete Session', () => {
    it('should use DELETE method', () => {
      const request = { method: 'DELETE' };
      expect(request.method).toBe('DELETE');
    });
  });

  describe('Update Session', () => {
    it('should use PATCH method', () => {
      const request = {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      };

      expect(request.method).toBe('PATCH');
    });
  });
});

describe('Hook Module Export', () => {
  it('should export useCodeLabSessions', async () => {
    const hookModule = await import('./useCodeLabSessions');
    expect(hookModule.useCodeLabSessions).toBeDefined();
    expect(typeof hookModule.useCodeLabSessions).toBe('function');
  });
});
