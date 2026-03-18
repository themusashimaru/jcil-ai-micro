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

// Tool cost estimates for usage-based billing
const TOOL_COSTS: Record<string, number> = {
  web_search: 0.001,
  fetch_url: 0.0005,
  run_code: 0.02,
  analyze_image: 0.02,
  browser_visit: 0.05,
  extract_pdf_url: 0.005,
  extract_table: 0.03,
  // parallel_research removed — agent pattern replaced by skills
  create_and_run_tool: 0.25,
  transcribe_audio: 0.006,
  // create_spreadsheet removed — use excel_advanced
  http_request: 0.0001,
  generate_qr_code: 0.0001,
  transform_image: 0.001,
  convert_file: 0.001,
  shorten_link: 0.0001,
  generate_diagram: 0.0001,
  generate_fake_data: 0.0001,
  diff_compare: 0.0001,
  analyze_text_nlp: 0.0002,
  extract_entities: 0.0002,
  generate_barcode: 0.0001,
  ocr_extract_text: 0.002,
  pdf_manipulate: 0.001,
  media_process: 0.01,
  query_data_sql: 0.0001,
  excel_advanced: 0.001,
  format_code: 0.0001,
  crypto_toolkit: 0.0001,
  zip_files: 0.0005,
  // capture_webpage removed — use browser_visit
  math_compute: 0.0001,
  image_metadata: 0.0001,
  search_index: 0.0002,
  ascii_art: 0.0001,
  color_tools: 0.0001,
  validate_data: 0.0001,
  cron_explain: 0.0001,
  convert_units: 0.0001,
  analyze_statistics: 0.0001,
  geo_calculate: 0.0001,
  phone_validate: 0.0001,
  analyze_password: 0.0001,
  analyze_molecule: 0.0001,
  analyze_sequence: 0.0001,
  matrix_compute: 0.0001,
  analyze_graph: 0.0001,
  periodic_table: 0.0001,
  physics_constants: 0.0001,
  signal_process: 0.0001,
  check_accessibility: 0.0001,
  symbolic_math: 0.0001,
  solve_ode: 0.0001,
  optimize: 0.0001,
  financial_calc: 0.0001,
  music_theory: 0.0001,
  compute_geometry: 0.0001,
  parse_grammar: 0.0001,
  recurrence_rule: 0.0001,
  solve_constraints: 0.0001,
  analyze_timeseries: 0.0001,
  tensor_ops: 0.0001,
  string_distance: 0.0001,
  numerical_integrate: 0.0001,
  find_roots: 0.0001,
  interpolate: 0.0001,
  special_functions: 0.0001,
  complex_math: 0.0001,
  combinatorics: 0.0001,
  number_theory: 0.0001,
  probability_dist: 0.0001,
  polynomial_ops: 0.0001,
  astronomy_calc: 0.0001,
  coordinate_transform: 0.0001,
  sequence_analyze: 0.0001,
  ml_toolkit: 0.0001,
  quantum_circuit: 0.0001,
  control_theory: 0.0001,
  monte_carlo_sim: 0.0001,
  game_solver: 0.0001,
  orbital_calc: 0.0001,
  thermo_calc: 0.0001,
  em_fields: 0.0001,
  image_compute: 0.0001,
  wavelet_transform: 0.0001,
  latex_render: 0.0001,
  rocket_propulsion: 0.0001,
  fluid_dynamics: 0.0001,
  aerodynamics: 0.0001,
  drone_flight: 0.0001,
  pathfinder: 0.0001,
  circuit_sim: 0.0001,
  ballistics: 0.0001,
  genetic_algorithm: 0.0001,
  chaos_dynamics: 0.0001,
  robotics_kinematics: 0.0001,
  optics_sim: 0.0001,
  epidemiology: 0.0001,
  finite_element: 0.0001,
  antenna_rf: 0.0001,
  materials_science: 0.0001,
  seismology: 0.0001,
  bioinformatics_pro: 0.0001,
  acoustics: 0.0001,
  workspace: 0.02,
  generate_code: 0.05,
  analyze_code: 0.03,
  build_project: 0.1,
  generate_tests: 0.05,
  fix_error: 0.03,
  refactor_code: 0.05,
  generate_docs: 0.03,
  run_workflow: 0.1,
  github_context: 0.02,
  network_security: 0.0001,
  dns_security: 0.0001,
  ip_security: 0.0001,
  wireless_security: 0.0001,
  api_security: 0.0001,
  web_security: 0.0001,
  browser_security: 0.0001,
  mobile_security: 0.0001,
  cloud_security: 0.0001,
  cloud_native_security: 0.0001,
  container_security: 0.0001,
  data_security: 0.0001,
  database_security: 0.0001,
  credential_security: 0.0001,
  email_security: 0.0001,
  endpoint_security: 0.0001,
  iot_security: 0.0001,
  physical_security: 0.0001,
  blockchain_security: 0.0001,
  ai_security: 0.0001,
  supply_chain_security: 0.0001,
  security_operations: 0.0001,
  security_metrics: 0.0001,
  security_headers: 0.0001,
  security_testing: 0.0001,
  security_audit: 0.0001,
  security_architecture: 0.0001,
  security_architecture_patterns: 0.0001,
  security_policy: 0.0001,
  security_awareness: 0.0001,
  security_culture: 0.0001,
  security_budget: 0.0001,
  threat_hunting: 0.0001,
  threat_intel: 0.0001,
  threat_model: 0.0001,
  threat_modeling: 0.0001,
  malware_analysis: 0.0001,
  malware_indicators: 0.0001,
  siem: 0.0001,
  forensics: 0.0001,
  soar: 0.0001,
  soc: 0.0001,
  xdr: 0.0001,
  red_team: 0.0001,
  blue_team: 0.0001,
  osint: 0.0001,
  ransomware_defense: 0.0001,
  compliance_framework: 0.0001,
  risk_management: 0.0001,
  incident_response: 0.0001,
  ids_ips: 0.0001,
  firewall: 0.0001,
  honeypot: 0.0001,
  pen_test: 0.0001,
  vuln_assessment: 0.0001,
  vulnerability_scanner: 0.0001,
  zero_trust: 0.0001,
  attack_surface: 0.0001,
  network_defense: 0.0001,
  cyber_insurance: 0.0001,
  vendor_risk: 0.0001,
  social_engineering: 0.0001,
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
          tools.push({
            name: composioTool.name,
            description: composioTool.description,
            parameters: {
              type: 'object' as const,
              properties: composioTool.input_schema.properties || {},
              required: composioTool.input_schema.required || [],
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
    if (!seenNames.has(tool.name)) {
      seenNames.add(tool.name);
      uniqueTools.push(tool);
    } else {
      log.warn('Skipped duplicate tool name', { tool: tool.name });
    }
  }

  log.debug('Available chat tools', {
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
    const toolCallWithSession = { ...toolCall, sessionId };

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
    } catch {
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
    } catch {
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
