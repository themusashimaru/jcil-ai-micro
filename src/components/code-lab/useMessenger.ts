/**
 * Messenger Hook for CodeLab
 *
 * Handles all messaging and model configuration:
 * - Sending messages with streaming responses
 * - Auto-search trigger detection
 * - Token usage tracking
 * - Model selection and thinking config
 * - Agent mode handling (research, strategy)
 * - Creative mode handling
 * - Stream cancellation
 * - Slash command / palette message handling
 */

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import {
  analyzeResponse,
  isConfirmation,
  isDecline,
  type SuggestedAction,
} from '@/lib/response-analysis';
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabSession, CodeLabMessage } from './types';
import type { CodeLabAttachment } from './CodeLabComposer';
import type { SessionStats } from '@/lib/workspace/token-tracker';
import type { ExtendedThinkingConfig } from '@/lib/workspace/extended-thinking';

const log = logger('Messenger');

interface UseMessengerOptions {
  currentSessionId: string | null;
  currentSession: CodeLabSession | undefined;
  sessions: CodeLabSession[];
  setSessions: React.Dispatch<React.SetStateAction<CodeLabSession[]>>;
  messages: CodeLabMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CodeLabMessage[]>>;
  setError: (error: string | null) => void;
  createSession: (title?: string) => Promise<CodeLabSession | null>;
  fetchPlanStatus: () => Promise<void>;
}

interface UseMessengerReturn {
  // Streaming state
  isStreaming: boolean;
  // Model state
  currentModelId: string;
  thinkingConfig: ExtendedThinkingConfig;
  modelSwitchFlash: boolean;
  handleModelChange: (modelId: string) => void;
  // Agent state
  activeAgent: 'research' | 'strategy' | 'deep-research' | null;
  strategyLoading: boolean;
  deepResearchLoading: boolean;
  handleAgentSelect: (agent: 'research' | 'strategy' | 'deep-research') => Promise<void>;
  // Creative mode
  handleCreativeMode: (mode: 'create-image' | 'edit-image') => void;
  // Token stats
  tokenStats: SessionStats;
  // Messaging
  sendMessage: (content: string, attachments?: CodeLabAttachment[], forceSearch?: boolean) => void;
  cancelStream: () => void;
  handleSlashCommand: (command: string) => void;
  handlePaletteMessage: (message: string) => void;
}

export function useMessenger({
  currentSessionId,
  currentSession,
  sessions,
  setSessions,
  messages: _messages,
  setMessages,
  setError,
  createSession,
  fetchPlanStatus,
}: UseMessengerOptions): UseMessengerReturn {
  const toast = useToastActions();

  // Streaming
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-search trigger
  const [pendingSearchSuggestion, setPendingSearchSuggestion] = useState<{
    action: SuggestedAction;
    originalQuestion: string | null;
  } | null>(null);

  // Model & thinking
  const [currentModelId, setCurrentModelId] = useState('deepseek-reasoner');
  const [thinkingConfig, setThinkingConfig] = useState<ExtendedThinkingConfig>({
    enabled: false,
    budgetTokens: 10000,
    showThinking: true,
    streamThinking: true,
  });
  const [modelSwitchFlash, setModelSwitchFlash] = useState(false);

  // Agent mode
  const [activeAgent, setActiveAgent] = useState<'research' | 'strategy' | 'deep-research' | null>(
    null
  );
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [deepResearchLoading, setDeepResearchLoading] = useState(false);

  // Token tracking
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

  // Model change handler
  const handleModelChange = useCallback((modelId: string) => {
    const isThinkingModel = modelId.endsWith('-thinking');
    const baseModelId = isThinkingModel ? modelId.replace('-thinking', '') : modelId;
    setCurrentModelId(baseModelId);
    setThinkingConfig((prev) => ({ ...prev, enabled: isThinkingModel }));
    log.info('Model changed', { modelId: baseModelId, thinking: isThinkingModel });
    setModelSwitchFlash(true);
    setTimeout(() => setModelSwitchFlash(false), 800);
  }, []);

  // Agent selection
  const handleAgentSelect = useCallback(
    async (agent: 'research' | 'strategy' | 'deep-research') => {
      if (activeAgent === agent) {
        setActiveAgent(null);
        setStrategyLoading(false);
        setDeepResearchLoading(false);
        log.info('Agent deactivated', { agent });
        return;
      }
      setActiveAgent(agent);
      log.info('Agent activated', { agent });
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

  // Creative mode
  const handleCreativeMode = useCallback(
    (mode: 'create-image' | 'edit-image') => {
      log.info('Creative mode selected', { mode });
      toast.info(
        mode === 'create-image'
          ? 'Describe the image you want to create in your next message'
          : 'Upload an image and describe how you want to edit it'
      );
    },
    [toast]
  );

  // Main send message function
  const sendMessage = useCallback(
    async (content: string, attachments?: CodeLabAttachment[], forceSearch?: boolean) => {
      if (!currentSessionId || isStreaming) return;

      // AUTO-SEARCH TRIGGER
      let effectiveForceSearch = forceSearch;
      let contentForAI = content;

      if (pendingSearchSuggestion) {
        const userConfirmed = isConfirmation(content);
        const userDeclined = isDecline(content);
        if (userConfirmed) {
          effectiveForceSearch = true;
          if (pendingSearchSuggestion.originalQuestion) {
            contentForAI = pendingSearchSuggestion.originalQuestion;
          }
          log.debug('User confirmed search suggestion', {
            action: pendingSearchSuggestion.action,
            originalQuestion: pendingSearchSuggestion.originalQuestion?.slice(0, 50),
          });
          setPendingSearchSuggestion(null);
        } else if (userDeclined) {
          log.debug('User declined search suggestion');
          setPendingSearchSuggestion(null);
        } else {
          setPendingSearchSuggestion(null);
        }
      }

      const sessionAtStart = sessions.find((s) => s.id === currentSessionId);
      const isFirstMessage =
        sessionAtStart?.title === 'New Session' || sessionAtStart?.messageCount === 0;

      // Convert attachments to base64
      let attachmentData: Array<{ name: string; type: string; data: string }> | undefined;
      if (attachments && attachments.length > 0) {
        attachmentData = await Promise.all(
          attachments.map(async (att) => {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(att.file);
            });
            return { name: att.file.name, type: att.file.type, data: base64 };
          })
        );
      }

      const displayContent =
        attachments && attachments.length > 0
          ? `${content}\n\n[Attached: ${attachments.map((a) => a.file.name).join(', ')}]`
          : content;

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

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: CodeLabMessage = {
        id: assistantId,
        sessionId: currentSessionId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        isStreaming: true,
        modelId: currentModelId,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/code-lab/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            content: contentForAI,
            repo: currentSession?.repo,
            attachments: attachmentData,
            forceSearch: effectiveForceSearch,
            modelId: currentModelId,
            thinking: thinkingConfig.enabled
              ? { enabled: true, budgetTokens: thinkingConfig.budgetTokens }
              : undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error('Failed to send message');

        const isActionCommand = response.headers.get('X-Action-Command') === 'true';
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            fullContent += chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
            );
          }

          // Parse token usage
          const usageMatch = fullContent.match(/<!--USAGE:({.*?})-->/);
          if (usageMatch) {
            try {
              const usage = JSON.parse(usageMatch[1]);
              fullContent = fullContent.replace(/\n?<!--USAGE:.*?-->/, '');
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
              );

              setTokenStats((prev) => {
                const newInputTotal = prev.totalInputTokens + usage.input;
                const newOutputTotal = prev.totalOutputTokens + usage.output;
                const newCacheRead = prev.totalCacheReadTokens + (usage.cacheRead || 0);
                const newCacheWrite = prev.totalCacheWriteTokens + (usage.cacheWrite || 0);
                const isOpus = usage.model?.includes('opus');
                const isHaiku = usage.model?.includes('haiku');
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

          // Handle action commands
          if (isActionCommand) {
            if (fullContent.includes('History cleared') || fullContent.includes('Session reset')) {
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
              return;
            }
          }

          // Mark streaming complete
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
          );

          // AUTO-SEARCH TRIGGER: Analyze response
          if (fullContent && !forceSearch) {
            const analysisResult = analyzeResponse(fullContent);
            if (
              analysisResult.triggerType !== 'none' &&
              analysisResult.suggestedAction !== 'none' &&
              analysisResult.suggestedPrompt
            ) {
              log.debug('Knowledge cutoff detected', {
                triggerType: analysisResult.triggerType,
                action: analysisResult.suggestedAction,
                confidence: analysisResult.confidence,
              });
              const updatedContent = fullContent + analysisResult.suggestedPrompt;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: updatedContent } : m))
              );
              setPendingSearchSuggestion({
                action: analysisResult.suggestedAction,
                originalQuestion: content,
              });
            }
          }

          // Refresh plan status
          fetchPlanStatus();

          // Update session sidebar
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date() }
                : s
            )
          );

          // Fallback token estimation
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

          // Auto-generate title for first message
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
                  setSessions((prev) =>
                    prev.map((s) => (s.id === currentSessionId ? { ...s, title } : s))
                  );
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
        if (err instanceof Error && err.name === 'AbortError') {
          log.info('Stream cancelled by user');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, content: m.content + '\n\n*[Cancelled]*' }
                : m
            )
          );
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
      setMessages,
      setError,
      setSessions,
      fetchPlanStatus,
    ]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleSlashCommand = useCallback(
    (command: string) => {
      if (!currentSessionId) {
        createSession().then((session) => {
          if (session) sendMessage(command);
        });
      } else {
        sendMessage(command);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [currentSessionId, createSession, sendMessage]
  );

  const handlePaletteMessage = useCallback(
    (message: string) => {
      if (!currentSessionId) {
        createSession().then((session) => {
          if (session) sendMessage(message);
        });
      } else {
        sendMessage(message);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [currentSessionId, createSession, sendMessage]
  );

  return {
    isStreaming,
    currentModelId,
    thinkingConfig,
    modelSwitchFlash,
    handleModelChange,
    activeAgent,
    strategyLoading,
    deepResearchLoading,
    handleAgentSelect,
    handleCreativeMode,
    tokenStats,
    sendMessage,
    cancelStream,
    handleSlashCommand,
    handlePaletteMessage,
  };
}
