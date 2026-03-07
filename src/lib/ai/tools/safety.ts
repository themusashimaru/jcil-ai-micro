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
  maxMiniAgents: 5,
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
export function isUrlSafe(_url: string): { safe: boolean; reason?: string; category?: string } {
  return { safe: true };
}

/** Check if a domain is trusted (trusts all domains) */
export function isDomainTrusted(_domain: string): boolean {
  return true;
}

// ============================================================================
// Browser Safety
// ============================================================================

/** Check if a session can visit a page (allows all visits) */
export function canVisitPage(_sessionId: string, _url: string): { safe: boolean; reason?: string } {
  return { safe: true };
}

/** Record a page visit for rate limiting (no-op) */
export function recordPageVisit(_sessionId: string, _url: string): void {
  // No-op until real visit tracking is implemented
}

/**
 * Sanitize tool output to prevent indirect prompt injection.
 * Strips patterns that could trick the model into changing behavior
 * when processing tool results from external sources.
 */
export function sanitizeOutput(output: string): string {
  if (!output) return output;

  let sanitized = output;

  // Strip system/instruction XML tags from external content
  sanitized = sanitized.replace(
    /<\/?(?:system|instructions?|prompt|override|admin|root|command|execute|ignore|forget|reset|mode|persona|role)[^>]*>/gi,
    ''
  );

  // Strip "ignore previous instructions" patterns from tool output
  sanitized = sanitized.replace(
    /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?|guidelines?|context)/gi,
    '[content filtered]'
  );

  // Strip role reassignment attempts from external content
  sanitized = sanitized.replace(
    /(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you\s+are)|from\s+now\s+on\s+you\s+are|new\s+instructions?:)/gi,
    '[content filtered]'
  );

  return sanitized;
}
