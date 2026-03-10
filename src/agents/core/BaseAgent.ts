/**
 * BASE AGENT CLASS
 *
 * Abstract foundation for all JCIL agents.
 * Provides streaming, timing, error handling out of the box.
 */

import {
  IAgent,
  AgentContext,
  AgentResult,
  AgentStreamCallback,
  AgentStreamEvent,
  AgentStreamEventType,
} from './types';

export abstract class BaseAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
  abstract name: string;
  abstract description: string;
  abstract version: string;

  protected startTime: number = 0;
  protected iterationCount: number = 0;
  protected sourcesUsed: Set<string> = new Set();

  /**
   * Main execution method - must be implemented by each agent
   */
  abstract execute(
    input: TInput,
    context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<AgentResult<TOutput>>;

  /**
   * Check if this agent can handle the given input
   */
  abstract canHandle(input: unknown): boolean;

  /**
   * Helper to emit stream events with consistent formatting
   */
  protected emit(
    onStream: AgentStreamCallback,
    type: AgentStreamEventType,
    message: string,
    options: {
      progress?: number;
      phase?: string;
      details?: unknown;
    } = {}
  ): void {
    const event: AgentStreamEvent = {
      type,
      message,
      progress: options.progress,
      phase: options.phase,
      details: options.details,
      timestamp: Date.now(),
    };
    onStream(event);
  }

  /**
   * Start timing for execution metrics
   */
  protected startExecution(): void {
    this.startTime = Date.now();
    this.iterationCount = 0;
    this.sourcesUsed.clear();
  }

  /**
   * Get execution time in milliseconds
   */
  protected getExecutionTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Increment iteration counter
   */
  protected incrementIteration(): void {
    this.iterationCount++;
  }

  /**
   * Track a source that was used
   */
  protected trackSource(source: string): void {
    this.sourcesUsed.add(source);
  }

  /**
   * Build standard metadata for result
   */
  protected buildMetadata(confidenceScore: number): AgentResult<TOutput>['metadata'] {
    return {
      executionTime: this.getExecutionTime(),
      iterations: this.iterationCount,
      sourcesUsed: Array.from(this.sourcesUsed),
      confidenceScore,
    };
  }

  /**
   * Create a success result
   */
  protected success(data: TOutput, confidenceScore: number): AgentResult<TOutput> {
    return {
      success: true,
      data,
      metadata: this.buildMetadata(confidenceScore),
    };
  }

  /**
   * Create a failure result
   */
  protected failure(error: string): AgentResult<TOutput> {
    return {
      success: false,
      error,
      metadata: this.buildMetadata(0),
    };
  }

  /**
   * Sleep helper for rate limiting
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper for API calls
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          await this.sleep(delayMs * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }
}
