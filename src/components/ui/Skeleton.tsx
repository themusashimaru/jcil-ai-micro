'use client';

/**
 * SKELETON LOADER COMPONENT
 *
 * Professional shimmer loading states for:
 * - Message threads
 * - Session lists
 * - File trees
 * - Cards and content blocks
 *
 * Follows Material Design and Apple HIG patterns.
 */

import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  width,
  height,
  borderRadius,
  className = '',
  variant = 'text',
  animation = 'wave',
}: SkeletonProps) {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'circular':
        return {
          borderRadius: '50%',
          width: width || 40,
          height: height || 40,
        };
      case 'rectangular':
        return {
          borderRadius: borderRadius || 0,
          width: width || '100%',
          height: height || 20,
        };
      case 'rounded':
        return {
          borderRadius: borderRadius || 8,
          width: width || '100%',
          height: height || 20,
        };
      case 'text':
      default:
        return {
          borderRadius: borderRadius || 4,
          width: width || '100%',
          height: height || '1em',
        };
    }
  };

  return (
    <span
      className={`skeleton skeleton-${animation} ${className}`}
      style={getVariantStyles()}
      aria-hidden="true"
    >
      <style jsx>{`
        .skeleton {
          display: inline-block;
          background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
          background-size: 200% 100%;
        }

        .skeleton-wave {
          animation: skeleton-wave 1.5s ease-in-out infinite;
        }

        .skeleton-pulse {
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }

        .skeleton-none {
          animation: none;
        }

        @keyframes skeleton-wave {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes skeleton-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .skeleton {
            background: linear-gradient(90deg, #374151 0%, #4b5563 50%, #374151 100%);
            background-size: 200% 100%;
          }
        }
      `}</style>
    </span>
  );
}

/**
 * Message skeleton - mimics a chat message bubble
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`message-skeleton ${isUser ? 'user' : 'assistant'}`} aria-hidden="true">
      {!isUser && (
        <div className="avatar">
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      )}
      <div className="content">
        <Skeleton variant="text" width="30%" height={14} />
        <div className="lines">
          <Skeleton variant="text" width="100%" height={16} />
          <Skeleton variant="text" width="85%" height={16} />
          <Skeleton variant="text" width="70%" height={16} />
        </div>
      </div>

      <style jsx>{`
        .message-skeleton {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          max-width: 720px;
        }

        .message-skeleton.user {
          justify-content: flex-end;
          margin-left: auto;
        }

        .avatar {
          flex-shrink: 0;
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .message-skeleton.user .content {
          align-items: flex-end;
          max-width: 400px;
        }

        .lines {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          background: #f3f4f6;
          padding: 0.75rem 1rem;
          border-radius: 12px;
        }

        .message-skeleton.user .lines {
          background: #1e3a5f;
        }

        .message-skeleton.user .lines :global(.skeleton) {
          background: linear-gradient(90deg, #2d4a6f 0%, #3d5a7f 50%, #2d4a6f 100%);
          background-size: 200% 100%;
        }
      `}</style>
    </div>
  );
}

/**
 * Thread skeleton - shows loading state for entire message thread
 */
export function ThreadSkeleton({ messageCount = 3 }: { messageCount?: number }) {
  return (
    <div className="thread-skeleton" role="status" aria-label="Loading conversation">
      {Array.from({ length: messageCount }).map((_, i) => (
        <MessageSkeleton key={i} isUser={i % 2 === 1} />
      ))}
      <span className="sr-only">Loading messages...</span>

      <style jsx>{`
        .thread-skeleton {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Session item skeleton - mimics a session list item
 */
export function SessionSkeleton() {
  return (
    <div className="session-skeleton" aria-hidden="true">
      <Skeleton variant="circular" width={8} height={8} />
      <div className="info">
        <Skeleton variant="text" width="70%" height={14} />
        <Skeleton variant="text" width="50%" height={12} />
      </div>

      <style jsx>{`
        .session-skeleton {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
        }

        .info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
      `}</style>
    </div>
  );
}

/**
 * Sessions list skeleton
 */
export function SessionsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="sessions-skeleton" role="status" aria-label="Loading sessions">
      {Array.from({ length: count }).map((_, i) => (
        <SessionSkeleton key={i} />
      ))}
      <span className="sr-only">Loading sessions...</span>

      <style jsx>{`
        .sessions-skeleton {
          display: flex;
          flex-direction: column;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * File tree skeleton
 */
export function FileTreeSkeleton({ itemCount = 6 }: { itemCount?: number }) {
  return (
    <div className="file-tree-skeleton" role="status" aria-label="Loading files">
      {Array.from({ length: itemCount }).map((_, i) => (
        <div key={i} className="file-item" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
          <Skeleton variant="rectangular" width={16} height={16} borderRadius={2} />
          <Skeleton variant="text" width={`${60 + Math.random() * 40}%`} height={14} />
        </div>
      ))}
      <span className="sr-only">Loading file tree...</span>

      <style jsx>{`
        .file-tree-skeleton {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          padding: 0.5rem;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Card skeleton - general purpose card loading state
 */
export function CardSkeleton({
  showImage = false,
  lines = 3,
}: {
  showImage?: boolean;
  lines?: number;
}) {
  return (
    <div className="card-skeleton" aria-hidden="true">
      {showImage && (
        <div className="image">
          <Skeleton variant="rectangular" width="100%" height={180} borderRadius={8} />
        </div>
      )}
      <div className="content">
        <Skeleton variant="text" width="60%" height={20} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${80 - i * 10}%`} height={14} />
        ))}
      </div>

      <style jsx>{`
        .card-skeleton {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

/**
 * Code block skeleton
 */
export function CodeBlockSkeleton({ lines = 8 }: { lines?: number }) {
  return (
    <div className="code-skeleton" aria-hidden="true">
      <div className="header">
        <Skeleton variant="text" width={60} height={12} />
        <Skeleton variant="rectangular" width={20} height={20} borderRadius={4} />
      </div>
      <div className="lines">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="line" style={{ paddingLeft: `${(i % 4) * 12}px` }}>
            <Skeleton variant="text" width={20} height={14} />
            <Skeleton variant="text" width={`${30 + Math.random() * 60}%`} height={14} />
          </div>
        ))}
      </div>

      <style jsx>{`
        .code-skeleton {
          background: #1a1f36;
          border-radius: 8px;
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #0f1219;
        }

        .header :global(.skeleton) {
          background: linear-gradient(90deg, #2d3348 0%, #3d4358 50%, #2d3348 100%);
          background-size: 200% 100%;
        }

        .lines {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.75rem;
        }

        .line {
          display: flex;
          gap: 0.75rem;
        }

        .lines :global(.skeleton) {
          background: linear-gradient(90deg, #2d3348 0%, #3d4358 50%, #2d3348 100%);
          background-size: 200% 100%;
        }
      `}</style>
    </div>
  );
}

export default Skeleton;
