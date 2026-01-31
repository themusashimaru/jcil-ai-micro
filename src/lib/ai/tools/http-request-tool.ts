/**
 * HTTP REQUEST TOOL
 *
 * Make HTTP requests to any API endpoint. Enables AI to:
 * - Call webhooks (Slack, Discord, Zapier, etc.)
 * - Integrate with any REST API
 * - Post data to external services
 * - Trigger automations
 *
 * SAFETY:
 * - Blocks requests to internal/private networks
 * - Rate limited per session
 * - Request/response size limits
 * - Timeout protection
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('HttpRequestTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
const MAX_REQUEST_BODY_SIZE = 512 * 1024; // 512KB

// Blocked patterns for security
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.', // Link-local
  '10.', // Private
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.', // Private
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.', // Private
  '.local',
  '.internal',
  'metadata.google', // Cloud metadata
  '169.254.169.254', // AWS metadata
];

// Rate limiting
const sessionRequests = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_HOUR = 50;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const httpRequestTool: UnifiedTool = {
  name: 'http_request',
  description: `Make HTTP requests to external APIs and webhooks. Use this when:
- Posting to webhooks (Slack, Discord, Zapier, Make, etc.)
- Calling REST APIs to get or send data
- Triggering external automations
- Integrating with third-party services

Supports GET, POST, PUT, PATCH, DELETE methods.
Can send JSON, form data, or plain text.

Examples:
- Post a message to a Slack webhook
- Call a Zapier webhook to trigger an automation
- Fetch data from a public API
- Send data to a custom endpoint

Note: Cannot access internal/private networks for security.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to request (must be https for POST/PUT/PATCH)',
      },
      method: {
        type: 'string',
        description: 'HTTP method',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        default: 'GET',
      },
      headers: {
        type: 'object',
        description:
          'Request headers as key-value pairs. Content-Type defaults to application/json for POST/PUT/PATCH.',
      },
      body: {
        type: 'object',
        description:
          'Request body (for POST/PUT/PATCH). Will be JSON-encoded unless content_type is specified.',
      },
      body_raw: {
        type: 'string',
        description: 'Raw string body (alternative to body object)',
      },
      content_type: {
        type: 'string',
        description: 'Content-Type override (e.g., "application/x-www-form-urlencoded")',
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// SAFETY CHECKS
// ============================================================================

function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: 'Only HTTP/HTTPS URLs are allowed' };
    }

    // Check blocked hosts
    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked) || hostname.endsWith(blocked)) {
        return { safe: false, reason: 'Cannot access internal/private networks' };
      }
    }

    // Check for IP addresses that might be private
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return { safe: false, reason: 'Cannot access private IP addresses' };
      }
      if (a === 127) {
        return { safe: false, reason: 'Cannot access localhost' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

function checkRateLimit(sessionId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  let session = sessionRequests.get(sessionId);
  if (!session || now > session.resetAt) {
    session = { count: 0, resetAt: now + hourMs };
    sessionRequests.set(sessionId, session);
  }

  if (session.count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (${MAX_REQUESTS_PER_HOUR} requests/hour)`,
    };
  }

  session.count++;
  return { allowed: true };
}

// ============================================================================
// HTTP REQUEST EXECUTION
// ============================================================================

async function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ success: boolean; status?: number; data?: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (body.length > MAX_REQUEST_BODY_SIZE) {
        return { success: false, error: 'Request body too large (max 512KB)' };
      }
      options.body = body;
    }

    const response = await fetch(url, options);
    clearTimeout(timeout);

    // Read response with size limit
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return {
        success: true,
        status: response.status,
        data: '[Response too large to display]',
      };
    }

    let data: string;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await response.json();
      data = JSON.stringify(json, null, 2);
    } else {
      data = await response.text();
    }

    // Truncate if needed
    if (data.length > MAX_RESPONSE_SIZE) {
      data = data.slice(0, MAX_RESPONSE_SIZE) + '\n... [truncated]';
    }

    return {
      success: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = (error as Error).message;

    if (message.includes('abort')) {
      return { success: false, error: 'Request timed out (30 seconds)' };
    }

    return { success: false, error: `Request failed: ${message}` };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeHttpRequest(
  toolCall: UnifiedToolCall & { sessionId?: string }
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;
  const sessionId = toolCall.sessionId || 'default';

  if (name !== 'http_request') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const url = args.url as string;
  const method = ((args.method as string) || 'GET').toUpperCase();
  const customHeaders = (args.headers as Record<string, string>) || {};
  const bodyObj = args.body as Record<string, unknown> | undefined;
  const bodyRaw = args.body_raw as string | undefined;
  const contentType = args.content_type as string | undefined;

  if (!url) {
    return { toolCallId: id, content: 'URL is required', isError: true };
  }

  // Validate method
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { toolCallId: id, content: 'Invalid HTTP method', isError: true };
  }

  // Safety check
  const safetyCheck = isUrlSafe(url);
  if (!safetyCheck.safe) {
    return { toolCallId: id, content: `Blocked: ${safetyCheck.reason}`, isError: true };
  }

  // Require HTTPS for requests with bodies
  if (['POST', 'PUT', 'PATCH'].includes(method) && !url.startsWith('https://')) {
    // Allow http for webhooks on well-known services
    const parsed = new URL(url);
    const allowedHttpHosts = ['hooks.slack.com', 'discord.com', 'webhook.site'];
    if (!allowedHttpHosts.some((h) => parsed.hostname.includes(h))) {
      log.warn('HTTP (non-HTTPS) POST request', { url });
      // Just warn, don't block - some webhooks are http
    }
  }

  // Rate limit
  const rateCheck = checkRateLimit(sessionId);
  if (!rateCheck.allowed) {
    return { toolCallId: id, content: rateCheck.reason || 'Rate limited', isError: true };
  }

  // Build headers
  const headers: Record<string, string> = {
    'User-Agent': 'JCIL-AI/1.0',
    ...customHeaders,
  };

  // Build body
  let body: string | undefined;
  if (bodyObj) {
    body = JSON.stringify(bodyObj);
    if (!headers['Content-Type'] && !contentType) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (bodyRaw) {
    body = bodyRaw;
  }

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  log.info('Making HTTP request', { method, url: url.slice(0, 100), hasBody: !!body });

  const result = await makeRequest(url, method, headers, body);

  if (!result.success && !result.status) {
    return { toolCallId: id, content: result.error || 'Request failed', isError: true };
  }

  // Format response
  let response = `**HTTP ${method}** ${url}\n\n`;
  response += `**Status:** ${result.status || 'Unknown'}\n\n`;

  if (result.data) {
    // Try to detect if it's JSON and format nicely
    if (result.data.startsWith('{') || result.data.startsWith('[')) {
      response += `**Response:**\n\`\`\`json\n${result.data}\n\`\`\``;
    } else {
      response += `**Response:**\n\`\`\`\n${result.data}\n\`\`\``;
    }
  }

  log.info('HTTP request completed', { method, status: result.status });

  return {
    toolCallId: id,
    content: response,
    isError: !result.success,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isHttpRequestAvailable(): boolean {
  return true; // Always available - uses native fetch
}
