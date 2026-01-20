'use client';

/**
 * CODE LAB PROVIDER STATUS
 *
 * Compact status indicator showing current AI provider.
 * Features:
 * - Color-coded provider indicator
 * - Tooltip with provider info
 * - Animated pulse when processing
 *
 * @version 1.0.0
 */

import { useState } from 'react';
import type { ProviderId } from '@/lib/ai/providers';

interface ProviderInfo {
  id: ProviderId;
  name: string;
  icon: string;
  color: string;
}

const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    icon: '🟣',
    color: '#8B5CF6',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    color: '#10B981',
  },
  xai: {
    id: 'xai',
    name: 'xAI Grok',
    icon: '⚡',
    color: '#F59E0B',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔵',
    color: '#3B82F6',
  },
};

interface CodeLabProviderStatusProps {
  providerId: ProviderId;
  isProcessing?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CodeLabProviderStatus({
  providerId,
  isProcessing = false,
  onClick,
  className = '',
}: CodeLabProviderStatusProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const provider = PROVIDER_INFO[providerId];

  return (
    <div
      className={`provider-status ${isProcessing ? 'processing' : ''} ${onClick ? 'clickable' : ''} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className="status-dot" style={{ backgroundColor: provider.color }} />
      <span className="status-icon">{provider.icon}</span>

      {showTooltip && (
        <div className="status-tooltip">
          <span className="tooltip-title">AI Provider</span>
          <span className="tooltip-name">{provider.name}</span>
          {isProcessing && <span className="tooltip-status">Processing...</span>}
        </div>
      )}

      <style jsx>{`
        .provider-status {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          font-size: 0.75rem;
          transition: all 0.15s ease;
        }

        .provider-status.clickable {
          cursor: pointer;
        }

        .provider-status.clickable:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-border-secondary, #d1d5db);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .provider-status.processing .status-dot {
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }

        .status-icon {
          font-size: 0.875rem;
          line-height: 1;
        }

        .status-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5rem 0.75rem;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          white-space: nowrap;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          animation: fadeIn 0.15s ease;
        }

        .status-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: var(--cl-bg-primary, #ffffff);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .tooltip-title {
          font-size: 0.6875rem;
          color: var(--cl-text-tertiary, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .tooltip-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .tooltip-status {
          font-size: 0.75rem;
          color: var(--cl-text-secondary, #374151);
          font-style: italic;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .provider-status {
            background: var(--cl-bg-secondary);
            border-color: var(--cl-border-primary);
          }

          .status-tooltip {
            background: var(--cl-bg-primary);
            border-color: var(--cl-border-primary);
          }
        }

        /* Compact mode on mobile */
        @media (max-width: 480px) {
          .provider-status {
            padding: 0.1875rem 0.375rem;
          }

          .status-icon {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabProviderStatus;
