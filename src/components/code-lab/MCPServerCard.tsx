'use client';

import { useState } from 'react';
import type { MCPServer } from './CodeLabMCPSettings';
import {
  ServerIcon,
  ToolIcon,
  TrashIcon,
  ChevronIcon,
  StatusBadge,
  ToggleSwitch,
} from './MCPPrimitives';

export function ServerCard({
  server,
  onToggle,
  onRemove,
  isToggling,
}: {
  server: MCPServer;
  onToggle: (enabled: boolean) => void;
  onRemove?: () => void;
  isToggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTools = server.tools.length > 0;

  return (
    <div className="server-card">
      <div className="server-header">
        <div className="server-info">
          {hasTools && (
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              <ChevronIcon expanded={expanded} />
            </button>
          )}
          <div className="server-icon">
            <ServerIcon />
          </div>
          <div className="server-details">
            <div className="server-name-row">
              <span className="server-name">{server.name}</span>
              <StatusBadge status={server.status} />
            </div>
            {server.description && <p className="server-description">{server.description}</p>}
            {server.error && <p className="server-error">{server.error}</p>}
          </div>
        </div>
        <div className="server-actions">
          {!server.builtIn && onRemove && (
            <button className="remove-btn" onClick={onRemove} title="Remove server">
              <TrashIcon />
            </button>
          )}
          <ToggleSwitch
            checked={server.enabled}
            onChange={onToggle}
            disabled={isToggling || server.status === 'starting'}
          />
        </div>
      </div>

      {/* Tools list */}
      {expanded && hasTools && (
        <div className="server-tools">
          <div className="tools-header">
            <ToolIcon />
            <span>Available Tools ({server.tools.length})</span>
          </div>
          <div className="tools-list">
            {server.tools.map((tool) => (
              <div key={tool.name} className="tool-item">
                <code className="tool-name">{tool.name}</code>
                <span className="tool-description">{tool.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .server-card {
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }

        .server-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .server-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1rem;
          gap: 1rem;
        }

        .server-info {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
        }

        .expand-btn {
          padding: 0.25rem;
          background: none;
          border: none;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 4px;
          margin-top: 2px;
        }

        .expand-btn:hover {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-primary, #1a1f36);
        }

        .server-icon {
          width: 36px;
          height: 36px;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cl-accent-primary, #1e3a5f);
          flex-shrink: 0;
        }

        .server-details {
          flex: 1;
          min-width: 0;
        }

        .server-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .server-name {
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
          font-size: 0.9375rem;
        }

        .server-description {
          margin: 0.25rem 0 0 0;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.4;
        }

        .server-error {
          margin: 0.25rem 0 0 0;
          font-size: 0.75rem;
          color: #ef4444;
        }

        .server-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .remove-btn {
          padding: 0.375rem;
          background: none;
          border: none;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .remove-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .server-tools {
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          padding: 0.75rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .tools-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-secondary, #374151);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin-bottom: 0.5rem;
        }

        .tools-list {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .tool-item {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          padding: 0.5rem;
          background: var(--cl-bg-primary, #ffffff);
          border-radius: 6px;
        }

        .tool-name {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.75rem;
          color: var(--cl-accent-primary, #1e3a5f);
          background: color-mix(in srgb, var(--cl-accent-primary, #1e3a5f) 10%, transparent);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          width: fit-content;
        }

        .tool-description {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          line-height: 1.4;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        :global(.spinner) {
          width: 10px;
          height: 10px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
