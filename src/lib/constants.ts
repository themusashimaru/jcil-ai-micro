/**
 * APPLICATION CONSTANTS
 *
 * Centralized configuration values to avoid magic numbers throughout the codebase.
 * These values control rate limits, timeouts, pagination, and other behaviors.
 */

// ========================================
// PAGINATION DEFAULTS
// ========================================

export const PAGINATION = {
  /** Default page size for admin lists */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum page size for admin lists */
  MAX_PAGE_SIZE: 100,
  /** Default page size for user-facing lists */
  USER_DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size for user-facing lists */
  USER_MAX_PAGE_SIZE: 50,
} as const;

// ========================================
// RATE LIMITING
// ========================================

export const RATE_LIMITS = {
  /** Chat messages per minute for free users */
  CHAT_FREE_PER_MINUTE: 5,
  /** Chat messages per minute for paid users */
  CHAT_PAID_PER_MINUTE: 30,
  /** Support ticket submissions per hour */
  SUPPORT_TICKETS_PER_HOUR: 3,
  /** API requests per minute (general) */
  API_REQUESTS_PER_MINUTE: 60,
  /** Login attempts per hour */
  LOGIN_ATTEMPTS_PER_HOUR: 10,
  /** Password reset requests per hour */
  PASSWORD_RESET_PER_HOUR: 3,
  /** Image generations per minute */
  IMAGE_GEN_PER_MINUTE: 5,
  /** Code Lab shell commands per minute */
  CODE_LAB_SHELL_PER_MINUTE: 60,
  /** Code Lab file operations per minute */
  CODE_LAB_FILES_PER_MINUTE: 120,
  /** Code Lab debug operations per minute */
  CODE_LAB_DEBUG_PER_MINUTE: 60,
  /** Code Lab edit operations per minute */
  CODE_LAB_EDIT_PER_MINUTE: 60,
  /** Code Lab LSP operations per minute */
  CODE_LAB_LSP_PER_MINUTE: 200,
} as const;

// ========================================
// TIERED RATE LIMITS BY SUBSCRIPTION
// ========================================

export type SubscriptionTier = 'free' | 'plus' | 'pro' | 'executive' | 'admin';

export const TIERED_RATE_LIMITS = {
  /** Chat messages per minute by tier */
  CHAT_PER_MINUTE: {
    free: 5, // 5 messages/min for free
    plus: 30, // 30 messages/min for Plus
    pro: 60, // 60 messages/min for Pro
    executive: 120, // 120 messages/min for Executive
    admin: 999, // Effectively unlimited for admins
  },
  /** Chat messages per hour by tier */
  CHAT_PER_HOUR: {
    free: 30, // 30 messages/hour for free
    plus: 300, // 300 messages/hour for Plus
    pro: 600, // 600 messages/hour for Pro
    executive: 1200, // 1200 messages/hour for Executive
    admin: 9999, // Effectively unlimited for admins
  },
  /** API requests per minute by tier */
  API_PER_MINUTE: {
    free: 30, // 30 req/min for free
    plus: 100, // 100 req/min for Plus
    pro: 200, // 200 req/min for Pro
    executive: 500, // 500 req/min for Executive
    admin: 9999, // Effectively unlimited for admins
  },
  /** Image generations per minute by tier */
  IMAGE_PER_MINUTE: {
    free: 1, // 1 image/min for free
    plus: 3, // 3 images/min for Plus
    pro: 5, // 5 images/min for Pro
    executive: 10, // 10 images/min for Executive
    admin: 99, // High limit for admins
  },
  /** Image generations per hour by tier */
  IMAGE_PER_HOUR: {
    free: 5, // 5 images/hour for free
    plus: 20, // 20 images/hour for Plus
    pro: 50, // 50 images/hour for Pro
    executive: 100, // 100 images/hour for Executive
    admin: 999, // High limit for admins
  },
} as const;

// ========================================
// TIMEOUTS (in milliseconds)
// ========================================

export const TIMEOUTS = {
  /** API request timeout */
  API_REQUEST: 30_000, // 30 seconds
  /** Long-running API request timeout */
  LONG_API_REQUEST: 120_000, // 2 minutes
  /** WebSocket ping interval */
  WEBSOCKET_PING: 30_000, // 30 seconds
  /** Session idle timeout */
  SESSION_IDLE: 30 * 60 * 1000, // 30 minutes
  /** File upload timeout */
  FILE_UPLOAD: 60_000, // 1 minute
  /** AI model response timeout */
  AI_RESPONSE: 90_000, // 90 seconds
  /** Code execution timeout */
  CODE_EXECUTION: 60_000, // 1 minute
} as const;

// ========================================
// CACHE TTL (in seconds)
// ========================================

export const CACHE_TTL = {
  /** Short-lived cache (1 minute) */
  SHORT: 60,
  /** Medium cache (5 minutes) */
  MEDIUM: 300,
  /** Long cache (30 minutes) */
  LONG: 1800,
  /** User session cache (1 hour) */
  USER_SESSION: 3600,
  /** Static data cache (24 hours) */
  STATIC: 86400,
  /** Admin stats cache (5 minutes) */
  ADMIN_STATS: 300,
  /** Rate limit window (2 hours) */
  RATE_LIMIT_WINDOW: 7200,
} as const;

// ========================================
// FILE UPLOAD LIMITS
// ========================================

export const FILE_LIMITS = {
  /** Maximum file size for general uploads (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Maximum file size for images (5MB) */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  /** Maximum file size for documents (20MB) */
  MAX_DOCUMENT_SIZE: 20 * 1024 * 1024,
  /** Maximum total upload size per request (50MB) */
  MAX_TOTAL_UPLOAD_SIZE: 50 * 1024 * 1024,
  /** Maximum files per upload request */
  MAX_FILES_PER_REQUEST: 10,
} as const;

// ========================================
// MESSAGE LIMITS
// ========================================

export const MESSAGE_LIMITS = {
  /** Maximum message length (characters) */
  MAX_MESSAGE_LENGTH: 32_000,
  /** Maximum conversation title length */
  MAX_TITLE_LENGTH: 200,
  /** Maximum messages per conversation before summary */
  MESSAGES_BEFORE_SUMMARY: 50,
  /** Minimum message length for processing */
  MIN_MESSAGE_LENGTH: 1,
} as const;

// ========================================
// TOKEN LIMITS BY PLAN
// ========================================

export const TOKEN_LIMITS = {
  /** Free tier - one-time trial */
  FREE: 10_000,
  /** Plus tier - monthly */
  PLUS: 1_000_000,
  /** Pro tier - monthly */
  PRO: 3_000_000,
  /** Executive tier - monthly */
  EXECUTIVE: 5_000_000,
} as const;

// ========================================
// IMAGE GENERATION LIMITS BY PLAN
// ========================================

export const IMAGE_LIMITS = {
  /** Free tier - monthly */
  FREE: 5,
  /** Plus tier - monthly */
  PLUS: 20,
  /** Pro tier - monthly */
  PRO: 50,
  /** Executive tier - monthly */
  EXECUTIVE: 100,
} as const;

// ========================================
// DATA RETENTION (in days)
// ========================================

export const RETENTION = {
  /** Conversation retention period */
  CONVERSATIONS: 90, // 3 months
  /** Message retention period */
  MESSAGES: 90, // 3 months
  /** Upload retention period */
  UPLOADS: 90, // 3 months
  /** Rate limit record cleanup */
  RATE_LIMIT_RECORDS: 1, // 24 hours
  /** Session data retention */
  SESSION_DATA: 30, // 30 days
} as const;

// ========================================
// UI/UX CONSTANTS
// ========================================

export const UI = {
  /** Typing indicator threshold (ms) */
  TYPING_INDICATOR_THRESHOLD: 300,
  /** Auto-save interval (ms) */
  AUTO_SAVE_INTERVAL: 5000,
  /** Toast notification duration (ms) */
  TOAST_DURATION: 5000,
  /** Animation duration (ms) */
  ANIMATION_DURATION: 200,
  /** Debounce delay for search (ms) */
  SEARCH_DEBOUNCE: 300,
  /** Maximum recent items to show */
  MAX_RECENT_ITEMS: 10,
} as const;

// ========================================
// HTTP STATUS CODES (for readability)
// ========================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ========================================
// ERROR CODES
// ========================================

export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  AUTH_ERROR: 'AUTH_ERROR',
  // CSRF
  CSRF_VALIDATION_FAILED: 'CSRF_VALIDATION_FAILED',
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  // Request Validation
  INVALID_INPUT: 'INVALID_INPUT',
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  // Limits
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',
  IMAGE_LIMIT_EXCEEDED: 'IMAGE_LIMIT_EXCEEDED',
  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
