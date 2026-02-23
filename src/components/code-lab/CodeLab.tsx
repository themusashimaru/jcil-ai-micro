'use client';

/**
 * CODE LAB - Main Layout Component
 *
 * A professional developer workspace that combines:
 * - Chat with Claude Opus 4.6
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
import './code-lab.css';
import { logger } from '@/lib/logger';
// AUTO-SEARCH TRIGGER: Detect knowledge cutoff mentions and suggest search
import {
  analyzeResponse,
  isConfirmation,
  isDecline,
  type SuggestedAction,
} from '@/lib/response-analysis';
// HIGH-003: Import async state helpers for race condition protection

const log = logger('CodeLab');

// ========================================
// CONSTANTS
// ========================================
const AGENT_CLEANUP_INTERVAL_MS = 60000; // 1 minute - how often to check for stale agents
const AGENT_RETENTION_TIME_MS = 5 * 60 * 1000; // 5 minutes - how long to keep completed agents

import { CodeLabSidebar } from './CodeLabSidebar';
import { CodeLabThread } from './CodeLabThread';
import { CodeLabComposer, CodeLabAttachment } from './CodeLabComposer';
import { CodeLabCommandPalette } from './CodeLabCommandPalette';
import { CodeLabKeyboardShortcuts } from './CodeLabKeyboardShortcuts';
// CodeLabModelSelector is now integrated into CodeLabComposer for cleaner UX
import { CodeLabTokenDisplay } from './CodeLabTokenDisplay';
// CodeLabThinkingToggle removed - thinking mode now integrated into model selector
// Users can select "Sonnet (Thinking)" or "Opus (Thinking)" from the dropdown
// MCP settings removed — AI uses tools seamlessly behind the scenes
// Thinking block visualization ready for extended thinking (Claude Code parity)
// Note: CodeLabThinkingBlock and parseThinkingBlocks are exported for use in CodeLabThread
export { CodeLabThinkingBlock, parseThinkingBlocks } from './CodeLabThinkingBlock';
import { CodeLabStatusBar } from './CodeLabStatusBar';
import { CodeLabWorkspacePanel } from './CodeLabWorkspacePanel';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useSessionManager } from './useSessionManager';
import { useWorkspaceManager } from './useWorkspaceManager';
import { CodeLabPermissionDialog, usePermissionManager } from './CodeLabPermissionDialog';
import {
  CodeLabFileChangeIndicator,
  useFileChangeNotifications,
} from './CodeLabFileChangeIndicator';
import { CodeLabSessionHistory } from './CodeLabSessionHistory';
// HIGH-005: Error boundary for sub-components
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabMessage } from './types';
import type { SessionStats } from '@/lib/workspace/token-tracker';
import type { ExtendedThinkingConfig } from '@/lib/workspace/extended-thinking';

interface CodeLabProps {
  userId?: string;
}

export function CodeLab({ userId: _userId }: CodeLabProps) {
  // ========================================
  // STATE — Session management (extracted to hook)
  // ========================================

  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    setMessages,
    isLoading,
    setError,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    exportSession,
    setSessionRepo,
  } = useSessionManager();

  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // AUTO-SEARCH TRIGGER: Track pending search suggestions after knowledge cutoff detection
  const [pendingSearchSuggestion, setPendingSearchSuggestion] = useState<{
    action: SuggestedAction;
    originalQuestion: string | null;
  } | null>(null);

  const toast = useToastActions();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Permission manager for dangerous operations (Claude Code parity)
  const {
    pendingRequest: permissionRequest,
    isDialogOpen: permissionDialogOpen,
    requestPermission,
    handleAllow: handlePermissionAllow,
    handleDeny: handlePermissionDeny,
  } = usePermissionManager();

  // File change notifications (Claude Code parity)
  const {
    hasChanges: hasFileChanges,
    clearChanges: clearFileChanges,
    dismissChanges: dismissFileChanges,
  } = useFileChangeNotifications(currentSessionId);

  // Workspace panel state
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'files' | 'diff' | 'deploy' | 'visual' | 'debug' | 'plan' | 'memory' | 'tasks'
  >('files');

  // Background agents state (Claude Code Ctrl+B parity)
  const [backgroundAgents, setBackgroundAgents] = useState<
    Array<{
      id: string;
      name: string;
      status: 'running' | 'completed' | 'failed';
      startedAt: Date;
      output?: string;
    }>
  >([]);

  // Background agent management functions (Claude Code parity)
  // Underscore prefix indicates these are exposed via context/API for tools to spawn parallel agents
  const _spawnBackgroundAgent = useCallback((name: string) => {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setBackgroundAgents((prev) => [
      ...prev,
      { id, name, status: 'running', startedAt: new Date() },
    ]);
    return id;
  }, []);

  const _updateBackgroundAgent = useCallback(
    (
      id: string,
      update: Partial<{ status: 'running' | 'completed' | 'failed'; output: string }>
    ) => {
      setBackgroundAgents((prev) =>
        prev.map((agent) => (agent.id === id ? { ...agent, ...update } : agent))
      );
    },
    []
  );

  // Export for external use (context provider would expose these)
  // This enables spawning background agents from AI tools
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__codeLabAgentAPI = {
      spawn: _spawnBackgroundAgent,
      update: _updateBackgroundAgent,
    };
  }

  // Clean up completed agents after retention period
  useEffect(() => {
    const interval = setInterval(() => {
      setBackgroundAgents((prev) =>
        prev.filter(
          (agent) =>
            agent.status === 'running' ||
            new Date().getTime() - agent.startedAt.getTime() < AGENT_RETENTION_TIME_MS
        )
      );
    }, AGENT_CLEANUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
  // Model selection state - default to DeepSeek for cost-effectiveness
  const [currentModelId, setCurrentModelId] = useState('deepseek-reasoner');

  // Extended thinking state (Claude Code parity)
  const [thinkingConfig, setThinkingConfig] = useState<ExtendedThinkingConfig>({
    enabled: false,
    budgetTokens: 10000,
    showThinking: true,
    streamThinking: true,
  });

  // Agent mode state (Deep Research, Deep Strategy, Research)
  const [activeAgent, setActiveAgent] = useState<'research' | 'strategy' | 'deep-research' | null>(
    null
  );
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [deepResearchLoading, setDeepResearchLoading] = useState(false);

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

  // Workspace management (extracted to hook)
  const {
    workspaceFiles,
    selectedFile,
    diffFiles,
    currentPlan,
    setCurrentPlan,
    memoryFile,
    memoryLoading,
    loadWorkspaceFiles,
    fetchPlanStatus,
    handleFileSelect,
    handleFileCreate,
    handleFileDelete,
    handleGitPush,
    handleGitPull,
    handleVisualToCode,
    handleDeploy,
    loadMemoryFile,
    saveMemoryFile,
  } = useWorkspaceManager({
    currentSessionId,
    currentSession,
    setError,
    requestPermission,
  });

  // ========================================
  // MODEL & THINKING HANDLERS (Claude Code parity)
  // ========================================

  // Track model switch flash state for visual feedback
  const [modelSwitchFlash, setModelSwitchFlash] = useState(false);

  const handleModelChange = useCallback((modelId: string) => {
    // Check if this is a "thinking" model variant
    const isThinkingModel = modelId.endsWith('-thinking');
    const baseModelId = isThinkingModel ? modelId.replace('-thinking', '') : modelId;

    // Set the actual model ID (without -thinking suffix)
    setCurrentModelId(baseModelId);

    // Auto-enable/disable extended thinking based on model selection
    setThinkingConfig((prev) => ({
      ...prev,
      enabled: isThinkingModel,
    }));

    log.info('Model changed', { modelId: baseModelId, thinking: isThinkingModel });

    // Trigger green flash animation instead of toast notification
    setModelSwitchFlash(true);
    setTimeout(() => setModelSwitchFlash(false), 800); // Flash for 800ms
  }, []);

  // Agent selection handler (Deep Research, Deep Strategy, Research)
  const handleAgentSelect = useCallback(
    async (agent: 'research' | 'strategy' | 'deep-research') => {
      // Toggle off if already active
      if (activeAgent === agent) {
        setActiveAgent(null);
        setStrategyLoading(false);
        setDeepResearchLoading(false);
        log.info('Agent deactivated', { agent });
        return;
      }

      // Switch to new agent
      setActiveAgent(agent);
      log.info('Agent activated', { agent });

      // Show loading state briefly for strategy/deep-research
      if (agent === 'strategy') {
        setStrategyLoading(true);
        setTimeout(() => setStrategyLoading(false), 500);
      } else if (agent === 'deep-research') {
        setDeepResearchLoading(true);
        setTimeout(() => setDeepResearchLoading(false), 500);
      }

      toast.info(
        agent === 'deep-research'
          ? 'Deep Research mode active - your next message will trigger multi-source research'
          : agent === 'strategy'
            ? 'Deep Strategy mode active - extended thinking enabled for planning'
            : 'Research mode active - quick web search with AI summary'
      );
    },
    [activeAgent, toast]
  );

  // Creative mode handler (Create Image, Edit Image)
  const handleCreativeMode = useCallback(
    (mode: 'create-image' | 'edit-image') => {
      log.info('Creative mode selected', { mode });
      toast.info(
        mode === 'create-image'
          ? 'Describe the image you want to create in your next message'
          : 'Upload an image and describe how you want to edit it'
      );
      // The actual image generation will be handled by the chat route
      // based on the user's message and any attached images
    },
    [toast]
  );

  // ========================================
  // MESSAGING
  // ========================================

  const sendMessage = useCallback(
    async (content: string, attachments?: CodeLabAttachment[], forceSearch?: boolean) => {
      if (!currentSessionId || isStreaming) return;

      // AUTO-SEARCH TRIGGER: Check if user is responding to a search suggestion
      let effectiveForceSearch = forceSearch;
      let contentForAI = content;

      if (pendingSearchSuggestion) {
        const userConfirmed = isConfirmation(content);
        const userDeclined = isDecline(content);

        if (userConfirmed) {
          // User confirmed search - trigger Perplexity search
          effectiveForceSearch = true;
          // Use the original question for the search
          if (pendingSearchSuggestion.originalQuestion) {
            contentForAI = pendingSearchSuggestion.originalQuestion;
          }
          log.debug('User confirmed search suggestion', {
            action: pendingSearchSuggestion.action,
            originalQuestion: pendingSearchSuggestion.originalQuestion?.slice(0, 50),
          });
          setPendingSearchSuggestion(null);
        } else if (userDeclined) {
          // User declined - clear pending suggestion
          log.debug('User declined search suggestion');
          setPendingSearchSuggestion(null);
        }
        // If neither confirmed nor declined, treat as new question and clear suggestion
        else {
          setPendingSearchSuggestion(null);
        }
      }

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
        modelId: currentModelId, // Track which model generated this response
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
            // Use contentForAI for search (may be original question after confirmation)
            content: contentForAI,
            repo: currentSession?.repo,
            attachments: attachmentData,
            // Use effectiveForceSearch (true if user confirmed search suggestion)
            forceSearch: effectiveForceSearch,
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

        // Check if this is an action command (like /clear, /reset)
        const isActionCommand = response.headers.get('X-Action-Command') === 'true';

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

          // Parse real token usage from API response (sent as hidden marker)
          const usageMatch = fullContent.match(/<!--USAGE:({.*?})-->/);
          if (usageMatch) {
            try {
              const usage = JSON.parse(usageMatch[1]);
              // Remove usage marker from displayed content
              fullContent = fullContent.replace(/\n?<!--USAGE:.*?-->/, '');
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
              );

              // Update token stats with REAL values from API
              setTokenStats((prev) => {
                const newInputTotal = prev.totalInputTokens + usage.input;
                const newOutputTotal = prev.totalOutputTokens + usage.output;
                const newCacheRead = prev.totalCacheReadTokens + (usage.cacheRead || 0);
                const newCacheWrite = prev.totalCacheWriteTokens + (usage.cacheWrite || 0);

                // Calculate real cost based on model
                const isOpus = usage.model?.includes('opus');
                const isHaiku = usage.model?.includes('haiku');
                // Pricing per 1K tokens
                const inputPrice = isOpus ? 0.015 : isHaiku ? 0.00025 : 0.003;
                const outputPrice = isOpus ? 0.075 : isHaiku ? 0.00125 : 0.015;

                const inputCost = (newInputTotal / 1000) * inputPrice;
                const outputCost = (newOutputTotal / 1000) * outputPrice;
                const contextUsagePercent = Math.min(
                  100,
                  ((newInputTotal + newOutputTotal) / 200000) * 100
                );

                return {
                  totalInputTokens: newInputTotal,
                  totalOutputTokens: newOutputTotal,
                  totalCacheReadTokens: newCacheRead,
                  totalCacheWriteTokens: newCacheWrite,
                  totalCost: {
                    inputCost,
                    outputCost,
                    cacheCost: 0,
                    totalCost: inputCost + outputCost,
                    currency: 'USD',
                  },
                  messageCount: prev.messageCount + 2,
                  startedAt: prev.startedAt,
                  contextUsagePercent,
                };
              });
            } catch {
              log.warn('Failed to parse token usage');
            }
          }

          // Handle action commands that modify local state
          if (isActionCommand) {
            if (fullContent.includes('History cleared') || fullContent.includes('Session reset')) {
              // Clear local messages - keep only the action response
              setMessages([
                {
                  id: assistantId,
                  sessionId: currentSessionId,
                  role: 'assistant',
                  content: fullContent,
                  createdAt: new Date(),
                  isStreaming: false,
                  modelId: currentModelId,
                },
              ]);
              // Reset token stats
              setTokenStats({
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalCacheReadTokens: 0,
                totalCacheWriteTokens: 0,
                totalCost: {
                  inputCost: 0,
                  outputCost: 0,
                  cacheCost: 0,
                  totalCost: 0,
                  currency: 'USD',
                },
                messageCount: 0,
                startedAt: Date.now(),
                contextUsagePercent: 0,
              });
              setIsStreaming(false);
              return; // Early exit - don't continue with normal flow
            }
          }

          // Mark streaming as complete
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
          );

          // AUTO-SEARCH TRIGGER: Analyze response for knowledge cutoff mentions
          // If detected, append a suggestion and track for confirmation
          if (fullContent && !forceSearch) {
            const analysisResult = analyzeResponse(fullContent);

            if (
              analysisResult.triggerType !== 'none' &&
              analysisResult.suggestedAction !== 'none' &&
              analysisResult.suggestedPrompt
            ) {
              log.debug('Knowledge cutoff detected, suggesting search', {
                triggerType: analysisResult.triggerType,
                action: analysisResult.suggestedAction,
                confidence: analysisResult.confidence,
              });

              // Append the suggestion to the message
              const updatedContent = fullContent + analysisResult.suggestedPrompt;

              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: updatedContent } : m))
              );

              // Track pending suggestion for confirmation handling
              setPendingSearchSuggestion({
                action: analysisResult.suggestedAction,
                originalQuestion: content,
              });
            }
          }

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

          // Token stats are now updated from real API usage (see usageMatch handling above)
          // This fallback only runs if API didn't return usage data
          if (!usageMatch) {
            const estimatedInputTokens = Math.ceil(content.length / 4);
            const estimatedOutputTokens = Math.ceil(fullContent.length / 4);
            setTokenStats((prev) => ({
              ...prev,
              totalInputTokens: prev.totalInputTokens + estimatedInputTokens,
              totalOutputTokens: prev.totalOutputTokens + estimatedOutputTokens,
              messageCount: prev.messageCount + 2,
            }));
          }

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
    [
      currentSessionId,
      currentSession?.repo,
      isStreaming,
      sessions,
      currentModelId,
      thinkingConfig,
      pendingSearchSuggestion,
    ]
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

  // Keyboard shortcuts (extracted to hook)
  useKeyboardShortcuts({
    isStreaming,
    sidebarCollapsed,
    createSession,
    cancelStream,
    setSidebarCollapsed,
    setCommandPaletteOpen,
    setShortcutsOpen,
    setHistoryOpen,
    setWorkspacePanelOpen,
    setActiveWorkspaceTab,
  });

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
            {/* Model Selector & Thinking mode moved to composer for cleaner UX */}
            {/* Users can now select "Sonnet (Thinking)" or "Opus (Thinking)" from the model dropdown */}

            {/* Token Usage Display (Claude Code parity) */}
            <CodeLabTokenDisplay stats={tokenStats} compact />

            {/* Workspace Panel Toggle */}
            <button
              className={`header-btn ${workspacePanelOpen ? 'active' : ''}`}
              onClick={() => setWorkspacePanelOpen(!workspacePanelOpen)}
              title="Workspace Panel (Cmd+E)"
              aria-label="Toggle Workspace Panel"
              aria-pressed={workspacePanelOpen}
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

              {/* Composer - Input with inline model selector */}
              <CodeLabComposer
                onSend={sendMessage}
                isStreaming={isStreaming}
                onCancel={cancelStream}
                placeholder="Ask anything, build anything..."
                disabled={!currentSessionId}
                currentModel={currentModelId}
                onModelChange={handleModelChange}
                thinkingEnabled={thinkingConfig.enabled}
                modelSwitchFlash={modelSwitchFlash}
                // Agent buttons (Deep Research, Deep Strategy, Research)
                activeAgent={activeAgent}
                onAgentSelect={handleAgentSelect}
                strategyLoading={strategyLoading}
                deepResearchLoading={deepResearchLoading}
                // Creative tools (Create Image, Edit Image)
                onCreativeMode={handleCreativeMode}
              />
            </div>

            {/* Workspace Panel */}
            {workspacePanelOpen && currentSessionId && (
              <CodeLabWorkspacePanel
                activeTab={activeWorkspaceTab}
                setActiveTab={setActiveWorkspaceTab}
                onClose={() => setWorkspacePanelOpen(false)}
                currentSessionId={currentSessionId}
                currentSession={currentSession}
                workspaceFiles={workspaceFiles}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileCreate={handleFileCreate}
                onFileDelete={handleFileDelete}
                onRefreshFiles={() => {
                  if (currentSessionId) loadWorkspaceFiles(currentSessionId);
                }}
                diffFiles={diffFiles}
                onDeploy={handleDeploy}
                onVisualToCode={handleVisualToCode}
                onInsertCode={(code) =>
                  sendMessage(`/create file with this code:\n\`\`\`\n${code}\n\`\`\``)
                }
                onAIAnalysis={(debugState) => {
                  const debugContext = JSON.stringify(debugState, null, 2);
                  sendMessage(
                    `/analyze this debug state and help me understand what's happening:\n\`\`\`json\n${debugContext}\n\`\`\``
                  );
                }}
                currentPlan={currentPlan}
                setCurrentPlan={setCurrentPlan}
                fetchPlanStatus={fetchPlanStatus}
                memoryFile={memoryFile}
                onSaveMemory={saveMemoryFile}
                onLoadMemory={loadMemoryFile}
                memoryLoading={memoryLoading}
                backgroundAgents={backgroundAgents}
                onGitPull={handleGitPull}
                onGitPush={handleGitPush}
              />
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

        {/* Status Bar - Professional status visibility (Claude Code parity) */}
        {currentSessionId && (
          <CodeLabStatusBar
            model={
              currentModelId.includes('opus')
                ? 'opus'
                : currentModelId.includes('haiku')
                  ? 'haiku'
                  : 'sonnet'
            }
            tokens={{
              used: tokenStats.totalInputTokens + tokenStats.totalOutputTokens,
              limit: 200000,
              costUSD: tokenStats.totalCost.totalCost,
            }}
            connectionStatus="connected"
            sandboxStatus={currentSession?.repo ? 'active' : 'stopped'}
            git={
              currentSession?.repo
                ? {
                    branch: currentSession.repo.branch || 'main',
                    isDirty: false,
                  }
                : undefined
            }
            mcpServersActive={0}
            onModelClick={() => {
              /* Model selector handles this */
            }}
            onTokensClick={() => setWorkspacePanelOpen(true)}
          />
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

      {/* Session History Search (Claude Code parity) */}
      <CodeLabSessionHistory
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={(sessionId) => {
          setCurrentSessionId(sessionId);
          setHistoryOpen(false);
        }}
        currentSessionId={currentSessionId}
      />

      {/* File Change Indicator (Claude Code parity) */}
      {hasFileChanges && (
        <CodeLabFileChangeIndicator
          sessionId={currentSessionId}
          workspaceActive={!!currentSession?.repo}
          onRefresh={() => {
            if (currentSessionId) {
              loadWorkspaceFiles(currentSessionId);
            }
            clearFileChanges();
          }}
          onDismiss={dismissFileChanges}
        />
      )}

      {/* Permission Dialog for dangerous operations (Claude Code parity) */}
      <CodeLabPermissionDialog
        request={permissionRequest}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        isOpen={permissionDialogOpen}
      />

      {/* Styles moved to code-lab.css */}
    </div>
  );
}
