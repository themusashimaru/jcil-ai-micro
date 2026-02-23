'use client';

import React from 'react';
import type { ActivityItem, ActivityType } from './CodeLabCollaboration';

export interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  join: '\uD83D\uDC4B',
  leave: '\uD83D\uDC4B',
  edit: '\u270F\uFE0F',
  cursor: '\uD83D\uDCCD',
  comment: '\uD83D\uDCAC',
  ai_request: '\uD83E\uDD16',
  file_open: '\uD83D\uDCC4',
};

export const ActivityFeed = React.memo(function ActivityFeed({
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

export default ActivityFeed;
