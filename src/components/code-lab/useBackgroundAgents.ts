/**
 * Background Agents Hook for CodeLab
 *
 * Manages background agent state and lifecycle:
 * - Spawning and updating agents
 * - Auto-cleanup of completed agents after retention period
 * - Window API exposure for external tool invocation
 */

import { useState, useEffect, useCallback } from 'react';

const AGENT_CLEANUP_INTERVAL_MS = 60000; // 1 minute
const AGENT_RETENTION_TIME_MS = 5 * 60 * 1000; // 5 minutes

export interface BackgroundAgent {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  output?: string;
}

interface UseBackgroundAgentsReturn {
  backgroundAgents: BackgroundAgent[];
}

export function useBackgroundAgents(): UseBackgroundAgentsReturn {
  const [backgroundAgents, setBackgroundAgents] = useState<BackgroundAgent[]>([]);

  const spawnBackgroundAgent = useCallback((name: string) => {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setBackgroundAgents((prev) => [
      ...prev,
      { id, name, status: 'running', startedAt: new Date() },
    ]);
    return id;
  }, []);

  const updateBackgroundAgent = useCallback(
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

  // Expose API for external tool invocation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__codeLabAgentAPI = {
        spawn: spawnBackgroundAgent,
        update: updateBackgroundAgent,
      };
    }
  }, [spawnBackgroundAgent, updateBackgroundAgent]);

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

  return { backgroundAgents };
}
