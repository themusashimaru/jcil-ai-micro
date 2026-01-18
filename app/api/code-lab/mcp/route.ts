/**
 * MCP API - REAL MODEL CONTEXT PROTOCOL ENDPOINTS
 *
 * Provides REST API for MCP operations:
 * - Server management (add, remove, start, stop)
 * - Tool discovery and invocation
 * - Resource access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { getMCPManager, MCPServerConfig } from '@/lib/mcp/mcp-client';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

const log = logger('MCPAPI');

// Default MCP servers available for use
const DEFAULT_SERVERS: MCPServerConfig[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Access files and directories',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    enabled: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    enabled: false,
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    enabled: false,
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'SQLite database access',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
    enabled: false,
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'HTTP requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    enabled: false,
  },
];

/**
 * POST /api/code-lab/mcp
 *
 * MCP actions: addServer, removeServer, startServer, stopServer, callTool, listTools
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(auth.user!.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { action, ...params } = body as {
      action: string;
      [key: string]: unknown;
    };

    const manager = getMCPManager();

    switch (action) {
      case 'addServer': {
        const config = params.config as MCPServerConfig;

        if (!config || !config.id || !config.command) {
          return NextResponse.json(
            { error: 'Invalid server configuration. Required: id, command' },
            { status: 400 }
          );
        }

        log.info('Adding MCP server', { userId: auth.user.id, serverId: config.id });

        try {
          const client = await manager.addServer(config);

          return NextResponse.json({
            success: true,
            server: {
              id: config.id,
              name: config.name,
              status: client.getStatus(),
              tools: client.tools,
              resources: client.resources,
              prompts: client.prompts,
            },
          });
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to add server: ${(error as Error).message}` },
            { status: 500 }
          );
        }
      }

      case 'removeServer': {
        const serverId = params.serverId as string;

        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }

        await manager.removeServer(serverId);

        return NextResponse.json({ success: true });
      }

      case 'startServer': {
        const serverId = params.serverId as string;

        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }

        const client = manager.getClient(serverId);
        if (!client) {
          // Try to add from defaults
          const defaultConfig = DEFAULT_SERVERS.find((s) => s.id === serverId);
          if (defaultConfig) {
            const newClient = await manager.addServer({ ...defaultConfig, enabled: true });
            return NextResponse.json({
              success: true,
              server: {
                id: serverId,
                status: newClient.getStatus(),
                tools: newClient.tools,
              },
            });
          }
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        await client.connect();

        return NextResponse.json({
          success: true,
          server: {
            id: serverId,
            status: client.getStatus(),
            tools: client.tools,
          },
        });
      }

      case 'stopServer': {
        const serverId = params.serverId as string;

        if (!serverId) {
          return NextResponse.json({ error: 'Missing serverId' }, { status: 400 });
        }

        const client = manager.getClient(serverId);
        if (!client) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        await client.disconnect();

        return NextResponse.json({ success: true });
      }

      case 'callTool': {
        const { serverId, toolName, args } = params as {
          serverId: string;
          toolName: string;
          args: Record<string, unknown>;
        };

        if (!serverId || !toolName) {
          return NextResponse.json({ error: 'Missing serverId or toolName' }, { status: 400 });
        }

        log.info('Calling MCP tool', { serverId, toolName });

        try {
          const result = await manager.callTool(serverId, toolName, args || {});

          return NextResponse.json({
            success: true,
            result,
          });
        } catch (error) {
          return NextResponse.json(
            { error: `Tool call failed: ${(error as Error).message}` },
            { status: 500 }
          );
        }
      }

      case 'listTools': {
        const tools = manager.getAllTools();

        return NextResponse.json({
          success: true,
          tools,
        });
      }

      case 'readResource': {
        const { serverId, uri } = params as { serverId: string; uri: string };

        if (!serverId || !uri) {
          return NextResponse.json({ error: 'Missing serverId or uri' }, { status: 400 });
        }

        const client = manager.getClient(serverId);
        if (!client) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        try {
          const result = await client.readResource(uri);

          return NextResponse.json({
            success: true,
            ...result,
          });
        } catch (error) {
          return NextResponse.json(
            { error: `Resource read failed: ${(error as Error).message}` },
            { status: 500 }
          );
        }
      }

      case 'getPrompt': {
        const { serverId, name, args } = params as {
          serverId: string;
          name: string;
          args?: Record<string, string>;
        };

        if (!serverId || !name) {
          return NextResponse.json({ error: 'Missing serverId or name' }, { status: 400 });
        }

        const client = manager.getClient(serverId);
        if (!client) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        try {
          const result = await client.getPrompt(name, args);

          return NextResponse.json({
            success: true,
            ...result,
          });
        } catch (error) {
          return NextResponse.json(
            { error: `Prompt get failed: ${(error as Error).message}` },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('MCP API error', error as Error);
    return NextResponse.json(
      { error: 'MCP operation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-lab/mcp
 *
 * Get MCP server info and available tools
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check (GET - no CSRF needed)
    const auth = await requireUser();
    if (!auth.authorized) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    const manager = getMCPManager();

    if (serverId) {
      // Get specific server info
      const client = manager.getClient(serverId);
      if (!client) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 });
      }

      return NextResponse.json({
        server: {
          id: serverId,
          status: client.getStatus(),
          serverInfo: client.serverInfo,
          capabilities: client.capabilities,
          tools: client.tools,
          resources: client.resources,
          prompts: client.prompts,
        },
      });
    }

    // List all servers and available defaults
    const clients = manager.getAllClients();
    const servers = clients.map((client) => ({
      id: client.serverInfo?.name || 'unknown',
      status: client.getStatus(),
      toolCount: client.tools.length,
      resourceCount: client.resources.length,
      promptCount: client.prompts.length,
    }));

    return NextResponse.json({
      servers,
      availableDefaults: DEFAULT_SERVERS,
      totalTools: manager.getAllTools().length,
    });
  } catch (error) {
    log.error('MCP API error', error as Error);
    return NextResponse.json({ error: 'Failed to get MCP info' }, { status: 500 });
  }
}
