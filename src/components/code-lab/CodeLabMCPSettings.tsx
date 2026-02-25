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
// ICONS
// ============================================

const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <rect x="2" y="3" width="20" height="6" rx="1" />
    <rect x="2" y="15" width="20" height="6" rx="1" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
  </svg>
);

const ToolIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="14"
    height="14"
    className={`transition-transform duration-150 ease-in-out ${expanded ? 'rotate-90' : 'rotate-0'}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: MCPServer['status'] }) {
  const config = {
    running: { label: 'Running', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    stopped: { label: 'Stopped', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
    starting: { label: 'Starting...', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
    error: { label: 'Error', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
  }[status];

  return (
    <span
      className="status-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold"
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
      }}
    >
      {status === 'starting' && <span className="spinner" />}
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      )}
      {config.label}
    </span>
  );
}

// ============================================
// TOGGLE SWITCH
// ============================================

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-[52px] h-7 rounded-[14px] border-none relative transition-[background] duration-200 ease-in-out shrink-0 ${checked ? 'bg-[#1e3a5f]' : 'bg-[#d1d5db]'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
    >
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-200 ease-in-out"
        style={{ left: checked ? 26 : 2 }}
      />
    </button>
  );
}

// ============================================
// SERVER CARD
// ============================================

function ServerCard({
  server,
  onToggle,
  onRemove,
  isToggling,
}: {
  server: MCPServer;
  onToggle: (enabled: boolean) => void;
  onRemove?: () => void;
  isToggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTools = server.tools.length > 0;

  return (
    <div className="server-card">
      <div className="server-header">
        <div className="server-info">
          {hasTools && (
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              <ChevronIcon expanded={expanded} />
            </button>
          )}
          <div className="server-icon">
            <ServerIcon />
          </div>
          <div className="server-details">
            <div className="server-name-row">
              <span className="server-name">{server.name}</span>
              <StatusBadge status={server.status} />
            </div>
            {server.description && <p className="server-description">{server.description}</p>}
            {server.error && <p className="server-error">{server.error}</p>}
          </div>
        </div>
        <div className="server-actions">
          {!server.builtIn && onRemove && (
            <button className="remove-btn" onClick={onRemove} title="Remove server">
              <TrashIcon />
            </button>
          )}
          <ToggleSwitch
            checked={server.enabled}
            onChange={onToggle}
            disabled={isToggling || server.status === 'starting'}
          />
        </div>
      </div>

      {/* Tools list */}
      {expanded && hasTools && (
        <div className="server-tools">
          <div className="tools-header">
            <ToolIcon />
            <span>Available Tools ({server.tools.length})</span>
          </div>
          <div className="tools-list">
            {server.tools.map((tool) => (
              <div key={tool.name} className="tool-item">
                <code className="tool-name">{tool.name}</code>
                <span className="tool-description">{tool.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .server-card {
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }

        .server-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .server-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1rem;
          gap: 1rem;
        }

        .server-info {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
        }

        .expand-btn {
          padding: 0.25rem;
          background: none;
          border: none;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 4px;
          margin-top: 2px;
        }

        .expand-btn:hover {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-primary, #1a1f36);
        }

        .server-icon {
          width: 36px;
          height: 36px;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cl-accent-primary, #1e3a5f);
          flex-shrink: 0;
        }

        .server-details {
          flex: 1;
          min-width: 0;
        }

        .server-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .server-name {
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
          font-size: 0.9375rem;
        }

        .server-description {
          margin: 0.25rem 0 0 0;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.4;
        }

        .server-error {
          margin: 0.25rem 0 0 0;
          font-size: 0.75rem;
          color: #ef4444;
        }

        .server-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .remove-btn {
          padding: 0.375rem;
          background: none;
          border: none;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .remove-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .server-tools {
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          padding: 0.75rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .tools-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-secondary, #374151);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin-bottom: 0.5rem;
        }

        .tools-list {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .tool-item {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          padding: 0.5rem;
          background: var(--cl-bg-primary, #ffffff);
          border-radius: 6px;
        }

        .tool-name {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.75rem;
          color: var(--cl-accent-primary, #1e3a5f);
          background: color-mix(in srgb, var(--cl-accent-primary, #1e3a5f) 10%, transparent);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          width: fit-content;
        }

        .tool-description {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          line-height: 1.4;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        :global(.spinner) {
          width: 10px;
          height: 10px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================
// ADD SERVER MODAL
// ============================================

function AddServerModal({
  onAdd,
  onClose,
}: {
  onAdd: (server: Omit<MCPServer, 'status' | 'tools' | 'builtIn'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('npx');
  const [args, setArgs] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    onAdd({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      command: command.trim(),
      args: args.trim() ? args.split(' ') : undefined,
      enabled: false,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Add MCP Server</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Server"
              required
            />
          </div>
          <div className="form-group">
            <label>Command *</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx"
              required
            />
          </div>
          <div className="form-group">
            <label>Arguments</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-name"
            />
            <span className="form-hint">Space-separated arguments</span>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this server do?"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim() || !command.trim()}
            >
              Add Server
            </button>
          </div>
        </form>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.15s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .modal-content {
            background: var(--cl-bg-primary, #ffffff);
            border-radius: 16px;
            padding: 1.5rem;
            width: 90%;
            max-width: 400px;
            box-shadow:
              0 20px 40px rgba(0, 0, 0, 0.15),
              0 10px 20px rgba(0, 0, 0, 0.1);
            animation: slideUp 0.2s ease;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          h3 {
            margin: 0 0 1.25rem 0;
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--cl-text-primary, #1a1f36);
          }

          .form-group {
            margin-bottom: 1rem;
          }

          label {
            display: block;
            font-size: 0.8125rem;
            font-weight: 500;
            color: var(--cl-text-secondary, #374151);
            margin-bottom: 0.375rem;
          }

          input {
            width: 100%;
            padding: 0.625rem 0.75rem;
            border: 1px solid var(--cl-border-primary, #e5e7eb);
            border-radius: 8px;
            font-size: 0.875rem;
            color: var(--cl-text-primary, #1a1f36);
            transition: border-color 0.15s ease;
          }

          input:focus {
            outline: none;
            border-color: var(--cl-accent-primary, #1e3a5f);
          }

          input::placeholder {
            color: var(--cl-text-tertiary, #9ca3af);
          }

          .form-hint {
            display: block;
            font-size: 0.75rem;
            color: var(--cl-text-tertiary, #6b7280);
            margin-top: 0.25rem;
          }

          .modal-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.625rem 1rem;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .btn-secondary {
            background: var(--cl-bg-secondary, #f9fafb);
            border: 1px solid var(--cl-border-primary, #e5e7eb);
            color: var(--cl-text-secondary, #374151);
          }

          .btn-secondary:hover {
            background: var(--cl-bg-tertiary, #f3f4f6);
          }

          .btn-primary {
            background: var(--cl-accent-primary, #1e3a5f);
            border: none;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: var(--cl-accent-secondary, #2d4a6f);
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
}

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
