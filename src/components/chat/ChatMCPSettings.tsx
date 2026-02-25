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
import { useTheme } from '@/contexts/ThemeContext';

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
    className={`transition-transform duration-150 ease-in-out ${expanded ? 'rotate-90' : 'rotate-0'}`}
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
  const { theme } = useTheme();
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
        className="fixed inset-0 bg-glass-dark backdrop-blur-sm z-[9998]"
        onClick={() => setShowModal(false)}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[80vh] rounded-xl border flex flex-col overflow-hidden z-[9999] w-[min(500px,90vw)] bg-surface-elevated border-theme shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme">
          <div className="flex items-center gap-2.5">
            <ServerIcon />
            <h2 className="m-0 text-base font-semibold">MCP Servers</h2>
            {runningCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-[10px] bg-green-500/20 text-green-500">
                {runningCount} running
              </span>
            )}
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="bg-transparent border-none cursor-pointer text-text-secondary p-1"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mt-0 mb-4 text-[13px] text-text-secondary">
            MCP servers extend AI capabilities with external tools and services.
          </p>

          {isLoading ? (
            <div className="text-center p-10 text-gray-500">Loading...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="rounded-lg border overflow-hidden bg-surface border-theme"
                >
                  {/* Server Header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div
                      className={`flex items-center gap-3 flex-1 ${server.tools.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => server.tools.length > 0 && toggleServerExpanded(server.id)}
                    >
                      {server.tools.length > 0 && (
                        <ChevronIcon expanded={expandedServers.has(server.id)} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{server.name}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
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
                          <p className="mt-1 mb-0 text-xs text-text-secondary">
                            {server.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Toggle */}
                    <label className="relative inline-block w-[52px] h-7 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={(e) => handleServerToggle(server.id, e.target.checked)}
                        className="opacity-0 w-0 h-0"
                      />
                      <span
                        className="absolute inset-0 rounded-[14px] transition-colors duration-200"
                        style={{
                          backgroundColor: server.enabled ? '#22c55e' : '#444',
                        }}
                      >
                        <span
                          className="absolute top-0.5 w-6 h-6 bg-white rounded-full transition-[left] duration-200"
                          style={{
                            left: server.enabled ? '26px' : '2px',
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  {/* Tools List (expanded) */}
                  {expandedServers.has(server.id) && server.tools.length > 0 && (
                    <div className="px-4 pb-3 border-t -mt-px border-theme">
                      <p className="text-[11px] text-text-secondary mt-3 mb-2 uppercase tracking-[0.5px]">
                        Available Tools ({server.tools.length})
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {server.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/[0.03]"
                          >
                            <ToolIcon />
                            <div>
                              <span className="text-xs font-medium">{tool.name}</span>
                              {tool.description && (
                                <p className="mt-0.5 mb-0 text-[11px] text-text-secondary">
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
                    <div className="px-4 py-2 text-xs bg-red-500/10 text-red-500">
                      {server.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between border-theme">
          <span className="text-xs text-text-secondary">{servers.length} servers available</span>
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 bg-primary text-white border-none rounded-md cursor-pointer text-[13px] font-medium"
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
          color:
            runningCount > 0
              ? '#22c55e'
              : theme === 'light'
                ? 'var(--primary)'
                : 'var(--text-primary)',
        }}
      >
        <span>MCP</span>
        {runningCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isMounted && createPortal(modal, document.body)}
    </>
  );
}

export default ChatMCPButton;
