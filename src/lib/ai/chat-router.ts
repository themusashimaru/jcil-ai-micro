/**
 * CHAT ROUTER - Multi-Provider Support
 *
 * Routes chat requests through the unified provider system with:
 * - Primary provider (Claude) with automatic fallback (xAI/Grok)
 * - Message format conversion (CoreMessage <-> UnifiedMessage)
 * - Streaming response formatting
 * - Full capability preservation across providers
 *
 * Usage:
 *   const { stream, provider, model } = await routeChat(messages, options);
 *   return new Response(stream, { headers: { 'X-Provider': provider } });
 */

import type { CoreMessage } from 'ai';
import {
  createProviderService,
  type ProviderChatOptions,
  type ProviderChatResult,
} from './providers/service';
import type {
  ProviderId,
  UnifiedMessage,
  UnifiedStreamChunk,
  UnifiedContentBlock,
  UnifiedTextBlock,
  UnifiedImageBlock,
  UnifiedDocumentBlock,
  UnifiedToolUseBlock,
  UnifiedToolResultBlock,
  UnifiedTool,
  UnifiedToolCall,
  UnifiedToolResult,
} from './providers/types';
import { logger } from '@/lib/logger';
import {
  ArtifactStore,
  ChainTelemetry,
  extractArtifacts,
  partitionParallelCalls,
  detectChainPattern,
  getToolFallbacks,
  buildRollbackContext,
  getToolDisplayLabel,
} from './tools/orchestration';

const log = logger('ChatRouter');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default provider configuration
 * Can be overridden via environment variables
 */
const DEFAULT_PRIMARY_PROVIDER: ProviderId =
  (process.env.DEFAULT_AI_PROVIDER as ProviderId) || 'claude';

const DEFAULT_FALLBACK_PROVIDER: ProviderId =
  (process.env.FALLBACK_AI_PROVIDER as ProviderId) || 'xai';

const ENABLE_FALLBACK = process.env.ENABLE_PROVIDER_FALLBACK !== 'false';

// ============================================================================
// MESSAGE CONVERSION: CoreMessage -> UnifiedMessage
// ============================================================================

/**
 * Convert a single content part from CoreMessage format to UnifiedContentBlock
 */
function convertContentPart(part: unknown): UnifiedContentBlock | null {
  if (!part || typeof part !== 'object') return null;

  const p = part as Record<string, unknown>;

  switch (p.type) {
    case 'text':
      return {
        type: 'text',
        text: String(p.text || ''),
      } as UnifiedTextBlock;

    case 'image':
      // Handle image parts - client sends as string data URL or object
      if (p.image) {
        // Handle string format (data URL from client): "data:image/png;base64,..."
        if (typeof p.image === 'string') {
          const imageStr = p.image as string;
          if (imageStr.startsWith('data:')) {
            // Parse data URL: data:image/png;base64,iVBORw0KGgo...
            const matches = imageStr.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  data: matches[2], // The base64 data
                  mediaType: matches[1], // e.g., 'image/png'
                },
              } as UnifiedImageBlock;
            }
          }
          // Plain URL string
          return {
            type: 'image',
            source: { type: 'url', url: imageStr },
          } as UnifiedImageBlock;
        }
        // Handle object format
        if (typeof p.image === 'object') {
          const img = p.image as Record<string, unknown>;
          if (img.url) {
            return {
              type: 'image',
              source: { type: 'url', url: String(img.url) },
            } as UnifiedImageBlock;
          } else if (img.base64) {
            return {
              type: 'image',
              source: {
                type: 'base64',
                data: String(img.base64),
                mediaType: String(img.mimeType || 'image/png'),
              },
            } as UnifiedImageBlock;
          }
        }
      }
      return null;

    case 'document':
      // Handle document parts (PDF, XLSX, DOCX sent for AI analysis)
      if (p.data && typeof p.data === 'string') {
        const dataStr = p.data as string;
        let base64Data = dataStr;
        let mediaType = String(p.mediaType || 'application/pdf');

        // Handle data URL format: "data:application/pdf;base64,..."
        if (dataStr.startsWith('data:')) {
          const matches = dataStr.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mediaType = matches[1];
            base64Data = matches[2];
          }
        }

        return {
          type: 'document',
          source: {
            type: 'base64',
            mediaType,
            data: base64Data,
          },
          name: p.name ? String(p.name) : undefined,
        } as UnifiedDocumentBlock;
      }
      return null;

    case 'tool-call':
    case 'tool_use':
      return {
        type: 'tool_use',
        id: String(p.toolCallId || p.id || ''),
        name: String(p.toolName || p.name || ''),
        arguments: (p.args || p.arguments || {}) as Record<string, unknown>,
      } as UnifiedToolUseBlock;

    case 'tool-result':
    case 'tool_result':
      return {
        type: 'tool_result',
        toolUseId: String(p.toolCallId || p.toolUseId || ''),
        content: typeof p.result === 'string' ? p.result : JSON.stringify(p.result || p.content),
        isError: Boolean(p.isError),
      } as UnifiedToolResultBlock;

    default:
      return null;
  }
}

/**
 * Convert CoreMessage array to UnifiedMessage array
 */
export function convertToUnifiedMessages(messages: CoreMessage[]): UnifiedMessage[] {
  return messages.map((msg): UnifiedMessage => {
    // Handle string content
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
      };
    }

    // Handle array content (multimodal)
    if (Array.isArray(msg.content)) {
      const blocks: UnifiedContentBlock[] = [];

      for (const part of msg.content) {
        const converted = convertContentPart(part);
        if (converted) {
          blocks.push(converted);
        } else if (typeof part === 'object' && part !== null) {
          // Fallback: try to extract text
          const p = part as unknown as Record<string, unknown>;
          if (p.text) {
            blocks.push({ type: 'text', text: String(p.text) });
          }
        }
      }

      // If we only have one text block, simplify to string
      if (blocks.length === 1 && blocks[0].type === 'text') {
        return {
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: (blocks[0] as UnifiedTextBlock).text,
        };
      }

      return {
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: blocks.length > 0 ? blocks : '',
      };
    }

    // Fallback for unexpected content types
    return {
      role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
      content: String(msg.content || ''),
    };
  });
}

// ============================================================================
// STREAM FORMATTING: UnifiedStreamChunk -> ReadableStream
// ============================================================================

/**
 * Create a ReadableStream from UnifiedStreamChunk generator
 * Formats chunks as plain text for streaming responses
 */
export function createStreamFromChunks(
  chunks: AsyncGenerator<UnifiedStreamChunk, ProviderChatResult, unknown>,
  onComplete?: (result: ProviderChatResult) => void,
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Keepalive: Opus 4.6 with thinking can take 10-15s before the first token.
      // Send a space byte every 10s to prevent connection timeouts.
      const KEEPALIVE_MS = 10_000;
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(' '));
        } catch {
          clearInterval(keepalive);
        }
      }, KEEPALIVE_MS);

      try {
        let result: ProviderChatResult | undefined;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let thinkingBuffer = '';

        for await (const chunk of chunks) {
          // Accumulate thinking chunks into a buffer
          if (chunk.type === 'thinking' && chunk.text) {
            thinkingBuffer += chunk.text;
            continue;
          }

          // When we get a non-thinking chunk, flush any accumulated thinking first
          if (thinkingBuffer && chunk.type === 'text') {
            controller.enqueue(encoder.encode(`\n<thinking>\n${thinkingBuffer}\n</thinking>\n`));
            thinkingBuffer = '';
          }

          // Emit text chunks to the stream
          if (chunk.type === 'text' && chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }

          // Accumulate token usage from message events
          if ((chunk.type === 'message_start' || chunk.type === 'message_end') && chunk.usage) {
            totalInputTokens += chunk.usage.inputTokens || 0;
            totalOutputTokens += chunk.usage.outputTokens || 0;
          }

          // Handle errors
          if (chunk.type === 'error' && chunk.error) {
            log.error('Stream error from provider', {
              code: chunk.error.code,
              message: chunk.error.message,
            });
          }
        }

        // Flush any remaining thinking content
        if (thinkingBuffer) {
          controller.enqueue(encoder.encode(`\n<thinking>\n${thinkingBuffer}\n</thinking>\n`));
          thinkingBuffer = '';
        }

        // Get the final result from the generator
        // Note: The generator returns the result when it completes
        try {
          const genResult = await chunks.next();
          if (genResult.done && genResult.value) {
            result = genResult.value as ProviderChatResult;
          }
        } catch {
          // Generator already exhausted, that's fine
        }

        // Call completion callback with result
        if (result && onComplete) {
          onComplete(result);
        }

        // Report accumulated usage for billing
        if (onUsage && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          try {
            onUsage({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
          } catch (usageErr) {
            log.warn('onUsage callback error in createStreamFromChunks', {
              error: (usageErr as Error).message,
            });
          }
        }

        clearInterval(keepalive);
        controller.close();
      } catch (error) {
        clearInterval(keepalive);
        log.error('Stream processing error', { error });
        controller.error(error);
      }
    },
  });
}

// ============================================================================
// CHAT ROUTING
// ============================================================================

/**
 * Options for routing a chat request
 */
export interface ChatRouteOptions {
  /** Override primary provider */
  providerId?: ProviderId;
  /** Override fallback provider */
  fallbackProviderId?: ProviderId;
  /** Specific model to use */
  model?: string;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response */
  temperature?: number;
  /** Disable fallback for this request */
  disableFallback?: boolean;
  /** Callback when provider switches */
  onProviderSwitch?: (from: ProviderId, to: ProviderId, reason: string) => void;
  /** Tools available to the AI */
  tools?: UnifiedTool[];
  /** Callback with accumulated token usage when stream ends */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
  /**
   * Extended thinking configuration
   * When enabled, the model will show its reasoning process before responding.
   * Only supported by Claude Sonnet 4.6+ and Opus 4.6+.
   */
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
  };
  /** BYOK: User's own API key for the selected provider */
  userApiKey?: string;
}

/**
 * Tool executor function type
 * Called when Claude wants to use a tool
 */
export type ToolExecutor = (toolCall: UnifiedToolCall) => Promise<UnifiedToolResult>;

/**
 * Result of routing a chat request
 */
export interface ChatRouteResult {
  /** ReadableStream for streaming response */
  stream: ReadableStream<Uint8Array>;
  /** Provider that handled the request */
  providerId: ProviderId;
  /** Model used */
  model: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Reason for fallback if used */
  fallbackReason?: string;
}

/**
 * Route a chat request through the multi-provider system
 *
 * @param messages - CoreMessage array from the request
 * @param options - Routing options
 * @returns ChatRouteResult with stream and metadata
 */
export async function routeChat(
  messages: CoreMessage[],
  options: ChatRouteOptions = {}
): Promise<ChatRouteResult> {
  const {
    providerId = DEFAULT_PRIMARY_PROVIDER,
    fallbackProviderId = DEFAULT_FALLBACK_PROVIDER,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    disableFallback = false,
    onProviderSwitch,
    onUsage,
    thinking,
  } = options;

  log.debug('Routing chat request', {
    primaryProvider: providerId,
    fallbackProvider: fallbackProviderId,
    messageCount: messages.length,
    hasSystemPrompt: !!systemPrompt,
  });

  // Create provider service with configured providers
  const service = createProviderService(providerId, disableFallback ? null : fallbackProviderId);

  // Convert messages to unified format
  let unifiedMessages = convertToUnifiedMessages(messages);

  // Filter out any existing system messages (we'll use the systemPrompt option instead)
  unifiedMessages = unifiedMessages.filter((m) => m.role !== 'system');

  // Build chat options - CRITICAL: pass systemPrompt here for Anthropic adapter
  const chatOptions: ProviderChatOptions = {
    providerId,
    fallbackProviderId: disableFallback ? undefined : fallbackProviderId,
    enableRetry: true,
    enableFallback: ENABLE_FALLBACK && !disableFallback,
    model,
    maxTokens,
    temperature,
    systemPrompt, // CRITICAL: This passes to the adapter's system parameter
    thinking, // Extended thinking config (Anthropic only)
    onProviderSwitch,
  };

  // Track the result for headers
  let finalResult: ProviderChatResult = {
    providerId,
    model: model || 'unknown',
    usedFallback: false,
  };

  // Start streaming
  const chunks = service.chat(unifiedMessages, chatOptions);

  // Create the response stream (passes onUsage for token tracking)
  const stream = createStreamFromChunks(
    chunks,
    (result) => {
      finalResult = result;
      log.debug('Chat completed', {
        provider: result.providerId,
        model: result.model,
        usedFallback: result.usedFallback,
        fallbackReason: result.fallbackReason,
      });
    },
    onUsage
  );

  return {
    stream,
    providerId: finalResult.providerId,
    model: finalResult.model,
    usedFallback: finalResult.usedFallback,
    fallbackReason: finalResult.fallbackReason,
  };
}

// ============================================================================
// CHAT WITH TOOLS (for Claude-driven tool use)
// ============================================================================

/**
 * Result of routing a chat request with tools
 */
export interface ChatWithToolsResult extends ChatRouteResult {
  /** Whether any tools were called */
  usedTools: boolean;
  /** Names of tools that were called */
  toolsUsed: string[];
}

/**
 * Route a chat request with tool support
 * Handles the tool execution loop: Claude calls tool -> we execute -> send results -> Claude continues
 *
 * @param messages - CoreMessage array from the request
 * @param options - Routing options (including tools)
 * @param toolExecutor - Function to execute tool calls
 * @returns ChatWithToolsResult with stream and metadata
 */
export async function routeChatWithTools(
  messages: CoreMessage[],
  options: ChatRouteOptions,
  toolExecutor: ToolExecutor
): Promise<ChatWithToolsResult> {
  const {
    providerId = DEFAULT_PRIMARY_PROVIDER,
    fallbackProviderId = DEFAULT_FALLBACK_PROVIDER,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    disableFallback = false,
    onProviderSwitch,
    tools = [],
    onUsage,
    thinking,
    userApiKey,
  } = options;

  if (tools.length === 0) {
    // No tools, use regular routing
    const result = await routeChat(messages, options);
    return {
      ...result,
      usedTools: false,
      toolsUsed: [],
    };
  }

  log.debug('Routing chat with tools', {
    primaryProvider: providerId,
    messageCount: messages.length,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  });

  const service = createProviderService(providerId, disableFallback ? null : fallbackProviderId);
  const encoder = new TextEncoder();

  // Track state across potential tool loops
  const currentMessages = convertToUnifiedMessages(messages).filter((m) => m.role !== 'system');
  const toolsUsed: string[] = [];
  let usedTools = false;

  // Build chat options
  const chatOptions: ProviderChatOptions = {
    providerId,
    fallbackProviderId: disableFallback ? undefined : fallbackProviderId,
    enableRetry: true,
    enableFallback: ENABLE_FALLBACK && !disableFallback,
    model,
    maxTokens,
    temperature,
    systemPrompt,
    thinking, // Extended thinking config (Anthropic only)
    tools,
    onProviderSwitch,
    ...(userApiKey ? { userApiKey } : {}),
  };

  const finalResult: ProviderChatResult = {
    providerId,
    model: model || 'unknown',
    usedFallback: false,
  };

  // Accumulate token usage across all iterations for billing
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Artifact store tracks outputs from tools for chaining
  const artifactStore = new ArtifactStore();
  // Chain telemetry tracks multi-step workflow execution
  const chainTelemetry = new ChainTelemetry();
  // Track all tools executed this session for chain detection
  const executedToolNames: string[] = [];
  // Track completed tool calls with params for rollback context
  const completedToolCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

  // Create a stream that handles tool loops
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const MAX_TOOL_ITERATIONS = 10; // Support complex orchestration chains
      const TOOL_LOOP_TIMEOUT_MS = 280_000; // 4 min 40s aggregate timeout (within 5-min backend limit)
      const toolLoopStartTime = Date.now();
      let iteration = 0;

      // Stream-level keepalive: runs from the very start of the connection.
      // Prevents Vercel/Cloudflare/load balancer timeouts during the initial
      // wait for Anthropic (can be 10-15s with thinking + 250 tools), AND
      // during gaps between tool execution and Claude's next response.
      // Sends a single space byte every 10s — invisible to the user but
      // keeps the TCP connection alive.
      const STREAM_KEEPALIVE_MS = 10_000;
      const streamKeepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(' '));
        } catch {
          // Stream closed — clear ourselves
          clearInterval(streamKeepalive);
        }
      }, STREAM_KEEPALIVE_MS);

      try {
        while (iteration < MAX_TOOL_ITERATIONS) {
          iteration++;

          // Aggregate timeout: abort tool loop if total time exceeds limit
          const elapsed = Date.now() - toolLoopStartTime;
          if (elapsed > TOOL_LOOP_TIMEOUT_MS) {
            log.warn('Tool loop aggregate timeout', { iteration, elapsedMs: elapsed });
            controller.enqueue(
              encoder.encode('\n\n*Tool execution took too long. Showing results so far.*\n')
            );
            break;
          }

          log.debug('Tool loop iteration', { iteration, messageCount: currentMessages.length });

          // Accumulate tool calls from this iteration
          const pendingToolCalls: UnifiedToolCall[] = [];
          let currentToolCall: Partial<UnifiedToolCall> | null = null;
          let toolArgsBuffer = '';
          let toolLoopThinkingBuffer = '';

          // Stream from provider
          const chunks = service.chat(currentMessages, chatOptions);

          for await (const chunk of chunks) {
            switch (chunk.type) {
              case 'message_start':
                // Capture input tokens from message_start (Anthropic reports them here)
                if (chunk.usage) {
                  totalInputTokens += chunk.usage.inputTokens || 0;
                }
                break;

              case 'text':
                // Flush accumulated thinking before emitting text
                if (toolLoopThinkingBuffer) {
                  controller.enqueue(
                    encoder.encode(`\n<thinking>\n${toolLoopThinkingBuffer}\n</thinking>\n`)
                  );
                  toolLoopThinkingBuffer = '';
                }
                // Stream text directly to client
                if (chunk.text) {
                  controller.enqueue(encoder.encode(chunk.text));
                }
                break;

              case 'thinking':
                // Buffer thinking chunks to avoid wrapping each token individually
                if (chunk.text) {
                  toolLoopThinkingBuffer += chunk.text;
                }
                break;

              case 'tool_call_start':
                // Start accumulating a tool call
                if (chunk.toolCall) {
                  currentToolCall = {
                    id: chunk.toolCall.id,
                    name: chunk.toolCall.name,
                    arguments: {},
                  };
                  toolArgsBuffer = '';
                  // Emit marker so the frontend can show real-time tool activity
                  controller.enqueue(encoder.encode(`\n<!--TOOL_START:${chunk.toolCall.name}-->`));
                  log.debug('Tool call started', {
                    name: chunk.toolCall.name,
                    id: chunk.toolCall.id,
                  });
                }
                break;

              case 'tool_call_delta':
                // Accumulate tool arguments (raw partial JSON string from Anthropic)
                if (chunk.toolCall?.arguments !== undefined) {
                  // Arguments come as raw partial JSON string, just concatenate
                  toolArgsBuffer += String(chunk.toolCall.arguments);
                }
                break;

              case 'tool_call_end':
                // Tool call complete, parse and add to pending
                if (currentToolCall && currentToolCall.id && currentToolCall.name) {
                  let args: Record<string, unknown> = {};
                  let parseError = false;

                  try {
                    // Parse accumulated arguments
                    args = toolArgsBuffer ? JSON.parse(toolArgsBuffer) : {};
                  } catch (parseErr) {
                    log.error('Failed to parse tool arguments, using empty args', {
                      error: (parseErr as Error).message,
                      buffer: toolArgsBuffer.substring(0, 100),
                    });
                    parseError = true;
                    // Continue with empty args - let tool executor handle it
                  }

                  const completedCall: UnifiedToolCall = {
                    id: currentToolCall.id,
                    name: currentToolCall.name,
                    arguments: parseError
                      ? { _parseError: true, _rawBuffer: toolArgsBuffer.substring(0, 500) }
                      : args,
                  };
                  pendingToolCalls.push(completedCall);
                  log.debug('Tool call completed', {
                    name: completedCall.name,
                    args: Object.keys(args),
                    parseError,
                  });
                }
                currentToolCall = null;
                toolArgsBuffer = '';
                break;

              case 'message_end':
                if (chunk.usage) {
                  totalInputTokens += chunk.usage.inputTokens || 0;
                  totalOutputTokens += chunk.usage.outputTokens || 0;
                  log.debug('Message usage', chunk.usage);
                }
                break;

              case 'error':
                if (chunk.error) {
                  log.error('Stream error', chunk.error);
                  // Include error code in the message for better frontend handling
                  // Format: "[CODE] message" allows frontend to extract the code
                  const errorMsg = chunk.error.code
                    ? `[${chunk.error.code}] ${chunk.error.message}`
                    : chunk.error.message;
                  controller.error(new Error(errorMsg));
                  return;
                }
                break;
            }
          }

          // Flush any remaining thinking buffer from this iteration
          if (toolLoopThinkingBuffer) {
            controller.enqueue(
              encoder.encode(`\n<thinking>\n${toolLoopThinkingBuffer}\n</thinking>\n`)
            );
            toolLoopThinkingBuffer = '';
          }

          // If no tool calls, we're done
          if (pendingToolCalls.length === 0) {
            log.debug('No tool calls, completing stream', { iteration });
            break;
          }

          // Execute tool calls and collect results
          usedTools = true;
          const toolResults: UnifiedToolResult[] = [];

          // Per-tool timeouts - some tools need more time than others
          const TOOL_TIMEOUTS: Record<string, number> = {
            spawn_agents: 150000, // Sub-agents run parallel Opus calls with tools
            web_search: 45000, // Web search can be slow
            browser_visit: 45000, // Browser automation needs time
            run_code: 45000, // Code execution can take time
            create_and_run_tool: 45000, // Dynamic tool creation
            create_document: 90000, // Document/PDF generation (includes image fetching)
            desktop_sandbox: 60000, // Desktop sandbox interactions
            fetch_url: 30000, // URL fetching
            analyze_image: 30000, // Vision analysis
            extract_pdf_url: 30000, // PDF extraction
            extract_table: 30000, // Table extraction
          };
          const DEFAULT_TIMEOUT_MS = 30000; // 30 second default
          const KEEPALIVE_INTERVAL_MS = 8000; // Send keepalive every 8s to prevent Vercel timeout

          // Keep connection alive during tool execution to prevent Vercel streaming timeout.
          // We intentionally do NOT inject visible status text (e.g. "*Searching the web...*")
          // into the content stream — that pollutes saved messages. Instead, send a single
          // space character as a keepalive. Vercel just needs bytes on the wire.
          const keepaliveInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(' '));
            } catch {
              // Stream may have been closed, ignore
            }
          }, KEEPALIVE_INTERVAL_MS);

          try {
            // Partition tool calls for parallel execution where safe
            const batches = partitionParallelCalls(pendingToolCalls);

            for (const batch of batches) {
              // Execute tools in this batch in parallel
              const batchPromises = batch.map(async (toolCall) => {
                log.info('Executing tool', { name: toolCall.name, id: toolCall.id });
                toolsUsed.push(toolCall.name);

                const toolTimeout = TOOL_TIMEOUTS[toolCall.name] || DEFAULT_TIMEOUT_MS;

                try {
                  const result = await Promise.race([
                    toolExecutor(toolCall),
                    new Promise<UnifiedToolResult>((_, reject) =>
                      setTimeout(
                        () => reject(new Error(`Tool execution timeout (${toolTimeout / 1000}s)`)),
                        toolTimeout
                      )
                    ),
                  ]);

                  // Extract and store artifacts from tool output
                  const artifacts = extractArtifacts(
                    toolCall.name,
                    result.content,
                    result.isError || false
                  );
                  for (const artifact of artifacts) {
                    artifactStore.add(
                      toolCall.name,
                      artifact.type,
                      artifact.content,
                      artifact.label,
                      artifact.metadata
                    );
                  }

                  // Track tool for chain detection and telemetry
                  executedToolNames.push(toolCall.name);
                  const detectedChain = detectChainPattern(executedToolNames);
                  if (detectedChain) {
                    // Auto-detect and track chain progress
                    const existingChains = chainTelemetry.getAll();
                    const isTracked = existingChains.some(
                      (e) => e.chainName === detectedChain.name && e.status === 'running'
                    );
                    if (!isTracked) {
                      chainTelemetry.startChain(detectedChain.name, detectedChain.tools);
                    }
                    chainTelemetry.stepCompleted(detectedChain.name);

                    // Emit chain progress to stream for real-time UI
                    try {
                      const steps = detectedChain.tools.map((t) => {
                        const executedIdx = executedToolNames.indexOf(t);
                        const isExecuted = executedIdx >= 0;
                        const isCurrent = t === toolCall.name;
                        return {
                          name: t,
                          label: getToolDisplayLabel(t),
                          status: isExecuted
                            ? 'complete'
                            : isCurrent
                              ? 'running'
                              : ('pending' as const),
                        };
                      });
                      const exec = chainTelemetry
                        .getAll()
                        .find((e) => e.chainName === detectedChain.name);
                      const progressJson = JSON.stringify({
                        chainName: detectedChain.name,
                        steps,
                        status: exec?.status || 'running',
                      });
                      controller.enqueue(
                        encoder.encode(`\n\`\`\`chain-progress\n${progressJson}\n\`\`\`\n`)
                      );
                    } catch {
                      // Non-critical — don't break the stream if progress emission fails
                    }
                  }

                  // Track successful tool for rollback context
                  if (!result.isError) {
                    const parsedArgs =
                      typeof toolCall.arguments === 'string'
                        ? {}
                        : (toolCall.arguments as Record<string, unknown>);
                    completedToolCalls.push({ name: toolCall.name, params: parsedArgs });
                  }

                  // Emit result marker so frontend knows tool finished
                  controller.enqueue(
                    encoder.encode(
                      `\n<!--TOOL_RESULT:${toolCall.name}:${result.isError ? 'error' : 'success'}-->`
                    )
                  );

                  // Emit DOCUMENT_DOWNLOAD marker for file-producing tools so the
                  // client renders the download button. Tool results contain
                  // markdown links like [Download file](url) after
                  // uploadInlineFiles() replaces base64 with hosted URLs.
                  const FILE_PRODUCING_TOOLS = new Set([
                    'create_document',
                    'create_presentation',
                    'excel_advanced',
                    'pdf_operations',
                    'zip_files',
                    'create_spreadsheet',
                    'generate_qr_code',
                    'transform_image',
                    'mail_merge',
                  ]);

                  const MIME_MAP: Record<string, string> = {
                    pdf: 'application/pdf',
                    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    txt: 'text/plain',
                    zip: 'application/zip',
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    webp: 'image/webp',
                    gif: 'image/gif',
                    svg: 'image/svg+xml',
                  };

                  if (
                    !result.isError &&
                    FILE_PRODUCING_TOOLS.has(toolCall.name) &&
                    typeof result.content === 'string'
                  ) {
                    // Try hosted URL first (Supabase upload succeeded)
                    const hostedMatch = result.content.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
                    // Fallback to data URL (Supabase upload failed or skipped)
                    const dataMatch =
                      !hostedMatch && result.content.match(/\[([^\]]+)\]\((data:[^)]+)\)/);

                    const linkMatch = hostedMatch || dataMatch;
                    if (linkMatch) {
                      const [, linkText, url] = linkMatch;
                      const ext = linkText.split('.').pop()?.toLowerCase() || 'pdf';
                      const filename = linkText.replace(/^Download\s+/i, '');
                      const isHosted = !!hostedMatch;

                      const marker = JSON.stringify({
                        filename,
                        mimeType: MIME_MAP[ext] || 'application/octet-stream',
                        ...(isHosted ? { downloadUrl: url } : { dataUrl: url }),
                        canPreview:
                          ext === 'pdf' || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext),
                        type: ext,
                      });
                      controller.enqueue(encoder.encode(`\n[DOCUMENT_DOWNLOAD:${marker}]`));
                      log.info('Emitted DOCUMENT_DOWNLOAD marker', {
                        tool: toolCall.name,
                        filename,
                        storage: isHosted ? 'supabase' : 'dataurl',
                      });
                    }
                  }

                  log.debug('Tool execution complete', {
                    name: toolCall.name,
                    resultLength: result.content.length,
                    isError: result.isError,
                    artifactsExtracted: artifacts.length,
                  });
                  return result;
                } catch (execErr) {
                  const errorMsg = (execErr as Error).message;
                  log.error('Tool execution failed', {
                    name: toolCall.name,
                    error: errorMsg,
                    timeout: toolTimeout,
                  });

                  // Track failure in chain telemetry
                  executedToolNames.push(toolCall.name);
                  const detectedChain = detectChainPattern(executedToolNames);
                  if (detectedChain) {
                    chainTelemetry.stepFailed(detectedChain.name, toolCall.name, errorMsg);
                  }

                  // Emit error marker so frontend knows tool failed
                  controller.enqueue(encoder.encode(`\n<!--TOOL_RESULT:${toolCall.name}:error-->`));

                  // Build fallback hint for Claude
                  const fallbacks = getToolFallbacks(toolCall.name);
                  const fallbackHint =
                    fallbacks.length > 0
                      ? `\n\nFALLBACK: Try using ${fallbacks[0]} instead of ${toolCall.name} to accomplish the same goal.`
                      : '';

                  // Build rollback context if there are completed steps
                  const rollbackHint = buildRollbackContext(completedToolCalls);

                  return {
                    toolCallId: toolCall.id,
                    content: `Error executing tool: ${errorMsg}${fallbackHint}${rollbackHint}`,
                    isError: true,
                  } as UnifiedToolResult;
                }
              });

              const batchResults = await Promise.all(batchPromises);
              toolResults.push(...batchResults);
            }
          } finally {
            // Always clear keepalive interval
            clearInterval(keepaliveInterval);
            // Send completion status and newline before Claude's synthesis
            log.debug('Tool execution phase complete, continuing to synthesis');
          }

          // Add assistant message with tool calls to conversation
          // Note: arguments are already parsed to Record at tool_call_end, so cast is safe
          const assistantToolContent: UnifiedContentBlock[] = pendingToolCalls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            arguments: (typeof tc.arguments === 'string' ? {} : tc.arguments) as Record<
              string,
              unknown
            >,
          }));
          currentMessages.push({
            role: 'assistant',
            content: assistantToolContent,
          });

          // Add tool results to conversation
          const toolResultContent: UnifiedContentBlock[] = toolResults.map((tr) => ({
            type: 'tool_result' as const,
            toolUseId: tr.toolCallId,
            content: tr.content,
            isError: tr.isError,
          }));

          // Inject artifact context so Claude knows about outputs from previous tools
          // This enables intelligent tool chaining (e.g., chart URL → presentation slide)
          if (artifactStore.hasArtifacts()) {
            const artifactContext = artifactStore.buildContextString();
            toolResultContent.push({
              type: 'text' as const,
              text: artifactContext,
            } as UnifiedContentBlock);
          }

          currentMessages.push({
            role: 'user', // Tool results go in user role for Anthropic
            content: toolResultContent,
          });

          log.debug('Continuing with tool results', {
            toolCount: toolResults.length,
            newMessageCount: currentMessages.length,
          });
        }

        if (iteration >= MAX_TOOL_ITERATIONS) {
          log.warn('Max tool iterations reached', { iteration });
        }

        // Log chain telemetry summary
        const chainStats = chainTelemetry.getStats();
        if (chainStats.total > 0) {
          log.info('Chain telemetry summary', {
            ...chainStats,
            executedTools: executedToolNames,
          });
        }

        // Report accumulated usage for billing
        if (onUsage && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          try {
            onUsage({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
          } catch (usageErr) {
            log.warn('onUsage callback error', { error: (usageErr as Error).message });
          }
        }

        clearInterval(streamKeepalive);
        controller.close();
      } catch (error) {
        clearInterval(streamKeepalive);
        log.error('Error in tool loop', { error });
        controller.error(error);
      }
    },
  });

  return {
    stream,
    providerId: finalResult.providerId,
    model: finalResult.model,
    usedFallback: finalResult.usedFallback,
    fallbackReason: finalResult.fallbackReason,
    usedTools,
    toolsUsed: [...new Set(toolsUsed)], // Dedupe
  };
}

// ============================================================================
// NON-STREAMING CHAT (for title generation, memory extraction, etc.)
// ============================================================================

/**
 * Result of a non-streaming chat completion
 */
export interface ChatCompletionResult {
  /** Generated text content */
  text: string;
  /** Provider that handled the request */
  providerId: ProviderId;
  /** Model used */
  model: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Token usage if available */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Complete a chat request without streaming
 * Useful for title generation, memory extraction, etc.
 *
 * @param messages - CoreMessage array
 * @param options - Routing options
 * @returns ChatCompletionResult with text and metadata
 */
export async function completeChat(
  messages: CoreMessage[],
  options: ChatRouteOptions = {}
): Promise<ChatCompletionResult> {
  const {
    providerId = DEFAULT_PRIMARY_PROVIDER,
    fallbackProviderId = DEFAULT_FALLBACK_PROVIDER,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    disableFallback = false,
    onProviderSwitch,
  } = options;

  log.debug('Completing chat (non-streaming)', {
    primaryProvider: providerId,
    messageCount: messages.length,
  });

  // Create provider service
  const service = createProviderService(providerId, disableFallback ? null : fallbackProviderId);

  // Convert messages
  let unifiedMessages = convertToUnifiedMessages(messages);

  // Filter out any existing system messages (we'll use the systemPrompt option instead)
  unifiedMessages = unifiedMessages.filter((m) => m.role !== 'system');

  // Build chat options - CRITICAL: pass systemPrompt here for Anthropic adapter
  const chatOptions: ProviderChatOptions = {
    providerId,
    fallbackProviderId: disableFallback ? undefined : fallbackProviderId,
    enableRetry: true,
    enableFallback: ENABLE_FALLBACK && !disableFallback,
    model,
    maxTokens,
    temperature,
    systemPrompt, // CRITICAL: This passes to the adapter's system parameter
    onProviderSwitch,
  };

  // Collect all text from the stream
  let text = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  let result: ProviderChatResult | undefined;

  const chunks = service.chat(unifiedMessages, chatOptions);

  let accInputTokens = 0;
  let accOutputTokens = 0;

  for await (const chunk of chunks) {
    if (chunk.type === 'text' && chunk.text) {
      text += chunk.text;
    }
    // Accumulate usage from both message_start (input) and message_end (output)
    if ((chunk.type === 'message_start' || chunk.type === 'message_end') && chunk.usage) {
      accInputTokens += chunk.usage.inputTokens || 0;
      accOutputTokens += chunk.usage.outputTokens || 0;
    }
  }

  if (accInputTokens > 0 || accOutputTokens > 0) {
    usage = { inputTokens: accInputTokens, outputTokens: accOutputTokens };
  }

  // Get final result
  try {
    const genResult = await chunks.next();
    if (genResult.done && genResult.value) {
      result = genResult.value as ProviderChatResult;
    }
  } catch {
    // Generator exhausted
  }

  return {
    text,
    providerId: result?.providerId || providerId,
    model: result?.model || model || 'unknown',
    usedFallback: result?.usedFallback || false,
    usage,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a provider is available and configured
 */
export function isProviderConfigured(providerId: ProviderId): boolean {
  const service = createProviderService(providerId, null);
  const statuses = service.getProviderStatuses();
  const status = statuses.find((s) => s.providerId === providerId);
  return status?.configured ?? false;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ProviderId[] {
  const service = createProviderService('claude', null);
  return service.getConfiguredProviders();
}

/**
 * Get the default provider configuration
 */
export function getDefaultProviders(): {
  primary: ProviderId;
  fallback: ProviderId;
} {
  return {
    primary: DEFAULT_PRIMARY_PROVIDER,
    fallback: DEFAULT_FALLBACK_PROVIDER,
  };
}
