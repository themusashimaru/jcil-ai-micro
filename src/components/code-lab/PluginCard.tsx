'use client';

import type { Plugin } from './marketplace-types';

interface PluginCardProps {
  plugin: Plugin;
  isSelected: boolean;
  isInstalled: boolean;
  isEnabled: boolean;
  isActionLoading: boolean;
  onSelect: (plugin: Plugin) => void;
  onInstall: (pluginId: string) => void;
  onEnable: (pluginId: string) => void;
  onDisable: (pluginId: string) => void;
  onConfigure: (pluginId: string) => void;
}

export function PluginCard({
  plugin,
  isSelected,
  isInstalled,
  isEnabled,
  isActionLoading,
  onSelect,
  onInstall,
  onEnable,
  onDisable,
  onConfigure,
}: PluginCardProps) {
  return (
    <div
      className={`plugin-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(plugin)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(plugin)}
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
              onInstall(plugin.metadata.id);
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
                  onDisable(plugin.metadata.id);
                } else {
                  onEnable(plugin.metadata.id);
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
}
