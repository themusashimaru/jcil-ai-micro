/**
 * UI-003 + UI-009: Shared hook for agent mode state management
 *
 * Consolidates the duplicated state pattern across 6 agent modes
 * (strategy, deepResearch, quickResearch, quickStrategy, deepWriter, quickWriter)
 * into a single reusable hook, reducing ~30 useState calls to 5 per instance.
 */

import { useState, useCallback } from 'react';
import type { StrategyStreamEvent } from '@/agents/strategy';

export type AgentPhase = 'idle' | 'intake' | 'executing' | 'complete' | 'error';

export interface AgentModeState {
  isActive: boolean;
  sessionId: string | null;
  phase: AgentPhase;
  loading: boolean;
  events: StrategyStreamEvent[];
}

export interface AgentModeActions {
  setActive: (active: boolean) => void;
  setSessionId: (id: string | null) => void;
  setPhase: (phase: AgentPhase) => void;
  setLoading: (loading: boolean) => void;
  setEvents: React.Dispatch<React.SetStateAction<StrategyStreamEvent[]>>;
  reset: () => void;
}

export type AgentMode = AgentModeState & AgentModeActions;

export function useAgentMode(): AgentMode {
  const [isActive, setActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<StrategyStreamEvent[]>([]);

  const reset = useCallback(() => {
    setActive(false);
    setSessionId(null);
    setPhase('idle');
    setLoading(false);
    setEvents([]);
  }, []);

  return {
    isActive,
    sessionId,
    phase,
    loading,
    events,
    setActive,
    setSessionId,
    setPhase,
    setLoading,
    setEvents,
    reset,
  };
}
