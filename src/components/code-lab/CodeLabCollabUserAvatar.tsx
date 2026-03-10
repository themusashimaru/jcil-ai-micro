'use client';

import React from 'react';
import Image from 'next/image';
import type { CollabUser } from './CodeLabCollaboration';

export interface UserAvatarProps {
  user: CollabUser;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onClick?: () => void;
}

export const UserAvatar = React.memo(function UserAvatar({
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
      {user.isTyping && <span className="avatar-typing">...</span>}
    </button>
  );
});

export default UserAvatar;
