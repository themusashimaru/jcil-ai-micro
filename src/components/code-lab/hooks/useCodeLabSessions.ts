/**
 * USE CODE LAB SESSIONS HOOK
 *
 * Manages session state and operations:
 * - Loading, creating, selecting, deleting sessions
 * - Renaming and exporting sessions
 * - Session repository association
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { CodeLabSession, CodeLabMessage } from '../types';

const log = logger('CodeLabSessions');

export interface UseCodeLabSessionsOptions {
  onError?: (message: string) => void;
  onSuccess?: (title: string, message: string) => void;
}

export interface UseCodeLabSessionsReturn {
  // State
  sessions: CodeLabSession[];
  currentSessionId: string | null;
  currentSession: CodeLabSession | undefined;
  isLoading: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<CodeLabSession | null>;
  selectSession: (sessionId: string) => Promise<CodeLabMessage[]>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  exportSession: (sessionId: string, messages: CodeLabMessage[]) => Promise<void>;
  setSessionRepo: (sessionId: string, repo: CodeLabSession['repo']) => Promise<void>;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<CodeLabSession[]>>;
}

export function useCodeLabSessions(
  options: UseCodeLabSessionsOptions = {}
): UseCodeLabSessionsReturn {
  const { onError } = options;

  const [sessions, setSessions] = useState<CodeLabSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/code-lab/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        return data.sessions || [];
      }
    } catch (err) {
      log.error('Error loading sessions', err as Error);
    }
    return [];
  }, []);

  const createSession = useCallback(
    async (title?: string): Promise<CodeLabSession | null> => {
      try {
        const response = await fetch('/api/code-lab/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title || 'New Session' }),
        });

        if (response.ok) {
          const data = await response.json();
          setSessions((prev) => [data.session, ...prev]);
          setCurrentSessionId(data.session.id);
          return data.session;
        }
      } catch (err) {
        log.error('Error creating session', err as Error);
        onError?.('Failed to create session');
      }
      return null;
    },
    [onError]
  );

  const selectSession = useCallback(async (sessionId: string): Promise<CodeLabMessage[]> => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/code-lab/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        return data.messages || [];
      }
    } catch (err) {
      log.error('Error loading messages', err as Error);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/code-lab/sessions/${sessionId}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(`Failed to delete session: ${response.status}`);
        }
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        if (currentSessionId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setCurrentSessionId(remaining[0].id);
          } else {
            setCurrentSessionId(null);
          }
        }
      } catch (err) {
        log.error('Error deleting session', err as Error);
      }
    },
    [currentSessionId, sessions]
  );

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
    } catch (err) {
      log.error('Error renaming session', err as Error);
    }
  }, []);

  const exportSession = useCallback(
    async (sessionId: string, messages: CodeLabMessage[]) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Get messages for this session if not current
      let exportMessages = messages;
      if (sessionId !== currentSessionId) {
        try {
          const response = await fetch(`/api/code-lab/sessions/${sessionId}/messages`);
          if (response.ok) {
            const data = await response.json();
            exportMessages = data.messages || [];
          }
        } catch (err) {
          log.error('Error fetching messages for export', err as Error);
          return;
        }
      }

      // Generate markdown
      const lines: string[] = [
        `# ${session.title}`,
        '',
        `**Created:** ${new Date(session.createdAt).toLocaleString()}`,
        `**Updated:** ${new Date(session.updatedAt).toLocaleString()}`,
        `**Messages:** ${session.messageCount}`,
      ];

      if (session.repo) {
        lines.push(`**Repository:** ${session.repo.fullName} (${session.repo.branch})`);
      }

      if (session.codeChanges) {
        lines.push('');
        lines.push('## Code Changes');
        lines.push(`- Lines added: **+${session.codeChanges.linesAdded}**`);
        lines.push(`- Lines removed: **-${session.codeChanges.linesRemoved}**`);
        lines.push(`- Files changed: **${session.codeChanges.filesChanged}**`);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Conversation');
      lines.push('');

      exportMessages.forEach((msg) => {
        if (msg.role === 'user') {
          lines.push(`### User`);
        } else if (msg.role === 'assistant') {
          lines.push(`### Assistant`);
        } else {
          lines.push(`### System`);
        }
        lines.push('');
        lines.push(msg.content);
        lines.push('');
      });

      // Download file
      const markdown = lines.join('\n');
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    [sessions, currentSessionId]
  );

  const setSessionRepo = useCallback(async (sessionId: string, repo: CodeLabSession['repo']) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });

      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, repo } : s)));
    } catch (err) {
      log.error('Error setting repo', err as Error);
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions().then((loadedSessions) => {
      if (loadedSessions?.length > 0) {
        setCurrentSessionId(loadedSessions[0].id);
      }
    });
  }, [loadSessions]);

  return {
    sessions,
    currentSessionId,
    currentSession,
    isLoading,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    exportSession,
    setSessionRepo,
    setCurrentSessionId,
    setSessions,
  };
}
