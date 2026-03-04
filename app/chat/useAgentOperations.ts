/**
 * AGENT MODE OPERATIONS HOOK
 *
 * Handles start, cancel, input, execute, and restore operations
 * for all agent modes (strategy, deep-research, etc.).
 */

import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { StrategyStreamEvent, StrategyOutput } from '@/agents/strategy';
import {
  AGENT_CONFIGS,
  ALL_MODE_IDS,
  formatResultContent,
  parseSSELine,
  type AgentModeId,
  type AgentModeRegistry,
  type Artifact,
} from './agentModes';
import type { Message } from './types';

const log = logger('ChatClient');

type SetMessages = React.Dispatch<React.SetStateAction<Message[]>>;
type SetIsStreaming = React.Dispatch<React.SetStateAction<boolean>>;

interface AgentOperationsDeps {
  modes: AgentModeRegistry;
  setMessages: SetMessages;
  setIsStreaming: SetIsStreaming;
  handleNewChat: () => void;
}

export function useAgentOperations({
  modes,
  setMessages,
  setIsStreaming,
  handleNewChat,
}: AgentOperationsDeps) {
  const startAgentMode = useCallback(
    async (modeId: AgentModeId) => {
      const mode = modes[modeId];
      const config = AGENT_CONFIGS[modeId];
      if (mode.isActive || mode.loading) return;

      mode.setLoading(true);
      setIsStreaming(true);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: config.introMessage,
          timestamp: new Date(),
        },
      ]);

      try {
        const body: Record<string, string> = { action: 'start' };
        if (config.apiMode) body.mode = config.apiMode;

        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to start ${config.label.toLowerCase()}`);
        }

        const sessionId = response.headers.get('X-Session-Id');
        if (!sessionId) throw new Error('No session ID returned from server.');

        mode.setSessionId(sessionId);
        mode.setActive(true);
        mode.setPhase('intake');
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `❌ **${config.errorPrefix} Error**\n\n${(error as Error).message}`,
            timestamp: new Date(),
          },
        ]);
        mode.setActive(false);
        mode.setPhase('idle');
      } finally {
        setIsStreaming(false);
        mode.setLoading(false);
      }
    },
    [modes, setMessages, setIsStreaming]
  );

  const cancelAgentMode = useCallback(
    async (modeId: AgentModeId) => {
      const mode = modes[modeId];
      const config = AGENT_CONFIGS[modeId];
      if (!mode.sessionId) return;
      try {
        await fetch(`/api/strategy?sessionId=${mode.sessionId}`, { method: 'DELETE' });
      } catch {
        /* ok */
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: config.cancelMessage,
          timestamp: new Date(),
        },
      ]);
      mode.setActive(false);
      mode.setPhase('idle');
      mode.setSessionId(null);
      setIsStreaming(false);
    },
    [modes, setMessages, setIsStreaming]
  );

  const exitAllAgentModes = useCallback(async () => {
    for (const id of ALL_MODE_IDS) {
      const mode = modes[id];
      if (mode.isActive && mode.sessionId) {
        try {
          await fetch(`/api/strategy?sessionId=${mode.sessionId}`, { method: 'DELETE' });
        } catch {
          /* ok */
        }
      }
      mode.reset();
    }
  }, [modes]);

  const executeAgentMode = useCallback(
    async (modeId: AgentModeId) => {
      const mode = modes[modeId];
      const config = AGENT_CONFIGS[modeId];
      if (!mode.sessionId) return;

      mode.setPhase('executing');
      setIsStreaming(true);
      mode.setEvents([]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: config.execMessage,
          timestamp: new Date(),
        },
      ]);

      try {
        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'execute', sessionId: mode.sessionId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to execute ${config.label.toLowerCase()}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let buffer = '';
        let lastProgressUpdate = Date.now();
        let progressMessageId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const sseData = parseSSELine(line);
            if (!sseData) continue;
            try {
              const event = JSON.parse(sseData) as StrategyStreamEvent & {
                data?: {
                  result?: StrategyOutput;
                  artifacts?: Artifact[];
                  completedAgents?: number;
                  totalAgents?: number;
                  cost?: number;
                };
              };
              mode.setEvents((prev) => [...prev, event]);

              if (
                config.hasProgressTracking &&
                Date.now() - lastProgressUpdate > 5000 &&
                event.data?.completedAgents !== undefined
              ) {
                lastProgressUpdate = Date.now();
                const progressContent = `📊 **Progress:** ${event.data.completedAgents}/${event.data.totalAgents || '?'} ${config.progressLabel} complete | $${(event.data.cost || 0).toFixed(2)}`;
                if (progressMessageId) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === progressMessageId ? { ...m, content: progressContent } : m
                    )
                  );
                } else {
                  progressMessageId = crypto.randomUUID();
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: progressMessageId!,
                      role: 'assistant',
                      content: progressContent,
                      timestamp: new Date(),
                    },
                  ]);
                }
              }

              if (event.type === 'strategy_complete' && event.data?.result) {
                const content = formatResultContent(
                  config,
                  event.data.result,
                  event.data.artifacts
                );
                setMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: 'assistant', content, timestamp: new Date() },
                ]);
                mode.setPhase('complete');
                mode.setActive(false);
                if (config.clearSessionOnComplete) mode.setSessionId(null);
              }
              if (event.type === 'error' || event.type === 'kill_switch')
                throw new Error(`Agent error: ${event.message}`);
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Agent error:')) throw e;
              log.warn('Failed to parse SSE event:', { error: e });
            }
          }
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `❌ **${config.errorPrefix} ${config.hasProgressTracking ? 'Failed' : 'Error'}**\n\n${(error as Error).message}`,
            timestamp: new Date(),
          },
        ]);
        mode.setPhase('error');
        if (config.deactivateOnError) mode.setActive(false);
      } finally {
        setIsStreaming(false);
      }
    },
    [modes, setMessages, setIsStreaming]
  );

  const handleAgentInput = useCallback(
    async (modeId: AgentModeId, input: string) => {
      const mode = modes[modeId];
      if (!mode.sessionId) return;
      if (input.toLowerCase().trim() === 'cancel') {
        await cancelAgentMode(modeId);
        return;
      }

      setIsStreaming(true);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: input, timestamp: new Date() },
      ]);

      try {
        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'input', sessionId: mode.sessionId, input }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to process input');
        }
        const data = await response.json();

        if (data.isComplete) {
          if (modeId !== 'quick-writer' && data.response) {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                content: data.response,
                timestamp: new Date(),
              },
            ]);
          }
          await executeAgentMode(modeId);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: data.response || 'No response received',
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `❌ **Error**\n\n${(error as Error).message}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [modes, setMessages, setIsStreaming, cancelAgentMode, executeAgentMode]
  );

  const handleSelectStrategySession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/strategy?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('Failed to load strategy session');
        const data = await response.json();

        if (data.result) {
          handleNewChat();
          const content = formatResultContent(AGENT_CONFIGS.strategy, data.result, undefined);
          const summaryMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `## 🧠 Strategy Session Restored\n\n**Agents:** ${data.totalAgents || 0} | **Searches:** ${data.totalSearches || 0}\n\n---\n\n${content}`,
            timestamp: new Date(),
          };
          setMessages([summaryMessage]);
        } else {
          handleNewChat();
          setMessages([
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `## 🧠 Strategy Session\n\n**Status:** ${data.phase}`,
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        log.error('Error loading strategy session:', error as Error);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Failed to load strategy session. Please try again.',
            timestamp: new Date(),
          },
        ]);
      }
    },
    [handleNewChat, setMessages]
  );

  return {
    startAgentMode,
    cancelAgentMode,
    exitAllAgentModes,
    handleAgentInput,
    executeAgentMode,
    handleSelectStrategySession,
  };
}
