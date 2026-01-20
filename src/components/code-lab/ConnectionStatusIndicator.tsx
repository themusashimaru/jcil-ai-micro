/**
 * CONNECTION STATUS INDICATOR - MEDIUM-012 FIX
 *
 * Visual indicator for WebSocket connection status:
 * - Connected: Green dot
 * - Connecting: Yellow pulsing dot
 * - Disconnected: Gray dot
 * - Error: Red dot
 *
 * Features:
 * - Accessible with ARIA labels
 * - Tooltip on hover
 * - Compact and minimal design
 */

'use client';

import React from 'react';
import type { ConnectionState } from '@/lib/realtime';

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionStatusIndicatorProps {
  /** Current connection state */
  state: ConnectionState;
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text next to indicator */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when clicked (e.g., to retry connection) */
  onClick?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATE_CONFIG: Record<
  ConnectionState,
  { label: string; color: string; bgColor: string; description: string }
> = {
  connected: {
    label: 'Connected',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    description: 'Real-time connection active',
  },
  connecting: {
    label: 'Connecting',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    description: 'Establishing connection...',
  },
  disconnected: {
    label: 'Disconnected',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    description: 'Not connected',
  },
  error: {
    label: 'Error',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    description: 'Connection error - click to retry',
  },
};

const SIZE_CONFIG = {
  sm: { dot: 6, fontSize: '0.6875rem', padding: '0.125rem 0.375rem', gap: '0.25rem' },
  md: { dot: 8, fontSize: '0.75rem', padding: '0.25rem 0.5rem', gap: '0.375rem' },
  lg: { dot: 10, fontSize: '0.8125rem', padding: '0.375rem 0.625rem', gap: '0.5rem' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ConnectionStatusIndicator({
  state,
  size = 'sm',
  showLabel = false,
  className = '',
  onClick,
}: ConnectionStatusIndicatorProps) {
  const config = STATE_CONFIG[state];
  const sizeConfig = SIZE_CONFIG[size];
  const isInteractive = !!onClick;
  const isConnecting = state === 'connecting';

  const Element = isInteractive ? 'button' : 'div';

  return (
    <>
      <Element
        className={`connection-status-indicator ${state} ${className}`}
        onClick={onClick}
        role={isInteractive ? 'button' : 'status'}
        aria-label={`Connection status: ${config.label}. ${config.description}`}
        aria-live="polite"
        title={config.description}
        type={isInteractive ? 'button' : undefined}
      >
        <span className={`status-dot ${isConnecting ? 'pulse' : ''}`} aria-hidden="true" />
        {showLabel && <span className="status-label">{config.label}</span>}
      </Element>

      <style jsx>{`
        .connection-status-indicator {
          display: inline-flex;
          align-items: center;
          gap: ${sizeConfig.gap};
          padding: ${showLabel ? sizeConfig.padding : '0'};
          background: ${showLabel ? config.bgColor : 'transparent'};
          border: none;
          border-radius: 9999px;
          font-size: ${sizeConfig.fontSize};
          font-weight: 500;
          color: ${config.color};
          cursor: ${isInteractive ? 'pointer' : 'default'};
          transition: all 0.2s ease;
          outline: none;
          user-select: none;
        }

        .connection-status-indicator:focus-visible {
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        }

        .connection-status-indicator.error:hover {
          background: ${showLabel ? 'rgba(239, 68, 68, 0.25)' : 'transparent'};
        }

        .status-dot {
          width: ${sizeConfig.dot}px;
          height: ${sizeConfig.dot}px;
          border-radius: 50%;
          background-color: ${config.color};
          flex-shrink: 0;
        }

        .status-dot.pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }

        .status-label {
          white-space: nowrap;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .connection-status-indicator {
            background: ${showLabel ? config.bgColor : 'transparent'};
          }
        }
      `}</style>
    </>
  );
}

// ============================================================================
// HOOK: useConnectionStatusMessage
// ============================================================================

/**
 * Hook to get connection status message for display
 *
 * @example
 * const message = useConnectionStatusMessage(connectionState);
 * // "Connected" | "Connecting..." | "Disconnected" | "Connection error"
 */
export function useConnectionStatusMessage(state: ConnectionState): string {
  return STATE_CONFIG[state].label;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConnectionStatusIndicator;
