/**
 * Session Manager Hook for CodeLab
 *
 * Handles all session CRUD operations:
 * - Loading sessions from API
 * - Creating new sessions
 * - Selecting/switching sessions
 * - Deleting, renaming, exporting sessions
 * - Setting repository connections
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useMountedRef } from './useAsyncState';
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabSession, CodeLabMessage } from './types';

const log = logger('SessionManager');

const ERROR_AUTO_CLEAR_DELAY_MS = 100;

interface UseSessionManagerReturn {
  sessions: CodeLabSession[];
  setSessions: React.Dispatch<React.SetStateAction<CodeLabSession[]>>;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  currentSession: CodeLabSession | undefined;
  messages: CodeLabMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CodeLabMessage[]>>;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  createSession: (title?: string) => Promise<CodeLabSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  exportSession: (sessionId: string) => Promise<void>;
  setSessionRepo: (sessionId: string, repo: CodeLabSession['repo']) => Promise<void>;
}

export function useSessionManager(): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<CodeLabSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CodeLabMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toast = useToastActions();
  const mountedRef = useMountedRef();
  const selectSessionRequestIdRef = useRef(0);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // Show toast notification when error occurs
  useEffect(() => {
    if (error) {
      toast.error('Error', error);
      const timer = setTimeout(() => setError(null), ERROR_AUTO_CLEAR_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [error, toast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized for simplicity
  const createSession = async (title?: string): Promise<CodeLabSession | null> => {
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
        setMessages([]);
        return data.session;
      }
    } catch (err) {
      log.error('Error creating session', err as Error);
      setError('Failed to create session');
    }
    return null;
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/code-lab/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        createSession();
      }
    } catch (err) {
      log.error('Error loading sessions', err as Error);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSession = async (sessionId: string) => {
    const requestId = ++selectSessionRequestIdRef.current;
    setCurrentSessionId(sessionId);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/code-lab/sessions/${sessionId}/messages`);

      if (!mountedRef.current || selectSessionRequestIdRef.current !== requestId) {
        log.debug('Ignoring stale selectSession response', { sessionId, requestId });
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      if (mountedRef.current && selectSessionRequestIdRef.current === requestId) {
        log.error('Error loading messages', err as Error);
      }
    } finally {
      if (mountedRef.current && selectSessionRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/code-lab/sessions/${sessionId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.status}`);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (currentSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          selectSession(remaining[0].id);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      log.error('Error deleting session', err as Error);
      toast.error('Delete Failed', 'Failed to delete session');
    }
  };

  const exportSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

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
  };

  const renameSession = async (sessionId: string, title: string) => {
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
  };

  const setSessionRepo = useCallback(
    async (sessionId: string, repo: CodeLabSession['repo']) => {
      try {
        const response = await fetch(`/api/code-lab/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || errorData.message || 'Failed to save repository';
          log.error('Error setting repo - API returned error', {
            status: response.status,
            error: errorMessage,
          });
          toast.error('Repository Error', errorMessage);
          return;
        }

        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, repo } : s)));

        if (repo) {
          toast.success('Repository Connected', `Connected to ${repo.fullName}`);
        } else {
          toast.info('Repository Cleared', 'Repository disconnected from session');
        }
      } catch (err) {
        log.error('Error setting repo', err as Error);
        toast.error('Connection Error', 'Failed to connect repository. Please try again.');
      }
    },
    [toast]
  );

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    setMessages,
    isLoading,
    error,
    setError,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    exportSession,
    setSessionRepo,
  };
}
