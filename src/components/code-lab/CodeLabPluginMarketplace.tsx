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
import type { Plugin, FilterCategory, TabType } from './marketplace-types';
import { CATEGORIES } from './marketplace-types';
import { PluginCard } from './PluginCard';
import { PluginDetailPanel } from './PluginDetailPanel';
import { MarketplaceStyles } from './MarketplaceStyles';

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
      } catch {
        // Error handled by caller
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
      } catch {
        // Error handled by caller
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
      } catch {
        // Error handled by caller
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
      } catch {
        // Error handled by caller
      } finally {
        setActionLoading(null);
      }
    },
    [onDisable]
  );

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
            filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.metadata.id}
                plugin={plugin}
                isSelected={selectedPlugin?.metadata.id === plugin.metadata.id}
                isInstalled={installedPlugins.includes(plugin.metadata.id)}
                isEnabled={enabledPlugins.includes(plugin.metadata.id)}
                isActionLoading={actionLoading === plugin.metadata.id}
                onSelect={setSelectedPlugin}
                onInstall={handleInstall}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onConfigure={onConfigure}
              />
            ))
          )}
        </div>

        <div className="detail-panel">
          <PluginDetailPanel
            selectedPlugin={selectedPlugin}
            installedPlugins={installedPlugins}
            enabledPlugins={enabledPlugins}
            actionLoading={actionLoading}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onEnable={handleEnable}
            onDisable={handleDisable}
            onConfigure={onConfigure}
          />
        </div>
      </div>

      <MarketplaceStyles />
    </div>
  );
}

export default CodeLabPluginMarketplace;
