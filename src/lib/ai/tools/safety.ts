/**
 * CHAT TOOLS SAFETY MODULE
 *
 * Unified safety checks for all chat-level tools.
 * Re-exports from strategy safety module for consistency.
 */

// Re-export everything from the strategy safety module
export {
  // Blocked lists
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  BLOCKED_URL_PATTERNS,
  ADULT_KEYWORDS,
  BLOCKED_FORM_ACTIONS,
  ALLOWED_FORM_TYPES,
  BLOCKED_INPUT_TYPES,
  BLOCKED_INPUT_PATTERNS,
  TRUSTED_DOMAINS,
  CONTENT_WARNING_KEYWORDS,

  // Rate limits
  RATE_LIMITS,

  // Types
  type SafetyCheckResult,

  // Safety check functions
  isUrlSafe,
  isFormActionSafe,
  isInputSafe,
  isDomainTrusted,
  sanitizeOutput,
  checkContentForWarnings,

  // Session tracking
  getSessionTracker,
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  getBlockedAttempts,
  cleanupSessionTracker,
  stopSessionCleanupInterval,

  // Logging
  logRiskyAction,
  logBlockedAction,

  // AI prompts
  AI_SAFETY_PROMPT,
  getCondensedSafetyPrompt,
} from '@/agents/strategy/tools/safety';

// ============================================================================
// CHAT-SPECIFIC COST LIMITS
// ============================================================================

/**
 * Cost limits for chat-level tools
 * Generous limits for real work - usage tracked for billing
 * Vercel timeout is the main constraint (300s max)
 */
export const CHAT_COST_LIMITS = {
  // Max cost per tool execution (in dollars)
  maxCostPerExecution: 0.50,

  // Max total cost per chat session (in dollars)
  maxCostPerSession: 5.00,

  // HARD SAFETY CAP - Protects user from runaway costs
  // Even if something goes wrong, never exceed this
  absoluteMaxCostPerSession: 20.00,

  // Max code executions per chat session
  maxCodeExecutions: 25,

  // Max browser visits per chat session
  maxBrowserVisits: 15,

  // Max vision analysis per chat session
  maxVisionAnalysis: 15,

  // Max PDF extractions per chat session
  maxPdfExtractions: 10,

  // Mini-agent limits
  maxMiniAgents: 10, // Never more than 10 parallel agents
  maxMiniAgentCost: 3.00, // $3 max for mini-agent runs
};

// ============================================================================
// CHAT SESSION COST TRACKER
// ============================================================================

interface ChatSessionCosts {
  totalCost: number;
  codeExecutions: number;
  browserVisits: number;
  visionAnalysis: number;
  pdfExtractions: number;
  toolCalls: Map<string, number>;
  createdAt: number;
  lastAccessedAt: number;
}

const chatSessionCosts = new Map<string, ChatSessionCosts>();
const CHAT_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get or create chat session cost tracker
 */
export function getChatSessionCosts(sessionId: string): ChatSessionCosts {
  const now = Date.now();

  // Cleanup old sessions
  for (const [id, session] of chatSessionCosts) {
    if (now - session.lastAccessedAt > CHAT_SESSION_TTL_MS) {
      chatSessionCosts.delete(id);
    }
  }

  if (!chatSessionCosts.has(sessionId)) {
    chatSessionCosts.set(sessionId, {
      totalCost: 0,
      codeExecutions: 0,
      browserVisits: 0,
      visionAnalysis: 0,
      pdfExtractions: 0,
      toolCalls: new Map(),
      createdAt: now,
      lastAccessedAt: now,
    });
  }

  const session = chatSessionCosts.get(sessionId)!;
  session.lastAccessedAt = now;
  return session;
}

/**
 * Check if a tool can be executed within cost limits
 */
export function canExecuteTool(
  sessionId: string,
  toolName: string,
  estimatedCost: number
): { allowed: boolean; reason?: string } {
  const session = getChatSessionCosts(sessionId);

  // HARD SAFETY CAP - Absolute maximum, protects user from runaway costs
  if (session.totalCost >= CHAT_COST_LIMITS.absoluteMaxCostPerSession) {
    return {
      allowed: false,
      reason: `Safety limit reached ($${CHAT_COST_LIMITS.absoluteMaxCostPerSession.toFixed(2)} max). Please start a new session.`,
    };
  }

  // Check total cost against soft limit
  if (session.totalCost + estimatedCost > CHAT_COST_LIMITS.maxCostPerSession) {
    // Allow if under hard cap (just warn)
    if (session.totalCost + estimatedCost <= CHAT_COST_LIMITS.absoluteMaxCostPerSession) {
      // Allow but close to limit - could add warning here
    } else {
      return {
        allowed: false,
        reason: `Session cost limit reached ($${CHAT_COST_LIMITS.maxCostPerSession.toFixed(2)} soft limit)`,
      };
    }
  }

  // Check per-execution cost
  if (estimatedCost > CHAT_COST_LIMITS.maxCostPerExecution) {
    return {
      allowed: false,
      reason: `Tool cost too high ($${estimatedCost.toFixed(2)} > $${CHAT_COST_LIMITS.maxCostPerExecution.toFixed(2)} max)`,
    };
  }

  // Check tool-specific limits
  switch (toolName) {
    case 'run_code':
      if (session.codeExecutions >= CHAT_COST_LIMITS.maxCodeExecutions) {
        return { allowed: false, reason: 'Max code executions reached for this session' };
      }
      break;
    case 'browser_visit':
    case 'puppeteer_browse':
      if (session.browserVisits >= CHAT_COST_LIMITS.maxBrowserVisits) {
        return { allowed: false, reason: 'Max browser visits reached for this session' };
      }
      break;
    case 'analyze_image':
    case 'vision_analyze':
      if (session.visionAnalysis >= CHAT_COST_LIMITS.maxVisionAnalysis) {
        return { allowed: false, reason: 'Max vision analysis reached for this session' };
      }
      break;
    case 'extract_pdf':
      if (session.pdfExtractions >= CHAT_COST_LIMITS.maxPdfExtractions) {
        return { allowed: false, reason: 'Max PDF extractions reached for this session' };
      }
      break;
  }

  return { allowed: true };
}

/**
 * Record tool execution cost
 */
export function recordToolCost(sessionId: string, toolName: string, cost: number): void {
  const session = getChatSessionCosts(sessionId);
  session.totalCost += cost;
  session.toolCalls.set(toolName, (session.toolCalls.get(toolName) || 0) + 1);

  // Update specific counters
  switch (toolName) {
    case 'run_code':
      session.codeExecutions++;
      break;
    case 'browser_visit':
    case 'puppeteer_browse':
      session.browserVisits++;
      break;
    case 'analyze_image':
    case 'vision_analyze':
      session.visionAnalysis++;
      break;
    case 'extract_pdf':
      session.pdfExtractions++;
      break;
  }
}

/**
 * Get session cost summary
 */
export function getSessionCostSummary(sessionId: string): {
  totalCost: number;
  remaining: number;
  breakdown: Record<string, number>;
} {
  const session = getChatSessionCosts(sessionId);
  const breakdown: Record<string, number> = {};

  for (const [tool, count] of session.toolCalls) {
    breakdown[tool] = count;
  }

  return {
    totalCost: session.totalCost,
    remaining: CHAT_COST_LIMITS.maxCostPerSession - session.totalCost,
    breakdown,
  };
}

/**
 * Clear session costs (for testing or reset)
 */
export function clearSessionCosts(sessionId: string): void {
  chatSessionCosts.delete(sessionId);
}
