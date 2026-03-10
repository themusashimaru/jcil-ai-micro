import { createStrategyAgent } from '@/agents/strategy';

type SessionPhase = 'intake' | 'executing' | 'complete' | 'cancelled' | 'error';

interface StrategyAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

interface ActiveSession {
  agent: ReturnType<typeof createStrategyAgent>;
  dbId: string; // UUID from database
  started: number;
  phase: SessionPhase;
}

// =============================================================================
// ACTIVE SESSIONS (In-memory for running agents)
// Database provides persistence; this Map holds live agent instances
// =============================================================================

const activeSessions = new Map<string, ActiveSession>();

export { activeSessions };
export type { SessionPhase, StrategyAttachment, ActiveSession };
