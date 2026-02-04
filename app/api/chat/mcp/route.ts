/**
 * CHAT MCP API ROUTE
 *
 * Handles MCP (Model Context Protocol) server operations for the main Chat.
 * Allows users to enable/disable MCP servers that extend AI capabilities.
 *
 * GET  /api/chat/mcp - List all MCP servers and their status
 * POST /api/chat/mcp - Start/stop MCP servers, call tools
 *
 * NOW USING REAL MCP CLIENT (Enhancement #1)
 *
 * ON-DEMAND ARCHITECTURE (Enhancement #2):
 * - Toggling ON marks server as "available" (doesn't start process)
 * - Server actually starts on first tool call (lazy start)
 * - Auto-stops after 1 minute of inactivity (idle timeout)
 * - Saves resources by not running unused servers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { getMCPManager } from '@/lib/mcp/mcp-client';
import {
  getUserServers,
  getKnownToolsForServer,
  DEFAULT_MCP_SERVERS,
} from './helpers';

const log = logger('chat-mcp-api');

/**
 * GET /api/chat/mcp
 * Returns list of MCP servers with their current status
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) {
      return auth.response;
    }

    const userServers = getUserServers(auth.user.id);

    // Combine default servers with user state
    const servers = DEFAULT_MCP_SERVERS.map((server) => {
      const state = userServers.get(server.id) || {
        enabled: false,
        status: 'stopped' as const,
        tools: [],
      };

      return {
        ...server,
        ...state,
      };
    });

    return NextResponse.json({ servers });
  } catch (error) {
    log.error('Failed to get MCP servers', { error: (error as Error).message });
    return NextResponse.json({ error: 'Failed to get servers' }, { status: 500 });
  }
}

/**
 * POST /api/chat/mcp
 * Handle MCP server operations
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();
    const { action, serverId, toolName, toolArgs } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const userServers = getUserServers(auth.user.id);

    switch (action) {
      case 'startServer': {
        // ON-DEMAND/LAZY START (Enhancement #2)
        // Just mark the server as "available" - it will actually start
        // when Claude first tries to use one of its tools
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        const server = DEFAULT_MCP_SERVERS.find((s) => s.id === serverId);
        if (!server) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Check if already running
        const manager = getMCPManager();
        const existingClient = manager.getClient(serverId);
        if (existingClient && existingClient.isConnected()) {
          // Already running, just return current state
          const tools = existingClient.tools.map((t) => ({
            name: t.name,
            description: t.description || '',
            serverId: serverId,
          }));

          userServers.set(serverId, {
            enabled: true,
            status: 'running',
            tools,
          });

          return NextResponse.json({
            status: 'running',
            serverId,
            message: `${server.name} is running`,
            tools,
          });
        }

        // Mark as available (will start on-demand when tool is called)
        // Pre-populate with known tools for this server type
        const knownTools = getKnownToolsForServer(serverId);

        userServers.set(serverId, {
          enabled: true,
          status: 'available',
          tools: knownTools,
        });

        log.info('MCP server marked as available (on-demand)', { serverId });

        return NextResponse.json({
          status: 'available',
          serverId,
          message: `${server.name} enabled - will start automatically when needed`,
          tools: knownTools,
          onDemand: true,
        });
      }

      case 'stopServer': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        try {
          await manager.removeServer(serverId);
          log.info('MCP server stopped', { serverId });
        } catch (error) {
          log.warn('Error stopping MCP server (may not have been running)', {
            serverId,
            error: (error as Error).message,
          });
        }

        userServers.set(serverId, {
          enabled: false,
          status: 'stopped',
          tools: [],
        });

        return NextResponse.json({
          status: 'stopped',
          serverId,
          message: 'Server stopped',
        });
      }

      case 'callTool': {
        if (!serverId || !toolName) {
          return NextResponse.json({ error: 'Server ID and tool name required' }, { status: 400 });
        }

        const serverState = userServers.get(serverId);
        if (!serverState || serverState.status !== 'running') {
          return NextResponse.json({ error: 'Server not running' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        try {
          const result = await manager.callTool(serverId, toolName, toolArgs || {});
          log.info('MCP tool called successfully', { serverId, toolName });

          return NextResponse.json({
            result: { content: result },
            toolName,
            serverId,
          });
        } catch (error) {
          log.error('MCP tool call failed', {
            serverId,
            toolName,
            error: (error as Error).message,
          });
          return NextResponse.json(
            {
              error: `Tool execution failed: ${(error as Error).message}`,
              toolName,
              serverId,
            },
            { status: 500 }
          );
        }
      }

      case 'listTools': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        const client = manager.getClient(serverId);

        if (!client || !client.isConnected()) {
          // Fall back to cached state if server not connected
          const serverState = userServers.get(serverId);
          if (!serverState) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
          }
          return NextResponse.json({
            tools: serverState.tools,
            serverId,
            source: 'cache',
          });
        }

        // Get real tools from the MCP client
        const tools = client.tools.map((t) => ({
          name: t.name,
          description: t.description || '',
          serverId: serverId,
          inputSchema: t.inputSchema,
        }));

        return NextResponse.json({
          tools,
          serverId,
          source: 'live',
        });
      }

      case 'getStatus': {
        // New action: Get real-time status of all or specific servers
        const manager = getMCPManager();

        if (serverId) {
          const client = manager.getClient(serverId);
          const serverState = userServers.get(serverId);

          return NextResponse.json({
            serverId,
            connected: client?.isConnected() || false,
            status: client?.getStatus() || serverState?.status || 'stopped',
            tools: client?.tools.length || serverState?.tools.length || 0,
          });
        }

        // Return status of all servers
        const statuses = [];
        for (const server of DEFAULT_MCP_SERVERS) {
          const client = manager.getClient(server.id);
          const serverState = userServers.get(server.id);

          statuses.push({
            serverId: server.id,
            name: server.name,
            connected: client?.isConnected() || false,
            status: client?.getStatus() || serverState?.status || 'stopped',
            tools: client?.tools.length || serverState?.tools.length || 0,
          });
        }

        return NextResponse.json({ statuses });
      }

      case 'healthCheck': {
        // New action: Run health check on servers
        const manager = getMCPManager();
        const healthResults = await manager.getHealthStatus();

        return NextResponse.json({ health: healthResults });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('MCP operation failed', { error: (error as Error).message });
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
