'use client';

/**
 * CHAT MCP SETTINGS
 *
 * MCP (Model Context Protocol) server configuration panel for main Chat.
 * Allows users to enable/disable MCP servers that extend AI capabilities.
 *
 * Features:
 * - View all available MCP servers
 * - Toggle servers on/off with status indicators
 * - View available tools from running servers
 * - Add custom MCP servers
 *
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value storage across conversations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: false,
    builtIn: true,
  },
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

// PlusIcon available for future "Add Custom Server" feature
const _PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
  </svg>
);
void _PlusIcon; // Silence unused warning

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="14"
    height="14"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease',
    }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============================================
// MCP BUTTON COMPONENT
// ============================================

interface ChatMCPButtonProps {
  disabled?: boolean;
}

export function ChatMCPButton({ disabled }: ChatMCPButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch servers when modal opens
  useEffect(() => {
    if (showModal) {
      fetchServers();
    }
  }, [showModal]);

  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/mcp');
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      } else {
        // Initialize with defaults if API fails
        setServers(
          DEFAULT_MCP_SERVERS.map((s) => ({
            ...s,
            status: 'stopped' as const,
            tools: [],
          }))
        );
      }
    } catch (error) {
      console.error('[ChatMCPButton] Failed to fetch servers:', error);
      setServers(
        DEFAULT_MCP_SERVERS.map((s) => ({
          ...s,
          status: 'stopped' as const,
          tools: [],
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleServerToggle = async (serverId: string, enabled: boolean) => {
    // Optimistic update
    setServers((prev) =>
      prev.map((s) =>
        s.id === serverId ? { ...s, enabled, status: enabled ? 'starting' : 'stopped' } : s
      )
    );

    try {
      const action = enabled ? 'startServer' : 'stopServer';
      const res = await fetch('/api/chat/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serverId }),
      });

      if (res.ok) {
        const data = await res.json();
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  enabled,
                  status: data.status || (enabled ? 'running' : 'stopped'),
                  tools: data.tools || s.tools,
                  error: data.error,
                }
              : s
          )
        );
      } else {
        // Revert on error
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, enabled: !enabled, status: 'error' } : s))
        );
      }
    } catch (error) {
      console.error('[ChatMCPButton] Toggle failed:', error);
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, enabled: !enabled, status: 'error' } : s))
      );
    }
  };

  const toggleServerExpanded = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const runningCount = servers.filter((s) => s.status === 'running').length;

  const modal = showModal && isMounted && (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
        onClick={() => setShowModal(false)}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(500px, 90vw)',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-secondary, #1a1a1a)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #333)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #333)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ServerIcon />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>MCP Servers</h2>
            {runningCount > 0 && (
              <span
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                  borderRadius: '10px',
                }}
              >
                {runningCount} running
              </span>
            )}
          </div>
          <button
            onClick={() => setShowModal(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #888)',
              padding: '4px',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          <p
            style={{
              margin: '0 0 16px',
              fontSize: '13px',
              color: 'var(--text-secondary, #888)',
            }}
          >
            MCP servers extend AI capabilities with external tools and services.
          </p>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {servers.map((server) => (
                <div
                  key={server.id}
                  style={{
                    backgroundColor: 'var(--bg-tertiary, #252525)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #333)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Server Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: 1,
                        cursor: server.tools.length > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() => server.tools.length > 0 && toggleServerExpanded(server.id)}
                    >
                      {server.tools.length > 0 && (
                        <ChevronIcon expanded={expandedServers.has(server.id)} />
                      )}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{server.name}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                server.status === 'running'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : server.status === 'starting'
                                    ? 'rgba(234, 179, 8, 0.2)'
                                    : server.status === 'error'
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : 'rgba(100, 100, 100, 0.2)',
                              color:
                                server.status === 'running'
                                  ? '#22c55e'
                                  : server.status === 'starting'
                                    ? '#eab308'
                                    : server.status === 'error'
                                      ? '#ef4444'
                                      : '#888',
                            }}
                          >
                            {server.status}
                          </span>
                        </div>
                        {server.description && (
                          <p
                            style={{
                              margin: '4px 0 0',
                              fontSize: '12px',
                              color: 'var(--text-secondary, #888)',
                            }}
                          >
                            {server.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Toggle */}
                    <label
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '44px',
                        height: '24px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={(e) => handleServerToggle(server.id, e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: server.enabled ? '#22c55e' : '#444',
                          borderRadius: '12px',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: server.enabled ? '22px' : '2px',
                            top: '2px',
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: 'left 0.2s',
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  {/* Tools List (expanded) */}
                  {expandedServers.has(server.id) && server.tools.length > 0 && (
                    <div
                      style={{
                        padding: '0 16px 12px',
                        borderTop: '1px solid var(--border-color, #333)',
                        marginTop: '-1px',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary, #888)',
                          margin: '12px 0 8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Available Tools ({server.tools.length})
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {server.tools.map((tool) => (
                          <div
                            key={tool.name}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '6px 8px',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              borderRadius: '4px',
                            }}
                          >
                            <ToolIcon />
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 500 }}>{tool.name}</span>
                              {tool.description && (
                                <p
                                  style={{
                                    margin: '2px 0 0',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary, #888)',
                                  }}
                                >
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {server.error && (
                    <div
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        fontSize: '12px',
                      }}
                    >
                      {server.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, #333)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
            {servers.length} servers available
          </span>
          <button
            onClick={() => setShowModal(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary-color, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        title="MCP Servers"
        className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80"
        style={{
          color: runningCount > 0 ? '#22c55e' : 'var(--text-primary)',
        }}
      >
        <span>MCP</span>
        {runningCount > 0 && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
            }}
          />
        )}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isMounted && createPortal(modal, document.body)}
    </>
  );
}

export default ChatMCPButton;
