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
  const [isSavingModels, setIsSavingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/provider');

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[Providers] API error:', response.status, errorData);
          setError(errorData.error || `Failed to load settings (${response.status})`);
          setIsLoading(false);
          return;
        }

        const data = await response.json();

        // Safely set values with defaults
        setActiveProvider(data?.activeProvider || 'openai');

        if (data?.providerConfig && typeof data.providerConfig === 'object') {
          setProviderConfig({
            openai: { model: data.providerConfig.openai?.model || 'gpt-5-mini' },
            anthropic: { model: data.providerConfig.anthropic?.model || 'claude-sonnet-4-5-20250929' },
          });
        }

        if (data?.updatedAt) {
          try {
            setLastUpdated(new Date(data.updatedAt).toLocaleString());
          } catch {
            // Invalid date, ignore
          }
        }
      } catch (err) {
        console.error('[Providers] Error loading settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load provider settings');
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

  // Handle model name changes
  const handleModelChange = (provider: Provider, model: string) => {
    setProviderConfig(prev => ({
      ...prev,
      [provider]: { model },
    }));
    setSuccessMessage(null); // Clear success message when editing
  };

  // Save model settings
  const handleSaveModels = async () => {
    if (isSavingModels) return;

    // Validate inputs
    if (!providerConfig.openai.model.trim() || !providerConfig.anthropic.model.trim()) {
      setError('Model names cannot be empty');
      return;
    }

    setIsSavingModels(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/provider', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activeProvider,
          providerConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save model settings');
      }

      const data = await response.json();
      setLastUpdated(new Date(data.updatedAt).toLocaleString());
      setSuccessMessage('Model settings saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('[Providers] Error saving models:', err);
      setError(err instanceof Error ? err.message : 'Failed to save model settings');
    } finally {
      setIsSavingModels(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-3xl font-bold mb-6">AI Provider Settings</h2>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">AI Provider Settings</h2>
      <p className="text-gray-400 mb-8">Select the AI provider to use for all chat requests. This setting is persisted and applies globally.</p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Provider Switch */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenAI Option */}
          <button
            onClick={() => handleProviderSwitch('openai')}
            disabled={isSaving}
            className={`p-6 rounded-xl border-2 transition-all text-left ${
              activeProvider === 'openai'
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-4 h-4 rounded-full mt-1 ${
                activeProvider === 'openai' ? 'bg-green-500' : 'bg-gray-600'
              }`} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">OpenAI</h3>
                <p className="text-sm mt-1 text-gray-400">GPT-5-mini with built-in web search</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-400">Web search (built-in)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-400">Image generation (DALL-E)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-400">Vision/Image analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* Anthropic Option */}
          <button
            onClick={() => handleProviderSwitch('anthropic')}
            disabled={isSaving}
            className={`p-6 rounded-xl border-2 transition-all text-left ${
              activeProvider === 'anthropic'
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-4 h-4 rounded-full mt-1 ${
                activeProvider === 'anthropic' ? 'bg-green-500' : 'bg-gray-600'
              }`} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Anthropic</h3>
                <p className="text-sm mt-1 text-gray-400">Claude Sonnet 4.5 with Brave Search</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400">✓</span>
                    <span className="text-gray-400">Web search (Brave)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-400">✗</span>
                    <span className="text-gray-500">Image generation unavailable</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-400">Vision/Image analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        {isSaving && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-gray-400">Switching provider...</span>
          </div>
        )}
      </div>

      {/* Model Configuration */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
        <h3 className="text-xl font-bold mb-2">Model Configuration</h3>
        <p className="text-sm text-gray-400 mb-6">
          Enter the exact model name as required by each provider&apos;s API. Changes take effect immediately after saving.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-white">OpenAI Model</span>
              <input
                type="text"
                value={providerConfig.openai.model}
                onChange={(e) => handleModelChange('openai', e.target.value)}
                placeholder="e.g., gpt-4o-mini, gpt-4o, o1-mini"
                className="mt-1 w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
              />
            </label>
            <p className="text-xs text-gray-500">
              Examples: gpt-4o-mini, gpt-4o, gpt-4-turbo, o1-mini, o1
            </p>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-white">Anthropic Model</span>
              <input
                type="text"
                value={providerConfig.anthropic.model}
                onChange={(e) => handleModelChange('anthropic', e.target.value)}
                placeholder="e.g., claude-sonnet-4-5-20250929"
                className="mt-1 w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none transition"
              />
            </label>
            <p className="text-xs text-gray-500">
              Examples: claude-sonnet-4-5-20250929, claude-opus-4-20250514
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSaveModels}
            disabled={isSavingModels}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg font-medium transition"
          >
            {isSavingModels ? 'Saving...' : 'Save Model Settings'}
          </button>
          {lastUpdated && (
            <span className="text-sm text-gray-500">Last updated: {lastUpdated}</span>
          )}
        </div>
      </div>

      {/* Provider Notes */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4">Provider Notes</h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium text-blue-400 mb-2">Anthropic + Brave Search</h4>
            <p className="text-sm text-gray-400">
              When Anthropic is active, web searches use the Brave Search API.
              Ensure <code className="bg-white/10 px-2 py-0.5 rounded">BRAVE_SEARCH_API_KEY</code> is configured.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <h4 className="font-medium text-yellow-400 mb-2">Image Generation</h4>
            <p className="text-sm text-gray-400">
              DALL-E image generation is only available with OpenAI. Anthropic users will see a message
              that image generation is unavailable.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-400 mb-2">Database Persistence</h4>
            <p className="text-sm text-gray-400">
              Settings are stored in <code className="bg-white/10 px-2 py-0.5 rounded">provider_settings</code>
              table. Run the migration if the table doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
