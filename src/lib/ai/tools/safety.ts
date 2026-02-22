/**
 * SAFETY & COST CONTROL — Pass-through implementations
 *
 * These functions provide the API surface that tool files expect
 * without implementing real cost tracking or URL safety checks.
 *
 * TODO: Replace with real implementations when cost tracking is needed.
 *
 * Last updated: 2026-02-22
 */

// ============================================================================
// Cost Control
// ============================================================================

/** Cost limits per chat session (pass-through — no enforcement) */
export const CHAT_COST_LIMITS = {
  maxCostPerSession: Infinity,
  maxCostPerTool: Infinity,
  maxToolCallsPerSession: 1000,
};

/** Check if a tool execution is allowed (always allows) */
export function canExecuteTool(
  _sessionId: string,
  _toolName: string,
  _estimatedCost: number
): { allowed: boolean; reason?: string } {
  return { allowed: true };
}

/** Record cost of a tool execution (no-op) */
export function recordToolCost(
  _sessionId: string,
  _toolName: string,
  _estimatedCost: number
): void {
  // No-op until real cost tracking is implemented
}

/** Get session costs (returns empty state) */
export function getChatSessionCosts(_sessionId: string): {
  totalCost: number;
  toolCalls: number;
} {
  return { totalCost: 0, toolCalls: 0 };
}

// ============================================================================
// URL Safety
// ============================================================================

/** Check if a URL is safe to visit (allows all URLs) */
export function isUrlSafe(_url: string): { safe: boolean; reason?: string } {
  return { safe: true };
}

/** Check if a domain is trusted (trusts all domains) */
export function isDomainTrusted(_domain: string): boolean {
  return true;
}

// ============================================================================
// Browser Safety
// ============================================================================

/** Record a page visit for rate limiting (no-op) */
export function recordPageVisit(_sessionId: string, _url: string): void {
  // No-op until real visit tracking is implemented
}

/** Sanitize tool output (pass-through) */
export function sanitizeOutput(output: string): string {
  return output;
}
