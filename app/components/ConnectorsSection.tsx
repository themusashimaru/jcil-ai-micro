'use client';

/**
 * CONNECTORS SECTION
 *
 * Manages external service connections like GitHub.
 * Users can connect via Personal Access Token.
 * Also manages BYOK (Bring Your Own Key) for AI providers.
 */

import { useState, useEffect } from 'react';

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  error?: string;
}

interface SpotifyStatus {
  configured: boolean;
  connected: boolean;
  userId?: string;
  displayName?: string;
  email?: string;
  imageUrl?: string;
  product?: string;
  connectedAt?: string;
  error?: string;
}

interface UberStatus {
  configured: boolean;
  connected: boolean;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  connectedAt?: string;
  error?: string;
}

interface NotionStatus {
  configured: boolean;
  connected: boolean;
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  userEmail?: string;
  connectedAt?: string;
  error?: string;
}

interface ProviderKeyStatus {
  provider: string;
  name: string;
  configured: boolean;
  lastChars?: string;
  model?: string;
  defaultModel: string;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  claude: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  ),
  deepseek: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <text x="12" y="16" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">D</text>
    </svg>
  ),
  xai: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  ),
};

export default function ConnectorsSection() {
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);
  const [uberStatus, setUberStatus] = useState<UberStatus | null>(null);
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [uberLoading, setUberLoading] = useState(true);
  const [notionLoading, setNotionLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // API Keys state
  const [providerKeys, setProviderKeys] = useState<ProviderKeyStatus[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  // Fetch connection statuses
  useEffect(() => {
    fetchGitHubStatus();
    fetchSpotifyStatus();
    fetchUberStatus();
    fetchNotionStatus();
    fetchProviderKeys();

    // Check for connection success from URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify') === 'connected') {
      setSuccess('Spotify connected successfully!');
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
    if (params.get('uber') === 'connected') {
      setSuccess('Uber connected successfully!');
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
    if (params.get('notion') === 'connected') {
      setSuccess('Notion connected successfully!');
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
    if (params.get('error')) {
      setError(`Connection error: ${params.get('error')}`);
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
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

  const fetchSpotifyStatus = async () => {
    setSpotifyLoading(true);
    try {
      const response = await fetch('/api/connectors/spotify/status');
      if (response.ok) {
        const responseData = await response.json();
        const status = responseData.data || responseData;
        setSpotifyStatus(status);
      }
    } catch (err) {
      console.error('Failed to fetch Spotify status:', err);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSpotifyConnect = () => {
    // Redirect to Spotify OAuth
    window.location.href = '/api/connectors/spotify/auth';
  };

  const handleSpotifyDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Spotify?')) {
      return;
    }

    try {
      const response = await fetch('/api/connectors/spotify/disconnect', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to disconnect Spotify');
      }
      setSpotifyStatus({ configured: true, connected: false });
      setSuccess('Spotify disconnected');
    } catch (err) {
      console.error('Failed to disconnect Spotify:', err);
      setError('Failed to disconnect Spotify. Please try again.');
    }
  };

  const fetchUberStatus = async () => {
    setUberLoading(true);
    try {
      const response = await fetch('/api/connectors/uber/status');
      if (response.ok) {
        const responseData = await response.json();
        const status = responseData.data || responseData;
        setUberStatus(status);
      }
    } catch (err) {
      console.error('Failed to fetch Uber status:', err);
    } finally {
      setUberLoading(false);
    }
  };

  const handleUberConnect = () => {
    // Redirect to Uber OAuth
    window.location.href = '/api/connectors/uber/auth';
  };

  const handleUberDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Uber?')) {
      return;
    }

    try {
      const response = await fetch('/api/connectors/uber/disconnect', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to disconnect Uber');
      }
      setUberStatus({ configured: true, connected: false });
      setSuccess('Uber disconnected');
    } catch (err) {
      console.error('Failed to disconnect Uber:', err);
      setError('Failed to disconnect Uber. Please try again.');
    }
  };

  const fetchNotionStatus = async () => {
    setNotionLoading(true);
    try {
      const response = await fetch('/api/connectors/notion/status');
      if (response.ok) {
        const responseData = await response.json();
        const status = responseData.data || responseData;
        setNotionStatus(status);
      }
    } catch (err) {
      console.error('Failed to fetch Notion status:', err);
    } finally {
      setNotionLoading(false);
    }
  };

  const handleNotionConnect = () => {
    window.location.href = '/api/connectors/notion/auth';
  };

  const handleNotionDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Notion?')) {
      return;
    }

    try {
      const response = await fetch('/api/connectors/notion/disconnect', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to disconnect Notion');
      }
      setNotionStatus({ configured: true, connected: false });
      setSuccess('Notion disconnected');
    } catch (err) {
      console.error('Failed to disconnect Notion:', err);
      setError('Failed to disconnect Notion. Please try again.');
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
      const response = await fetch('/api/user/github-token', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to disconnect GitHub: ${response.status}`);
      }
      setGithubStatus({ connected: false });
      setSuccess('GitHub disconnected');
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect. Please try again.');
    }
  };

  // API Keys functions
  const fetchProviderKeys = async () => {
    setLoadingKeys(true);
    try {
      const response = await fetch('/api/user/api-keys');
      if (response.ok) {
        const data = await response.json();
        setProviderKeys(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleTestKey = async (provider: string) => {
    if (!newApiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setTestingKey(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: newApiKey.trim(), action: 'test' }),
      });

      const data = await response.json();

      if (data.valid) {
        setSuccess('API key is valid!');
      } else {
        setError(data.error || 'Invalid API key');
      }
    } catch (err) {
      console.error('Failed to test API key:', err);
      setError('Failed to test API key');
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    if (!newApiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setSavingKey(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: newApiKey.trim(),
          model: newModel.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save API key');
        return;
      }

      setSuccess(data.message || 'API key saved successfully');
      setNewApiKey('');
      setNewModel('');
      setShowKeyInput(null);
      fetchProviderKeys();
    } catch (err) {
      console.error('Failed to save API key:', err);
      setError('Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveKey = async (provider: string, providerName: string) => {
    if (!confirm(`Are you sure you want to remove your ${providerName} API key?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/user/api-keys?provider=${provider}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove API key');
      }

      const data = await response.json();
      setSuccess(data.message || 'API key removed');
      fetchProviderKeys();
    } catch (err) {
      console.error('Failed to remove API key:', err);
      setError('Failed to remove API key');
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
                className="hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                GitHub Settings
              </a>{' '}
              with the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">repo</code> scope.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSaveToken}
                disabled={saving || !token.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary)' }}
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

      {/* Spotify Connector */}
      <div className="border rounded-xl p-4 sm:p-5 mt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left side: Icon and info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1DB954] flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-base sm:text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                Spotify
              </h3>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Control music, create playlists, get recommendations
              </p>
            </div>
          </div>

          {/* Right side: Status/Actions */}
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            {spotifyLoading ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </div>
            ) : !spotifyStatus?.configured ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Not configured
              </div>
            ) : spotifyStatus?.connected ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  {spotifyStatus.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spotifyStatus.imageUrl}
                      alt={spotifyStatus.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-green-600">
                    {spotifyStatus.displayName}
                  </span>
                  {spotifyStatus.product === 'premium' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#1DB954] text-white">
                      Premium
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSpotifyDisconnect}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleSpotifyConnect}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1DB954] text-white hover:bg-[#1ed760] transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Uber Connector */}
      <div className="border rounded-xl p-4 sm:p-5 mt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left side: Icon and info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12.0009 0C5.37328 0 0 5.37328 0 12.0009C0 18.6267 5.37328 24 12.0009 24C18.6267 24 24 18.6267 24 12.0009C24 5.37328 18.6267 0 12.0009 0ZM6.54545 8.18182H8.72727V15.8182H6.54545V8.18182ZM17.4545 12.5455C17.4545 14.2909 16.0364 15.8182 14.1818 15.8182H10.9091V8.18182H14.1818C16.0364 8.18182 17.4545 9.6 17.4545 11.4545V12.5455Z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-base sm:text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                Uber
              </h3>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Get ride estimates, request rides, track trips
              </p>
            </div>
          </div>

          {/* Right side: Status/Actions */}
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            {uberLoading ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </div>
            ) : !uberStatus?.configured ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Not configured
              </div>
            ) : uberStatus?.connected ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-600">
                    {uberStatus.firstName} {uberStatus.lastName}
                  </span>
                </div>
                <button
                  onClick={handleUberDisconnect}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleUberConnect}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notion Connector */}
      <div className="border rounded-xl p-4 sm:p-5 mt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left side: Icon and info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#000000] flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.142c-.42-.326-.98-.7-2.055-.606L3.01 2.7c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.62c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.212v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.448-1.632z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-base sm:text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                Notion
              </h3>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Create pages, manage databases, search workspace
              </p>
            </div>
          </div>

          {/* Right side: Status/Actions */}
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            {notionLoading ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </div>
            ) : !notionStatus?.configured ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Not configured
              </div>
            ) : notionStatus?.connected ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-600">
                    {notionStatus.workspaceName || notionStatus.userName}
                  </span>
                </div>
                <button
                  onClick={handleNotionDisconnect}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleNotionConnect}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* API Keys Section - BYOK */}
      <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Code Lab API Keys
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Bring your own API keys to use with Code Lab. Keys are encrypted and never shown after saving.
        </p>

        {loadingKeys ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading API keys...
          </div>
        ) : (
          <div className="space-y-3">
            {providerKeys.map((provider) => (
              <div
                key={provider.provider}
                className="border rounded-lg p-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Provider Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    >
                      {PROVIDER_ICONS[provider.provider]}
                    </div>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {provider.name}
                      </div>
                      {provider.configured && (
                        <div className="space-y-0.5">
                          {provider.lastChars && (
                            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              ••••••••{provider.lastChars}
                            </div>
                          )}
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Model: <span className="font-mono">{provider.model || provider.defaultModel}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {provider.configured ? (
                      <>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                          Configured
                        </span>
                        <button
                          onClick={() => handleRemoveKey(provider.provider, provider.name)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setShowKeyInput(provider.provider);
                          setNewApiKey('');
                          setNewModel('');
                          setError(null);
                        }}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        Add Key
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Input Form */}
                {showKeyInput === provider.provider && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    {/* API Key Input */}
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      API Key
                    </label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder={`Enter your ${provider.name} API key`}
                      className="w-full px-3 py-2 rounded-lg border text-sm font-mono mb-3"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                      }}
                    />

                    {/* Model Input */}
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Model Name <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      placeholder={provider.defaultModel}
                      className="w-full px-3 py-2 rounded-lg border text-sm font-mono mb-1"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                      }}
                    />
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                      Leave blank to use default: <code className="px-1 py-0.5 bg-gray-100 rounded">{provider.defaultModel}</code>
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleTestKey(provider.provider)}
                        disabled={testingKey || !newApiKey.trim()}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        {testingKey ? 'Testing...' : 'Test Key'}
                      </button>
                      <button
                        onClick={() => handleSaveKey(provider.provider)}
                        disabled={savingKey || !newApiKey.trim()}
                        className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {savingKey ? 'Saving...' : 'Save Key'}
                      </button>
                      <button
                        onClick={() => {
                          setShowKeyInput(null);
                          setNewApiKey('');
                          setNewModel('');
                          setError(null);
                        }}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Your API key will be encrypted. You won&apos;t be able to view it after saving.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Future connectors hint */}
      <div className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        <p>More connectors coming soon: Notion, Linear, and more.</p>
      </div>
    </section>
  );
}
