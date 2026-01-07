/**
 * STRUCTURED LOGGING SYSTEM
 *
 * Enterprise-grade logging for JCIL.AI platform.
 * Provides consistent, structured logs across all modules.
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Module prefixes for easy filtering
 * - Automatic PII redaction
 * - JSON structured output for production
 * - Conditional debug output based on environment
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   const log = logger('ModuleName');
 *   log.info('Operation completed', { count: 5 });
 *   log.error('Operation failed', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Configuration for logging behavior
 */
const config = {
  /** Enable debug logs (disabled in production by default) */
  enableDebug: process.env.NODE_ENV !== 'production',
  /** Enable JSON structured output (enabled in production) */
  jsonOutput: process.env.NODE_ENV === 'production',
  /** Fields to redact from log output */
  redactedFields: [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'email',
    'phone',
    'ssn',
    'credit_card',
    'creditCard',
  ],
};

/**
 * Redact sensitive fields from context objects
 */
function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (config.redactedFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Format error for logging
 */
function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: config.enableDebug ? error.stack : undefined,
    };
  }
  return {
    name: 'Error',
    message: String(error),
  };
}

/**
 * Output a log entry
 */
function output(entry: LogEntry): void {
  const redactedEntry = {
    ...entry,
    context: entry.context ? redactSensitive(entry.context) : undefined,
  };

  if (config.jsonOutput) {
    // Structured JSON output for production (log aggregators)
    const jsonEntry = JSON.stringify(redactedEntry);
    switch (entry.level) {
      case 'error':
        console.error(jsonEntry);
        break;
      case 'warn':
        console.warn(jsonEntry);
        break;
      default:
        console.log(jsonEntry);
    }
  } else {
    // Human-readable output for development
    const prefix = `[${entry.module}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(redactSensitive(entry.context))}` : '';
    const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';
    const message = `${prefix} ${entry.message}${contextStr}${errorStr}`;

    switch (entry.level) {
      case 'error':
        console.error(message);
        if (entry.error?.stack && config.enableDebug) {
          console.error(entry.error.stack);
        }
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }
}

/**
 * Logger interface returned by logger factory
 */
interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext | Error, error?: Error) => void;
  error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) => void;
}

/**
 * Create a logger instance for a specific module
 *
 * @param module - Module name for log prefixing
 * @returns Logger instance with debug, info, warn, error methods
 *
 * @example
 * const log = logger('ChatAPI');
 * log.info('Request received', { userId: '123' });
 * log.error('Processing failed', error, { conversationId: 'abc' });
 */
export function logger(module: string): Logger {
  const createEntry = (level: LogLevel, message: string, context?: LogContext, error?: unknown): LogEntry => ({
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    context,
    error: formatError(error),
  });

  return {
    /**
     * Debug level - detailed information for troubleshooting
     * Only output in development environment
     */
    debug(message: string, context?: LogContext): void {
      if (!config.enableDebug) return;
      output(createEntry('debug', message, context));
    },

    /**
     * Info level - general operational information
     */
    info(message: string, context?: LogContext): void {
      output(createEntry('info', message, context));
    },

    /**
     * Warn level - potentially harmful situations
     */
    warn(message: string, contextOrError?: LogContext | Error, error?: Error): void {
      if (contextOrError instanceof Error) {
        output(createEntry('warn', message, undefined, contextOrError));
      } else {
        output(createEntry('warn', message, contextOrError, error));
      }
    },

    /**
     * Error level - error events that might still allow operation
     */
    error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
      if (errorOrContext instanceof Error) {
        output(createEntry('error', message, context, errorOrContext));
      } else {
        output(createEntry('error', message, errorOrContext));
      }
    },
  };
}

/**
 * Pre-configured loggers for common modules
 */
export const apiLogger = logger('API');
export const authLogger = logger('Auth');
export const dbLogger = logger('Database');
export const stripeLogger = logger('Stripe');
export const anthropicLogger = logger('Anthropic');
export const workspaceLogger = logger('Workspace');
export const codeLabLogger = logger('CodeLab');
