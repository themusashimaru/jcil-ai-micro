'use client';

/**
 * BYOK (Bring Your Own Key) Section
 *
 * Allows users to add their own API keys for AI providers.
 * Keys are encrypted and stored securely.
 */

import { useState, useEffect } from 'react';

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
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
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
      <text x="12" y="16" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
        D
      </text>
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

export default function BYOKSection() {
  const [providerKeys, setProviderKeys] = useState<ProviderKeyStatus[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderKeys();
  }, []);

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
        BYOK API Keys (Code Lab)
      </h2>
      <p className="mb-6 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
        Bring your own API keys to use with Code Lab. Your keys are encrypted and never shown after
        saving.
      </p>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-green-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

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
                          Model:{' '}
                          <span className="font-mono">
                            {provider.model || provider.defaultModel}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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
                    Leave blank to use default:{' '}
                    <code className="px-1 py-0.5 bg-gray-100 rounded">{provider.defaultModel}</code>
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

      {/* Info Section */}
      <div
        className="mt-6 p-4 rounded-lg border"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
      >
        <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Why use your own API keys?
        </h4>
        <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>
            - <strong>No usage limits</strong> - Use your own quota
          </li>
          <li>
            - <strong>Direct billing</strong> - Pay providers directly
          </li>
          <li>
            - <strong>Latest models</strong> - Access newest releases immediately
          </li>
          <li>
            - <strong>Privacy</strong> - Requests go directly to providers
          </li>
        </ul>
      </div>
    </section>
  );
}
