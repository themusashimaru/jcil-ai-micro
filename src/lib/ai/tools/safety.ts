/**
 * SAFETY & COST CONTROL
 *
 * Tool execution cost tracking with per-session limits.
 * URL safety validation with SSRF protection.
 * Prompt injection sanitization for tool outputs.
 *
 * Cost tracking uses in-process Map with session-scoped counters.
 * In serverless environments, each instance tracks independently —
 * this provides a per-instance safety net, not a global budget.
 * For global cost tracking, integrate with a billing service.
 *
 * Last updated: 2026-03-07
 */

import { logger } from '@/lib/logger';

const log = logger('Safety');

// ============================================================================
// Cost Control
// ============================================================================

/** Cost limits per chat session */
export const CHAT_COST_LIMITS = {
  /** Max estimated cost ($) per session before tools are blocked */
  maxCostPerSession: 5.0,
  /** Max estimated cost ($) per single tool invocation */
  maxCostPerTool: 2.0,
  /** Max total tool calls per session */
  maxToolCallsPerSession: 200,
  /** Max concurrent mini-agents per session */
  maxMiniAgents: 5,
};

/** Per-session cost tracking state */
interface SessionCostState {
  totalCost: number;
  toolCalls: number;
  lastActivity: number;
}

// In-process session cost tracker (per serverless instance)
const sessionCosts = new Map<string, SessionCostState>();

// Cleanup stale sessions every 10 minutes
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
let lastCleanup = Date.now();

function cleanupStaleSessions(): void {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;
  for (const [id, state] of sessionCosts.entries()) {
    if (now - state.lastActivity > SESSION_TTL_MS) {
      sessionCosts.delete(id);
    }
  }
}

function getOrCreateSession(sessionId: string): SessionCostState {
  cleanupStaleSessions();
  let state = sessionCosts.get(sessionId);
  if (!state) {
    state = { totalCost: 0, toolCalls: 0, lastActivity: Date.now() };
    sessionCosts.set(sessionId, state);
  }
  return state;
}

/** Check if a tool execution is allowed based on session cost limits */
export function canExecuteTool(
  sessionId: string,
  toolName: string,
  estimatedCost: number
): { allowed: boolean; reason?: string } {
  const state = getOrCreateSession(sessionId);

  // Check per-tool cost limit
  if (estimatedCost > CHAT_COST_LIMITS.maxCostPerTool) {
    log.warn('Tool cost exceeds per-tool limit', {
      sessionId: sessionId.slice(0, 8),
      toolName,
      estimatedCost,
      limit: CHAT_COST_LIMITS.maxCostPerTool,
    });
    return {
      allowed: false,
      reason: `Tool cost ($${estimatedCost.toFixed(2)}) exceeds per-tool limit ($${CHAT_COST_LIMITS.maxCostPerTool.toFixed(2)})`,
    };
  }

  // Check session cost limit
  if (state.totalCost + estimatedCost > CHAT_COST_LIMITS.maxCostPerSession) {
    log.warn('Session cost limit reached', {
      sessionId: sessionId.slice(0, 8),
      toolName,
      currentCost: state.totalCost,
      estimatedCost,
      limit: CHAT_COST_LIMITS.maxCostPerSession,
    });
    return {
      allowed: false,
      reason: `Session cost limit reached ($${state.totalCost.toFixed(2)}/$${CHAT_COST_LIMITS.maxCostPerSession.toFixed(2)})`,
    };
  }

  // Check tool call count limit
  if (state.toolCalls >= CHAT_COST_LIMITS.maxToolCallsPerSession) {
    log.warn('Session tool call limit reached', {
      sessionId: sessionId.slice(0, 8),
      toolName,
      toolCalls: state.toolCalls,
      limit: CHAT_COST_LIMITS.maxToolCallsPerSession,
    });
    return {
      allowed: false,
      reason: `Tool call limit reached (${state.toolCalls}/${CHAT_COST_LIMITS.maxToolCallsPerSession})`,
    };
  }

  return { allowed: true };
}

/** Record cost of a tool execution */
export function recordToolCost(sessionId: string, toolName: string, estimatedCost: number): void {
  const state = getOrCreateSession(sessionId);
  state.totalCost += estimatedCost;
  state.toolCalls += 1;
  state.lastActivity = Date.now();

  log.debug('Tool cost recorded', {
    sessionId: sessionId.slice(0, 8),
    toolName,
    cost: estimatedCost,
    sessionTotal: state.totalCost,
    sessionCalls: state.toolCalls,
  });
}

/** Get session costs */
export function getChatSessionCosts(sessionId: string): {
  totalCost: number;
  toolCalls: number;
} {
  const state = sessionCosts.get(sessionId);
  if (!state) return { totalCost: 0, toolCalls: 0 };
  return { totalCost: state.totalCost, toolCalls: state.toolCalls };
}

// ============================================================================
// URL Safety
// ============================================================================

// Private/internal IP ranges that should never be fetched
const BLOCKED_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private class A
  /^172\.(1[6-9]|2\d|3[01])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local / cloud metadata
  /^0\./, // current network
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
];

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:', 'vbscript:'];

/** Check if a URL is safe to visit — blocks SSRF targets and dangerous protocols */
export function isUrlSafe(url: string): { safe: boolean; reason?: string; category?: string } {
  try {
    const parsed = new URL(url);

    // Block dangerous protocols
    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
      return { safe: false, reason: `Blocked protocol: ${parsed.protocol}`, category: 'protocol' };
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        safe: false,
        reason: `Unsupported protocol: ${parsed.protocol}`,
        category: 'protocol',
      };
    }

    const hostname = parsed.hostname;

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::1]') {
      return { safe: false, reason: 'Localhost access blocked', category: 'ssrf' };
    }

    // Block private/internal IPs
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Internal IP access blocked', category: 'ssrf' };
      }
    }

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { safe: false, reason: 'Cloud metadata access blocked', category: 'ssrf' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL', category: 'parse' };
  }
}

/** Check if a domain is trusted */
export function isDomainTrusted(domain: string): boolean {
  const check = isUrlSafe(`https://${domain}`);
  return check.safe;
}

// ============================================================================
// Browser Safety
// ============================================================================

/** Check if a session can visit a page — delegates to URL safety check */
export function canVisitPage(_sessionId: string, url: string): { safe: boolean; reason?: string } {
  return isUrlSafe(url);
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
