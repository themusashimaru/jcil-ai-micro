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
import { CodeLabPlanView } from './CodeLabPlanView';
import { CodeLabModelSelector } from './CodeLabModelSelector';
import { CodeLabTokenDisplay } from './CodeLabTokenDisplay';
import { CodeLabThinkingToggle } from './CodeLabThinkingToggle';
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabSession, CodeLabMessage } from './types';
import type { FileNode } from './CodeLabLiveFileTree';
import type { FileDiff } from './CodeLabDiffViewer';
import type { Plan } from '@/lib/workspace/plan-mode';
import type { SessionStats } from '@/lib/workspace/token-tracker';
import type { ExtendedThinkingConfig } from '@/lib/workspace/extended-thinking';

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
    'files' | 'diff' | 'deploy' | 'visual' | 'debug' | 'plan'
  >('files');
  const [workspaceFiles, setWorkspaceFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  // Model selection state (Claude Code parity)
  const [currentModelId, setCurrentModelId] = useState('claude-sonnet-4-20250514');

  // Extended thinking state (Claude Code parity)
  const [thinkingConfig, setThinkingConfig] = useState<ExtendedThinkingConfig>({
    enabled: false,
    budgetTokens: 10000,
    showThinking: true,
    streamThinking: true,
  });

  // Token tracking state (Claude Code parity)
  const [tokenStats, setTokenStats] = useState<SessionStats>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCost: { inputCost: 0, outputCost: 0, cacheCost: 0, totalCost: 0, currency: 'USD' },
    messageCount: 0,
    startedAt: Date.now(),
    contextUsagePercent: 0,
  });

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

  // Fetch current plan status
  const fetchPlanStatus = async () => {
    try {
      const response = await fetch('/api/code-lab/plan');
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan || null);
      }
    } catch (err) {
      log.debug('Error fetching plan status', { error: String(err) });
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
  // MODEL & THINKING HANDLERS (Claude Code parity)
  // ========================================

  const handleModelChange = useCallback(
    (modelId: string) => {
      setCurrentModelId(modelId);
      log.info('Model changed', { modelId });
      toast.success(
        'Model Changed',
        `Switched to ${modelId.includes('opus') ? 'Opus' : modelId.includes('haiku') ? 'Haiku' : 'Sonnet'}`
      );
    },
    [toast]
  );

  const handleThinkingToggle = useCallback(() => {
    setThinkingConfig((prev) => {
      const newEnabled = !prev.enabled;
      if (newEnabled) {
        toast.success(
          'Thinking Enabled',
          `Extended thinking with ${prev.budgetTokens / 1000}K token budget`
        );
      } else {
        toast.success('Thinking Disabled', 'Normal response mode');
      }
      return { ...prev, enabled: newEnabled };
    });
  }, [toast]);

  const handleThinkingBudgetChange = useCallback(
    (budget: number) => {
      setThinkingConfig((prev) => ({ ...prev, budgetTokens: budget }));
      toast.success('Budget Updated', `Thinking budget set to ${budget / 1000}K tokens`);
    },
    [toast]
  );

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
            // Model & thinking configuration (Claude Code parity)
            modelId: currentModelId,
            thinking: thinkingConfig.enabled
              ? {
                  enabled: true,
                  budgetTokens: thinkingConfig.budgetTokens,
                }
              : undefined,
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

          // Refresh plan status in case plan tools were called
          fetchPlanStatus();

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

          // Update token stats (estimate based on content length - ~4 chars per token)
          const estimatedInputTokens = Math.ceil(content.length / 4);
          const estimatedOutputTokens = Math.ceil(fullContent.length / 4);
          setTokenStats((prev) => {
            const newInputTotal = prev.totalInputTokens + estimatedInputTokens;
            const newOutputTotal = prev.totalOutputTokens + estimatedOutputTokens;
            // Estimate cost (Sonnet pricing by default: $0.003/1K input, $0.015/1K output)
            const inputCost = (newInputTotal / 1000) * 0.003;
            const outputCost = (newOutputTotal / 1000) * 0.015;
            const contextUsagePercent = Math.min(
              100,
              ((newInputTotal + newOutputTotal) / 200000) * 100
            );
            return {
              ...prev,
              totalInputTokens: newInputTotal,
              totalOutputTokens: newOutputTotal,
              totalCost: {
                ...prev.totalCost,
                inputCost,
                outputCost,
                totalCost: inputCost + outputCost,
              },
              messageCount: prev.messageCount + 2,
              contextUsagePercent,
            };
          });

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
    [currentSessionId, currentSession?.repo, isStreaming, sessions, currentModelId, thinkingConfig]
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
      if (cmdKey && e.key === '6') {
        e.preventDefault();
        setActiveWorkspaceTab('plan');
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
            {/* Model Selector (Claude Code parity) */}
            <CodeLabModelSelector
              currentModel={currentModelId}
              onModelChange={handleModelChange}
              disabled={isStreaming}
            />

            {/* Extended Thinking Toggle (Claude Code parity) */}
            <CodeLabThinkingToggle
              config={thinkingConfig}
              onToggle={handleThinkingToggle}
              onBudgetChange={handleThinkingBudgetChange}
              disabled={isStreaming}
            />

            {/* Token Usage Display (Claude Code parity) */}
            <CodeLabTokenDisplay stats={tokenStats} compact />

            {/* Workspace Panel Toggle */}
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
                  <button
                    className={activeWorkspaceTab === 'plan' ? 'active' : ''}
                    onClick={() => {
                      setActiveWorkspaceTab('plan');
                      fetchPlanStatus();
                    }}
                  >
                    Plan {currentPlan && currentPlan.status === 'in_progress' && '●'}
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
                  {activeWorkspaceTab === 'plan' &&
                    (currentPlan ? (
                      <CodeLabPlanView
                        plan={currentPlan}
                        onApprove={async () => {
                          const res = await fetch('/api/code-lab/plan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'approve',
                              sessionId: currentSessionId,
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setCurrentPlan(data.plan);
                          }
                        }}
                        onSkipStep={async (reason) => {
                          const res = await fetch('/api/code-lab/plan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'skip',
                              reason,
                              sessionId: currentSessionId,
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setCurrentPlan(data.plan);
                          }
                        }}
                        onCancelPlan={async () => {
                          const res = await fetch('/api/code-lab/plan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'cancel', sessionId: currentSessionId }),
                          });
                          if (res.ok) {
                            setCurrentPlan(null);
                          }
                        }}
                      />
                    ) : (
                      <div className="plan-empty">
                        <div className="plan-empty-icon">📋</div>
                        <h3>No Active Plan</h3>
                        <p>Claude will create a plan when tackling complex tasks.</p>
                        <p className="hint">Plans break down work into trackable steps.</p>
                      </div>
                    ))}
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
          background: var(--cl-bg-primary);
          color: var(--cl-text-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
        }

        .code-lab-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--cl-bg-secondary);
        }

        /* Mobile backdrop */
        .mobile-backdrop {
          display: none;
        }

        /* Mobile header - hidden on desktop */
        .mobile-header {
          display: none;
        }

        /* Touch-friendly base styles - minimum 44px touch targets */
        button,
        .touch-target {
          min-height: 44px;
          min-width: 44px;
        }

        /* Tablet: 768-1024px - Adjust layout for medium screens */
        @media (min-width: 769px) and (max-width: 1024px) {
          .code-lab {
            flex-direction: row;
          }

          .code-lab-sidebar {
            width: 260px;
            flex-shrink: 0;
          }

          .code-lab-main {
            flex: 1;
          }

          /* Increase touch targets on tablet */
          button,
          .touch-target,
          .sidebar-item,
          .tab-button {
            min-height: 44px;
            padding-top: 0.625rem;
            padding-bottom: 0.625rem;
          }
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
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            min-height: 56px; /* Ensure header meets touch target */
            background: var(--cl-bg-primary);
            border-bottom: 1px solid var(--cl-border-primary);
          }

          .mobile-menu-btn {
            background: none;
            border: none;
            padding: 0.625rem;
            min-width: 44px;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--cl-text-secondary);
            border-radius: 8px;
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-menu-btn:hover,
          .mobile-menu-btn:active {
            background: var(--cl-bg-hover);
          }

          .mobile-menu-btn svg {
            width: 24px;
            height: 24px;
          }

          .mobile-title {
            font-weight: 600;
            color: var(--cl-text-primary);
            flex: 1;
            font-size: 1rem;
          }

          /* Increase all touch targets on mobile */
          button,
          .touch-target,
          .sidebar-item,
          .tab-button {
            min-height: 44px;
          }

          /* Bottom sheet style for panels */
          .bottom-sheet {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            max-height: 70vh;
            border-radius: 16px 16px 0 0;
            background: var(--cl-bg-primary);
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
            z-index: 50;
            transform: translateY(100%);
            transition: transform 0.3s ease-out;
          }

          .bottom-sheet.open {
            transform: translateY(0);
          }

          .bottom-sheet-handle {
            width: 36px;
            height: 4px;
            background: var(--cl-border-secondary);
            border-radius: 2px;
            margin: 8px auto 12px;
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
          color: var(--cl-accent-primary);
        }

        .code-lab-empty-icon svg {
          width: 100%;
          height: 100%;
        }

        .code-lab-empty h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--cl-text-primary);
          margin: 0 0 0.5rem;
        }

        .code-lab-empty p {
          color: var(--cl-text-tertiary);
          margin: 0 0 1.5rem;
        }

        .code-lab-empty-btn {
          background: var(--cl-accent-primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          min-height: 44px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .code-lab-empty-btn:hover {
          background: var(--cl-accent-secondary);
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
          padding: 0.625rem;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--cl-text-tertiary);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: var(--cl-bg-hover);
          color: var(--cl-text-secondary);
        }

        .header-btn.active {
          background: var(--cl-accent-primary);
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
          background: var(--cl-bg-primary);
          border-left: 1px solid var(--cl-border-primary);
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
          border-bottom: 1px solid var(--cl-border-primary);
          padding: 0 0.5rem;
          background: var(--cl-bg-secondary);
        }

        .workspace-tabs button {
          background: none;
          border: none;
          padding: 0.75rem 1rem;
          min-height: 44px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-tertiary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.2s;
        }

        .workspace-tabs button:hover {
          color: var(--cl-text-secondary);
        }

        .workspace-tabs button.active {
          color: var(--cl-accent-primary);
          border-bottom-color: var(--cl-accent-primary);
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
          border-top: 1px solid var(--cl-border-primary);
          background: var(--cl-bg-secondary);
        }

        .git-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          min-height: 44px;
          border: 1px solid var(--cl-border-primary);
          border-radius: 8px;
          background: var(--cl-bg-primary);
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
          color: var(--cl-info);
        }

        .git-btn.pull:hover {
          background: color-mix(in srgb, var(--cl-info) 10%, var(--cl-bg-primary));
          border-color: var(--cl-info);
        }

        .git-btn.push {
          color: var(--cl-success);
        }

        .git-btn.push:hover {
          background: color-mix(in srgb, var(--cl-success) 10%, var(--cl-bg-primary));
          border-color: var(--cl-success);
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
          color: var(--cl-text-tertiary);
        }

        .diff-empty p {
          margin: 0 0 0.5rem;
        }

        .diff-empty .hint {
          font-size: 0.8125rem;
          color: var(--cl-text-muted);
        }

        /* Plan empty state */
        .plan-empty {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--cl-text-tertiary);
        }

        .plan-empty-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .plan-empty h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary);
          margin: 0 0 0.5rem;
        }

        .plan-empty p {
          margin: 0 0 0.25rem;
          font-size: 0.875rem;
        }

        .plan-empty .hint {
          font-size: 0.8125rem;
          color: var(--cl-text-muted);
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
