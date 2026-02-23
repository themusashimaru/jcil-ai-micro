'use client';

import React, { useState, useMemo } from 'react';
import type { CollabUser, UserRole } from './CodeLabCollaboration';
import { UserAvatar } from './CodeLabCollabUserAvatar';

export interface UserListProps {
  users: CollabUser[];
  currentUserId: string;
  onFollow: (userId: string) => void;
  followingUserId?: string;
  onKick?: (userId: string) => void;
  onChangeRole?: (userId: string, role: UserRole) => void;
  isOwner: boolean;
}

export const UserList = React.memo(function UserList({
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
                {followingUserId === user.id ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDC40'}
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

export default UserList;
