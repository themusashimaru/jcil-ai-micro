'use client';

/**
 * CODE LAB - Main Layout Component
 *
 * A professional developer workspace that combines:
 * - Chat with Claude Opus 4.5
 * - Code generation via Code Agent V2
 * - Web search via Perplexity
 *
 * Design: Light mode, clean, professional
 * - Dark navy text on white background
 * - AI responses flow naturally (no bubbles)
 * - User messages in subtle containers
 * - Terminal-style code output
 */

import { useState, useEffect, useCallback } from 'react';
import { CodeLabSidebar } from './CodeLabSidebar';
import { CodeLabThread } from './CodeLabThread';
import { CodeLabComposer } from './CodeLabComposer';
import type { CodeLabSession, CodeLabMessage } from './types';

interface CodeLabProps {
  userId?: string;
}

export function CodeLab({ userId: _userId }: CodeLabProps) {
  // ========================================
  // STATE
  // ========================================

  const [sessions, setSessions] = useState<CodeLabSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CodeLabMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current session helper
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/code-lab/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);

        // Auto-select first session or create new one
        if (data.sessions?.length > 0) {
          selectSession(data.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('[CodeLab] Error loading sessions:', err);
    }
  };

  const createSession = async (title?: string) => {
    try {
      const response = await fetch('/api/code-lab/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'New Session' }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(prev => [data.session, ...prev]);
        setCurrentSessionId(data.session.id);
        setMessages([]);
        return data.session;
      }
    } catch (err) {
      console.error('[CodeLab] Error creating session:', err);
      setError('Failed to create session');
    }
    return null;
  };

  const selectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/code-lab/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('[CodeLab] Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (currentSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          selectSession(remaining[0].id);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('[CodeLab] Error deleting session:', err);
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title } : s))
      );
    } catch (err) {
      console.error('[CodeLab] Error renaming session:', err);
    }
  };

  const setSessionRepo = async (
    sessionId: string,
    repo: CodeLabSession['repo']
  ) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });

      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, repo } : s))
      );
    } catch (err) {
      console.error('[CodeLab] Error setting repo:', err);
    }
  };

  // ========================================
  // MESSAGING
  // ========================================

  const [_abortController, _setAbortController] = useState<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentSessionId || isStreaming) return;

    // Create user message
    const userMessage: CodeLabMessage = {
      id: `temp-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: CodeLabMessage = {
      id: assistantId,
      sessionId: currentSessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/code-lab/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          content,
          repo: currentSession?.repo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;

          // Update the assistant message with streamed content
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? { ...m, content: fullContent }
                : m
            )
          );
        }

        // Mark streaming as complete
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, isStreaming: false }
              : m
          )
        );
      }
    } catch (err) {
      console.error('[CodeLab] Error sending message:', err);
      setError('Failed to send message');

      // Remove the failed assistant message
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }, [currentSessionId, currentSession?.repo, isStreaming]);

  const cancelStream = useCallback(() => {
    // TODO: Implement abort controller
    setIsStreaming(false);
  }, []);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="code-lab">
      {/* Sidebar - Sessions & Repo */}
      <CodeLabSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCreateSession={createSession}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onSetRepo={setSessionRepo}
        currentRepo={currentSession?.repo}
      />

      {/* Main Content Area */}
      <main className="code-lab-main">
        {currentSessionId ? (
          <>
            {/* Thread - Messages */}
            <CodeLabThread
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              sessionTitle={currentSession?.title || 'Session'}
              repo={currentSession?.repo}
            />

            {/* Composer - Input */}
            <CodeLabComposer
              onSend={sendMessage}
              isStreaming={isStreaming}
              onCancel={cancelStream}
              placeholder="Ask anything, build anything..."
              disabled={!currentSessionId}
            />
          </>
        ) : (
          // Empty state
          <div className="code-lab-empty">
            <div className="code-lab-empty-content">
              <div className="code-lab-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <h2>Code Lab</h2>
              <p>Your professional coding workspace</p>
              <button
                onClick={() => createSession()}
                className="code-lab-empty-btn"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Error Toast */}
      {error && (
        <div className="code-lab-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <style jsx>{`
        .code-lab {
          display: flex;
          height: 100vh;
          background: #ffffff;
          color: #1a1f36;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .code-lab-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #fafbfc;
        }

        .code-lab-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .code-lab-empty-content {
          text-align: center;
          padding: 3rem;
        }

        .code-lab-empty-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.5rem;
          color: #6366f1;
        }

        .code-lab-empty-icon svg {
          width: 100%;
          height: 100%;
        }

        .code-lab-empty h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1a1f36;
          margin: 0 0 0.5rem;
        }

        .code-lab-empty p {
          color: #6b7280;
          margin: 0 0 1.5rem;
        }

        .code-lab-empty-btn {
          background: #1a1f36;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .code-lab-empty-btn:hover {
          background: #2d3348;
        }

        .code-lab-error {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          background: #ef4444;
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .code-lab-error button {
          background: none;
          border: none;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
