'use client';

/**
 * MCP SERVER MANAGEMENT SECTION
 *
 * Manages MCP (Model Context Protocol) servers from Settings.
 * - View built-in servers with status indicators
 * - Enable/disable servers (on-demand architecture)
 * - View available tools per server
 * - Run health checks
 */

import { useState, useEffect, useCallback } from 'react';

interface MCPTool {
  name: string;
  description: string;
  serverId: string;
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  enabled: boolean;
  builtIn: boolean;
  status: 'running' | 'stopped' | 'available' | 'error' | 'starting';
  tools: MCPTool[];
  error?: string;
}

interface HealthResult {
  serverId: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  running: { label: 'Running', color: 'text-green-400', dot: 'bg-green-400' },
  available: { label: 'Ready', color: 'text-blue-400', dot: 'bg-blue-400' },
  starting: { label: 'Starting', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  stopped: { label: 'Stopped', color: 'text-gray-400', dot: 'bg-gray-500' },
  error: { label: 'Error', color: 'text-red-400', dot: 'bg-red-400' },
};

const SERVER_ICONS: Record<string, string> = {
  filesystem: '📁',
  github: '🐙',
  puppeteer: '🌐',
  postgres: '🐘',
};

export default function MCPServersSection() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({});
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [togglingServer, setTogglingServer] = useState<string | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/mcp');
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      }
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const toggleServer = async (serverId: string, currentlyEnabled: boolean) => {
    setTogglingServer(serverId);
    try {
      const response = await fetch('/api/chat/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentlyEnabled ? 'stopServer' : 'startServer',
          serverId,
        }),
      });

      if (response.ok) {
        // Persist toggle state to database
        const server = servers.find((s) => s.id === serverId);
        if (server) {
          fetch('/api/user/mcp-servers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              server_id: serverId,
              name: server.name,
              description: server.description,
              command: server.command,
              args: server.args,
              enabled: !currentlyEnabled,
            }),
          }).catch((e) => console.error('Failed to persist MCP state:', e));
        }
        await fetchServers();
      }
    } catch (err) {
      console.error('Failed to toggle server:', err);
    } finally {
      setTogglingServer(null);
    }
  };

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const response = await fetch('/api/chat/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'healthCheck' }),
      });

      if (response.ok) {
        const data = await response.json();
        const results: Record<string, HealthResult> = {};
        if (data.health) {
          for (const [serverId, info] of Object.entries(data.health)) {
            const h = info as { healthy: boolean; latency?: number; error?: string };
            results[serverId] = {
              serverId,
              healthy: h.healthy,
              latency: h.latency,
              error: h.error,
            };
          }
        }
        setHealthResults(results);
      }
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setCheckingHealth(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-text-primary">
          <span>MCP Servers</span>
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse bg-glass" />
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = servers.filter((s) => s.enabled).length;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-text-primary">
            MCP Servers
          </h3>
          <p className="text-sm mt-1 text-text-secondary">
            Extend AI capabilities with Model Context Protocol servers.
            {enabledCount > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                {enabledCount} active
              </span>
            )}
          </p>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={checkingHealth || enabledCount === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 bg-glass border border-theme text-text-primary"
          aria-label="Run health check on active servers"
        >
          {checkingHealth ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Checking...
            </span>
          ) : (
            'Health Check'
          )}
        </button>
      </div>

      {/* On-Demand Architecture Note */}
      <div className="mb-4 px-4 py-3 rounded-lg text-xs bg-glass border border-theme text-text-secondary">
        Servers use on-demand architecture — they start automatically when needed and stop after 1
        minute of inactivity to save resources.
      </div>

      {/* Server List */}
      <div className="space-y-3">
        {servers.map((server) => {
          const status = STATUS_CONFIG[server.status] || STATUS_CONFIG.stopped;
          const health = healthResults[server.id];
          const isExpanded = expandedServer === server.id;
          const isToggling = togglingServer === server.id;

          return (
            <div
              key={server.id}
              className={`rounded-xl border transition-colors bg-glass ${server.enabled ? 'border-primary' : 'border-theme'}`}
            >
              {/* Server Row */}
              <div className="flex items-start justify-between p-4 gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
                    {SERVER_ICONS[server.id] || '🔧'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-text-primary">{server.name}</h4>
                      {server.builtIn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400 whitespace-nowrap">
                          Built-in
                        </span>
                      )}
                      {server.enabled && (
                        <span
                          className={`flex items-center gap-1 text-xs whitespace-nowrap ${status.color}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.dot}`}
                          />
                          {status.label}
                        </span>
                      )}
                      {health && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            health.healthy
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {health.healthy
                            ? `${health.latency ? `${health.latency}ms` : 'OK'}`
                            : 'Unhealthy'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 line-clamp-2 text-text-muted">
                      {server.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {server.tools && server.tools.length > 0 && (
                    <button
                      onClick={() => setExpandedServer(isExpanded ? null : server.id)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors whitespace-nowrap ${isExpanded ? 'bg-primary text-white' : 'bg-transparent text-text-muted border border-theme'}`}
                      aria-expanded={isExpanded}
                      aria-label={`${server.tools.length} tools available for ${server.name}`}
                    >
                      {server.tools.length} tools
                    </button>
                  )}

                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleServer(server.id, server.enabled)}
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${server.enabled ? 'bg-primary' : 'bg-glass border border-theme'}`}
                    role="switch"
                    aria-checked={server.enabled}
                    aria-label={`${server.enabled ? 'Disable' : 'Enable'} ${server.name} server`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        server.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {server.error && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                    {server.error}
                  </p>
                </div>
              )}

              {isExpanded && server.tools.length > 0 && (
                <div className="border-t border-theme px-4 py-3">
                  <p className="text-xs font-medium mb-2 text-text-secondary">Available Tools</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {server.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs bg-background"
                      >
                        <code className="font-mono flex-shrink-0 text-primary">{tool.name}</code>
                        <span className="truncate text-text-muted">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
