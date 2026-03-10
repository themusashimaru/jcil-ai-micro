'use client';

/**
 * CODE LAB MCP SETTINGS
 *
 * Beautiful MCP (Model Context Protocol) server configuration panel.
 * Features:
 * - View all available MCP servers
 * - Toggle servers on/off with status indicators
 * - View available tools from running servers
 * - Add custom MCP servers
 * - Real-time status updates
 *
 * This gives Code Lab feature parity with Claude Code's MCP support.
 *
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { ServerIcon, PlusIcon } from './MCPPrimitives';
import { ServerCard } from './MCPServerCard';
import { AddServerModal } from './MCPAddServerModal';

// ============================================
// TYPES
// ============================================

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  enabled: boolean;
  status: 'running' | 'stopped' | 'error' | 'starting';
  error?: string;
  tools: MCPTool[];
  builtIn: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  serverId: string;
}

interface CodeLabMCPSettingsProps {
  servers: MCPServer[];
  onServerToggle: (serverId: string, enabled: boolean) => Promise<void>;
  onServerAdd?: (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => Promise<void>;
  onServerRemove?: (serverId: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// DEFAULT SERVERS
// ============================================

export const DEFAULT_MCP_SERVERS: Omit<MCPServer, 'status' | 'tools'>[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and navigate files in the workspace',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Manage repositories, issues, and pull requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    enabled: false,
    builtIn: true,
  },
  // Memory server removed - persistent memory is always-on via Supabase (conversation_memory table)
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation for web testing and scraping',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    enabled: false,
    builtIn: true,
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function CodeLabMCPSettings({
  servers,
  onServerToggle,
  onServerAdd,
  onServerRemove,
  isLoading = false,
  className = '',
}: CodeLabMCPSettingsProps) {
  const [togglingServers, setTogglingServers] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  const handleToggle = useCallback(
    async (serverId: string, enabled: boolean) => {
      setTogglingServers((prev) => new Set(prev).add(serverId));
      try {
        await onServerToggle(serverId, enabled);
      } finally {
        setTogglingServers((prev) => {
          const next = new Set(prev);
          next.delete(serverId);
          return next;
        });
      }
    },
    [onServerToggle]
  );

  const handleAdd = useCallback(
    async (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => {
      if (onServerAdd) {
        await onServerAdd(server);
      }
    },
    [onServerAdd]
  );

  const runningCount = servers.filter((s) => s.status === 'running').length;
  const totalToolsCount = servers.reduce((acc, s) => acc + s.tools.length, 0);

  return (
    <div className={`mcp-settings ${className}`}>
      {/* Header */}
      <div className="mcp-header">
        <div className="mcp-title">
          <ServerIcon />
          <h2>MCP Servers</h2>
        </div>
        <div className="mcp-stats">
          <span className="stat">
            <span className="stat-value">{runningCount}</span> running
          </span>
          <span className="stat">
            <span className="stat-value">{totalToolsCount}</span> tools
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mcp-description">
        Connect to MCP servers to extend Claude&apos;s capabilities with external tools and
        integrations.
      </p>

      {/* Server list */}
      <div className="server-list">
        {isLoading ? (
          <div className="loading-state">
            <span className="spinner" />
            <span>Loading servers...</span>
          </div>
        ) : servers.length === 0 ? (
          <div className="empty-state">
            <ServerIcon />
            <p>No MCP servers configured</p>
            <p className="hint">Add a server to extend Claude&apos;s capabilities</p>
          </div>
        ) : (
          servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onToggle={(enabled) => handleToggle(server.id, enabled)}
              onRemove={
                !server.builtIn && onServerRemove ? () => onServerRemove(server.id) : undefined
              }
              isToggling={togglingServers.has(server.id)}
            />
          ))
        )}
      </div>

      {/* Add server button */}
      {onServerAdd && (
        <button className="add-server-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon />
          Add Custom Server
        </button>
      )}

      {/* Add modal */}
      {showAddModal && <AddServerModal onAdd={handleAdd} onClose={() => setShowAddModal(false)} />}

      <style jsx>{`
        .mcp-settings {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1rem;
        }

        .mcp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .mcp-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mcp-title h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .mcp-stats {
          display: flex;
          gap: 1rem;
        }

        .stat {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .stat-value {
          font-weight: 600;
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .mcp-description {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          margin: 0 0 1rem 0;
          line-height: 1.5;
        }

        .server-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
          overflow-y: auto;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .loading-state {
          flex-direction: row;
          gap: 0.5rem;
        }

        .empty-state p {
          margin: 0.5rem 0 0 0;
        }

        .empty-state .hint {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .add-server-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          margin-top: 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px dashed var(--cl-border-primary, #e5e7eb);
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cl-text-secondary, #374151);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-server-btn:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-accent-primary, #1e3a5f);
          color: var(--cl-accent-primary, #1e3a5f);
        }

        :global(.mcp-settings .spinner) {
          width: 16px;
          height: 16px;
          border: 2px solid var(--cl-border-primary, #e5e7eb);
          border-top-color: var(--cl-accent-primary, #1e3a5f);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabMCPSettings;
