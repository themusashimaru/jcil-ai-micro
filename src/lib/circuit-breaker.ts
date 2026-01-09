/**
 * CIRCUIT BREAKER SYSTEM
 *
 * Implements the circuit breaker pattern for fault tolerance at scale.
 * Prevents cascade failures when downstream services are unhealthy.
 *
 * STATES:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unhealthy, requests fail fast
 * - HALF-OPEN: Testing if service recovered
 *
 * USAGE:
 * const result = await anthropicBreaker.fire(callAnthropicFn, args);
 */

import CircuitBreaker from 'opossum';
import { logger } from '@/lib/logger';

const log = logger('CircuitBreaker');

// ============================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================

export interface CircuitBreakerConfig {
  timeout: number; // Request timeout in ms
  errorThresholdPercentage: number; // % of failures to trip circuit
  resetTimeout: number; // Time to wait before testing recovery
  volumeThreshold: number; // Min requests before circuit can trip
  name: string; // Identifier for logging
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  timeout: 60000, // 60 seconds
  errorThresholdPercentage: 50, // 50% failures
  resetTimeout: 30000, // 30 seconds
  volumeThreshold: 10, // At least 10 requests
  name: 'default',
};

// ============================================
// ANTHROPIC CIRCUIT BREAKER
// ============================================

const anthropicConfig: CircuitBreakerConfig = {
  timeout: 120000, // 2 minutes (AI responses can be slow)
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5, // Trip faster due to cost
  name: 'anthropic',
};

type AnthropicFunction = (...args: unknown[]) => Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anthropicBreaker: CircuitBreaker<any[], any> | null = null;

/**
 * Get the Anthropic circuit breaker
 */
export function getAnthropicBreaker<T>(fn: AnthropicFunction): CircuitBreaker<unknown[], T> {
  if (anthropicBreaker) {
    return anthropicBreaker;
  }

  anthropicBreaker = new CircuitBreaker(fn, {
    timeout: anthropicConfig.timeout,
    errorThresholdPercentage: anthropicConfig.errorThresholdPercentage,
    resetTimeout: anthropicConfig.resetTimeout,
    volumeThreshold: anthropicConfig.volumeThreshold,
  });

  setupBreakerEvents(anthropicBreaker, anthropicConfig.name);
  return anthropicBreaker;
}

// ============================================
// DATABASE CIRCUIT BREAKER
// ============================================

const databaseConfig: CircuitBreakerConfig = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 60,
  resetTimeout: 10000, // Recover faster
  volumeThreshold: 10,
  name: 'database',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let databaseBreaker: CircuitBreaker<any[], any> | null = null;

/**
 * Get the database circuit breaker
 */
export function getDatabaseBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>
): CircuitBreaker<unknown[], T> {
  if (databaseBreaker) {
    return databaseBreaker;
  }

  databaseBreaker = new CircuitBreaker(fn, {
    timeout: databaseConfig.timeout,
    errorThresholdPercentage: databaseConfig.errorThresholdPercentage,
    resetTimeout: databaseConfig.resetTimeout,
    volumeThreshold: databaseConfig.volumeThreshold,
  });

  setupBreakerEvents(databaseBreaker, databaseConfig.name);
  return databaseBreaker;
}

// ============================================
// REDIS CIRCUIT BREAKER
// ============================================

const redisConfig: CircuitBreakerConfig = {
  timeout: 5000, // 5 seconds (Redis should be fast)
  errorThresholdPercentage: 70,
  resetTimeout: 5000, // Recover quickly
  volumeThreshold: 20,
  name: 'redis',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisBreaker: CircuitBreaker<any[], any> | null = null;

/**
 * Get the Redis circuit breaker
 */
export function getRedisBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>
): CircuitBreaker<unknown[], T> {
  if (redisBreaker) {
    return redisBreaker;
  }

  redisBreaker = new CircuitBreaker(fn, {
    timeout: redisConfig.timeout,
    errorThresholdPercentage: redisConfig.errorThresholdPercentage,
    resetTimeout: redisConfig.resetTimeout,
    volumeThreshold: redisConfig.volumeThreshold,
  });

  setupBreakerEvents(redisBreaker, redisConfig.name);
  return redisBreaker;
}

// ============================================
// GENERIC CIRCUIT BREAKER FACTORY
// ============================================

/**
 * Create a circuit breaker with custom config
 */
export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker<unknown[], T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const breaker = new CircuitBreaker(fn, {
    timeout: finalConfig.timeout,
    errorThresholdPercentage: finalConfig.errorThresholdPercentage,
    resetTimeout: finalConfig.resetTimeout,
    volumeThreshold: finalConfig.volumeThreshold,
  });

  setupBreakerEvents(breaker, finalConfig.name);
  return breaker;
}

// ============================================
// EVENT HANDLING
// ============================================

/**
 * Set up event handlers for a circuit breaker
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupBreakerEvents(breaker: CircuitBreaker<any[], any>, name: string): void {
  breaker.on('open', () => {
    log.error(`Circuit breaker OPEN: ${name}`, {
      name,
      state: 'open',
      message: 'Too many failures - requests will fail fast',
    });

    // Send alert if configured
    sendAlert(name, 'open');
  });

  breaker.on('halfOpen', () => {
    log.warn(`Circuit breaker HALF-OPEN: ${name}`, {
      name,
      state: 'halfOpen',
      message: 'Testing if service recovered',
    });
  });

  breaker.on('close', () => {
    log.info(`Circuit breaker CLOSED: ${name}`, {
      name,
      state: 'closed',
      message: 'Service recovered - normal operation resumed',
    });

    sendAlert(name, 'closed');
  });

  breaker.on('fallback', (result) => {
    log.debug(`Circuit breaker fallback: ${name}`, { result });
  });

  breaker.on('timeout', () => {
    log.warn(`Circuit breaker timeout: ${name}`);
  });

  breaker.on('reject', () => {
    log.warn(`Circuit breaker rejected request: ${name}`);
  });

  breaker.on('success', () => {
    // Only log at trace level to avoid noise
  });

  breaker.on('failure', (error) => {
    log.debug(`Circuit breaker failure: ${name}`, { error: (error as Error).message });
  });
}

// ============================================
// ALERTING
// ============================================

/**
 * Send alert when circuit breaker state changes
 */
async function sendAlert(name: string, state: 'open' | 'closed'): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'jcil-ai',
        alert: 'circuit_breaker_state_change',
        circuitBreaker: name,
        state,
        severity: state === 'open' ? 'critical' : 'info',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    log.warn(`Failed to send circuit breaker alert for ${name}`);
  }
}

// ============================================
// STATUS & METRICS
// ============================================

export interface CircuitBreakerStatus {
  name: string;
  state: 'open' | 'closed' | 'halfOpen';
  stats: {
    successes: number;
    failures: number;
    timeouts: number;
    fallbacks: number;
    rejects: number;
  };
}

/**
 * Get status of all circuit breakers
 */
export function getAllBreakerStatus(): CircuitBreakerStatus[] {
  const breakers = [
    { name: 'anthropic', breaker: anthropicBreaker },
    { name: 'database', breaker: databaseBreaker },
    { name: 'redis', breaker: redisBreaker },
  ];

  return breakers
    .filter(({ breaker }) => breaker !== null)
    .map(({ name, breaker }) => ({
      name,
      state: breaker!.opened ? 'open' : breaker!.halfOpen ? 'halfOpen' : 'closed',
      stats: {
        successes: breaker!.stats.successes,
        failures: breaker!.stats.failures,
        timeouts: breaker!.stats.timeouts,
        fallbacks: breaker!.stats.fallbacks,
        rejects: breaker!.stats.rejects,
      },
    }));
}

/**
 * Reset all circuit breakers (for testing/maintenance)
 */
export function resetAllBreakers(): void {
  [anthropicBreaker, databaseBreaker, redisBreaker].forEach((breaker) => {
    if (breaker) {
      breaker.close();
    }
  });
  log.info('All circuit breakers reset');
}

// ============================================
// WRAPPER FOR EASY USE
// ============================================

/**
 * Wrap any async function with a circuit breaker
 *
 * @example
 * const result = await withCircuitBreaker(
 *   () => callExternalService(data),
 *   { name: 'external-service', timeout: 5000 }
 * );
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = createCircuitBreaker(fn, config);
  return breaker.fire() as Promise<T>;
}

/**
 * Check if a service is currently available (circuit closed)
 */
export function isServiceAvailable(service: 'anthropic' | 'database' | 'redis'): boolean {
  const breaker =
    service === 'anthropic'
      ? anthropicBreaker
      : service === 'database'
        ? databaseBreaker
        : redisBreaker;

  return breaker ? !breaker.opened : true;
}
