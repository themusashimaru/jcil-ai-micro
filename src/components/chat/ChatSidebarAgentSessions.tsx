/**
 * CHAT SIDEBAR AGENT SESSIONS
 *
 * PURPOSE:
 * - Render the collapsible agent/strategy sessions section (admin only)
 * - Display session status icons and metadata
 *
 * Extracted from ChatSidebar.tsx to reduce component size.
 */

'use client';

interface StrategySession {
  session_id: string;
  phase: 'intake' | 'executing' | 'complete' | 'cancelled' | 'error';
  started_at: string;
  completed_at?: string;
  problem_summary?: string;
  total_agents: number;
  completed_agents: number;
  total_searches: number;
  total_cost: number;
  isActive?: boolean;
}

export interface ChatSidebarAgentSessionsProps {
  strategySessions: StrategySession[];
  strategyCollapsed: boolean;
  setStrategyCollapsed: (collapsed: boolean) => void;
  onSelectStrategySession?: (sessionId: string) => void;
}

export function ChatSidebarAgentSessions({
  strategySessions,
  strategyCollapsed,
  setStrategyCollapsed,
  onSelectStrategySession,
}: ChatSidebarAgentSessionsProps) {
  if (strategySessions.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setStrategyCollapsed(!strategyCollapsed)}
        className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-lg"
        style={{ backgroundColor: 'var(--glass-bg)' }}
      >
        <svg
          className={`h-3 w-3 transition-transform ${strategyCollapsed ? '' : 'rotate-90'}`}
          style={{ color: 'var(--text-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg
          className="w-3.5 h-3.5 text-purple-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
          Agent Sessions
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          ({strategySessions.length})
        </span>
      </button>
      {!strategyCollapsed && (
        <div className="mt-1 space-y-1">
          {strategySessions.map((session) => (
            <button
              key={session.session_id}
              onClick={() => onSelectStrategySession?.(session.session_id)}
              className="w-full p-2 text-left rounded-lg hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                {session.phase === 'complete' ? (
                  <svg
                    className="w-4 h-4 text-green-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : session.phase === 'executing' || session.isActive ? (
                  <svg
                    className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : session.phase === 'error' ? (
                  <svg
                    className="w-4 h-4 text-red-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {session.problem_summary || 'Agent Session'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {session.total_searches} searches
                    {session.total_cost > 0 && ` • $${session.total_cost.toFixed(2)}`}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
