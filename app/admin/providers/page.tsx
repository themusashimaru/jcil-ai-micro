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

interface TierModels {
  basic: string;
  pro: string;
  executive: string;
}

interface ProviderModelConfig {
  model: string; // Legacy fallback
  models: TierModels;
  imageModel?: string; // OpenAI only
}

interface ProviderConfig {
  openai: ProviderModelConfig;
  anthropic: ProviderModelConfig;
}

export default function ProvidersPage() {
  const [activeProvider, setActiveProvider] = useState<Provider>('openai');
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    openai: {
      model: 'gpt-4o-mini',
      models: {
        basic: 'gpt-4o-mini',
        pro: 'gpt-4o',
        executive: 'gpt-4o',
      },
      imageModel: 'dall-e-3',
    },
    anthropic: {
      model: 'claude-sonnet-4-5-20250929',
      models: {
        basic: 'claude-3-5-haiku-20241022',
        pro: 'claude-sonnet-4-5-20250929',
        executive: 'claude-sonnet-4-5-20250929',
      },
    },
  });
  const [codeCommandModel, setCodeCommandModel] = useState('claude-opus-4-5-20251101');
  const [perplexityModel, setPerplexityModel] = useState('sonar-pro');
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
            openai: {
              model: data.providerConfig.openai?.model || 'gpt-4o-mini',
              models: {
                basic: data.providerConfig.openai?.models?.basic || 'gpt-4o-mini',
                pro: data.providerConfig.openai?.models?.pro || 'gpt-4o',
                executive: data.providerConfig.openai?.models?.executive || 'gpt-4o',
              },
              imageModel: data.providerConfig.openai?.imageModel || 'dall-e-3',
            },
            anthropic: {
              model: data.providerConfig.anthropic?.model || 'claude-sonnet-4-5-20250929',
              models: {
                basic: data.providerConfig.anthropic?.models?.basic || 'claude-3-5-haiku-20241022',
                pro: data.providerConfig.anthropic?.models?.pro || 'claude-sonnet-4-5-20250929',
                executive: data.providerConfig.anthropic?.models?.executive || 'claude-sonnet-4-5-20250929',
              },
            },
          });
        }

        // Load Code Command model
        if (data?.codeCommandModel) {
          setCodeCommandModel(data.codeCommandModel);
        }

        // Load Perplexity model
        if (data?.perplexityModel) {
          setPerplexityModel(data.perplexityModel);
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

  // Handle tier-specific model changes
  const handleTierModelChange = (provider: Provider, tier: keyof TierModels, model: string) => {
    setProviderConfig(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        model: tier === 'pro' ? model : prev[provider].model, // Keep pro as legacy fallback
        models: {
          ...prev[provider].models,
          [tier]: model,
        },
      },
    }));
    setSuccessMessage(null);
  };

  // Handle image model change (OpenAI only)
  const handleImageModelChange = (model: string) => {
    setProviderConfig(prev => ({
      ...prev,
      openai: {
        ...prev.openai,
        imageModel: model,
      },
    }));
    setSuccessMessage(null);
  };

  // Save model settings
  const handleSaveModels = async () => {
    if (isSavingModels) return;

    // Validate inputs - check all tier models
    const openaiModels = providerConfig.openai.models;
    const anthropicModels = providerConfig.anthropic.models;

    if (!openaiModels.basic.trim() || !openaiModels.pro.trim() || !openaiModels.executive.trim()) {
      setError('All OpenAI tier model names must be filled');
      return;
    }

    if (!anthropicModels.basic.trim() || !anthropicModels.pro.trim() || !anthropicModels.executive.trim()) {
      setError('All Anthropic tier model names must be filled');
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
          codeCommandModel,
          perplexityModel,
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--primary)' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">AI Provider Settings</h2>
      <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Select the AI provider to use for all chat requests. This setting is persisted and applies globally.</p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <p className="text-green-600">{successMessage}</p>
        </div>
      )}

      {/* Provider Switch */}
      <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenAI Option */}
          <button
            onClick={() => handleProviderSwitch('openai')}
            disabled={isSaving}
            className="p-6 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: activeProvider === 'openai' ? '#22c55e' : 'var(--border)',
              backgroundColor: activeProvider === 'openai' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-4 h-4 rounded-full mt-1"
                style={{ backgroundColor: activeProvider === 'openai' ? '#22c55e' : 'var(--text-muted)' }}
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold">OpenAI</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>GPT-5-mini with built-in web search</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Web search (built-in)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Image generation (DALL-E)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
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
            className="p-6 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: activeProvider === 'anthropic' ? '#22c55e' : 'var(--border)',
              backgroundColor: activeProvider === 'anthropic' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-4 h-4 rounded-full mt-1"
                style={{ backgroundColor: activeProvider === 'anthropic' ? '#22c55e' : 'var(--text-muted)' }}
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Anthropic</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Claude with native web search</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-500">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Web search (native)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-500">⚡</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Image generation (admin only via DALL-E)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Vision/Image analysis</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        {isSaving && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <span style={{ color: 'var(--text-muted)' }}>Switching provider...</span>
          </div>
        )}
      </div>

      {/* Model Configuration */}
      <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-xl font-bold mb-2">Model Configuration</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Configure which AI model to use for each subscription tier. This allows cost optimization (cheaper models for basic tier) and premium experience for higher tiers.
        </p>

        {/* OpenAI Models */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            OpenAI Models
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-medium">Plus Tier</span>
              <input
                type="text"
                value={providerConfig.openai.models.basic}
                onChange={(e) => handleTierModelChange('openai', 'basic', e.target.value)}
                placeholder="gpt-4o-mini"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Pro Tier</span>
              <input
                type="text"
                value={providerConfig.openai.models.pro}
                onChange={(e) => handleTierModelChange('openai', 'pro', e.target.value)}
                placeholder="gpt-4o"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Executive Tier</span>
              <input
                type="text"
                value={providerConfig.openai.models.executive}
                onChange={(e) => handleTierModelChange('openai', 'executive', e.target.value)}
                placeholder="gpt-4o"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
          </div>
          <label className="block max-w-xs">
            <span className="text-sm font-medium">Image Model</span>
            <input
              type="text"
              value={providerConfig.openai.imageModel || ''}
              onChange={(e) => handleImageModelChange(e.target.value)}
              placeholder="dall-e-3"
              className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Leave empty to disable image generation</p>
          </label>
        </div>

        {/* Anthropic Models */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-orange-500 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
            Anthropic Models
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Plus Tier</span>
              <input
                type="text"
                value={providerConfig.anthropic.models.basic}
                onChange={(e) => handleTierModelChange('anthropic', 'basic', e.target.value)}
                placeholder="claude-3-5-haiku-20241022"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Pro Tier</span>
              <input
                type="text"
                value={providerConfig.anthropic.models.pro}
                onChange={(e) => handleTierModelChange('anthropic', 'pro', e.target.value)}
                placeholder="claude-sonnet-4-5-20250929"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Executive Tier</span>
              <input
                type="text"
                value={providerConfig.anthropic.models.executive}
                onChange={(e) => handleTierModelChange('anthropic', 'executive', e.target.value)}
                placeholder="claude-sonnet-4-5-20250929"
                className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Examples: claude-3-5-haiku-20241022, claude-sonnet-4-5-20250929, claude-opus-4-20250514
          </p>
        </div>

        {/* Code Command Model (Admin) */}
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <h4 className="text-lg font-semibold text-purple-500 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
            Code Command Model (Admin Only)
          </h4>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            The model used for Code Command - your admin coding assistant. Use a powerful model for complex engineering tasks.
          </p>
          <label className="block max-w-md">
            <span className="text-sm font-medium">Claude Model</span>
            <input
              type="text"
              value={codeCommandModel}
              onChange={(e) => {
                setCodeCommandModel(e.target.value);
                setSuccessMessage(null);
              }}
              placeholder="claude-opus-4-5-20251101"
              className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Recommended: claude-opus-4-5-20251101 (best for code) or claude-sonnet-4-5-20250929 (faster)
            </p>
          </label>
        </div>

        {/* Perplexity Model (Web Search) */}
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <h4 className="text-lg font-semibold text-blue-500 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            Perplexity Model (Web Search)
          </h4>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            The model used for web search and fact-checking. Sonar Pro provides better accuracy and source quality.
          </p>
          <label className="block max-w-md">
            <span className="text-sm font-medium">Perplexity Model</span>
            <select
              value={perplexityModel}
              onChange={(e) => {
                setPerplexityModel(e.target.value);
                setSuccessMessage(null);
              }}
              className="mt-1 w-full rounded-lg px-4 py-2 focus:outline-none transition"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="sonar-pro">sonar-pro (Best quality, recommended)</option>
              <option value="sonar">sonar (Faster, basic searches)</option>
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              sonar-pro: Better accuracy, better sources. sonar: Faster, good for simple lookups.
            </p>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveModels}
            disabled={isSavingModels}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg font-medium transition"
          >
            {isSavingModels ? 'Saving...' : 'Save Model Settings'}
          </button>
          {lastUpdated && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Last updated: {lastUpdated}</span>
          )}
        </div>
      </div>

      {/* Provider Notes */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
        <h3 className="text-xl font-bold mb-4">Provider Notes</h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-medium text-blue-600 mb-2">Web Search</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Both providers have native web search. OpenAI uses <code className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--glass-bg)' }}>web_search_preview</code> and
              Anthropic uses <code className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--glass-bg)' }}>web_search_20250305</code>.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <h4 className="font-medium text-yellow-600 mb-2">Image Generation</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              DALL-E image generation is available with both providers. When Anthropic is active,
              only admins can generate images (uses DALL-E via OpenAI API). Regular users see an unavailable message.
              Configure the image model in the OpenAI section above.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <h4 className="font-medium text-purple-600 mb-2">Tier-Based Model Selection</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Each subscription tier uses its configured model. Use cheaper models (Haiku, gpt-4o-mini)
              for Plus tier to optimize costs, premium models for Executive tier.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-600 mb-2">Database Persistence</h4>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Settings are stored in <code className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--glass-bg)' }}>provider_settings</code>
              table. Run the migration if the table doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
