/**
 * Chat Tool Loading & Execution
 *
 * Handles lazy tool loading (registry-driven), MCP server integration,
 * Composio app integration, and the tool executor with cost tracking,
 * rate limiting, and quality control.
 */

import { logger } from '@/lib/logger';
import { uploadDocument } from '@/lib/documents/storage';
import {
  canExecuteTool,
  recordToolCost,
  type UnifiedToolResult,
  shouldRunQC,
  verifyOutput,
  isNativeServerTool,
} from '@/lib/ai/tools';
import {
  loadAvailableToolDefinitions,
  executeToolByName,
  hasToolLoader,
} from '@/lib/ai/tools/tool-loader';
import type { ToolTier } from '@/lib/ai/tools/registry';
import type { UnifiedTool } from '@/lib/ai/providers/types';
import type { ToolExecutor } from '@/lib/ai/chat-router';
import { getMCPManager, MCPClientManager } from '@/lib/mcp/mcp-client';
import {
  getComposioToolsForUser,
  executeComposioTool,
  isComposioTool,
  isComposioConfigured,
  getComposioClient,
} from '@/lib/composio';
import {
  ensureServerRunning,
  getUserServers as getMCPUserServers,
  getKnownToolsForServer,
} from '@/app/api/chat/mcp/helpers';
import { checkResearchRateLimit, checkToolRateLimit } from './rate-limiting';
import { sanitizeToolError } from './helpers';
import { sanitizeOutput } from '@/lib/ai/tools/safety';

const log = logger('ChatTools');

/**
 * Tool cost estimates for usage-based billing.
 * Maps 1:1 with the 96 active tools in registry.ts.
 * Last synced: 2026-03-23
 */
const TOOL_COSTS: Record<string, number> = {
  // ── Core (web, search, browser) ─────────────────────────────────
  web_search: 0.001,
  fetch_url: 0.0005,
  browser_visit: 0.05,
  http_request: 0.0001,
  shorten_link: 0.0001,
  youtube_transcript: 0.01,

  // ── Code & development ──────────────────────────────────────────
  run_code: 0.02,
  fix_error: 0.03,
  refactor_code: 0.05,
  format_code: 0.0001,
  diff_compare: 0.0001,
  github: 0.02,
  create_and_run_tool: 0.25,
  spawn_agents: 0.1,

  // ── Sandbox (E2B) ──────────────────────────────────────────────
  desktop_sandbox: 0.05,
  sandbox_files: 0.02,
  sandbox_test_runner: 0.05,
  sandbox_template: 0.03,

  // ── Documents & templates ──────────────────────────────────────
  create_document: 0.02,
  create_presentation: 0.03,
  document_template: 0.02,
  mail_merge: 0.02,
  create_email_template: 0.01,
  generate_invoice: 0.02,
  build_resume: 0.02,

  // ── Business & planning ────────────────────────────────────────
  create_business_canvas: 0.02,
  create_contract: 0.03,
  create_grant_proposal: 0.03,
  create_proposal: 0.03,
  create_okr_plan: 0.02,
  create_swot_analysis: 0.02,
  create_raci_matrix: 0.01,
  create_risk_assessment: 0.02,
  decision_matrix: 0.01,
  project_timeline: 0.02,
  content_calendar: 0.02,
  create_press_release: 0.02,
  create_case_study: 0.02,
  create_property_listing: 0.02,

  // ── HR & operations ────────────────────────────────────────────
  create_job_description: 0.02,
  create_performance_review: 0.02,
  create_policy_document: 0.02,
  create_sop: 0.02,
  create_training_manual: 0.03,
  create_meeting_minutes: 0.02,

  // ── Healthcare ─────────────────────────────────────────────────
  create_care_plan: 0.02,
  medical_calc: 0.02,

  // ── Education ──────────────────────────────────────────────────
  create_lesson_plan: 0.02,
  create_flashcards: 0.02,
  create_quiz: 0.02,
  create_rubric: 0.02,

  // ── Faith & ministry ───────────────────────────────────────────
  daily_devotional: 0.01,
  prayer_journal: 0.01,
  scripture_reference: 0.01,
  sermon_outline: 0.01,
  small_group_guide: 0.02,
  create_church_budget: 0.02,

  // ── Personal & lifestyle ───────────────────────────────────────
  budget_calculator: 0.02,
  calendar_event: 0.001,
  draft_email: 0.01,
  meal_planner: 0.02,
  plan_event: 0.02,
  plan_trip: 0.02,

  // ── PDF, Excel, files ──────────────────────────────────────────
  extract_pdf: 0.005,
  extract_table: 0.03,
  pdf_manipulate: 0.001,
  excel_advanced: 0.001,
  convert_file: 0.001,
  zip_files: 0.0005,
  query_data_sql: 0.0001,

  // ── Media & images ─────────────────────────────────────────────
  analyze_image: 0.02,
  transform_image: 0.001,
  transcribe_audio: 0.006,
  media_process: 0.01,
  image_metadata: 0.0001,
  ocr_extract_text: 0.002,
  generate_qr_code: 0.0001,
  generate_barcode: 0.0001,

  // ── Charts & visualization ─────────────────────────────────────
  create_chart: 0.001,
  e2b_visualize: 0.03,
  graphics_3d: 0.02,
  hough_vision: 0.02,
  ray_tracing: 0.02,

  // ── Data & analysis ────────────────────────────────────────────
  generate_fake_data: 0.0001,
  validate_data: 0.0001,
  analyze_text_nlp: 0.0002,
  search_index: 0.0002,
  analyze_sequence: 0.0001,
  sequence_analyze: 0.0001,
  signal_process: 0.0001,
  geo_calculate: 0.0001,
  phone_validate: 0.0001,
  check_accessibility: 0.0001,
  parse_grammar: 0.0001,
  solve_constraints: 0.0001,
  crypto_toolkit: 0.0001,
};

export interface LoadedTools {
  tools: UnifiedTool[];
  mcpToolNames: string[];
  composioToolContext: Awaited<ReturnType<typeof getComposioToolsForUser>> | null;
}

/**
 * All tool tiers are always loaded. Opus decides what to use.
 *
 * Previous behavior gated specialist tools behind keyword detection,
 * but with Opus 4.6 the token cost of extra schemas (~2-3K) is negligible
 * and we'd rather have every capability available than risk Opus not
 * having a tool it needs.
 */
export function selectToolTiers(_messageContent: string): ToolTier[] {
  return ['core', 'extended', 'specialist'];
}

/**
 * Load all available tools: built-in (lazy), MCP, and Composio.
 * Core + extended tools are always loaded. Specialist tools load on demand.
 *
 * @param userId - The authenticated user ID
 * @param messageContext - The last user message for tier selection (optional; loads all tiers if omitted)
 */
export async function loadAllTools(
  userId: string | null,
  messageContext?: string
): Promise<LoadedTools> {
  // Determine which tiers to load based on message content
  const tiers = messageContext ? selectToolTiers(messageContext) : undefined;

  // Lazy-load built-in tools from registry, filtered by tier
  const tools: UnifiedTool[] = await loadAvailableToolDefinitions(tiers);

  if (tiers) {
    log.info('Smart tool loading', { tiers, toolCount: tools.length });
  }
  const mcpToolNames: string[] = [];
  let composioToolContext: Awaited<ReturnType<typeof getComposioToolsForUser>> | null = null;

  // MCP tools from running servers
  const mcpManager = getMCPManager();
  const runningMcpTools = mcpManager.getAllTools();
  for (const mcpTool of runningMcpTools) {
    const toolName = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
    mcpToolNames.push(toolName);

    const anthropicTool = {
      name: toolName,
      description: `[MCP: ${mcpTool.serverId}] ${mcpTool.description || mcpTool.name}`,
      parameters: {
        type: 'object' as const,
        properties:
          (mcpTool.inputSchema as { properties?: Record<string, unknown> })?.properties || {},
        required: (mcpTool.inputSchema as { required?: string[] })?.required || [],
      },
    };
    tools.push(anthropicTool as UnifiedTool);
  }

  // MCP tools from "available" servers (enabled but not yet started)
  if (userId) {
    const mcpUserServers = getMCPUserServers(userId);
    for (const [serverId, serverState] of mcpUserServers.entries()) {
      if (serverState.enabled && serverState.status === 'available') {
        const knownTools = getKnownToolsForServer(serverId);
        for (const tool of knownTools) {
          const toolName = `mcp_${serverId}_${tool.name}`;
          if (!mcpToolNames.includes(toolName)) {
            mcpToolNames.push(toolName);

            // Note: These tools from cold servers have placeholder schemas.
            // The actual parameter schema is loaded when the server starts on-demand.
            // We accept a JSON object as input; the server will validate at execution time.
            const anthropicTool = {
              name: toolName,
              description: `[MCP: ${serverId}] ${tool.description || tool.name} (Server will start on first use — pass arguments as a JSON object)`,
              parameters: {
                type: 'object' as const,
                properties: {},
                required: [],
                additionalProperties: true,
              },
            };
            tools.push(anthropicTool as UnifiedTool);
          }
        }
      }
    }
  }

  if (mcpToolNames.length > 0) {
    log.info('MCP tools added to chat (on-demand)', {
      count: mcpToolNames.length,
      tools: mcpToolNames,
    });
  }

  // Composio tools (connected apps)
  if (isComposioConfigured() && userId) {
    try {
      composioToolContext = await getComposioToolsForUser(userId);

      if (composioToolContext.tools.length > 0) {
        for (const composioTool of composioToolContext.tools) {
          // Guard against Composio tools with missing/malformed schemas
          const schema = composioTool.input_schema;
          if (!composioTool.name || !schema || typeof schema !== 'object') {
            log.warn('Skipping Composio tool with missing schema', {
              name: composioTool.name || '<unnamed>',
              hasSchema: !!schema,
            });
            continue;
          }
          tools.push({
            name: composioTool.name,
            description: composioTool.description || composioTool.name,
            parameters: {
              type: 'object' as const,
              properties: schema.properties || {},
              required: schema.required || [],
            },
          } as UnifiedTool);
        }

        log.info('Composio tools added to chat', {
          userId,
          connectedApps: composioToolContext.connectedApps,
          toolCount: composioToolContext.tools.length,
          hasGitHub: composioToolContext.hasGitHub,
        });
      }
    } catch (composioError) {
      log.error('Failed to load Composio tools - integrations will be unavailable', {
        userId,
        error: composioError instanceof Error ? composioError.message : String(composioError),
      });
    }
  }

  // Deduplicate tools by name — Anthropic rejects requests with duplicate tool names
  const seenNames = new Set<string>();
  const uniqueTools: UnifiedTool[] = [];
  for (const tool of tools) {
    // Skip tools with missing or malformed schemas — they'll crash the API call
    if (!tool.name || !tool.parameters || typeof tool.parameters !== 'object') {
      log.warn('Skipping tool with missing name or parameters', {
        name: tool.name || '<undefined>',
        hasParams: !!tool.parameters,
      });
      continue;
    }
    if (!seenNames.has(tool.name)) {
      seenNames.add(tool.name);
      uniqueTools.push(tool);
    } else {
      log.warn('Skipped duplicate tool name', { tool: tool.name });
    }
  }

  // Safety cap: prevent runaway tool loading from crashing the API call.
  // Normal load is ~96 built-in + 25 MCP + Composio (~30-50) ≈ 150-170 tools.
  // Opus 4.6 handles 200+ tools within its 200K context window.
  // This cap only guards against extreme edge cases (e.g., rogue MCP server
  // registering thousands of tools).
  const MAX_TOOLS = 250;
  if (uniqueTools.length > MAX_TOOLS) {
    log.warn('Too many tools loaded — capping to prevent API overflow', {
      total: uniqueTools.length,
      cap: MAX_TOOLS,
      dropped: uniqueTools.length - MAX_TOOLS,
    });
    uniqueTools.length = MAX_TOOLS;
  }

  log.info('Chat tools loaded', {
    toolCount: uniqueTools.length,
    deduped: tools.length - uniqueTools.length,
  });

  return { tools: uniqueTools, mcpToolNames, composioToolContext };
}

// ============================================================================
// INLINE FILE UPLOAD (enables tool chaining)
// ============================================================================

/** Regex to find markdown links with base64 data URLs */
const BASE64_LINK_PATTERN = /\[([^\]]+)\]\((data:([^;]+);base64,[A-Za-z0-9+/=]+)\)/g;

/** MIME type → file extension */
const MIME_TO_EXT: Record<string, string> = {
  // Documents
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/rtf': 'rtf',
  // Images
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  // Data / Text
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  // Archives
  'application/zip': 'zip',
  'application/gzip': 'gz',
  // Audio / Video (for transcription outputs, media tools)
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/**
 * Find base64 data URLs in tool output and upload them to Supabase storage.
 * Replaces inline data URLs with hosted download URLs so they can be
 * attached to emails, shared via Slack, etc.
 */
async function uploadInlineFiles(
  userId: string,
  content: string,
  toolName: string
): Promise<string> {
  const matches = [...content.matchAll(BASE64_LINK_PATTERN)];
  if (matches.length === 0) return content;

  let updated = content;
  for (const match of matches) {
    const [fullMatch, linkText, dataUrl, mimeType] = match;
    const ext = MIME_TO_EXT[mimeType];
    if (!ext) continue; // Skip unknown MIME types

    try {
      // Extract the base64 data
      const base64Part = dataUrl.split(',')[1];
      if (!base64Part || base64Part.length < 100) continue; // Skip tiny/invalid

      const buffer = Buffer.from(base64Part, 'base64');
      const filename = `${linkText.replace(/[^a-zA-Z0-9_.-]/g, '_')}.${ext}`;

      const result = await uploadDocument(userId, buffer, filename, mimeType);

      if (result.storage === 'supabase') {
        // Replace the base64 data URL with the hosted URL
        updated = updated.replace(fullMatch, `[${linkText}](${result.url})`);
        log.info('Uploaded inline file for chaining', {
          tool: toolName,
          filename,
          size: buffer.length,
        });
      }
    } catch (err) {
      log.warn('Failed to upload inline file', {
        tool: toolName,
        error: err instanceof Error ? err.message : String(err),
      });
      // Keep the original data URL on failure
    }
  }

  return updated;
}

/**
 * Create a tool executor with rate limiting, cost control, and MCP/Composio dispatch.
 */
export function createToolExecutor(userId: string, sessionId: string): ToolExecutor {
  const mcpManager = getMCPManager();

  return async (toolCall): Promise<UnifiedToolResult> => {
    const toolName = toolCall.name;
    const estimatedCost = TOOL_COSTS[toolName] || 0.01;

    // Check cost limits
    const costCheck = canExecuteTool(sessionId, toolName, estimatedCost);
    if (!costCheck.allowed) {
      log.warn('Tool cost limit exceeded', { tool: toolName, reason: costCheck.reason });
      return {
        toolCallId: toolCall.id,
        content: `Cannot execute ${toolName}: ${costCheck.reason}`,
        isError: true,
      };
    }

    // Check research rate limit for search tools
    if (['web_search', 'browser_visit', 'fetch_url'].includes(toolName)) {
      const rateCheck = await checkResearchRateLimit(userId);
      if (!rateCheck.allowed) {
        log.warn('Search rate limit exceeded', {
          identifier: userId,
          tool: toolName,
        });
        return {
          toolCallId: toolCall.id,
          content: 'Search rate limit exceeded. Please try again later.',
          isError: true,
        };
      }
    }

    // CHAT-016: Per-tool rate limiting for expensive operations
    const toolRateCheck = await checkToolRateLimit(userId, toolName);
    if (!toolRateCheck.allowed) {
      log.warn('Tool rate limit exceeded', {
        identifier: userId,
        tool: toolName,
        limit: toolRateCheck.limit,
      });
      return {
        toolCallId: toolCall.id,
        content: `Rate limit exceeded for ${toolName}. Please try again later.`,
        isError: true,
      };
    }

    // Skip native server tools (web_search) — handled by Anthropic server-side
    if (isNativeServerTool(toolName)) {
      log.info('Skipping native server tool (handled by Anthropic)', { tool: toolName });
      return {
        toolCallId: toolCall.id,
        content: 'Handled by server',
        isError: false,
      };
    }

    log.info('Executing chat tool', { tool: toolName, sessionId });

    // Inject session ID into tool call for cost tracking
    const toolCallWithSession = { ...toolCall, sessionId, userId };

    // Execute the appropriate tool with error handling to prevent crashes
    let result: UnifiedToolResult = {
      toolCallId: toolCall.id,
      content: `Tool not executed: ${toolName}`,
      isError: true,
    };

    // Timeout wrapper to prevent hung tools from blocking slots forever
    const TOOL_TIMEOUT_MS =
      toolName === 'run_code' || toolName === 'parallel_research'
        ? 120_000 // 2 min for long-running tools
        : toolName === 'browser_visit' || toolName === 'desktop_sandbox'
          ? 90_000 // 90s for browser/desktop (sandbox startup + page load)
          : toolName === 'create_document'
            ? 90_000 // 90s for document/PDF generation (includes image fetching)
            : 30_000; // 30s for everything else

    try {
      const toolPromise = (async () => {
        if (hasToolLoader(toolName)) {
          // Built-in tool via lazy loader
          const loaderResult = await executeToolByName(toolCallWithSession);
          if (loaderResult) {
            return loaderResult;
          }
          // Loader exists but returned null — tool recognized but not executed
          return {
            toolCallId: toolCall.id,
            content: `Tool not executed: ${toolName}`,
            isError: true,
          } as UnifiedToolResult;
        } else if (toolName.startsWith('mcp_')) {
          // MCP tool
          return await executeMCPTool(mcpManager, toolName, toolCall, userId);
        } else if (isComposioTool(toolName)) {
          // Composio tool
          return await executeComposioToolCall(toolName, toolCall, userId);
        }
        return {
          toolCallId: toolCall.id,
          content: `Unknown tool: ${toolName}`,
          isError: true,
        } as UnifiedToolResult;
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool '${toolName}' timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
          TOOL_TIMEOUT_MS
        )
      );

      const execResult = await Promise.race([toolPromise, timeoutPromise]);
      if (execResult) {
        // Sanitize tool output to prevent indirect prompt injection
        if (!execResult.isError && typeof execResult.content === 'string') {
          execResult.content = sanitizeOutput(execResult.content);
        }
        result = execResult;
      }
    } catch (toolError) {
      const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
      log.error('Tool execution failed with unhandled error', {
        tool: toolName,
        error: errorMsg,
      });
      result = {
        toolCallId: toolCall.id,
        content: sanitizeToolError(toolName, errorMsg),
        isError: true,
      };
    }

    // Post-process: upload inline base64 files to storage so they get hosted URLs
    // This enables chaining (e.g., create document → attach to email)
    if (!result.isError && typeof result.content === 'string') {
      result.content = await uploadInlineFiles(userId, result.content, toolName);
    }

    // Record cost if successful
    if (!result.isError) {
      recordToolCost(sessionId, toolName, estimatedCost);
      log.debug('Tool executed successfully', { tool: toolName, cost: estimatedCost });

      // Quality control check for high-value operations
      if (shouldRunQC(toolName)) {
        try {
          const inputStr =
            typeof toolCall.arguments === 'string'
              ? toolCall.arguments
              : JSON.stringify(toolCall.arguments);
          const qcResult = await verifyOutput(toolName, inputStr, result.content);

          if (!qcResult.passed) {
            log.warn('QC check failed', {
              tool: toolName,
              issues: qcResult.issues,
            });
            result.content += `\n\n⚠️ Quality check: ${qcResult.issues.join(', ')}`;
          } else {
            log.debug('QC check passed', { tool: toolName });
          }
        } catch (qcError) {
          log.warn('QC check error', { error: (qcError as Error).message });
        }
      }
    }

    return result;
  };
}

async function executeMCPTool(
  mcpManager: MCPClientManager,
  toolName: string,
  toolCall: { id: string; arguments: string | Record<string, unknown> },
  userId: string
): Promise<UnifiedToolResult> {
  const parts = toolName.split('_');
  if (parts.length < 3) {
    return {
      toolCallId: toolCall.id,
      content: `Invalid MCP tool name format: ${toolName}`,
      isError: true,
    };
  }

  const serverId = parts[1];
  const actualToolName = parts.slice(2).join('_');

  try {
    const ensureResult = await ensureServerRunning(serverId, userId);
    if (!ensureResult.success) {
      return {
        toolCallId: toolCall.id,
        content: `Failed to start MCP server ${serverId}: ${ensureResult.error || 'Unknown error'}`,
        isError: true,
      };
    }

    log.info('MCP server ready (on-demand)', {
      serverId,
      tools: ensureResult.tools.length,
    });

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs =
        typeof toolCall.arguments === 'string'
          ? JSON.parse(toolCall.arguments)
          : toolCall.arguments;
    } catch (error) {
      log.warn('Failed to parse MCP tool arguments', {
        tool: actualToolName,
        error: (error as Error).message,
      });
      return {
        toolCallId: toolCall.id,
        content: `Invalid JSON arguments for MCP tool ${actualToolName}`,
        isError: true,
      };
    }

    log.info('Executing MCP tool', { serverId, tool: actualToolName });
    const mcpResult = await mcpManager.callTool(serverId, actualToolName, parsedArgs);

    log.info('MCP tool executed successfully', { serverId, tool: actualToolName });
    return {
      toolCallId: toolCall.id,
      content: typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult, null, 2),
      isError: false,
    };
  } catch (mcpError) {
    const errorMsg = mcpError instanceof Error ? mcpError.message : String(mcpError);
    log.error('MCP tool execution failed', {
      serverId,
      tool: actualToolName,
      error: errorMsg,
    });
    return {
      toolCallId: toolCall.id,
      content: sanitizeToolError(`${serverId}:${actualToolName}`, errorMsg),
      isError: true,
    };
  }
}

/**
 * Resolve attachment_urls into Composio's s3key-based attachment format.
 * Downloads each URL, uploads to Composio S3, and returns the attachment object.
 */
async function resolveAttachmentUrls(
  attachmentUrls: string[]
): Promise<{ s3key: string; mimetype: string; name: string } | null> {
  if (!attachmentUrls || attachmentUrls.length === 0) return null;

  // Process the first attachment (Gmail API supports one attachment object)
  const url = attachmentUrls[0];

  try {
    const client = getComposioClient();

    // Composio's files.upload accepts a URL string directly
    const fileData = await client.files.upload({
      file: url,
      toolSlug: 'GMAIL_SEND_EMAIL',
      toolkitSlug: 'gmail',
    });

    log.info('Uploaded attachment to Composio S3', {
      name: fileData.name,
      mimetype: fileData.mimetype,
      s3key: fileData.s3key,
    });

    return {
      s3key: fileData.s3key,
      mimetype: fileData.mimetype,
      name: fileData.name,
    };
  } catch (err) {
    log.error('Failed to upload attachment to Composio', {
      url: url.substring(0, 100),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function executeComposioToolCall(
  toolName: string,
  toolCall: { id: string; arguments: string | Record<string, unknown> },
  userId: string
): Promise<UnifiedToolResult> {
  try {
    log.info('Executing Composio tool', {
      tool: toolName,
      userId,
    });

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs =
        typeof toolCall.arguments === 'string'
          ? JSON.parse(toolCall.arguments)
          : toolCall.arguments;
    } catch (error) {
      log.warn('Failed to parse Composio tool arguments', {
        tool: toolName,
        error: (error as Error).message,
      });
      return {
        toolCallId: toolCall.id,
        content: `Invalid JSON arguments for Composio tool ${toolName}`,
        isError: true,
      };
    }

    // Handle attachment_urls for Gmail email tools
    if (
      (toolName === 'composio_GMAIL_SEND_EMAIL' ||
        toolName === 'composio_GMAIL_CREATE_EMAIL_DRAFT') &&
      Array.isArray(parsedArgs.attachment_urls) &&
      parsedArgs.attachment_urls.length > 0
    ) {
      const attachment = await resolveAttachmentUrls(parsedArgs.attachment_urls as string[]);
      if (attachment) {
        parsedArgs.attachment = attachment;
        log.info('Resolved attachment_urls to Composio attachment', {
          name: attachment.name,
          mimetype: attachment.mimetype,
        });
      } else {
        log.warn('Failed to resolve attachment_urls, sending email without attachment');
      }
      // Remove attachment_urls — Composio doesn't understand this param
      delete parsedArgs.attachment_urls;
    }

    const composioResult = await executeComposioTool(userId || 'anonymous', toolName, parsedArgs);

    if (composioResult.success) {
      log.info('Composio tool executed successfully', { tool: toolName });
      return {
        toolCallId: toolCall.id,
        content:
          typeof composioResult.result === 'string'
            ? composioResult.result
            : JSON.stringify(composioResult.result, null, 2),
        isError: false,
      };
    } else {
      return {
        toolCallId: toolCall.id,
        content: sanitizeToolError(toolName, composioResult.error || 'Unknown error'),
        isError: true,
      };
    }
  } catch (composioError) {
    const errorMsg = composioError instanceof Error ? composioError.message : String(composioError);
    log.error('Composio tool execution failed', {
      tool: toolName,
      error: errorMsg,
    });
    return {
      toolCallId: toolCall.id,
      content: sanitizeToolError(toolName, errorMsg),
      isError: true,
    };
  }
}
