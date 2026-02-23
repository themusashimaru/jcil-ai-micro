'use client';

/**
 * CODE LAB COLLABORATION
 *
 * Real-time collaboration features that go BEYOND Claude Code.
 * True multi-user presence and shared coding experience.
 *
 * Features:
 * - Real-time cursor presence (see where others are)
 * - Live code sharing with conflict resolution
 * - User avatars and activity indicators
 * - Session invitation system
 * - Voice/video chat integration
 * - Shared terminal access
 * - Code annotations and comments
 * - Follow mode (follow another user's view)
 * - Activity feed
 * - Shared Claude interactions
 *
 * This is what makes Code Lab unique - true collaborative coding.
 */

import React, { useState, useCallback } from 'react';
import './code-lab-collaboration.css';
import { UserAvatar } from './CodeLabCollabUserAvatar';
import { UserList } from './CodeLabCollabUserList';
import { ActivityFeed } from './CodeLabCollabActivityFeed';
import { InvitePanel } from './CodeLabCollabInvitePanel';
import { AnnotationsPanel } from './CodeLabCollabAnnotationsPanel';

// ============================================================================
// TYPES
// ============================================================================

export type UserStatus = 'active' | 'idle' | 'away' | 'busy';
export type UserRole = 'owner' | 'editor' | 'viewer';
export type ActivityType =
  | 'join'
  | 'leave'
  | 'edit'
  | 'cursor'
  | 'comment'
  | 'ai_request'
  | 'file_open';

export interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  status: UserStatus;
  role: UserRole;
  cursor?: {
    file: string;
    line: number;
    column: number;
  };
  selection?: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  isTyping?: boolean;
  lastActivity: Date;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  user: CollabUser;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CodeAnnotation {
  id: string;
  file: string;
  line: number;
  column?: number;
  user: CollabUser;
  content: string;
  timestamp: Date;
  resolved?: boolean;
  replies: Array<{
    id: string;
    user: CollabUser;
    content: string;
    timestamp: Date;
  }>;
}

export interface CollabSession {
  id: string;
  name: string;
  owner: CollabUser;
  users: CollabUser[];
  activities: ActivityItem[];
  annotations: CodeAnnotation[];
  createdAt: Date;
  isLive: boolean;
}

export interface CodeLabCollaborationProps {
  session: CollabSession;
  currentUser: CollabUser;
  onInvite: (email: string) => void;
  onKickUser: (userId: string) => void;
  onChangeRole: (userId: string, role: UserRole) => void;
  onFollow: (userId: string) => void;
  onUnfollow: () => void;
  onAddAnnotation: (file: string, line: number, content: string) => void;
  onResolveAnnotation: (id: string) => void;
  onReplyAnnotation: (id: string, content: string) => void;
  followingUserId?: string;
  className?: string;
}

// ============================================================================
// CURSOR INDICATOR (for code editor)
// ============================================================================

export interface CursorIndicatorProps {
  user: CollabUser;
  style?: React.CSSProperties;
}

export const CursorIndicator = React.memo(function CursorIndicator({
  user,
  style,
}: CursorIndicatorProps) {
  return (
    <div
      className="cursor-indicator"
      style={
        {
          ...style,
          '--cursor-color': user.color,
        } as React.CSSProperties
      }
    >
      <div className="cursor-caret" />
      <div className="cursor-label">{user.name}</div>
    </div>
  );
});

// ============================================================================
// SELECTION HIGHLIGHT (for code editor)
// ============================================================================

export interface SelectionHighlightProps {
  user: CollabUser;
  style?: React.CSSProperties;
}

export const SelectionHighlight = React.memo(function SelectionHighlight({
  user,
  style,
}: SelectionHighlightProps) {
  return (
    <div
      className="selection-highlight"
      style={{
        ...style,
        backgroundColor: `${user.color}30`,
        borderColor: user.color,
      }}
    />
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeLabCollaboration({
  session,
  currentUser,
  onInvite,
  onKickUser,
  onChangeRole,
  onFollow,
  onUnfollow,
  onAddAnnotation: _onAddAnnotation,
  onResolveAnnotation,
  onReplyAnnotation,
  followingUserId,
  className = '',
}: CodeLabCollaborationProps) {
  void _onAddAnnotation; // Reserved for future inline annotation
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'annotations'>('users');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const handleFollow = useCallback(
    (userId: string) => {
      if (followingUserId === userId) {
        onUnfollow();
      } else {
        onFollow(userId);
      }
    },
    [followingUserId, onFollow, onUnfollow]
  );

  const isOwner = currentUser.role === 'owner';

  return (
    <div className={`code-lab-collab ${className}`}>
      {/* Header */}
      <div className="collab-header">
        <div className="collab-title">
          <span className="collab-title-icon">👥</span>
          <span className="collab-title-text">Collaboration</span>
          {session.isLive && (
            <span className="collab-live">
              <span className="live-dot" />
              Live
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="user-avatars">
            {session.users.slice(0, 5).map((user) => (
              <UserAvatar key={user.id} user={user} size="sm" />
            ))}
          </div>
          <span className="user-count">
            {session.users.length} {session.users.length === 1 ? 'user' : 'users'}
          </span>
          {isOwner && (
            <button className="invite-trigger" onClick={() => setIsInviteOpen(!isInviteOpen)}>
              + Invite
            </button>
          )}
        </div>
      </div>

      {/* Invite Panel */}
      {isInviteOpen && isOwner && <InvitePanel onInvite={onInvite} sessionId={session.id} />}

      {/* Tabs */}
      <div className="collab-tabs">
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
          <span className="tab-badge">{session.users.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
        <button
          className={`tab-btn ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          Annotations
          <span className="tab-badge">{session.annotations.filter((a) => !a.resolved).length}</span>
        </button>
      </div>

      {/* Content */}
      <div className="collab-content">
        {activeTab === 'users' && (
          <UserList
            users={session.users}
            currentUserId={currentUser.id}
            onFollow={handleFollow}
            followingUserId={followingUserId}
            onKick={isOwner ? onKickUser : undefined}
            onChangeRole={isOwner ? onChangeRole : undefined}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'activity' && <ActivityFeed activities={session.activities} />}
        {activeTab === 'annotations' && (
          <AnnotationsPanel
            annotations={session.annotations}
            currentUser={currentUser}
            onResolve={onResolveAnnotation}
            onReply={onReplyAnnotation}
          />
        )}
      </div>
    </div>
  );
}

export default CodeLabCollaboration;
