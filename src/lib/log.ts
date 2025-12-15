/**
 * Structured Logging
 *
 * JSON logging for telemetry, analytics, and billing
 * Captures: user_id, model, tool_name, tokens, latency, errors
 */

import { createHash } from 'crypto';

export interface TelemetryEvent {
  user_id?: string;
  model?: string;
  tool_name?: string;
  params_hash?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  ok?: boolean;
  err_code?: string;
  err_message?: string;
  // Additional context
  conversation_id?: string;
  request_id?: string;
  image_cost?: number; // For DALL-E billing
  web_search?: boolean;
  cached?: boolean;
}

/**
 * Log a telemetry event as structured JSON
 */
export function logEvent(event: TelemetryEvent): void {
  const logEntry = {
    ts: Date.now(),
    type: 'telemetry',
    ...event,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Log an API request start (returns timestamp for latency calculation)
 */
export function logRequestStart(context: {
  user_id?: string;
  model?: string;
  tool_name?: string;
}): { startTime: number; context: typeof context } {
  return {
    startTime: Date.now(),
    context,
  };
}

/**
 * Log an API request completion
 */
export function logRequestEnd(
  tracker: { startTime: number; context: Record<string, unknown> },
  result: {
    ok: boolean;
    tokens_in?: number;
    tokens_out?: number;
    err_code?: string;
    err_message?: string;
    cached?: boolean;
    web_search?: boolean;
  }
): void {
  logEvent({
    ...tracker.context,
    latency_ms: Date.now() - tracker.startTime,
    ...result,
  } as TelemetryEvent);
}

/**
 * Log an error event
 */
export function logError(
  error: Error | unknown,
  context: {
    user_id?: string;
    model?: string;
    tool_name?: string;
    operation?: string;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logEvent({
    ...context,
    ok: false,
    err_code: err.name || 'ERROR',
    err_message: err.message,
  });
}

/**
 * Log image generation (separate billing)
 */
export function logImageGeneration(
  user_id: string,
  model: string,
  size: string,
  cost: number,
  ok: boolean,
  latency_ms: number
): void {
  console.log(
    JSON.stringify({
      ts: Date.now(),
      type: 'image_billing',
      user_id,
      model,
      size,
      cost,
      ok,
      latency_ms,
    })
  );
}

/**
 * Log video generation (separate billing)
 */
export function logVideoGeneration(
  user_id: string,
  model: string,
  size: string,
  seconds: number,
  cost: number,
  ok: boolean,
  latency_ms: number
): void {
  console.log(
    JSON.stringify({
      ts: Date.now(),
      type: 'video_billing',
      user_id,
      model,
      size,
      seconds,
      cost,
      ok,
      latency_ms,
    })
  );
}

/**
 * Create a hash of parameters for logging (redacts sensitive data)
 */
export function hashParams(params: Record<string, unknown>): string {
  // Remove sensitive fields before hashing
  const sanitized = { ...params };
  delete sanitized.token;
  delete sanitized.api_key;
  delete sanitized.password;
  delete sanitized.secret;

  return createHash('sha256')
    .update(JSON.stringify(sanitized))
    .digest('hex')
    .slice(0, 16);
}
