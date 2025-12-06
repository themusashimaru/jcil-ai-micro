/**
 * ADMIN PROVIDERS & ROUTING
 * PURPOSE: AI provider management with OpenAI ↔ Anthropic switching
 *
 * Features:
 * - Manual provider switch (OpenAI or Anthropic)
 * - Persistent setting stored in database
 * - Real-time status indicators
 * - Provider-specific feature notes
 */

'use client';

import { useState, useEffect } from 'react';

type Provider = 'openai' | 'anthropic';

interface ProviderConfig {
  openai: { model: string };
  anthropic: { model: string };
}

export default function ProvidersPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>('openai');
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    openai: { model: 'gpt-5-mini' },
    anthropic: { model: 'claude-sonnet-4-5-20250929' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/provider');
        if (response.ok) {
          const data = await response.json();
          setActiveProvider(data.activeProvider || 'openai');
          if (data.providerConfig) {
            setProviderConfig(data.providerConfig);
          }
          if (data.updatedAt) {
            setLastUpdated(new Date(data.updatedAt).toLocaleString());
          }
        }
      } catch (err) {
        console.error('[Providers] Error loading settings:', err);
        setError('Failed to load provider settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle provider switch
  const handleProviderSwitch = async (provider: Provider) => {
    if (provider === activeProvider || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/provider', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activeProvider: provider,
          providerConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update provider');
      }

      const data = await response.json();
      setActiveProvider(data.activeProvider);
      setLastUpdated(new Date(data.updatedAt).toLocaleString());
    } catch (err) {
      console.error('[Providers] Error switching provider:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch provider');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--background)' }}>
        <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          AI Provider Settings
        </h1>
        <div className="glass-morphism rounded-2xl p-6">
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--background)' }}>
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
        AI Provider Settings
      </h1>

      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Provider Switch */}
      <div className="glass-morphism rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Active Provider
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Select the AI provider to use for all chat requests. This setting is persisted in the database
          and applies globally to all users.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenAI Option */}
          <button
            onClick={() => handleProviderSwitch('openai')}
            disabled={isSaving}
            className={`p-6 rounded-xl border-2 transition-all ${
              activeProvider === 'openai'
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-4 h-4 rounded-full mt-1 ${
                activeProvider === 'openai' ? 'bg-green-500' : 'bg-gray-600'
              }`} />
              <div className="text-left flex-1">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  OpenAI
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  GPT-5-mini with built-in web search
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Web search (built-in)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Image generation (DALL-E)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Vision/Image analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* Anthropic Option */}
          <button
            onClick={() => handleProviderSwitch('anthropic')}
            disabled={isSaving}
            className={`p-6 rounded-xl border-2 transition-all ${
              activeProvider === 'anthropic'
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-4 h-4 rounded-full mt-1 ${
                activeProvider === 'anthropic' ? 'bg-green-500' : 'bg-gray-600'
              }`} />
              <div className="text-left flex-1">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Anthropic
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Claude Sonnet 4.5 with Brave Search
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Web search (Brave)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-400">✗</span>
                    <span style={{ color: 'var(--text-muted)' }}>Image generation unavailable</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Vision/Image analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        {isSaving && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span style={{ color: 'var(--text-secondary)' }}>Switching provider...</span>
          </div>
        )}

        {lastUpdated && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            Last updated: {lastUpdated}
          </p>
        )}
      </div>

      {/* Current Configuration */}
      <div className="glass-morphism rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Current Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg bg-white/5">
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>OpenAI</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Model: <code className="bg-white/10 px-2 py-0.5 rounded">{providerConfig.openai.model}</code>
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white/5">
            <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Anthropic</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Model: <code className="bg-white/10 px-2 py-0.5 rounded">{providerConfig.anthropic.model}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Provider Notes */}
      <div className="glass-morphism rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Provider Notes
        </h2>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h3 className="font-medium text-blue-400 mb-2">Anthropic + Brave Search</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              When Anthropic is active, web searches are performed using the Brave Search API.
              Make sure the <code className="bg-white/10 px-2 py-0.5 rounded">BRAVE_SEARCH_API_KEY</code> environment
              variable is configured.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <h3 className="font-medium text-yellow-400 mb-2">Image Generation</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Image generation (DALL-E) is only available when OpenAI is the active provider.
              When Anthropic is active, users will see a message explaining that image generation
              is temporarily unavailable.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h3 className="font-medium text-green-400 mb-2">Database Persistence</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Provider settings are stored in the <code className="bg-white/10 px-2 py-0.5 rounded">provider_settings</code>
              table and persist across deployments. Run the migration to create this table if not already done.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
