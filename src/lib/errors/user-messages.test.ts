import { describe, it, expect } from 'vitest';
import {
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
} from './user-messages';

// ========================================
// MESSAGE CONSTANTS
// ========================================

describe('AUTH_MESSAGES', () => {
  it('should have sessionExpired with message, suggestion, and action', () => {
    expect(AUTH_MESSAGES.sessionExpired.message).toContain('expired');
    expect(AUTH_MESSAGES.sessionExpired.suggestion).toBeDefined();
    expect(AUTH_MESSAGES.sessionExpired.action).toBe('Sign In');
  });

  it('should have unauthorized message', () => {
    expect(AUTH_MESSAGES.unauthorized.message).toContain('sign in');
    expect(AUTH_MESSAGES.unauthorized.action).toBe('Sign In');
  });

  it('should have forbidden message', () => {
    expect(AUTH_MESSAGES.forbidden.message).toContain('permission');
  });

  it('should have accountLocked message', () => {
    expect(AUTH_MESSAGES.accountLocked.message).toContain('locked');
    expect(AUTH_MESSAGES.accountLocked.action).toBe('Reset Password');
  });

  it('should have invalidCredentials message', () => {
    expect(AUTH_MESSAGES.invalidCredentials.message).toContain('incorrect');
  });
});

describe('RATE_LIMIT_MESSAGES', () => {
  it('should have tooManyRequests', () => {
    expect(RATE_LIMIT_MESSAGES.tooManyRequests.message).toContain('too many');
  });

  it('should have chatLimit with upgrade action', () => {
    expect(RATE_LIMIT_MESSAGES.chatLimit.message).toContain('message limit');
    expect(RATE_LIMIT_MESSAGES.chatLimit.action).toBe('View Plans');
  });

  it('should have apiLimit', () => {
    expect(RATE_LIMIT_MESSAGES.apiLimit.message).toContain('rate limit');
  });
});

describe('RESOURCE_MESSAGES', () => {
  it('should have notFound', () => {
    expect(RESOURCE_MESSAGES.notFound.message).toBeDefined();
  });

  it('should have sessionNotFound with action', () => {
    expect(RESOURCE_MESSAGES.sessionNotFound.message).toContain('session');
    expect(RESOURCE_MESSAGES.sessionNotFound.action).toBe('Create New Session');
  });

  it('should have fileNotFound', () => {
    expect(RESOURCE_MESSAGES.fileNotFound.message).toContain('file');
  });

  it('should have alreadyExists', () => {
    expect(RESOURCE_MESSAGES.alreadyExists.message).toContain('already exists');
  });
});

describe('VALIDATION_MESSAGES', () => {
  it('should have invalidInput', () => {
    expect(VALIDATION_MESSAGES.invalidInput.message).toBeDefined();
  });

  it('should have tooLong', () => {
    expect(VALIDATION_MESSAGES.tooLong.message).toContain('too long');
  });

  it('should have tooShort', () => {
    expect(VALIDATION_MESSAGES.tooShort.message).toContain('too short');
  });

  it('should have invalidEmail', () => {
    expect(VALIDATION_MESSAGES.invalidEmail.message).toContain('email');
  });

  it('should have invalidPassword', () => {
    expect(VALIDATION_MESSAGES.invalidPassword.message).toContain('Password');
  });

  it('should have invalidPath', () => {
    expect(VALIDATION_MESSAGES.invalidPath.message).toContain('path');
  });
});

describe('OPERATION_MESSAGES', () => {
  it('should have saveFailed with retry action', () => {
    expect(OPERATION_MESSAGES.saveFailed.message).toContain('save');
    expect(OPERATION_MESSAGES.saveFailed.action).toBe('Retry');
  });

  it('should have deleteFailed', () => {
    expect(OPERATION_MESSAGES.deleteFailed.message).toContain('delete');
  });

  it('should have loadFailed', () => {
    expect(OPERATION_MESSAGES.loadFailed.message).toContain('load');
    expect(OPERATION_MESSAGES.loadFailed.action).toBe('Retry');
  });

  it('should have uploadFailed', () => {
    expect(OPERATION_MESSAGES.uploadFailed.message).toContain('upload');
  });

  it('should have executionFailed', () => {
    expect(OPERATION_MESSAGES.executionFailed.message).toContain('execution');
  });

  it('should have deployFailed', () => {
    expect(OPERATION_MESSAGES.deployFailed.message).toContain('Deployment');
    expect(OPERATION_MESSAGES.deployFailed.action).toBe('View Logs');
  });
});

describe('CONNECTION_MESSAGES', () => {
  it('should have offline', () => {
    expect(CONNECTION_MESSAGES.offline.message).toContain('offline');
  });

  it('should have timeout with retry action', () => {
    expect(CONNECTION_MESSAGES.timeout.message).toContain('timed out');
    expect(CONNECTION_MESSAGES.timeout.action).toBe('Retry');
  });

  it('should have serverError', () => {
    expect(CONNECTION_MESSAGES.serverError.message).toContain('wrong');
  });

  it('should have serviceUnavailable', () => {
    expect(CONNECTION_MESSAGES.serviceUnavailable.message).toContain('unavailable');
  });

  it('should have connectionLost', () => {
    expect(CONNECTION_MESSAGES.connectionLost.message).toContain('lost');
  });
});

describe('COLLABORATION_MESSAGES', () => {
  it('should have sessionFull', () => {
    expect(COLLABORATION_MESSAGES.sessionFull.message).toContain('full');
  });

  it('should have userJoined as a function', () => {
    const msg = COLLABORATION_MESSAGES.userJoined('Alice');
    expect(msg.message).toBe('Alice joined the session.');
  });

  it('should have userLeft as a function', () => {
    const msg = COLLABORATION_MESSAGES.userLeft('Bob');
    expect(msg.message).toBe('Bob left the session.');
  });

  it('should have syncError', () => {
    expect(COLLABORATION_MESSAGES.syncError.message).toContain('sync');
  });
});

// ========================================
// getMessageForStatus
// ========================================

describe('getMessageForStatus', () => {
  it('should return invalidInput for 400', () => {
    expect(getMessageForStatus(400)).toEqual(VALIDATION_MESSAGES.invalidInput);
  });

  it('should return unauthorized for 401', () => {
    expect(getMessageForStatus(401)).toEqual(AUTH_MESSAGES.unauthorized);
  });

  it('should return forbidden for 403', () => {
    expect(getMessageForStatus(403)).toEqual(AUTH_MESSAGES.forbidden);
  });

  it('should return notFound for 404', () => {
    expect(getMessageForStatus(404)).toEqual(RESOURCE_MESSAGES.notFound);
  });

  it('should return timeout for 408', () => {
    expect(getMessageForStatus(408)).toEqual(CONNECTION_MESSAGES.timeout);
  });

  it('should return alreadyExists for 409', () => {
    expect(getMessageForStatus(409)).toEqual(RESOURCE_MESSAGES.alreadyExists);
  });

  it('should return tooManyRequests for 429', () => {
    expect(getMessageForStatus(429)).toEqual(RATE_LIMIT_MESSAGES.tooManyRequests);
  });

  it('should return serverError for 500', () => {
    expect(getMessageForStatus(500)).toEqual(CONNECTION_MESSAGES.serverError);
  });

  it('should return serviceUnavailable for 502', () => {
    expect(getMessageForStatus(502)).toEqual(CONNECTION_MESSAGES.serviceUnavailable);
  });

  it('should return serviceUnavailable for 503', () => {
    expect(getMessageForStatus(503)).toEqual(CONNECTION_MESSAGES.serviceUnavailable);
  });

  it('should return serviceUnavailable for 504', () => {
    expect(getMessageForStatus(504)).toEqual(CONNECTION_MESSAGES.serviceUnavailable);
  });

  it('should return generic message for unknown status', () => {
    const msg = getMessageForStatus(418);
    expect(msg.message).toContain('unexpected error');
    expect(msg.suggestion).toContain('try again');
  });
});

// ========================================
// getMessageForCode
// ========================================

describe('getMessageForCode', () => {
  it('should return unauthorized for UNAUTHORIZED', () => {
    expect(getMessageForCode('UNAUTHORIZED')).toEqual(AUTH_MESSAGES.unauthorized);
  });

  it('should return forbidden for FORBIDDEN', () => {
    expect(getMessageForCode('FORBIDDEN')).toEqual(AUTH_MESSAGES.forbidden);
  });

  it('should return notFound for NOT_FOUND', () => {
    expect(getMessageForCode('NOT_FOUND')).toEqual(RESOURCE_MESSAGES.notFound);
  });

  it('should return sessionNotFound for SESSION_NOT_FOUND', () => {
    expect(getMessageForCode('SESSION_NOT_FOUND')).toEqual(RESOURCE_MESSAGES.sessionNotFound);
  });

  it('should return fileNotFound for FILE_NOT_FOUND', () => {
    expect(getMessageForCode('FILE_NOT_FOUND')).toEqual(RESOURCE_MESSAGES.fileNotFound);
  });

  it('should return tooManyRequests for RATE_LIMITED', () => {
    expect(getMessageForCode('RATE_LIMITED')).toEqual(RATE_LIMIT_MESSAGES.tooManyRequests);
  });

  it('should return invalidInput for INVALID_INPUT', () => {
    expect(getMessageForCode('INVALID_INPUT')).toEqual(VALIDATION_MESSAGES.invalidInput);
  });

  it('should return invalidPath for PATH_TRAVERSAL', () => {
    expect(getMessageForCode('PATH_TRAVERSAL')).toEqual(VALIDATION_MESSAGES.invalidPath);
  });

  it('should return sessionExpired for CSRF_VALIDATION_FAILED', () => {
    expect(getMessageForCode('CSRF_VALIDATION_FAILED')).toEqual(AUTH_MESSAGES.sessionExpired);
  });

  it('should return serverError for INTERNAL_ERROR', () => {
    expect(getMessageForCode('INTERNAL_ERROR')).toEqual(CONNECTION_MESSAGES.serverError);
  });

  it('should return serviceUnavailable for SERVICE_UNAVAILABLE', () => {
    expect(getMessageForCode('SERVICE_UNAVAILABLE')).toEqual(
      CONNECTION_MESSAGES.serviceUnavailable
    );
  });

  it('should return generic message for unknown code', () => {
    const msg = getMessageForCode('UNKNOWN_CODE_XYZ');
    expect(msg.message).toContain('error occurred');
    expect(msg.suggestion).toContain('try again');
  });
});

// ========================================
// formatUserError
// ========================================

describe('formatUserError', () => {
  it('should return fallback for null error', () => {
    const result = formatUserError(null);
    expect(result.message).toBe('An error occurred.');
  });

  it('should return fallback for undefined error', () => {
    const result = formatUserError(undefined);
    expect(result.message).toBe('An error occurred.');
  });

  it('should return custom fallback when provided', () => {
    const fallback = { message: 'Custom fallback' };
    const result = formatUserError(null, fallback);
    expect(result.message).toBe('Custom fallback');
  });

  it('should map error with code property', () => {
    const result = formatUserError({ code: 'UNAUTHORIZED' });
    expect(result).toEqual(AUTH_MESSAGES.unauthorized);
  });

  it('should map error with status property', () => {
    const result = formatUserError({ status: 404 });
    expect(result).toEqual(RESOURCE_MESSAGES.notFound);
  });

  it('should prefer code over status when both are present', () => {
    const result = formatUserError({ code: 'FORBIDDEN', status: 404 });
    expect(result).toEqual(AUTH_MESSAGES.forbidden);
  });

  it('should detect ECONNREFUSED in message', () => {
    const result = formatUserError({ message: 'connect ECONNREFUSED 127.0.0.1:5432' });
    expect(result).toEqual(CONNECTION_MESSAGES.serverError);
  });

  it('should detect ETIMEDOUT in message', () => {
    const result = formatUserError({ message: 'connect ETIMEDOUT' });
    expect(result).toEqual(CONNECTION_MESSAGES.serverError);
  });

  it('should detect Network in message', () => {
    const result = formatUserError({ message: 'Network request failed' });
    expect(result).toEqual(CONNECTION_MESSAGES.offline);
  });

  it('should detect fetch in message', () => {
    const result = formatUserError({ message: 'Failed to fetch' });
    expect(result).toEqual(CONNECTION_MESSAGES.offline);
  });

  it('should handle AbortError', () => {
    // Use a real Error with name set to 'AbortError' (DOMException may not extend Error in Node)
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    const result = formatUserError(error);
    expect(result).toEqual(CONNECTION_MESSAGES.timeout);
  });

  it('should handle TypeError with fetch message', () => {
    const error = new TypeError('Failed to fetch');
    const result = formatUserError(error);
    expect(result).toEqual(CONNECTION_MESSAGES.offline);
  });

  it('should return fallback for generic Error', () => {
    const result = formatUserError(new Error('Something broke'));
    expect(result.message).toBe('An error occurred.');
  });

  it('should return fallback for string error', () => {
    const result = formatUserError('string error');
    expect(result.message).toBe('An error occurred.');
  });

  it('should return fallback for number error', () => {
    const result = formatUserError(42);
    expect(result.message).toBe('An error occurred.');
  });

  it('should handle empty object', () => {
    const result = formatUserError({});
    expect(result.message).toBe('An error occurred.');
  });
});
