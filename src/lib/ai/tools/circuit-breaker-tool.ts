/**
 * CIRCUIT BREAKER TOOL
 * Circuit breaker pattern design and configuration
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const STATES = {
  CLOSED: 'Circuit allowing requests through',
  OPEN: 'Circuit blocking all requests (failing fast)',
  HALF_OPEN: 'Circuit testing with limited requests'
};

function designCircuitBreaker(config: {
  service: string;
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  halfOpenRequests?: number;
}): Record<string, unknown> {
  const {
    service,
    failureThreshold = 5,
    successThreshold = 3,
    timeout = 30000,
    halfOpenRequests = 3
  } = config;

  return {
    service,
    configuration: {
      failureThreshold,
      successThreshold,
      timeoutMs: timeout,
      halfOpenRequests,
      windowSize: '10 requests or 60 seconds'
    },
    states: STATES,
    stateTransitions: [
      { from: 'CLOSED', to: 'OPEN', condition: `${failureThreshold} consecutive failures` },
      { from: 'OPEN', to: 'HALF_OPEN', condition: `After ${timeout}ms timeout` },
      { from: 'HALF_OPEN', to: 'CLOSED', condition: `${successThreshold} successful requests` },
      { from: 'HALF_OPEN', to: 'OPEN', condition: 'Any failure' }
    ],
    implementation: {
      typescript: `class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > ${timeout}) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= ${successThreshold}) {
        this.state = 'CLOSED';
        this.successes = 0;
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= ${failureThreshold}) {
      this.state = 'OPEN';
    }
  }
}`
    },
    resilience4jConfig: `CircuitBreakerConfig.custom()
  .failureRateThreshold(${(failureThreshold / 10) * 100})
  .waitDurationInOpenState(Duration.ofMillis(${timeout}))
  .permittedNumberOfCallsInHalfOpenState(${halfOpenRequests})
  .slidingWindowSize(10)
  .build();`
  };
}

function designRetryPolicy(config: {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffType?: 'exponential' | 'linear' | 'fixed';
  retryableErrors?: string[];
}): Record<string, unknown> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    backoffType = 'exponential',
    retryableErrors = ['ECONNRESET', 'ETIMEDOUT', '503', '429']
  } = config;

  const delays = Array.from({ length: maxRetries }, (_, i) => {
    switch (backoffType) {
      case 'exponential': return Math.min(initialDelay * Math.pow(2, i), maxDelay);
      case 'linear': return Math.min(initialDelay * (i + 1), maxDelay);
      default: return initialDelay;
    }
  });

  return {
    configuration: {
      maxRetries,
      initialDelay: `${initialDelay}ms`,
      maxDelay: `${maxDelay}ms`,
      backoffType,
      retryableErrors
    },
    delaySequence: delays.map(d => `${d}ms`),
    totalMaxWait: `${delays.reduce((a, b) => a + b, 0)}ms`,
    implementation: `async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = ${maxRetries},
  initialDelay = ${initialDelay}
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) break;
      if (!isRetryable(error)) throw error;

      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        ${maxDelay}
      );

      // Add jitter to prevent thundering herd
      const jitter = delay * 0.2 * Math.random();
      await sleep(delay + jitter);
    }
  }

  throw lastError!;
}`,
    bestPractices: [
      'Add jitter to prevent thundering herd',
      'Set reasonable maximum delay',
      'Only retry idempotent operations',
      'Log retry attempts for debugging',
      'Consider circuit breaker for repeated failures'
    ]
  };
}

function designBulkhead(config: {
  service: string;
  maxConcurrent?: number;
  maxWait?: number;
  type?: 'semaphore' | 'threadpool';
}): Record<string, unknown> {
  const {
    service,
    maxConcurrent = 10,
    maxWait = 5000,
    type = 'semaphore'
  } = config;

  return {
    pattern: 'Bulkhead',
    purpose: 'Isolate failures and limit resource consumption',
    configuration: {
      service,
      maxConcurrentCalls: maxConcurrent,
      maxWaitDuration: `${maxWait}ms`,
      type
    },
    implementation: `class Bulkhead {
  private concurrent = 0;
  private queue: Array<() => void> = [];

  constructor(
    private maxConcurrent = ${maxConcurrent},
    private maxWait = ${maxWait}
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.concurrent >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.concurrent++;
    try {
      return await fn();
    } finally {
      this.concurrent--;
      this.releaseWaiter();
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bulkhead timeout'));
      }, this.maxWait);

      this.queue.push(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private releaseWaiter() {
    const waiter = this.queue.shift();
    if (waiter) waiter();
  }
}`,
    resilience4jConfig: `BulkheadConfig.custom()
  .maxConcurrentCalls(${maxConcurrent})
  .maxWaitDuration(Duration.ofMillis(${maxWait}))
  .build();`,
    sizing: {
      recommendation: `Start with ${maxConcurrent} and monitor queue depth`,
      formula: 'maxConcurrent = expectedRPS * avgLatencySeconds * safetyFactor',
      example: `100 RPS * 0.1s * 1.5 = 15 concurrent calls`
    }
  };
}

function designFallback(scenarios: Array<{
  trigger: string;
  fallbackType: string;
}>): Record<string, unknown> {
  const fallbackStrategies = {
    cache: {
      description: 'Return cached data',
      implementation: 'Return last known good value from cache',
      pros: ['Fast response', 'User sees data'],
      cons: ['May be stale', 'Cache miss = no fallback']
    },
    default: {
      description: 'Return default/static value',
      implementation: 'Return predefined safe default',
      pros: ['Always available', 'Predictable'],
      cons: ['Generic response', 'May not fit all cases']
    },
    degraded: {
      description: 'Return partial/simplified response',
      implementation: 'Skip non-essential data',
      pros: ['Core functionality preserved', 'Graceful degradation'],
      cons: ['Incomplete experience', 'Complexity']
    },
    queue: {
      description: 'Queue request for later',
      implementation: 'Store request, process async',
      pros: ['No data loss', 'Eventual completion'],
      cons: ['Delayed response', 'Queue management']
    },
    failSilent: {
      description: 'Return empty/null silently',
      implementation: 'Swallow error, return empty',
      pros: ['Simple', 'No error to user'],
      cons: ['Hidden failures', 'Silent data loss']
    }
  };

  return {
    strategies: fallbackStrategies,
    recommendedPerScenario: scenarios.map(s => ({
      trigger: s.trigger,
      recommendedFallback: s.fallbackType,
      strategy: fallbackStrategies[s.fallbackType as keyof typeof fallbackStrategies] || fallbackStrategies.default
    })),
    implementation: `async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn('Primary failed, using fallback', error);
    return fallback();
  }
}

// Usage
const data = await withFallback(
  () => fetchFromAPI(),
  () => getCachedData() || defaultData
);`
  };
}

function analyzeResilience(patterns: string[]): Record<string, unknown> {
  const coverage = {
    circuitBreaker: patterns.includes('circuit-breaker'),
    retry: patterns.includes('retry'),
    bulkhead: patterns.includes('bulkhead'),
    fallback: patterns.includes('fallback'),
    timeout: patterns.includes('timeout'),
    rateLimit: patterns.includes('rate-limit')
  };

  const score = Object.values(coverage).filter(Boolean).length;

  return {
    coverage,
    score: `${score}/6`,
    rating: score >= 5 ? 'Excellent' : score >= 3 ? 'Good' : score >= 1 ? 'Basic' : 'No resilience',
    missing: Object.entries(coverage).filter(([, v]) => !v).map(([k]) => k),
    recommendations: Object.entries(coverage)
      .filter(([, v]) => !v)
      .map(([pattern]) => ({
        pattern,
        recommendation: `Add ${pattern} pattern`,
        priority: pattern === 'timeout' ? 'Critical' : pattern === 'circuit-breaker' ? 'High' : 'Medium'
      })),
    compositionExample: `// Recommended order: Retry -> Circuit Breaker -> Bulkhead -> Timeout
const resilientCall = pipe(
  withTimeout(5000),
  withBulkhead(bulkhead),
  withCircuitBreaker(circuitBreaker),
  withRetry({ maxRetries: 3 })
)(apiCall);`
  };
}

export const circuitBreakerTool: UnifiedTool = {
  name: 'circuit_breaker',
  description: 'Circuit Breaker: design, retry_policy, bulkhead, fallback, analyze_resilience',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['design', 'retry_policy', 'bulkhead', 'fallback', 'analyze_resilience'] },
      config: { type: 'object' },
      scenarios: { type: 'array' },
      patterns: { type: 'array' }
    },
    required: ['operation']
  },
};

export async function executeCircuitBreaker(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'design':
        result = designCircuitBreaker(args.config || { service: 'payment-service' });
        break;
      case 'retry_policy':
        result = designRetryPolicy(args.config || {});
        break;
      case 'bulkhead':
        result = designBulkhead(args.config || { service: 'order-service' });
        break;
      case 'fallback':
        result = designFallback(args.scenarios || [
          { trigger: 'API timeout', fallbackType: 'cache' },
          { trigger: 'Service unavailable', fallbackType: 'default' }
        ]);
        break;
      case 'analyze_resilience':
        result = analyzeResilience(args.patterns || ['timeout', 'retry']);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCircuitBreakerAvailable(): boolean { return true; }
