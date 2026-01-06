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

import { useState, useEffect, useCallback, useRef } from 'react';
import { CodeLabSidebar } from './CodeLabSidebar';
import { CodeLabThread } from './CodeLabThread';
import { CodeLabComposer, CodeLabAttachment } from './CodeLabComposer';
import { CodeLabCommandPalette } from './CodeLabCommandPalette';
import { CodeLabKeyboardShortcuts } from './CodeLabKeyboardShortcuts';
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // AbortController for canceling streams
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Export session as markdown
  const exportSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Get messages for this session
    let exportMessages = messages;
    if (sessionId !== currentSessionId) {
      try {
        const response = await fetch(`/api/code-lab/sessions/${sessionId}/messages`);
        if (response.ok) {
          const data = await response.json();
          exportMessages = data.messages || [];
        }
      } catch (err) {
        console.error('[CodeLab] Error fetching messages for export:', err);
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

    exportMessages.forEach(msg => {
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

  const sendMessage = useCallback(async (
    content: string,
    attachments?: CodeLabAttachment[],
    forceSearch?: boolean
  ) => {
    if (!currentSessionId || isStreaming) return;

    // Capture session info at the start (before any async operations)
    const sessionAtStart = sessions.find(s => s.id === currentSessionId);
    const isFirstMessage = sessionAtStart?.title === 'New Session' || sessionAtStart?.messageCount === 0;

    // Convert attachments to base64 for API
    let attachmentData: Array<{ name: string; type: string; data: string }> | undefined;
    if (attachments && attachments.length > 0) {
      attachmentData = await Promise.all(
        attachments.map(async (att) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(att.file);
          });
          return {
            name: att.file.name,
            type: att.file.type,
            data: base64,
          };
        })
      );
    }

    // Create display content for user message
    const displayContent = attachments && attachments.length > 0
      ? `${content}\n\n[Attached: ${attachments.map(a => a.file.name).join(', ')}]`
      : content;

    // Create user message
    const userMessage: CodeLabMessage = {
      id: `temp-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content: displayContent,
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

    // Create AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/code-lab/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          content,
          repo: currentSession?.repo,
          attachments: attachmentData,
          forceSearch,
        }),
        signal: abortControllerRef.current.signal,
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

        // Update session in sidebar (increment message count, update timestamp)
        setSessions(prev =>
          prev.map(s =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messageCount: s.messageCount + 2, // user + assistant
                  updatedAt: new Date(),
                }
              : s
          )
        );

        // Generate title if this is the first message exchange (title is still default)
        if (isFirstMessage) {
          try {
            const titleResponse = await fetch('/api/chat/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userMessage: content,
                assistantMessage: fullContent.slice(0, 500),
              }),
            });

            if (titleResponse.ok) {
              const { title } = await titleResponse.json();
              if (title && title !== 'New Conversation') {
                // Update local state immediately
                setSessions(prev =>
                  prev.map(s =>
                    s.id === currentSessionId ? { ...s, title } : s
                  )
                );

                // Persist to database
                await fetch(`/api/code-lab/sessions/${currentSessionId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title }),
                });
              }
            }
          } catch (titleErr) {
            console.error('[CodeLab] Error generating title:', titleErr);
          }
        }
      }
    } catch (err) {
      // Don't show error for user-initiated cancellations
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[CodeLab] Stream cancelled by user');
        // Mark the partial message as complete (not streaming)
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, isStreaming: false, content: m.content + '\n\n*[Cancelled]*' }
              : m
          )
        );
      } else {
        console.error('[CodeLab] Error sending message:', err);
        setError('Failed to send message');
        // Remove the failed assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantId));
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [currentSessionId, currentSession?.repo, isStreaming, sessions]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Handler for slash commands from command palette
  const handleSlashCommand = useCallback((command: string) => {
    if (!currentSessionId) {
      createSession().then((session) => {
        if (session) {
          sendMessage(command);
        }
      });
    } else {
      sendMessage(command);
    }
  }, [currentSessionId, createSession, sendMessage]);

  // Handler for direct messages from command palette
  const handlePaletteMessage = useCallback((message: string) => {
    if (!currentSessionId) {
      createSession().then((session) => {
        if (session) {
          sendMessage(message);
        }
      });
    } else {
      sendMessage(message);
    }
  }, [currentSessionId, createSession, sendMessage]);

  // ========================================
  // KEYBOARD SHORTCUTS
  // ========================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+N - New session
      if (cmdKey && e.key === 'n') {
        e.preventDefault();
        createSession();
      }

      // Escape - Cancel streaming or close sidebar on mobile
      if (e.key === 'Escape') {
        if (isStreaming) {
          cancelStream();
        } else if (!sidebarCollapsed && window.innerWidth <= 768) {
          setSidebarCollapsed(true);
        }
      }

      // Cmd/Ctrl+B - Toggle sidebar
      if (cmdKey && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }

      // Cmd/Ctrl+K - Open command palette
      if (cmdKey && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Cmd/Ctrl+/ - Show keyboard shortcuts
      if (cmdKey && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
      }

      // Cmd/Ctrl+Shift+P - Open command palette (VSCode style)
      if (cmdKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, cancelStream, sidebarCollapsed, createSession]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="code-lab">
      {/* Mobile backdrop when sidebar open */}
      {!sidebarCollapsed && (
        <div
          className="mobile-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

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
        onExportSession={exportSession}
        currentRepo={currentSession?.repo}
        currentCodeChanges={currentSession?.codeChanges}
      />

      {/* Main Content Area */}
      <main className="code-lab-main">
        {/* Mobile header with menu button */}
        <div className="mobile-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarCollapsed(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="mobile-title">{currentSession?.title || 'Code Lab'}</span>
        </div>
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

      {/* Command Palette */}
      <CodeLabCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecuteSlashCommand={handleSlashCommand}
        onSendMessage={handlePaletteMessage}
      />

      {/* Keyboard Shortcuts Help */}
      <CodeLabKeyboardShortcuts
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <style jsx>{`
        .code-lab {
          display: flex;
          height: 100vh;
          background: #ffffff;
          color: #1a1f36;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
        }

        .code-lab-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #fafbfc;
        }

        /* Mobile backdrop */
        .mobile-backdrop {
          display: none;
        }

        /* Mobile header - hidden on desktop */
        .mobile-header {
          display: none;
        }

        /* Mobile: sidebar as overlay drawer */
        @media (max-width: 768px) {
          .code-lab {
            flex-direction: column;
          }

          .code-lab-main {
            width: 100%;
            height: 100vh;
          }

          .mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 40;
          }

          .mobile-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: white;
            border-bottom: 1px solid #e5e7eb;
          }

          .mobile-menu-btn {
            background: none;
            border: none;
            padding: 0.5rem;
            cursor: pointer;
            color: #374151;
            border-radius: 6px;
          }

          .mobile-menu-btn:hover {
            background: #f3f4f6;
          }

          .mobile-menu-btn svg {
            width: 24px;
            height: 24px;
          }

          .mobile-title {
            font-weight: 600;
            color: #1a1f36;
            flex: 1;
          }
        }

        .code-lab-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .code-lab-empty-content {
          text-align: center;
          padding: 2rem;
          max-width: 400px;
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
          z-index: 1000;
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
