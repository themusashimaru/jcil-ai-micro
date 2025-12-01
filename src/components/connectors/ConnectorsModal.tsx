'use client';

import { useState, useEffect } from 'react';
import { CONNECTORS, CATEGORY_LABELS, type ConnectorConfig } from '@/lib/connectors/config';

interface UserConnection {
  id: string;
  service: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
}

interface ConnectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectorsModal({ isOpen, onClose }: ConnectorsModalProps) {
  const [connections, setConnections] = useState<Record<string, UserConnection>>({});
  const [loading, setLoading] = useState(true);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorConfig | null>(null);
  const [token, setToken] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; username?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  // GitHub-specific state
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  // Check if connector uses multi-field inputs
  const hasMultipleFields = selectedConnector?.fields && selectedConnector.fields.length > 0;

  // Get the combined token value for multi-field connectors
  const getCombinedToken = (): string => {
    if (!selectedConnector) return '';
    if (!hasMultipleFields) return token;

    const separator = selectedConnector.fieldSeparator || '|';
    const values = selectedConnector.fields!.map(field => fieldValues[field.key] || '');
    return values.join(separator);
  };

  // Check if all required fields are filled
  const isFormValid = (): boolean => {
    if (!selectedConnector) return false;
    if (!hasMultipleFields) return token.trim().length > 0;
    return selectedConnector.fields!.every(field => (fieldValues[field.key] || '').trim().length > 0);
  };

  // Fetch user's existing connections
  useEffect(() => {
    if (isOpen) {
      fetchConnections();
    }
  }, [isOpen]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/connectors');
      if (response.ok) {
        const data = await response.json();
        const connectionsMap: Record<string, UserConnection> = {};
        data.connections.forEach((conn: UserConnection) => {
          connectionsMap[conn.service] = conn;
        });
        setConnections(connectionsMap);
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedConnector || !isFormValid()) return;

    setTesting(true);
    setTestResult(null);
    setError(null);
    setGithubRepos([]);
    setSelectedRepos(new Set());
    setGithubUsername(null);

    const tokenToTest = getCombinedToken();

    try {
      const response = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: selectedConnector.id, token: tokenToTest }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: data.username ? `Connected as ${data.username}` : 'Connection successful!',
          username: data.username,
        });

        // For GitHub, store repos and username for selection
        if (selectedConnector.id === 'github' && data.repos) {
          setGithubRepos(data.repos);
          setGithubUsername(data.username);
          // Auto-select first 5 repos by default
          const defaultSelected = new Set<string>(data.repos.slice(0, 5).map((r: GitHubRepo) => r.full_name));
          setSelectedRepos(defaultSelected);
        }
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!selectedConnector || !isFormValid()) return;

    setSaving(true);
    setError(null);

    const tokenToSave = getCombinedToken();

    // Build metadata based on connector type
    let metadata: Record<string, unknown> = {};
    if (selectedConnector.id === 'github' && githubUsername) {
      metadata = {
        owner: githubUsername,
        selectedRepos: Array.from(selectedRepos),
      };
    }

    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedConnector.id,
          token: tokenToSave,
          metadata,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConnections(prev => ({
          ...prev,
          [selectedConnector.id]: data.connection,
        }));
        setSelectedConnector(null);
        setToken('');
        setFieldValues({});
        setTestResult(null);
        setGithubRepos([]);
        setSelectedRepos(new Set());
        setGithubUsername(null);
      } else {
        setError(data.error || 'Failed to save connection');
      }
    } catch {
      setError('Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (service: string) => {
    if (!confirm('Are you sure you want to disconnect this service?')) return;

    try {
      const response = await fetch(`/api/connectors?service=${service}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConnections(prev => {
          const updated = { ...prev };
          delete updated[service];
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  // Filter connectors based on search query
  const filteredConnectors = searchQuery.trim()
    ? CONNECTORS.filter(connector =>
        connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connector.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connector.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CONNECTORS;

  // Group connectors by category
  const connectorsByCategory = filteredConnectors.reduce((acc, connector) => {
    if (!acc[connector.category]) {
      acc[connector.category] = [];
    }
    acc[connector.category].push(connector);
    return acc;
  }, {} as Record<string, ConnectorConfig[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Connectors</h2>
            <p className="text-sm text-gray-400 mt-0.5">Connect external services to enhance AI capabilities</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar - only show in grid view */}
        {!selectedConnector && (
          <div className="px-4 pt-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search connectors..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : selectedConnector ? (
            // Connector Setup View
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedConnector(null);
                  setToken('');
                  setFieldValues({});
                  setTestResult(null);
                  setError(null);
                  setGithubRepos([]);
                  setSelectedRepos(new Set());
                  setGithubUsername(null);
                  setSearchQuery('');
                }}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to connectors
              </button>

              <div className="bg-zinc-800/50 rounded-xl p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{selectedConnector.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedConnector.name}</h3>
                    <p className="text-sm text-gray-400">{selectedConnector.description}</p>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">What AI can do:</h4>
                  <ul className="space-y-1">
                    {selectedConnector.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Token Input - Single or Multi-field */}
                <div className="space-y-4">
                  {hasMultipleFields ? (
                    // Multi-field inputs (e.g., Supabase with URL + Key)
                    <>
                      {selectedConnector.fields!.map((field) => (
                        <label key={field.key} className="block">
                          <span className="text-sm font-medium text-gray-300">{field.label}</span>
                          {field.helpText && (
                            <span className="block text-xs text-gray-500 mt-0.5">{field.helpText}</span>
                          )}
                          <input
                            type={field.type || 'password'}
                            value={fieldValues[field.key] || ''}
                            onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="mt-1 w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </label>
                      ))}
                    </>
                  ) : (
                    // Single token input
                    <label className="block">
                      <span className="text-sm font-medium text-gray-300">{selectedConnector.tokenLabel}</span>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={selectedConnector.placeholder}
                        className="mt-1 w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </label>
                  )}

                  <a
                    href={selectedConnector.tokenHelpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  >
                    How to get your credentials
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={`mt-4 p-3 rounded-lg ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {testResult.message}
                  </div>
                )}

                {/* GitHub Repo Selection */}
                {testResult?.success && selectedConnector?.id === 'github' && githubRepos.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-zinc-800/50 border border-white/5">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      Select repositories to work with:
                    </h4>
                    <p className="text-xs text-gray-500 mb-3">
                      The AI will be able to read and write to these repos. You can use just the repo name (e.g., &quot;my-project&quot;) instead of the full path.
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {githubRepos.map((repo) => (
                        <label
                          key={repo.full_name}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRepos.has(repo.full_name)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRepos);
                              if (e.target.checked) {
                                newSelected.add(repo.full_name);
                              } else {
                                newSelected.delete(repo.full_name);
                              }
                              setSelectedRepos(newSelected);
                            }}
                            className="w-4 h-4 rounded border-gray-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white truncate">{repo.name}</span>
                              {repo.private && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
                                  Private
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{repo.full_name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedRepos.size > 0 && (
                      <p className="mt-2 text-xs text-gray-400">
                        {selectedRepos.size} repo{selectedRepos.size !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/20 text-red-400">
                    {error}
                  </div>
                )}

                {/* Warning */}
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-400">
                    <strong>Important:</strong> By connecting, you authorize the AI to access this service on your behalf.
                    For any changes (file edits, commits, etc.), the AI will ask for your confirmation first.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleTestConnection}
                    disabled={!isFormValid() || testing}
                    className="flex-1 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleSaveConnection}
                    disabled={!isFormValid() || saving}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Connectors Grid View
            <div className="space-y-6">
              {/* No results message */}
              {searchQuery && Object.keys(connectorsByCategory).length === 0 && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-gray-400 text-sm">No connectors found for &quot;{searchQuery}&quot;</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {Object.entries(connectorsByCategory).map(([category, connectors]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                    {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {connectors.map((connector) => {
                      const isConnected = !!connections[connector.id];
                      const isComingSoon = connector.comingSoon;

                      return (
                        <div
                          key={connector.id}
                          className={`relative p-4 rounded-xl border transition-all ${
                            isConnected
                              ? 'bg-green-500/10 border-green-500/30'
                              : isComingSoon
                              ? 'bg-zinc-800/30 border-white/5 opacity-60'
                              : 'bg-zinc-800/50 border-white/5 hover:border-white/20 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isComingSoon && !isConnected) {
                              setSelectedConnector(connector);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-2xl flex-shrink-0">{connector.icon}</span>
                              <div className="min-w-0">
                                <h4 className="font-medium text-white">{connector.name}</h4>
                                <p className="text-xs text-gray-400 line-clamp-1">{connector.description}</p>
                              </div>
                            </div>

                            {isConnected ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDisconnect(connector.id);
                                }}
                                className="px-3 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full transition-colors whitespace-nowrap flex-shrink-0"
                              >
                                Disconnect
                              </button>
                            ) : isComingSoon ? (
                              <span className="px-3 py-1 text-xs bg-zinc-700 text-gray-400 rounded-full whitespace-nowrap flex-shrink-0">
                                Coming Soon
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full whitespace-nowrap flex-shrink-0">
                                Connect
                              </span>
                            )}
                          </div>

                          {isConnected && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Connected
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/50">
          <p className="text-xs text-gray-500 text-center">
            Your API tokens are encrypted and stored securely. You can disconnect at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
