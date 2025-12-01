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
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        });
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

    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: selectedConnector.id, token: tokenToSave }),
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

  // Group connectors by category
  const connectorsByCategory = CONNECTORS.reduce((acc, connector) => {
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
