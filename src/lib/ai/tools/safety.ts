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
