'use client';

/**
 * CODE LAB PLUGIN MARKETPLACE
 *
 * Visual plugin discovery and management interface.
 *
 * Features:
 * - Browse available plugins
 * - Search and filter plugins
 * - View plugin details
 * - Install/uninstall plugins
 * - Enable/disable plugins
 * - Configure plugins
 *
 * @version 1.0.0
 */

import { useState, useMemo, useCallback } from 'react';

// Types
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
}

interface Plugin {
  metadata: PluginMetadata;
  state: 'available' | 'installed' | 'enabled' | 'disabled' | 'error';
  scope: 'project' | 'user';
  toolCount?: number;
  commandCount?: number;
  downloads?: number;
  rating?: number;
  error?: string;
}

interface CodeLabPluginMarketplaceProps {
  plugins: Plugin[];
  installedPlugins: string[];
  enabledPlugins: string[];
  onInstall: (pluginId: string) => Promise<void>;
  onUninstall: (pluginId: string) => Promise<void>;
  onEnable: (pluginId: string) => Promise<void>;
  onDisable: (pluginId: string) => Promise<void>;
  onConfigure: (pluginId: string) => void;
  isLoading?: boolean;
}

type TabType = 'browse' | 'installed';
type FilterCategory = 'all' | 'tools' | 'commands' | 'themes' | 'mcp';

const CATEGORIES: { id: FilterCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'tools', label: 'Tools', icon: '🔧' },
  { id: 'commands', label: 'Commands', icon: '⌨️' },
  { id: 'themes', label: 'Themes', icon: '🎨' },
  { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
];

export function CodeLabPluginMarketplace({
  plugins,
  installedPlugins,
  enabledPlugins,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onConfigure,
  isLoading = false,
}: CodeLabPluginMarketplaceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter plugins based on search and category
  const filteredPlugins = useMemo(() => {
    let result = [...plugins];

    // Filter by tab
    if (activeTab === 'installed') {
      result = result.filter((p) => installedPlugins.includes(p.metadata.id));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.metadata.name.toLowerCase().includes(query) ||
          p.metadata.description?.toLowerCase().includes(query) ||
          p.metadata.keywords?.some((k) => k.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((p) =>
        p.metadata.keywords?.some((k) => k.toLowerCase().includes(selectedCategory))
      );
    }

    return result;
  }, [plugins, activeTab, searchQuery, selectedCategory, installedPlugins]);

  // Handle install action
  const handleInstall = useCallback(
    async (pluginId: string) => {
      setActionLoading(pluginId);
      try {
        await onInstall(pluginId);
      } finally {
        setActionLoading(null);
      }
    },
    [onInstall]
  );

  // Handle uninstall action
  const handleUninstall = useCallback(
    async (pluginId: string) => {
      setActionLoading(pluginId);
      try {
        await onUninstall(pluginId);
      } finally {
        setActionLoading(null);
      }
    },
    [onUninstall]
  );

  // Handle enable action
  const handleEnable = useCallback(
    async (pluginId: string) => {
      setActionLoading(pluginId);
      try {
        await onEnable(pluginId);
      } finally {
        setActionLoading(null);
      }
    },
    [onEnable]
  );

  // Handle disable action
  const handleDisable = useCallback(
    async (pluginId: string) => {
      setActionLoading(pluginId);
      try {
        await onDisable(pluginId);
      } finally {
        setActionLoading(null);
      }
    },
    [onDisable]
  );

  // Render plugin card
  const renderPluginCard = (plugin: Plugin) => {
    const isInstalled = installedPlugins.includes(plugin.metadata.id);
    const isEnabled = enabledPlugins.includes(plugin.metadata.id);
    const isActionLoading = actionLoading === plugin.metadata.id;

    return (
      <div
        key={plugin.metadata.id}
        className={`plugin-card ${selectedPlugin?.metadata.id === plugin.metadata.id ? 'selected' : ''}`}
        onClick={() => setSelectedPlugin(plugin)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedPlugin(plugin)}
      >
        <div className="plugin-header">
          <div className="plugin-icon">{plugin.metadata.name.charAt(0).toUpperCase()}</div>
          <div className="plugin-info">
            <h3 className="plugin-name">{plugin.metadata.name}</h3>
            <span className="plugin-version">v{plugin.metadata.version}</span>
          </div>
          <div className="plugin-status">
            {isEnabled && <span className="status-badge enabled">Enabled</span>}
            {isInstalled && !isEnabled && <span className="status-badge installed">Installed</span>}
          </div>
        </div>

        <p className="plugin-description">
          {plugin.metadata.description || 'No description available'}
        </p>

        {plugin.metadata.keywords && plugin.metadata.keywords.length > 0 && (
          <div className="plugin-tags">
            {plugin.metadata.keywords.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="plugin-stats">
          {plugin.toolCount !== undefined && (
            <span className="stat">🔧 {plugin.toolCount} tools</span>
          )}
          {plugin.commandCount !== undefined && (
            <span className="stat">⌨️ {plugin.commandCount} commands</span>
          )}
          {plugin.downloads !== undefined && (
            <span className="stat">📥 {plugin.downloads.toLocaleString()}</span>
          )}
        </div>

        <div className="plugin-actions">
          {!isInstalled ? (
            <button
              className="action-btn install"
              onClick={(e) => {
                e.stopPropagation();
                handleInstall(plugin.metadata.id);
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Installing...' : 'Install'}
            </button>
          ) : (
            <>
              <button
                className={`action-btn ${isEnabled ? 'disable' : 'enable'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEnabled) {
                    handleDisable(plugin.metadata.id);
                  } else {
                    handleEnable(plugin.metadata.id);
                  }
                }}
                disabled={isActionLoading}
              >
                {isActionLoading ? '...' : isEnabled ? 'Disable' : 'Enable'}
              </button>
              <button
                className="action-btn settings"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigure(plugin.metadata.id);
                }}
                aria-label="Configure plugin"
              >
                ⚙️
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render plugin detail panel
  const renderDetailPanel = () => {
    if (!selectedPlugin) {
      return (
        <div className="detail-empty">
          <div className="empty-icon">📦</div>
          <p>Select a plugin to view details</p>
        </div>
      );
    }

    const plugin = selectedPlugin;
    const isInstalled = installedPlugins.includes(plugin.metadata.id);
    const isEnabled = enabledPlugins.includes(plugin.metadata.id);
    const isActionLoading = actionLoading === plugin.metadata.id;

    return (
      <div className="plugin-detail">
        <div className="detail-header">
          <div className="detail-icon">{plugin.metadata.name.charAt(0).toUpperCase()}</div>
          <div className="detail-title">
            <h2>{plugin.metadata.name}</h2>
            <span className="version">v{plugin.metadata.version}</span>
            {plugin.metadata.author && <span className="author">by {plugin.metadata.author}</span>}
          </div>
        </div>

        <div className="detail-actions">
          {!isInstalled ? (
            <button
              className="primary-btn install"
              onClick={() => handleInstall(plugin.metadata.id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Installing...' : 'Install Plugin'}
            </button>
          ) : (
            <>
              <button
                className={`primary-btn ${isEnabled ? 'disable' : 'enable'}`}
                onClick={() =>
                  isEnabled ? handleDisable(plugin.metadata.id) : handleEnable(plugin.metadata.id)
                }
                disabled={isActionLoading}
              >
                {isActionLoading ? '...' : isEnabled ? 'Disable' : 'Enable'}
              </button>
              <button className="secondary-btn" onClick={() => onConfigure(plugin.metadata.id)}>
                Configure
              </button>
              <button
                className="danger-btn"
                onClick={() => handleUninstall(plugin.metadata.id)}
                disabled={isActionLoading}
              >
                Uninstall
              </button>
            </>
          )}
        </div>

        <div className="detail-section">
          <h3>Description</h3>
          <p>{plugin.metadata.description || 'No description available'}</p>
        </div>

        {plugin.metadata.keywords && plugin.metadata.keywords.length > 0 && (
          <div className="detail-section">
            <h3>Tags</h3>
            <div className="tags-list">
              {plugin.metadata.keywords.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="detail-section">
          <h3>Details</h3>
          <dl className="details-list">
            <dt>Version</dt>
            <dd>{plugin.metadata.version}</dd>
            {plugin.metadata.author && (
              <>
                <dt>Author</dt>
                <dd>{plugin.metadata.author}</dd>
              </>
            )}
            {plugin.metadata.license && (
              <>
                <dt>License</dt>
                <dd>{plugin.metadata.license}</dd>
              </>
            )}
            {plugin.metadata.homepage && (
              <>
                <dt>Homepage</dt>
                <dd>
                  <a href={plugin.metadata.homepage} target="_blank" rel="noopener noreferrer">
                    {plugin.metadata.homepage}
                  </a>
                </dd>
              </>
            )}
            <dt>Scope</dt>
            <dd>{plugin.scope === 'project' ? 'Project' : 'User'}</dd>
          </dl>
        </div>

        {plugin.error && (
          <div className="detail-section error">
            <h3>Error</h3>
            <p className="error-message">{plugin.error}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="plugin-marketplace">
      <div className="marketplace-header">
        <h1>Plugin Marketplace</h1>
        <p>Discover and install plugins to extend Code Lab</p>
      </div>

      <div className="marketplace-toolbar">
        <div className="tabs" role="tablist" aria-label="Plugin views">
          <button
            className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
            role="tab"
            aria-selected={activeTab === 'browse'}
          >
            Browse
          </button>
          <button
            className={`tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
            role="tab"
            aria-selected={activeTab === 'installed'}
          >
            Installed ({installedPlugins.length})
          </button>
        </div>

        <div className="search-box">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search plugins"
          />
        </div>
      </div>

      <div className="marketplace-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-label">{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="marketplace-content">
        <div className="plugin-list">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading plugins...</p>
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div className="empty-state">
              <p>No plugins found</p>
              <span>Try a different search or category</span>
            </div>
          ) : (
            filteredPlugins.map(renderPluginCard)
          )}
        </div>

        <div className="detail-panel">{renderDetailPanel()}</div>
      </div>

      <style jsx>{`
        .plugin-marketplace {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--cl-bg-primary, #ffffff);
          color: var(--cl-text-primary, #1a1f36);
        }

        .marketplace-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .marketplace-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 0.25rem;
        }

        .marketplace-header p {
          color: var(--cl-text-secondary, #6b7280);
          margin: 0;
        }

        .marketplace-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          gap: 1rem;
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
        }

        .tab {
          padding: 0.5rem 1rem;
          background: none;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cl-text-secondary, #6b7280);
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .tab.active {
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
          border-radius: 8px;
          flex: 1;
          max-width: 300px;
        }

        .search-icon {
          width: 18px;
          height: 18px;
          color: var(--cl-text-muted, #9ca3af);
        }

        .search-box input {
          flex: 1;
          border: none;
          background: none;
          font-size: 0.875rem;
          color: var(--cl-text-primary, #1a1f36);
          outline: none;
        }

        .marketplace-categories {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 2rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          overflow-x: auto;
        }

        .category-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: none;
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
          border-radius: 16px;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #6b7280);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .category-btn:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .category-btn.active {
          background: var(--cl-accent-primary, #1e3a5f);
          border-color: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .marketplace-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .plugin-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          align-content: start;
        }

        .plugin-card {
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .plugin-card:hover {
          border-color: var(--cl-accent-primary, #1e3a5f);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .plugin-card.selected {
          border-color: var(--cl-accent-primary, #1e3a5f);
          background: var(--cl-accent-bg, #f0f4f8);
        }

        .plugin-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .plugin-icon {
          width: 40px;
          height: 40px;
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.25rem;
        }

        .plugin-info {
          flex: 1;
        }

        .plugin-name {
          font-size: 0.9375rem;
          font-weight: 600;
          margin: 0;
        }

        .plugin-version {
          font-size: 0.75rem;
          color: var(--cl-text-muted, #9ca3af);
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .status-badge.enabled {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.installed {
          background: #dbeafe;
          color: #1e40af;
        }

        .plugin-description {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #6b7280);
          margin: 0 0 0.75rem;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .plugin-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-bottom: 0.75rem;
        }

        .tag {
          padding: 0.125rem 0.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: var(--cl-text-secondary, #6b7280);
        }

        .plugin-stats {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: var(--cl-text-muted, #9ca3af);
          margin-bottom: 0.75rem;
        }

        .plugin-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.install {
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .action-btn.install:hover:not(:disabled) {
          background: var(--cl-accent-secondary, #2d4a6f);
        }

        .action-btn.enable {
          background: #22c55e;
          color: white;
        }

        .action-btn.disable {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-primary, #1a1f36);
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
        }

        .action-btn.settings {
          padding: 0.375rem 0.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .detail-panel {
          width: 360px;
          border-left: 1px solid var(--cl-border-primary, #e5e7eb);
          overflow-y: auto;
        }

        .detail-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--cl-text-muted, #9ca3af);
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .plugin-detail {
          padding: 1.5rem;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .detail-icon {
          width: 56px;
          height: 56px;
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.5rem;
        }

        .detail-title h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .detail-title .version {
          font-size: 0.75rem;
          color: var(--cl-text-muted, #9ca3af);
          margin-left: 0.5rem;
        }

        .detail-title .author {
          display: block;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #6b7280);
          margin-top: 0.25rem;
        }

        .detail-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .primary-btn {
          flex: 1;
          padding: 0.625rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .primary-btn.install,
        .primary-btn.enable {
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .primary-btn.disable {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-primary, #1a1f36);
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
        }

        .secondary-btn {
          padding: 0.625rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-secondary, #e5e7eb);
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .danger-btn {
          padding: 0.625rem 1rem;
          background: transparent;
          border: 1px solid var(--cl-error, #ef4444);
          color: var(--cl-error, #ef4444);
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .danger-btn:hover {
          background: #fef2f2;
        }

        .detail-section {
          margin-bottom: 1.5rem;
        }

        .detail-section h3 {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cl-text-muted, #9ca3af);
          margin: 0 0 0.75rem;
        }

        .detail-section p {
          font-size: 0.875rem;
          line-height: 1.6;
          margin: 0;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .details-list {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.5rem 1rem;
          font-size: 0.8125rem;
          margin: 0;
        }

        .details-list dt {
          color: var(--cl-text-muted, #9ca3af);
        }

        .details-list dd {
          margin: 0;
        }

        .details-list a {
          color: var(--cl-accent-primary, #1e3a5f);
          text-decoration: none;
        }

        .details-list a:hover {
          text-decoration: underline;
        }

        .detail-section.error {
          background: #fef2f2;
          border-radius: 8px;
          padding: 1rem;
        }

        .error-message {
          color: var(--cl-error, #ef4444);
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
          color: var(--cl-text-muted, #9ca3af);
          grid-column: 1 / -1;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--cl-border-secondary, #e5e7eb);
          border-top-color: var(--cl-accent-primary, #1e3a5f);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .marketplace-toolbar {
            flex-direction: column;
          }

          .search-box {
            max-width: 100%;
          }

          .detail-panel {
            display: none;
          }

          .plugin-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabPluginMarketplace;
