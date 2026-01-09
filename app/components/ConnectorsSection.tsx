'use client';

/**
 * CONNECTORS SECTION
 *
 * Manages external service connections like GitHub.
 * Users can connect via Personal Access Token.
 */

import { useState, useEffect } from 'react';

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

export default function ConnectorsSection() {
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch GitHub connection status
  useEffect(() => {
    fetchGitHubStatus();
  }, []);

  const fetchGitHubStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/github-token');
      if (response.ok) {
        const responseData = await response.json();
        // API returns { ok: true, data: { connected: ... } }
        const status = responseData.data || responseData;
        setGithubStatus(status);
      }
    } catch (err) {
      console.error('Failed to fetch GitHub status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/user/github-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      const responseData = await response.json();
      // API returns { ok: true, data: { ... } } or { ok: false, error: ... }
      const data = responseData.data || responseData;

      if (!response.ok) {
        setError(responseData.error || data.error || 'Failed to save token');
        return;
      }

      setGithubStatus({
        connected: true,
        username: data.username,
        avatarUrl: data.avatarUrl,
      });
      setToken('');
      setShowTokenInput(false);
      setSuccess('GitHub connected successfully!');
    } catch (err) {
      console.error('Failed to save token:', err);
      setError('Failed to connect. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GitHub?')) {
      return;
    }

    try {
      await fetch('/api/user/github-token', { method: 'DELETE' });
      setGithubStatus({ connected: false });
      setSuccess('GitHub disconnected');
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect. Please try again.');
    }
  };

  return (
    <section className="glass-morphism rounded-2xl p-4 sm:p-6">
      <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Connectors
      </h2>
      <p className="mb-6 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
        Connect external services to enhance your development workflow.
      </p>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* GitHub Connector */}
      <div className="border rounded-xl p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
        {/* Mobile: Stack vertically, Desktop: Side by side */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left side: Icon and info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-base sm:text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                GitHub
              </h3>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Push code to repositories, create PRs, and review code
              </p>
            </div>
          </div>

          {/* Right side: Status/Actions */}
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </div>
            ) : githubStatus?.connected ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  {githubStatus.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={githubStatus.avatarUrl}
                      alt={githubStatus.username}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-green-600">
                    @{githubStatus.username}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTokenInput(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Token Input */}
        {showTokenInput && !githubStatus?.connected && (
          <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3">
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Personal Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '16px', // Prevent iOS zoom
                }}
              />
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=JCIL%20AI%20Code%20Lab"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                GitHub Settings
              </a>{' '}
              with the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">repo</code> scope.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSaveToken}
                disabled={saving || !token.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Connecting...' : 'Save Token'}
              </button>
              <button
                onClick={() => {
                  setShowTokenInput(false);
                  setToken('');
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Future connectors hint */}
      <div className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        <p>More connectors coming soon: Vercel, Linear, Notion, and more.</p>
      </div>
    </section>
  );
}
