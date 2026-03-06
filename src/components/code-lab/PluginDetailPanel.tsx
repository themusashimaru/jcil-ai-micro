'use client';

import type { Plugin } from './marketplace-types';

interface PluginDetailPanelProps {
  selectedPlugin: Plugin | null;
  installedPlugins: string[];
  enabledPlugins: string[];
  actionLoading: string | null;
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
  onEnable: (pluginId: string) => void;
  onDisable: (pluginId: string) => void;
  onConfigure: (pluginId: string) => void;
}

export function PluginDetailPanel({
  selectedPlugin,
  installedPlugins,
  enabledPlugins,
  actionLoading,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onConfigure,
}: PluginDetailPanelProps) {
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
            onClick={() => onInstall(plugin.metadata.id)}
            disabled={isActionLoading}
          >
            {isActionLoading ? 'Installing...' : 'Install Plugin'}
          </button>
        ) : (
          <>
            <button
              className={`primary-btn ${isEnabled ? 'disable' : 'enable'}`}
              onClick={() =>
                isEnabled ? onDisable(plugin.metadata.id) : onEnable(plugin.metadata.id)
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
              onClick={() => onUninstall(plugin.metadata.id)}
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
}
