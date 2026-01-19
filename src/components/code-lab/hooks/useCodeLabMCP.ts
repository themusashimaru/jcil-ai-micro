/**
 * USE CODE LAB MCP HOOK
 *
 * Manages MCP (Model Context Protocol) server state and operations.
 * Provides toggle, add, and remove functionality for MCP servers.
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { MCPServer } from '../CodeLabMCPSettings';
import { DEFAULT_MCP_SERVERS } from '../CodeLabMCPSettings';

const log = logger('CodeLabMCP');

export interface UseCodeLabMCPOptions {
  sessionId: string | null;
  onToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

export interface UseCodeLabMCPReturn {
  // State
  mcpServers: MCPServer[];
  mcpLoading: boolean;

  // Actions
  handleMCPServerToggle: (serverId: string, enabled: boolean) => Promise<void>;
  handleMCPServerAdd: (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => Promise<void>;
  handleMCPServerRemove: (serverId: string) => Promise<void>;
  setMcpServers: React.Dispatch<React.SetStateAction<MCPServer[]>>;
}

export function useCodeLabMCP(options: UseCodeLabMCPOptions): UseCodeLabMCPReturn {
  const { onToast } = options;

  const [mcpServers, setMcpServers] = useState<MCPServer[]>(() =>
    DEFAULT_MCP_SERVERS.map((s) => ({
      ...s,
      status: 'stopped' as const,
      tools: [],
    }))
  );
  const [mcpLoading, setMcpLoading] = useState(false);

  const handleMCPServerToggle = useCallback(
    async (serverId: string, enabled: boolean) => {
      setMcpLoading(true);
      setMcpServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? { ...s, enabled, status: enabled ? 'starting' : 'stopped', error: undefined }
            : s
        )
      );

      try {
        const response = await fetch('/api/code-lab/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: enabled ? 'startServer' : 'stopServer',
            serverId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setMcpServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? {
                    ...s,
                    status: data.server?.status || (enabled ? 'running' : 'stopped'),
                    tools: (data.server?.tools || []).map(
                      (t: { name: string; description: string }) => ({
                        name: t.name,
                        description: t.description || '',
                        serverId,
                      })
                    ),
                    error: undefined,
                  }
                : s
            )
          );
          onToast?.(
            'success',
            enabled ? 'Server Started' : 'Server Stopped',
            `${serverId} ${enabled ? 'is now running' : 'has been stopped'}`
          );
        } else {
          const error = await response.text();
          setMcpServers((prev) =>
            prev.map((s) =>
              s.id === serverId ? { ...s, status: 'error', error, enabled: false } : s
            )
          );
          onToast?.('error', 'MCP Error', `Failed to ${enabled ? 'start' : 'stop'} ${serverId}`);
        }
      } catch (err) {
        setMcpServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? { ...s, status: 'error', error: 'Network error', enabled: false }
              : s
          )
        );
        log.error('MCP toggle error', err as Error);
      } finally {
        setMcpLoading(false);
      }
    },
    [onToast]
  );

  const handleMCPServerAdd = useCallback(
    async (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => {
      const newServer: MCPServer = {
        ...server,
        status: 'stopped',
        tools: [],
        builtIn: false,
      };
      setMcpServers((prev) => [...prev, newServer]);
      onToast?.('success', 'Server Added', `${server.name} has been added`);
    },
    [onToast]
  );

  const handleMCPServerRemove = useCallback(
    async (serverId: string) => {
      setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
      onToast?.('success', 'Server Removed', 'Custom server has been removed');
    },
    [onToast]
  );

  return {
    mcpServers,
    mcpLoading,
    handleMCPServerToggle,
    handleMCPServerAdd,
    handleMCPServerRemove,
    setMcpServers,
  };
}
