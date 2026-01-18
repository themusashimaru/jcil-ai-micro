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
import { logger } from '@/lib/logger';

const log = logger('CodeLab');
import { CodeLabSidebar } from './CodeLabSidebar';
import { CodeLabThread } from './CodeLabThread';
import { CodeLabComposer, CodeLabAttachment } from './CodeLabComposer';
import { CodeLabCommandPalette } from './CodeLabCommandPalette';
import { CodeLabKeyboardShortcuts } from './CodeLabKeyboardShortcuts';
import { CodeLabLiveFileTree } from './CodeLabLiveFileTree';
import { CodeLabDiffViewer } from './CodeLabDiffViewer';
import { CodeLabVisualToCode } from './CodeLabVisualToCode';
import { CodeLabDeployFlow } from './CodeLabDeployFlow';
import { CodeLabDebugPanel } from './CodeLabDebugPanel';
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabSession, CodeLabMessage } from './types';
import type { FileNode } from './CodeLabLiveFileTree';
import type { FileDiff } from './CodeLabDiffViewer';

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

  // Toast notifications for better UX
  const toast = useToastActions();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Workspace panel state
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'files' | 'diff' | 'deploy' | 'visual' | 'debug'
  >('files');
  const [workspaceFiles, setWorkspaceFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);

  // AbortController for canceling streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Current session helper
  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show toast notification when error occurs
  useEffect(() => {
    if (error) {
      toast.error('Error', error);
      // Auto-clear error state after showing toast
      const timer = setTimeout(() => setError(null), 100);
      return () => clearTimeout(timer);
    }
  }, [error, toast]);

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
      log.error('Error loading sessions', err as Error);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized for simplicity
  const createSession = async (title?: string) => {
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
      log.error('Error loading messages', err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, { method: 'DELETE' });
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
    }
  };

  // Export session as markdown
  const exportSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
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

  const setSessionRepo = async (sessionId: string, repo: CodeLabSession['repo']) => {
    try {
      await fetch(`/api/code-lab/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });

      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, repo } : s)));

      // When repo is set, load workspace files
      if (repo) {
        loadWorkspaceFiles(sessionId);
      }
    } catch (err) {
      log.error('Error setting repo', err as Error);
    }
  };

  // ========================================
  // WORKSPACE MANAGEMENT
  // ========================================

  const loadWorkspaceFiles = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/code-lab/files?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkspaceFiles(data.files || []);
      }
    } catch (err) {
      log.error('Error loading workspace files', err as Error);
    }
  };

  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    // File content will be loaded by the file tree component
  };

  const handleFileCreate = async (path: string, content: string = '') => {
    if (!currentSessionId) return;
    try {
      await fetch('/api/code-lab/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, path, content }),
      });
      loadWorkspaceFiles(currentSessionId);
    } catch (err) {
      log.error('Error creating file', err as Error);
    }
  };

  const handleFileDelete = async (path: string) => {
    if (!currentSessionId) return;
    try {
      await fetch(
        `/api/code-lab/files?sessionId=${currentSessionId}&path=${encodeURIComponent(path)}`,
        {
          method: 'DELETE',
        }
      );
      loadWorkspaceFiles(currentSessionId);
    } catch (err) {
      log.error('Error deleting file', err as Error);
    }
  };

  // Git operations
  const handleGitPush = async () => {
    if (!currentSessionId || !currentSession?.repo) return;
    try {
      const response = await fetch('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          operation: 'push',
          repo: currentSession.repo,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.diff) {
          setDiffFiles(data.diff);
        }
      }
    } catch (err) {
      log.error('Error pushing to git', err as Error);
      setError('Failed to push changes');
    }
  };

  const handleGitPull = async () => {
    if (!currentSessionId || !currentSession?.repo) return;
    try {
      await fetch('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          operation: 'pull',
          repo: currentSession.repo,
        }),
      });
      loadWorkspaceFiles(currentSessionId);
    } catch (err) {
      log.error('Error pulling from git', err as Error);
      setError('Failed to pull changes');
    }
  };

  // Visual to code handler
  const handleVisualToCode = async (
    imageBase64: string,
    framework: string,
    instructions?: string
  ) => {
    const response = await fetch('/api/code-lab/visual-to-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, framework, instructions }),
    });

    if (!response.ok) throw new Error('Failed to generate code');
    return response.json();
  };

  // Deploy handler
  const handleDeploy = async (config: {
    platform: 'vercel' | 'netlify' | 'railway' | 'cloudflare';
    projectName: string;
    buildCommand: string;
    outputDir: string;
    envVars: Record<string, string>;
    domain?: string;
  }) => {
    if (!currentSessionId) {
      return {
        id: '',
        status: 'error' as const,
        createdAt: new Date(),
        buildLogs: [],
        error: 'No session',
      };
    }

    const response = await fetch('/api/code-lab/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        platform: config.platform,
        config: {
          projectName: config.projectName,
          buildCommand: config.buildCommand,
          outputDir: config.outputDir,
          envVars: config.envVars,
          domain: config.domain,
        },
      }),
    });

    const result = await response.json();

    return {
      id: result.projectId || `deploy-${Date.now()}`,
      status: result.success ? ('success' as const) : ('error' as const),
      url: result.url,
      createdAt: new Date(),
      buildLogs: [],
      error: result.error,
    };
  };

  // ========================================
  // MESSAGING
  // ========================================

  const sendMessage = useCallback(
    async (content: string, attachments?: CodeLabAttachment[], forceSearch?: boolean) => {
      if (!currentSessionId || isStreaming) return;

      // Capture session info at the start (before any async operations)
      const sessionAtStart = sessions.find((s) => s.id === currentSessionId);
      const isFirstMessage =
        sessionAtStart?.title === 'New Session' || sessionAtStart?.messageCount === 0;

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
      const displayContent =
        attachments && attachments.length > 0
          ? `${content}\n\n[Attached: ${attachments.map((a) => a.file.name).join(', ')}]`
          : content;

      // Create user message
      const userMessage: CodeLabMessage = {
        id: `temp-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content: displayContent,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
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

      setMessages((prev) => [...prev, assistantMessage]);

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
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
            );
          }

          // Mark streaming as complete
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
          );

          // Update session in sidebar (increment message count, update timestamp)
          setSessions((prev) =>
            prev.map((s) =>
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
                  setSessions((prev) =>
                    prev.map((s) => (s.id === currentSessionId ? { ...s, title } : s))
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
              log.error('Error generating title', titleErr as Error);
            }
          }
        }
      } catch (err) {
        // Don't show error for user-initiated cancellations
        if (err instanceof Error && err.name === 'AbortError') {
          log.info('Stream cancelled by user');
          // Mark the partial message as complete (not streaming)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, content: m.content + '\n\n*[Cancelled]*' }
                : m
            )
          );
          // Only count 1 message (user) since assistant was cancelled
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messageCount: s.messageCount + 1, updatedAt: new Date() }
                : s
            )
          );
        } else {
          log.error('Error sending message', err as Error);
          setError('Failed to send message');
          // Remove BOTH the failed user message and assistant message
          // This ensures state stays in sync with server
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantId && m.id !== userMessage.id)
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [currentSessionId, currentSession?.repo, isStreaming, sessions]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Handler for slash commands from command palette
  const handleSlashCommand = useCallback(
    (command: string) => {
      if (!currentSessionId) {
        createSession().then((session) => {
          if (session) {
            sendMessage(command);
          }
        });
      } else {
        sendMessage(command);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized
    },
    [currentSessionId, createSession, sendMessage]
  );

  // Handler for direct messages from command palette
  const handlePaletteMessage = useCallback(
    (message: string) => {
      if (!currentSessionId) {
        createSession().then((session) => {
          if (session) {
            sendMessage(message);
          }
        });
      } else {
        sendMessage(message);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized
    },
    [currentSessionId, createSession, sendMessage]
  );

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
        setSidebarCollapsed((prev) => !prev);
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

      // Cmd/Ctrl+E - Toggle workspace panel
      if (cmdKey && e.key === 'e') {
        e.preventDefault();
        setWorkspacePanelOpen((prev) => !prev);
      }

      // Cmd/Ctrl+1,2,3,4 - Switch workspace tabs
      if (cmdKey && e.key === '1') {
        e.preventDefault();
        setActiveWorkspaceTab('files');
        setWorkspacePanelOpen(true);
      }
      if (cmdKey && e.key === '2') {
        e.preventDefault();
        setActiveWorkspaceTab('diff');
        setWorkspacePanelOpen(true);
      }
      if (cmdKey && e.key === '3') {
        e.preventDefault();
        setActiveWorkspaceTab('deploy');
        setWorkspacePanelOpen(true);
      }
      if (cmdKey && e.key === '4') {
        e.preventDefault();
        setActiveWorkspaceTab('visual');
        setWorkspacePanelOpen(true);
      }
      if (cmdKey && e.key === '5') {
        e.preventDefault();
        setActiveWorkspaceTab('debug');
        setWorkspacePanelOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized
  }, [isStreaming, cancelStream, sidebarCollapsed, createSession]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="code-lab">
      {/* Mobile backdrop when sidebar open */}
      {!sidebarCollapsed && (
        <div className="mobile-backdrop" onClick={() => setSidebarCollapsed(true)} />
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
          <button className="mobile-menu-btn" onClick={() => setSidebarCollapsed(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <span className="mobile-title">{currentSession?.title || 'Code Lab'}</span>
          <div className="header-actions">
            <button
              className={`header-btn ${workspacePanelOpen ? 'active' : ''}`}
              onClick={() => setWorkspacePanelOpen(!workspacePanelOpen)}
              title="Workspace Panel (Cmd+E)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </button>
          </div>
        </div>
        {currentSessionId ? (
          <div className="code-lab-content">
            <div className={`chat-area ${workspacePanelOpen ? 'with-panel' : ''}`}>
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
            </div>

            {/* Workspace Panel */}
            {workspacePanelOpen && (
              <div className="workspace-panel">
                <div className="workspace-tabs">
                  <button
                    className={activeWorkspaceTab === 'files' ? 'active' : ''}
                    onClick={() => setActiveWorkspaceTab('files')}
                  >
                    Files
                  </button>
                  <button
                    className={activeWorkspaceTab === 'diff' ? 'active' : ''}
                    onClick={() => setActiveWorkspaceTab('diff')}
                  >
                    Changes
                  </button>
                  <button
                    className={activeWorkspaceTab === 'deploy' ? 'active' : ''}
                    onClick={() => setActiveWorkspaceTab('deploy')}
                  >
                    Deploy
                  </button>
                  <button
                    className={activeWorkspaceTab === 'visual' ? 'active' : ''}
                    onClick={() => setActiveWorkspaceTab('visual')}
                  >
                    Visual
                  </button>
                  <button
                    className={activeWorkspaceTab === 'debug' ? 'active' : ''}
                    onClick={() => setActiveWorkspaceTab('debug')}
                  >
                    Debug
                  </button>
                </div>
                <div className="workspace-content">
                  {activeWorkspaceTab === 'files' && (
                    <CodeLabLiveFileTree
                      files={workspaceFiles}
                      selectedPath={selectedFile ?? undefined}
                      onFileSelect={handleFileSelect}
                      onFileCreate={(path) => handleFileCreate(path)}
                      onFileDelete={handleFileDelete}
                      onRefresh={() => {
                        if (currentSessionId) loadWorkspaceFiles(currentSessionId);
                      }}
                    />
                  )}
                  {activeWorkspaceTab === 'diff' && (
                    <div className="diff-list">
                      {diffFiles.length === 0 ? (
                        <div className="diff-empty">
                          <p>No changes to display</p>
                          <p className="hint">Push or pull from GitHub to see file changes</p>
                        </div>
                      ) : (
                        diffFiles.map((fileDiff, index) => (
                          <CodeLabDiffViewer
                            key={`${fileDiff.oldPath || fileDiff.newPath}-${index}`}
                            diff={fileDiff}
                            onAcceptHunk={(hunkIndex) =>
                              log.debug('Accept hunk', { hunkIndex, file: fileDiff.newPath })
                            }
                            onRejectHunk={(hunkIndex) =>
                              log.debug('Reject hunk', { hunkIndex, file: fileDiff.newPath })
                            }
                          />
                        ))
                      )}
                    </div>
                  )}
                  {activeWorkspaceTab === 'deploy' && <CodeLabDeployFlow onDeploy={handleDeploy} />}
                  {activeWorkspaceTab === 'visual' && (
                    <CodeLabVisualToCode
                      onGenerate={handleVisualToCode}
                      onInsertCode={(code) =>
                        sendMessage(`/create file with this code:\n\`\`\`\n${code}\n\`\`\``)
                      }
                    />
                  )}
                  {activeWorkspaceTab === 'debug' && currentSessionId && (
                    <CodeLabDebugPanel
                      sessionId={currentSessionId}
                      token={currentSessionId}
                      workspaceId={currentSessionId}
                      onAIAnalysis={(debugState) => {
                        const debugContext = JSON.stringify(debugState, null, 2);
                        sendMessage(
                          `/analyze this debug state and help me understand what's happening:\n\`\`\`json\n${debugContext}\n\`\`\``
                        );
                      }}
                    />
                  )}
                </div>
                {currentSession?.repo && (
                  <div className="workspace-git-actions">
                    <button onClick={handleGitPull} className="git-btn pull">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                      Pull
                    </button>
                    <button onClick={handleGitPush} className="git-btn push">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      Push
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Empty state
          <div className="code-lab-empty">
            <div className="code-lab-empty-content">
              <div className="code-lab-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              </div>
              <h2>Code Lab</h2>
              <p>Your professional coding workspace</p>
              <button onClick={() => createSession()} className="code-lab-empty-btn">
                Start New Session
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Error notifications now handled by Toast system */}

      {/* Command Palette */}
      <CodeLabCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecuteSlashCommand={handleSlashCommand}
        onSendMessage={handlePaletteMessage}
      />

      {/* Keyboard Shortcuts Help */}
      <CodeLabKeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Voice Coding Mode - Disabled to prevent double messages with composer voice button */}
      {/* The composer has its own voice input button which is cleaner UX */}

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
            z-index: 44; /* Just below sidebar (45) */
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
          color: #1e3a5f;
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
          color: #4b5563;
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

        /* Header actions */
        .header-actions {
          display: flex;
          gap: 0.5rem;
          margin-left: auto;
        }

        .header-btn {
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
          color: #4b5563;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .header-btn.active {
          background: #1e3a5f;
          color: white;
        }

        .header-btn svg {
          width: 20px;
          height: 20px;
        }

        /* Content layout with workspace panel */
        .code-lab-content {
          flex: 1;
          display: flex;
          min-height: 0;
          overflow: hidden;
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: flex 0.3s ease;
        }

        .chat-area.with-panel {
          flex: 0.6;
        }

        /* Workspace Panel */
        .workspace-panel {
          width: 40%;
          min-width: 300px;
          max-width: 600px;
          background: #ffffff;
          border-left: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .workspace-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 0.5rem;
          background: #fafbfc;
        }

        .workspace-tabs button {
          background: none;
          border: none;
          padding: 0.75rem 1rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.2s;
        }

        .workspace-tabs button:hover {
          color: #374151;
        }

        .workspace-tabs button.active {
          color: #1e3a5f;
          border-bottom-color: #1e3a5f;
        }

        .workspace-content {
          flex: 1;
          overflow: auto;
          padding: 1rem;
        }

        .workspace-git-actions {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-top: 1px solid #e5e7eb;
          background: #fafbfc;
        }

        .git-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .git-btn svg {
          width: 16px;
          height: 16px;
        }

        .git-btn.pull {
          color: #3b82f6;
        }

        .git-btn.pull:hover {
          background: #eff6ff;
          border-color: #3b82f6;
        }

        .git-btn.push {
          color: #22c55e;
        }

        .git-btn.push:hover {
          background: #f0fdf4;
          border-color: #22c55e;
        }

        /* Diff list */
        .diff-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .diff-empty {
          text-align: center;
          padding: 2rem 1rem;
          color: #4b5563;
        }

        .diff-empty p {
          margin: 0 0 0.5rem;
        }

        .diff-empty .hint {
          font-size: 0.8125rem;
          color: #6b7280;
        }

        /* Mobile workspace panel - z-index hierarchy:
         * 30: workspace backdrop
         * 35: workspace panel
         * 40: sidebar backdrop
         * 45: sidebar
         * 100: command palette
         * 1000: error banner
         */
        @media (max-width: 1024px) {
          .workspace-panel {
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: 100%;
            max-width: 400px;
            z-index: 35;
            box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
          }

          .chat-area.with-panel {
            flex: 1;
          }
        }

        @media (max-width: 768px) {
          .workspace-panel {
            max-width: 100%;
          }

          .header-actions {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}
