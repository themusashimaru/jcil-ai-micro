/**
 * USER-FACING ERROR MESSAGES - LOW-002 FIX
 *
 * Standardized, user-friendly error messages with consistent tone.
 * These messages are designed to be:
 * - Clear and actionable
 * - Professional but friendly
 * - Consistent across the platform
 * - Helpful without exposing technical details
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface UserMessage {
  /** Main message shown to user */
  message: string;
  /** Optional suggestion for resolution */
  suggestion?: string;
  /** Optional action button label */
  action?: string;
}

// ============================================================================
// AUTHENTICATION MESSAGES
// ============================================================================

export const AUTH_MESSAGES = {
  sessionExpired: {
    message: 'Your session has expired.',
    suggestion: 'Please sign in again to continue.',
    action: 'Sign In',
  },
  unauthorized: {
    message: 'You need to sign in to access this feature.',
    suggestion: 'Create a free account or sign in to continue.',
    action: 'Sign In',
  },
  forbidden: {
    message: "You don't have permission to perform this action.",
    suggestion: 'Contact support if you believe this is an error.',
  },
  accountLocked: {
    message: 'Your account has been temporarily locked.',
    suggestion: 'Please try again in a few minutes or reset your password.',
    action: 'Reset Password',
  },
  invalidCredentials: {
    message: 'The email or password you entered is incorrect.',
    suggestion: 'Please check your credentials and try again.',
  },
} as const;

// ============================================================================
// RATE LIMITING MESSAGES
// ============================================================================

export const RATE_LIMIT_MESSAGES = {
  tooManyRequests: {
    message: "You've made too many requests.",
    suggestion: 'Please wait a moment before trying again.',
  },
  chatLimit: {
    message: "You've reached your message limit for this period.",
    suggestion: 'Upgrade your plan for more messages or wait for the limit to reset.',
    action: 'View Plans',
  },
  apiLimit: {
    message: 'API rate limit exceeded.',
    suggestion: 'Please slow down your requests or upgrade your plan.',
  },
} as const;

// ============================================================================
// RESOURCE MESSAGES
// ============================================================================

export const RESOURCE_MESSAGES = {
  notFound: {
    message: "We couldn't find what you're looking for.",
    suggestion: 'The item may have been moved or deleted.',
  },
  sessionNotFound: {
    message: 'This session no longer exists.',
    suggestion: 'It may have been deleted or expired.',
    action: 'Create New Session',
  },
  fileNotFound: {
    message: 'This file could not be found.',
    suggestion: 'It may have been moved, renamed, or deleted.',
  },
  alreadyExists: {
    message: 'An item with this name already exists.',
    suggestion: 'Please choose a different name.',
  },
} as const;

// ============================================================================
// VALIDATION MESSAGES
// ============================================================================

export const VALIDATION_MESSAGES = {
  invalidInput: {
    message: 'Please check your input and try again.',
    suggestion: 'Some fields may be missing or contain invalid values.',
  },
  tooLong: {
    message: 'Your input is too long.',
    suggestion: 'Please shorten your text and try again.',
  },
  tooShort: {
    message: 'Your input is too short.',
    suggestion: 'Please provide more details.',
  },
  invalidEmail: {
    message: 'Please enter a valid email address.',
  },
  invalidPassword: {
    message: 'Password does not meet requirements.',
    suggestion: 'Use at least 8 characters with a mix of letters and numbers.',
  },
  invalidPath: {
    message: 'The file path is not valid.',
    suggestion: 'Please check the path and try again.',
  },
} as const;

// ============================================================================
// OPERATION MESSAGES
// ============================================================================

export const OPERATION_MESSAGES = {
  saveFailed: {
    message: 'Unable to save your changes.',
    suggestion: 'Please try again. Your changes have not been lost.',
    action: 'Retry',
  },
  deleteFailed: {
    message: 'Unable to delete this item.',
    suggestion: 'Please try again or refresh the page.',
    action: 'Retry',
  },
  loadFailed: {
    message: 'Unable to load the requested content.',
    suggestion: 'Please check your connection and try again.',
    action: 'Retry',
  },
  uploadFailed: {
    message: 'File upload failed.',
    suggestion: 'Please check the file size and format, then try again.',
    action: 'Try Again',
  },
  executionFailed: {
    message: 'Code execution encountered an error.',
    suggestion: 'Check your code for errors and try again.',
  },
  deployFailed: {
    message: 'Deployment failed.',
    suggestion: 'Please check the deployment logs for details.',
    action: 'View Logs',
  },
} as const;

// ============================================================================
// CONNECTION MESSAGES
// ============================================================================

export const CONNECTION_MESSAGES = {
  offline: {
    message: 'You appear to be offline.',
    suggestion: 'Please check your internet connection.',
  },
  timeout: {
    message: 'The request timed out.',
    suggestion: 'Please try again. The server may be busy.',
    action: 'Retry',
  },
  serverError: {
    message: 'Something went wrong on our end.',
    suggestion: "We're working to fix it. Please try again shortly.",
  },
  serviceUnavailable: {
    message: 'This service is temporarily unavailable.',
    suggestion: 'Please try again in a few minutes.',
  },
  connectionLost: {
    message: 'Connection to the server was lost.',
    suggestion: 'Attempting to reconnect...',
  },
} as const;

// ============================================================================
// COLLABORATION MESSAGES
// ============================================================================

export const COLLABORATION_MESSAGES = {
  sessionFull: {
    message: 'This session is full.',
    suggestion: 'Please wait for someone to leave or create a new session.',
  },
  userJoined: (name: string) => ({
    message: `${name} joined the session.`,
  }),
  userLeft: (name: string) => ({
    message: `${name} left the session.`,
  }),
  syncError: {
    message: 'Unable to sync changes.',
    suggestion: 'Your changes are saved locally. Reconnecting...',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a user-friendly message for an HTTP status code
 */
export function getMessageForStatus(status: number): UserMessage {
  switch (status) {
    case 400:
      return VALIDATION_MESSAGES.invalidInput;
    case 401:
      return AUTH_MESSAGES.unauthorized;
    case 403:
      return AUTH_MESSAGES.forbidden;
    case 404:
      return RESOURCE_MESSAGES.notFound;
    case 408:
      return CONNECTION_MESSAGES.timeout;
    case 409:
      return RESOURCE_MESSAGES.alreadyExists;
    case 429:
      return RATE_LIMIT_MESSAGES.tooManyRequests;
    case 500:
      return CONNECTION_MESSAGES.serverError;
    case 502:
    case 503:
    case 504:
      return CONNECTION_MESSAGES.serviceUnavailable;
    default:
      return {
        message: 'An unexpected error occurred.',
        suggestion: 'Please try again or contact support if the problem persists.',
      };
  }
}

/**
 * Get a user-friendly message for an error code
 */
export function getMessageForCode(code: string): UserMessage {
  const codeMap: Record<string, UserMessage> = {
    UNAUTHORIZED: AUTH_MESSAGES.unauthorized,
    FORBIDDEN: AUTH_MESSAGES.forbidden,
    NOT_FOUND: RESOURCE_MESSAGES.notFound,
    SESSION_NOT_FOUND: RESOURCE_MESSAGES.sessionNotFound,
    FILE_NOT_FOUND: RESOURCE_MESSAGES.fileNotFound,
    RATE_LIMITED: RATE_LIMIT_MESSAGES.tooManyRequests,
    INVALID_INPUT: VALIDATION_MESSAGES.invalidInput,
    PATH_TRAVERSAL: VALIDATION_MESSAGES.invalidPath,
    CSRF_VALIDATION_FAILED: AUTH_MESSAGES.sessionExpired,
    INTERNAL_ERROR: CONNECTION_MESSAGES.serverError,
    SERVICE_UNAVAILABLE: CONNECTION_MESSAGES.serviceUnavailable,
  };

  return (
    codeMap[code] || {
      message: 'An error occurred.',
      suggestion: 'Please try again.',
    }
  );
}

/**
 * Format an error for display to the user
 */
export function formatUserError(
  error: unknown,
  fallback: UserMessage = { message: 'An error occurred.' }
): UserMessage {
  if (!error) return fallback;

  // Handle API error responses
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Check for error code
    if (typeof err.code === 'string') {
      return getMessageForCode(err.code);
    }

    // Check for HTTP status
    if (typeof err.status === 'number') {
      return getMessageForStatus(err.status);
    }

    // Check for message
    if (typeof err.message === 'string') {
      // Don't expose technical errors to users
      if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
        return CONNECTION_MESSAGES.serverError;
      }
      if (err.message.includes('Network') || err.message.includes('fetch')) {
        return CONNECTION_MESSAGES.offline;
      }
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return CONNECTION_MESSAGES.timeout;
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return CONNECTION_MESSAGES.offline;
    }
  }

  return fallback;
}

// ============================================================================
// EXPORTS
// ============================================================================

const UserMessages = {
  AUTH_MESSAGES,
  RATE_LIMIT_MESSAGES,
  RESOURCE_MESSAGES,
  VALIDATION_MESSAGES,
  OPERATION_MESSAGES,
  CONNECTION_MESSAGES,
  COLLABORATION_MESSAGES,
  getMessageForStatus,
  getMessageForCode,
  formatUserError,
};

export default UserMessages;
