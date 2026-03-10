import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, apiLogger, authLogger, dbLogger } from './logger';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger factory', () => {
    it('should create a logger with module name', () => {
      const log = logger('TestModule');
      expect(log).toBeDefined();
      expect(typeof log.info).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.debug).toBe('function');
    });

    it('should include module name in log output', () => {
      const log = logger('MyModule');
      log.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalled();
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain('[MyModule]');
      expect(logOutput).toContain('Test message');
    });
  });

  describe('log levels', () => {
    it('should call console.log for info level', () => {
      const log = logger('Test');
      log.info('Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should call console.error for error level', () => {
      const log = logger('Test');
      log.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should call console.warn for warn level', () => {
      const log = logger('Test');
      log.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should call console.debug for debug level', () => {
      const log = logger('Test');
      log.debug('Debug message');
      // In test environment, debug is enabled
      expect(consoleSpy.debug).toHaveBeenCalled();
    });
  });

  describe('context handling', () => {
    it('should include context in log output', () => {
      const log = logger('Test');
      log.info('Message', { userId: '123', action: 'test' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('userId');
      expect(output).toContain('123');
    });

    it('should handle empty context', () => {
      const log = logger('Test');
      log.info('Message', {});
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should handle undefined context', () => {
      const log = logger('Test');
      log.info('Message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('PII redaction', () => {
    it('should redact password fields', () => {
      const log = logger('Test');
      log.info('Login attempt', { password: 'secret123' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('secret123');
      expect(output).toContain('[REDACTED]');
    });

    it('should redact token fields', () => {
      const log = logger('Test');
      log.info('API call', { accessToken: 'abc123xyz' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('abc123xyz');
      expect(output).toContain('[REDACTED]');
    });

    it('should redact email fields', () => {
      const log = logger('Test');
      log.info('User action', { userEmail: 'test@example.com' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('test@example.com');
      expect(output).toContain('[REDACTED]');
    });

    it('should redact api_key fields', () => {
      const log = logger('Test');
      log.info('Config', { api_key: 'sk_live_12345' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('sk_live_12345');
      expect(output).toContain('[REDACTED]');
    });

    it('should redact credit_card fields', () => {
      const log = logger('Test');
      log.info('Payment', { creditCard: '4111111111111111' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('4111111111111111');
      expect(output).toContain('[REDACTED]');
    });

    it('should redact nested sensitive fields', () => {
      const log = logger('Test');
      log.info('Request', { user: { password: 'secret', name: 'John' } });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('secret');
      expect(output).toContain('John');
    });

    it('should preserve non-sensitive fields', () => {
      const log = logger('Test');
      log.info('Action', { userId: '123', status: 'active' });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('123');
      expect(output).toContain('active');
    });
  });

  describe('error handling', () => {
    it('should handle Error objects in error method', () => {
      const log = logger('Test');
      const testError = new Error('Test error');
      log.error('Operation failed', testError);
      expect(consoleSpy.error).toHaveBeenCalled();
      const output = consoleSpy.error.mock.calls[0][0];
      expect(output).toContain('Test error');
    });

    it('should handle Error objects with context', () => {
      const log = logger('Test');
      const testError = new Error('Test error');
      log.error('Operation failed', testError, { requestId: '123' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle context objects in error method', () => {
      const log = logger('Test');
      log.error('Operation failed', { code: 'ERR_001', details: 'Failed' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle Error in warn method', () => {
      const log = logger('Test');
      const testError = new Error('Warning error');
      log.warn('Warning', testError);
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle non-Error thrown values', () => {
      const log = logger('Test');
      log.error('Failed', { error: 'string error' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('pre-configured loggers', () => {
    it('should have apiLogger configured', () => {
      expect(apiLogger).toBeDefined();
      apiLogger.info('API request');
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[API]');
    });

    it('should have authLogger configured', () => {
      expect(authLogger).toBeDefined();
      authLogger.info('Auth event');
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[Auth]');
    });

    it('should have dbLogger configured', () => {
      expect(dbLogger).toBeDefined();
      dbLogger.info('DB query');
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[Database]');
    });
  });

  describe('array handling in context', () => {
    it('should handle arrays in context', () => {
      const log = logger('Test');
      log.info('Items', { items: [1, 2, 3] });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('[1,2,3]');
    });

    it('should redact sensitive fields in arrays', () => {
      const log = logger('Test');
      log.info('Users', { users: [{ email: 'a@b.com' }, { email: 'c@d.com' }] });
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).not.toContain('a@b.com');
      expect(output).not.toContain('c@d.com');
    });
  });

  describe('null and undefined handling', () => {
    it('should handle null values in context', () => {
      const log = logger('Test');
      log.info('Data', { value: null });
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should handle undefined values in context', () => {
      const log = logger('Test');
      log.info('Data', { value: undefined });
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });
});
