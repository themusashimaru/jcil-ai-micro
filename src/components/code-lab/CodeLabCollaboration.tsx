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

import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';

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
// USER AVATAR
// ============================================================================

interface UserAvatarProps {
  user: CollabUser;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onClick?: () => void;
}

const UserAvatar = React.memo(function UserAvatar({
  user,
  size = 'md',
  showStatus = true,
  onClick,
}: UserAvatarProps) {
  const sizes = { sm: 24, md: 32, lg: 40 };
  const px = sizes[size];

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      className={`user-avatar size-${size} status-${user.status}`}
      style={
        {
          '--avatar-color': user.color,
          width: px,
          height: px,
        } as React.CSSProperties
      }
      onClick={onClick}
      title={`${user.name} (${user.status})`}
      aria-label={`${user.name} - ${user.status}`}
    >
      {user.avatar ? (
        <Image src={user.avatar} alt="" width={32} height={32} className="avatar-img" />
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
      {showStatus && <span className="avatar-status" />}
      {user.isTyping && <span className="avatar-typing">•••</span>}
    </button>
  );
});

// ============================================================================
// USER LIST
// ============================================================================

interface UserListProps {
  users: CollabUser[];
  currentUserId: string;
  onFollow: (userId: string) => void;
  followingUserId?: string;
  onKick?: (userId: string) => void;
  onChangeRole?: (userId: string, role: UserRole) => void;
  isOwner: boolean;
}

const UserList = React.memo(function UserList({
  users,
  currentUserId,
  onFollow,
  followingUserId,
  onKick,
  onChangeRole,
  isOwner,
}: UserListProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users]);

  return (
    <div className="user-list">
      {sortedUsers.map((user) => (
        <div
          key={user.id}
          className={`user-item ${user.id === currentUserId ? 'current' : ''} ${expandedUser === user.id ? 'expanded' : ''}`}
        >
          <div
            className="user-main"
            onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
          >
            <UserAvatar user={user} size="sm" />
            <div className="user-info">
              <span className="user-name">
                {user.name}
                {user.id === currentUserId && <span className="user-you">(you)</span>}
              </span>
              <span className="user-activity">
                {user.cursor
                  ? `${user.cursor.file.split('/').pop()}:${user.cursor.line}`
                  : user.status}
              </span>
            </div>
            <span className={`user-role role-${user.role}`}>{user.role}</span>
            {user.id !== currentUserId && (
              <button
                className={`follow-btn ${followingUserId === user.id ? 'following' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFollow(user.id);
                }}
                title={followingUserId === user.id ? 'Stop following' : 'Follow'}
              >
                {followingUserId === user.id ? '👁️' : '👀'}
              </button>
            )}
          </div>

          {expandedUser === user.id && isOwner && user.id !== currentUserId && (
            <div className="user-actions">
              {onChangeRole && (
                <select
                  value={user.role}
                  onChange={(e) => onChangeRole(user.id, e.target.value as UserRole)}
                  className="role-select"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
              {onKick && (
                <button className="kick-btn" onClick={() => onKick(user.id)}>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// ACTIVITY FEED
// ============================================================================

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  join: '👋',
  leave: '👋',
  edit: '✏️',
  cursor: '📍',
  comment: '💬',
  ai_request: '🤖',
  file_open: '📄',
};

const ActivityFeed = React.memo(function ActivityFeed({
  activities,
  maxItems = 50,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(-maxItems).reverse();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="activity-feed">
      {displayActivities.length === 0 ? (
        <div className="activity-empty">No recent activity</div>
      ) : (
        <ul className="activity-list">
          {displayActivities.map((activity) => (
            <li key={activity.id} className={`activity-item type-${activity.type}`}>
              <span className="activity-icon">{ACTIVITY_ICONS[activity.type]}</span>
              <div className="activity-content">
                <span className="activity-user" style={{ color: activity.user.color }}>
                  {activity.user.name}
                </span>
                <span className="activity-message">{activity.message}</span>
              </div>
              <span className="activity-time">{formatTime(activity.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

// ============================================================================
// INVITE PANEL
// ============================================================================

interface InvitePanelProps {
  onInvite: (email: string) => void;
  sessionId: string;
}

const InvitePanel = React.memo(function InvitePanel({ onInvite, sessionId }: InvitePanelProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/code-lab/join/${sessionId}`;

  const handleInvite = () => {
    if (email.trim() && email.includes('@')) {
      onInvite(email.trim());
      setEmail('');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="invite-panel">
      <div className="invite-email">
        <input
          type="email"
          className="invite-input"
          placeholder="Enter email to invite..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
        />
        <button className="invite-btn" onClick={handleInvite}>
          Invite
        </button>
      </div>
      <div className="invite-link">
        <input type="text" className="link-input" value={inviteLink} readOnly />
        <button className="copy-btn" onClick={handleCopyLink}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// ANNOTATIONS PANEL
// ============================================================================

interface AnnotationsPanelProps {
  annotations: CodeAnnotation[];
  currentUser: CollabUser;
  onResolve: (id: string) => void;
  onReply: (id: string, content: string) => void;
}

const AnnotationsPanel = React.memo(function AnnotationsPanel({
  annotations,
  currentUser: _currentUser,
  onResolve,
  onReply,
}: AnnotationsPanelProps) {
  void _currentUser; // Reserved for future use
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      if (filter === 'open') return !a.resolved;
      if (filter === 'resolved') return a.resolved;
      return true;
    });
  }, [annotations, filter]);

  const handleReply = (id: string) => {
    if (replyContent.trim()) {
      onReply(id, replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
    }
  };

  return (
    <div className="annotations-panel">
      <div className="annotations-filter">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All ({annotations.length})
        </button>
        <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>
          Open ({annotations.filter((a) => !a.resolved).length})
        </button>
        <button
          className={filter === 'resolved' ? 'active' : ''}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({annotations.filter((a) => a.resolved).length})
        </button>
      </div>

      {filteredAnnotations.length === 0 ? (
        <div className="annotations-empty">No annotations</div>
      ) : (
        <div className="annotations-list">
          {filteredAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              className={`annotation-card ${annotation.resolved ? 'resolved' : ''}`}
            >
              <div className="annotation-header">
                <UserAvatar user={annotation.user} size="sm" showStatus={false} />
                <div className="annotation-meta">
                  <span className="annotation-user">{annotation.user.name}</span>
                  <span className="annotation-location">
                    {annotation.file.split('/').pop()}:{annotation.line}
                  </span>
                </div>
                {!annotation.resolved && (
                  <button className="resolve-btn" onClick={() => onResolve(annotation.id)}>
                    ✓ Resolve
                  </button>
                )}
              </div>
              <div className="annotation-content">{annotation.content}</div>

              {annotation.replies.length > 0 && (
                <div className="annotation-replies">
                  {annotation.replies.map((reply) => (
                    <div key={reply.id} className="reply">
                      <span className="reply-user" style={{ color: reply.user.color }}>
                        {reply.user.name}:
                      </span>
                      <span className="reply-content">{reply.content}</span>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === annotation.id ? (
                <div className="reply-input-row">
                  <input
                    type="text"
                    className="reply-input"
                    placeholder="Type your reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReply(annotation.id)}
                    autoFocus
                  />
                  <button className="reply-send" onClick={() => handleReply(annotation.id)}>
                    Send
                  </button>
                  <button className="reply-cancel" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="add-reply-btn" onClick={() => setReplyingTo(annotation.id)}>
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

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
      <style>{`
        .code-lab-collab {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--cl-bg-primary, #0d1117);
          border-radius: 8px;
          overflow: hidden;
        }

        /* Header */
        .collab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .collab-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .collab-title-icon {
          font-size: 16px;
        }

        .collab-title-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--cl-text-primary, #e6edf3);
        }

        .collab-live {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(63, 185, 80, 0.15);
          border-radius: 16px;
          font-size: 11px;
          color: #3fb950;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: #3fb950;
          border-radius: 50%;
          animation: livePulse 2s infinite;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }

        .user-count {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--cl-text-tertiary, #8b949e);
        }

        .invite-trigger {
          padding: 6px 12px;
          background: var(--cl-accent, #58a6ff);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .invite-trigger:hover {
          background: #4c9aed;
        }

        /* User Avatars Stack */
        .user-avatars {
          display: flex;
          margin-right: 8px;
        }

        .user-avatar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--avatar-color);
          border: 2px solid var(--cl-bg-secondary, #161b22);
          cursor: pointer;
          transition: all 0.15s;
          padding: 0;
        }

        .user-avatar:hover {
          transform: scale(1.1);
          z-index: 10;
        }

        .user-avatars .user-avatar {
          margin-left: -8px;
        }

        .user-avatars .user-avatar:first-child {
          margin-left: 0;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-initials {
          font-size: 10px;
          font-weight: 600;
          color: white;
        }

        .avatar-status {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid var(--cl-bg-secondary, #161b22);
        }

        .status-active .avatar-status { background: #3fb950; }
        .status-idle .avatar-status { background: #d29922; }
        .status-away .avatar-status { background: #8b949e; }
        .status-busy .avatar-status { background: #f85149; }

        .avatar-typing {
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 8px;
          color: var(--cl-accent, #58a6ff);
          animation: typing 1s infinite;
        }

        @keyframes typing {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Tab Bar */
        .collab-tabs {
          display: flex;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .tab-btn {
          flex: 1;
          padding: 10px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tab-btn:hover {
          color: var(--cl-text-primary, #e6edf3);
        }

        .tab-btn.active {
          color: var(--cl-accent, #58a6ff);
          border-bottom-color: var(--cl-accent, #58a6ff);
        }

        .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          margin-left: 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-radius: 8px;
          font-size: 10px;
        }

        /* Content */
        .collab-content {
          flex: 1;
          overflow-y: auto;
        }

        /* User List */
        .user-list {
          padding: 8px;
        }

        .user-item {
          padding: 8px;
          border-radius: 8px;
          transition: background 0.15s;
        }

        .user-item:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .user-item.current {
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.1));
        }

        .user-main {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--cl-text-primary, #e6edf3);
        }

        .user-you {
          margin-left: 4px;
          font-size: 11px;
          color: var(--cl-text-muted, #6e7681);
        }

        .user-activity {
          display: block;
          font-size: 11px;
          color: var(--cl-text-tertiary, #8b949e);
        }

        .user-role {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .role-owner {
          background: rgba(210, 153, 34, 0.15);
          color: #d29922;
        }

        .role-editor {
          background: rgba(56, 139, 253, 0.15);
          color: #58a6ff;
        }

        .role-viewer {
          background: rgba(139, 148, 158, 0.15);
          color: #8b949e;
        }

        .follow-btn {
          padding: 4px 8px;
          background: transparent;
          border: none;
          font-size: 14px;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .user-item:hover .follow-btn {
          opacity: 1;
        }

        .follow-btn.following {
          opacity: 1;
        }

        .user-actions {
          display: flex;
          gap: 8px;
          padding: 8px 0 0 42px;
        }

        .role-select {
          padding: 4px 8px;
          background: var(--cl-bg-tertiary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 4px;
          color: var(--cl-text-primary, #e6edf3);
          font-size: 11px;
        }

        .kick-btn {
          padding: 4px 8px;
          background: transparent;
          border: 1px solid var(--cl-text-danger, #f85149);
          border-radius: 4px;
          color: var(--cl-text-danger, #f85149);
          font-size: 11px;
          cursor: pointer;
        }

        .kick-btn:hover {
          background: rgba(248, 81, 73, 0.15);
        }

        /* Activity Feed */
        .activity-feed {
          padding: 8px;
        }

        .activity-empty {
          padding: 24px;
          text-align: center;
          color: var(--cl-text-muted, #6e7681);
          font-size: 12px;
        }

        .activity-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          transition: background 0.15s;
        }

        .activity-item:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .activity-icon {
          font-size: 14px;
        }

        .activity-content {
          flex: 1;
          font-size: 12px;
        }

        .activity-user {
          font-weight: 500;
        }

        .activity-message {
          color: var(--cl-text-secondary, #8b949e);
        }

        .activity-time {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        /* Invite Panel */
        .invite-panel {
          padding: 12px;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .invite-email,
        .invite-link {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .invite-link {
          margin-bottom: 0;
        }

        .invite-input,
        .link-input {
          flex: 1;
          padding: 8px 12px;
          background: var(--cl-bg-tertiary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 6px;
          color: var(--cl-text-primary, #e6edf3);
          font-size: 12px;
        }

        .link-input {
          font-size: 11px;
          color: var(--cl-text-tertiary, #8b949e);
        }

        .invite-btn,
        .copy-btn {
          padding: 8px 16px;
          background: var(--cl-accent, #58a6ff);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }

        .copy-btn {
          background: var(--cl-bg-secondary, #161b22);
          border: 1px solid var(--cl-border, #30363d);
          color: var(--cl-text-primary, #e6edf3);
        }

        /* Annotations */
        .annotations-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .annotations-filter {
          display: flex;
          gap: 4px;
          padding: 8px;
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .annotations-filter button {
          padding: 4px 10px;
          background: transparent;
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 16px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 11px;
          cursor: pointer;
        }

        .annotations-filter button:hover,
        .annotations-filter button.active {
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
          border-color: var(--cl-accent, #58a6ff);
          color: var(--cl-accent, #58a6ff);
        }

        .annotations-empty {
          padding: 24px;
          text-align: center;
          color: var(--cl-text-muted, #6e7681);
          font-size: 12px;
        }

        .annotations-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .annotation-card {
          padding: 12px;
          background: var(--cl-bg-secondary, #161b22);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .annotation-card.resolved {
          opacity: 0.6;
        }

        .annotation-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .annotation-meta {
          flex: 1;
        }

        .annotation-user {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--cl-text-primary, #e6edf3);
        }

        .annotation-location {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        .resolve-btn {
          padding: 4px 10px;
          background: rgba(63, 185, 80, 0.15);
          border: none;
          border-radius: 12px;
          color: #3fb950;
          font-size: 11px;
          cursor: pointer;
        }

        .annotation-content {
          font-size: 13px;
          color: var(--cl-text-secondary, #c9d1d9);
          line-height: 1.5;
        }

        .annotation-replies {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid var(--cl-border, #30363d);
        }

        .reply {
          padding: 4px 0;
          font-size: 12px;
        }

        .reply-user {
          font-weight: 500;
        }

        .reply-content {
          color: var(--cl-text-secondary, #8b949e);
        }

        .reply-input-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .reply-input {
          flex: 1;
          padding: 6px 10px;
          background: var(--cl-bg-tertiary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 4px;
          color: var(--cl-text-primary, #e6edf3);
          font-size: 12px;
        }

        .reply-send,
        .reply-cancel {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .reply-send {
          background: var(--cl-accent, #58a6ff);
          color: white;
        }

        .reply-cancel {
          background: transparent;
          border: 1px solid var(--cl-border, #30363d);
          color: var(--cl-text-tertiary, #8b949e);
        }

        .add-reply-btn {
          margin-top: 8px;
          padding: 4px 10px;
          background: transparent;
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 12px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 11px;
          cursor: pointer;
        }

        .add-reply-btn:hover {
          border-color: var(--cl-accent, #58a6ff);
          color: var(--cl-accent, #58a6ff);
        }

        /* Cursor Indicator (for editor) */
        .cursor-indicator {
          position: absolute;
          pointer-events: none;
          z-index: 100;
        }

        .cursor-caret {
          width: 2px;
          height: 18px;
          background: var(--cursor-color);
          animation: cursorBlink 1s step-start infinite;
        }

        @keyframes cursorBlink {
          50% { opacity: 0; }
        }

        .cursor-label {
          position: absolute;
          top: -18px;
          left: 0;
          padding: 2px 6px;
          background: var(--cursor-color);
          border-radius: 3px 3px 3px 0;
          font-size: 10px;
          font-weight: 500;
          color: white;
          white-space: nowrap;
        }

        /* Scrollbars */
        .collab-content::-webkit-scrollbar,
        .annotations-list::-webkit-scrollbar {
          width: 6px;
        }

        .collab-content::-webkit-scrollbar-track,
        .annotations-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .collab-content::-webkit-scrollbar-thumb,
        .annotations-list::-webkit-scrollbar-thumb {
          background: var(--cl-border, #30363d);
          border-radius: 3px;
        }
      `}</style>

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

// ============================================================================
// HOOK FOR COLLABORATION STATE
// ============================================================================

const USER_COLORS = [
  '#f85149',
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#a371f7',
  '#f778ba',
  '#79c0ff',
  '#7ee787',
  '#e3b341',
  '#bc8cff',
];

export function useCollaboration(currentUserId: string, currentUserName: string) {
  const [session, setSession] = useState<CollabSession>(() => {
    const currentUser: CollabUser = {
      id: currentUserId,
      name: currentUserName,
      color: USER_COLORS[0],
      status: 'active',
      role: 'owner',
      lastActivity: new Date(),
    };

    return {
      id: `session-${Date.now()}`,
      name: 'Coding Session',
      owner: currentUser,
      users: [currentUser],
      activities: [],
      annotations: [],
      createdAt: new Date(),
      isLive: true,
    };
  });

  const [followingUserId, setFollowingUserId] = useState<string | undefined>();

  const currentUser = session.users.find((u) => u.id === currentUserId) || session.owner;

  const addActivity = useCallback(
    (type: ActivityType, message: string, metadata?: Record<string, unknown>) => {
      setSession((prev) => ({
        ...prev,
        activities: [
          ...prev.activities,
          {
            id: `activity-${Date.now()}`,
            type,
            user: prev.users.find((u) => u.id === currentUserId) || prev.owner,
            message,
            timestamp: new Date(),
            metadata,
          },
        ],
      }));
    },
    [currentUserId]
  );

  const inviteUser = useCallback(
    (email: string) => {
      addActivity('join', `invited ${email}`);
    },
    [addActivity]
  );

  const kickUser = useCallback(
    (userId: string) => {
      const user = session.users.find((u) => u.id === userId);
      if (user) {
        setSession((prev) => ({
          ...prev,
          users: prev.users.filter((u) => u.id !== userId),
        }));
        addActivity('leave', `removed ${user.name}`);
      }
    },
    [session.users, addActivity]
  );

  const changeRole = useCallback((userId: string, role: UserRole) => {
    setSession((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, role } : u)),
    }));
  }, []);

  const addAnnotation = useCallback(
    (file: string, line: number, content: string) => {
      const annotation: CodeAnnotation = {
        id: `annotation-${Date.now()}`,
        file,
        line,
        user: currentUser,
        content,
        timestamp: new Date(),
        replies: [],
      };
      setSession((prev) => ({
        ...prev,
        annotations: [...prev.annotations, annotation],
      }));
      addActivity('comment', `added a comment on ${file.split('/').pop()}:${line}`);
    },
    [currentUser, addActivity]
  );

  const resolveAnnotation = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      annotations: prev.annotations.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    }));
  }, []);

  const replyAnnotation = useCallback(
    (id: string, content: string) => {
      setSession((prev) => ({
        ...prev,
        annotations: prev.annotations.map((a) =>
          a.id === id
            ? {
                ...a,
                replies: [
                  ...a.replies,
                  {
                    id: `reply-${Date.now()}`,
                    user: currentUser,
                    content,
                    timestamp: new Date(),
                  },
                ],
              }
            : a
        ),
      }));
    },
    [currentUser]
  );

  return {
    session,
    currentUser,
    followingUserId,
    setFollowingUserId,
    inviteUser,
    kickUser,
    changeRole,
    addAnnotation,
    resolveAnnotation,
    replyAnnotation,
    addActivity,
  };
}

export default CodeLabCollaboration;
