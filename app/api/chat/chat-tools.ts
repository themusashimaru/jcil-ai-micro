/**
 * Chat Tool Loading & Execution
 *
 * Handles lazy tool loading (registry-driven), MCP server integration,
 * Composio app integration, and the tool executor with cost tracking,
 * rate limiting, and quality control.
 */

import { logger } from '@/lib/logger';
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
import type { UnifiedTool } from '@/lib/ai/providers/types';
import type { ToolExecutor } from '@/lib/ai/chat-router';
import { getMCPManager, MCPClientManager } from '@/lib/mcp/mcp-client';
import {
  getComposioToolsForUser,
  executeComposioTool,
  isComposioTool,
  isComposioConfigured,
} from '@/lib/composio';
import {
  ensureServerRunning,
  getUserServers as getMCPUserServers,
  getKnownToolsForServer,
} from '@/app/api/chat/mcp/helpers';
import { checkResearchRateLimit, checkToolRateLimit } from './rate-limiting';
import { sanitizeToolError } from './helpers';

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
  parallel_research: 0.15,
  create_and_run_tool: 0.25,
  transcribe_audio: 0.006,
  create_spreadsheet: 0.001,
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
  capture_webpage: 0.005,
  math_compute: 0.0001,
  image_metadata: 0.0001,
  search_index: 0.0002,
  ascii_art: 0.0001,
  color_tools: 0.0001,
  validate_data: 0.0001,
  cron_explain: 0.0001,
  convert_units: 0.0001,
  audio_synth: 0.0001,
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
 * Load all available tools: built-in (lazy), MCP, and Composio.
 */
export async function loadAllTools(userId: string | null): Promise<LoadedTools> {
  // Lazy-load built-in tools from registry
  const tools: UnifiedTool[] = await loadAvailableToolDefinitions();
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

            const anthropicTool = {
              name: toolName,
              description: `[MCP: ${serverId}] ${tool.description || tool.name}`,
              parameters: {
                type: 'object' as const,
                properties: {},
                required: [],
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
      log.warn('Failed to load Composio tools', { error: composioError });
    }
  }

  log.debug('Available chat tools', { toolCount: tools.length, tools: tools.map((t) => t.name) });

  return { tools, mcpToolNames, composioToolContext };
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
      const rateCheck = checkResearchRateLimit(userId);
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
    const toolRateCheck = checkToolRateLimit(userId, toolName);
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

    try {
      if (hasToolLoader(toolName)) {
        // Built-in tool via lazy loader
        const loaderResult = await executeToolByName(toolCallWithSession);
        if (loaderResult) {
          result = loaderResult;
        }
      } else if (toolName.startsWith('mcp_')) {
        // MCP tool
        result = await executeMCPTool(mcpManager, toolName, toolCall, userId);
      } else if (isComposioTool(toolName)) {
        // Composio tool
        result = await executeComposioToolCall(toolName, toolCall, userId);
      } else {
        result = {
          toolCallId: toolCall.id,
          content: `Unknown tool: ${toolName}`,
          isError: true,
        };
      }
    } catch (toolError) {
      log.error('Tool execution failed with unhandled error', {
        tool: toolName,
        error: (toolError as Error).message,
      });
      result = {
        toolCallId: toolCall.id,
        content: sanitizeToolError(toolName, (toolError as Error).message),
        isError: true,
      };
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

    log.info('Executing MCP tool', { serverId, tool: actualToolName });
    const mcpResult = await mcpManager.callTool(
      serverId,
      actualToolName,
      typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments
    );

    log.info('MCP tool executed successfully', { serverId, tool: actualToolName });
    return {
      toolCallId: toolCall.id,
      content: typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult, null, 2),
      isError: false,
    };
  } catch (mcpError) {
    log.error('MCP tool execution failed', {
      serverId,
      tool: actualToolName,
      error: (mcpError as Error).message,
    });
    return {
      toolCallId: toolCall.id,
      content: sanitizeToolError(`${serverId}:${actualToolName}`, (mcpError as Error).message),
      isError: true,
    };
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

    const composioResult = await executeComposioTool(
      userId || 'anonymous',
      toolName,
      typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments
    );

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
    log.error('Composio tool execution failed', {
      tool: toolName,
      error: (composioError as Error).message,
    });
    return {
      toolCallId: toolCall.id,
      content: sanitizeToolError(toolName, (composioError as Error).message),
      isError: true,
    };
  }
}
