/**
 * CONNECTORS BUTTON
 * =================
 *
 * Button to show connected services (GitHub, Vercel, Supabase, etc.)
 * Displays in chat composer action bar.
 *
 * GitHub uses Personal Access Token for workspace git operations (clone/push/pull).
 * All other services (Vercel, Supabase, Cloudflare, etc.) use Composio OAuth connectors.
 */

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

interface ConnectorsButtonProps {
  disabled?: boolean;
}

export function ConnectorsButton({ disabled }: ConnectorsButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // GitHub state (PAT for workspace git operations)
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [showGitHubTokenInput, setShowGitHubTokenInput] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState('');
  const [githubTokenError, setGithubTokenError] = useState('');
  const [githubSaving, setGithubSaving] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch status when modal opens
  useEffect(() => {
    if (showModal) {
      fetchAllStatuses();
    }
  }, [showModal]);

  const fetchAllStatuses = async () => {
    setLoading(true);
    try {
      const githubRes = await fetch('/api/user/github-token');
      if (githubRes.ok) {
        const data = await githubRes.json();
        setGithubStatus(data);
      }
    } catch (error) {
      console.error('[ConnectorsButton] Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  // GitHub handlers
  const handleSaveGitHubToken = async () => {
    if (!githubTokenInput.trim()) {
      setGithubTokenError('Please enter a token');
      return;
    }

    setGithubSaving(true);
    setGithubTokenError('');

    try {
      const response = await fetch('/api/user/github-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubTokenInput.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGithubStatus({
          connected: true,
          username: data.username,
          avatarUrl: data.avatarUrl,
        });
        setShowGitHubTokenInput(false);
        setGithubTokenInput('');
      } else {
        setGithubTokenError(data.error || 'Failed to save token');
      }
    } catch (error) {
      console.error('[ConnectorsButton] Failed to save GitHub token:', error);
      setGithubTokenError('Failed to connect. Please try again.');
    } finally {
      setGithubSaving(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      const response = await fetch('/api/user/github-token', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to disconnect GitHub: ${response.status}`);
      }
      setGithubStatus({ connected: false });
    } catch (error) {
      console.error('[ConnectorsButton] Failed to disconnect GitHub:', error);
    }
  };

  return (
    <>
      {/* Connectors Button */}
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className="rounded-lg p-1 md:p-2 disabled:opacity-50 shrink-0 flex items-center justify-center transition-colors relative"
        style={{ color: 'var(--primary)' }}
        title="Connect GitHub & More"
      >
        {/* Link/plug icon - represents connections */}
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        {/* Connected indicator */}
        {githubStatus.connected && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
        )}
      </button>

      {/* Modal */}
      {showModal &&
        isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowModal(false);
                setShowGitHubTokenInput(false);
                setGithubTokenInput('');
                setGithubTokenError('');
              }}
            />
            {/* Modal Content */}
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[9999] max-w-md mx-auto rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Connectors</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setShowGitHubTokenInput(false);
                    setGithubTokenInput('');
                    setGithubTokenError('');
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-t-white" />
                  </div>
                ) : (
                  <>
                    {/* GitHub Connector (PAT for workspace git ops) */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🐙</span>
                          <div>
                            <p className="font-medium text-white">GitHub</p>
                            <p className="text-xs text-gray-400">Push code to repositories</p>
                          </div>
                        </div>
                        {githubStatus.connected ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400">@{githubStatus.username}</span>
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowGitHubTokenInput(true)}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                          >
                            Connect
                          </button>
                        )}
                      </div>

                      {/* Token Input Section */}
                      {showGitHubTokenInput && !githubStatus.connected && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs text-gray-400 mb-3">
                            Create a{' '}
                            <a
                              href="https://github.com/settings/tokens/new?scopes=repo&description=JCIL.ai"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Personal Access Token
                            </a>{' '}
                            with <code className="bg-white/10 px-1 rounded">repo</code> scope
                          </p>

                          <input
                            type="password"
                            value={githubTokenInput}
                            onChange={(e) => {
                              setGithubTokenInput(e.target.value);
                              setGithubTokenError('');
                            }}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoComplete="off"
                          />

                          {githubTokenError && (
                            <p className="mt-2 text-xs text-red-400">{githubTokenError}</p>
                          )}

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={handleSaveGitHubToken}
                              disabled={githubSaving || !githubTokenInput.trim()}
                              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
                            >
                              {githubSaving ? 'Connecting...' : 'Connect'}
                            </button>
                            <button
                              onClick={() => {
                                setShowGitHubTokenInput(false);
                                setGithubTokenInput('');
                                setGithubTokenError('');
                              }}
                              className="px-3 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Disconnect Button */}
                      {githubStatus.connected && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={handleDisconnectGitHub}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Disconnect GitHub
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Composio-Powered Connectors Info */}
                    <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🔗</span>
                        <div>
                          <p className="font-medium text-white">67+ App Connectors</p>
                          <p className="text-xs text-gray-400">
                            Powered by Composio (SOC2 certified)
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>▲</span> Vercel
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>🟢</span> Supabase
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>🔶</span> Cloudflare
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>💬</span> Slack
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>📧</span> Gmail
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span>💳</span> Stripe
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        Connect apps in Settings → Connectors panel
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 text-center">
                  All service connections use SOC2-certified Composio OAuth
                </p>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
