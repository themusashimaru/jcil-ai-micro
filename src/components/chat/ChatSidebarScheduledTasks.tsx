'use client';

/**
 * CHAT SIDEBAR SCHEDULED TASKS
 *
 * Collapsible section in the chat sidebar showing all user-scheduled tasks.
 * Each task shows: name, platform icon, next run time, status, and actions.
 * Follows the ChatSidebarFolderSection design pattern.
 */

import { useState, useCallback } from 'react';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  platform: string;
  action: string;
  tool_name: string;
  tool_params: Record<string, unknown>;
  scheduled_for: string;
  timezone: string;
  recurring: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  last_run_at?: string;
  last_result?: string;
  last_error?: string;
  run_count: number;
  fail_count: number;
  created_at: string;
}

interface ChatSidebarScheduledTasksProps {
  tasks: ScheduledTask[];
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onRefresh: () => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  gmail: '\u2709\uFE0F',
  email: '\u2709\uFE0F',
  calendar: '\u{1F4C5}',
  'google calendar': '\u{1F4C5}',
  slack: '\u{1F4AC}',
  discord: '\u{1F3AE}',
  github: '\u{1F41B}',
  reminder: '\u{1F514}',
  default: '\u23F0',
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; color: string }> = {
  pending: { dot: 'bg-blue-400', label: 'Scheduled', color: 'text-blue-400' },
  running: { dot: 'bg-amber-400 animate-pulse', label: 'Running', color: 'text-amber-400' },
  completed: { dot: 'bg-emerald-400', label: 'Done', color: 'text-emerald-400' },
  failed: { dot: 'bg-red-400', label: 'Failed', color: 'text-red-400' },
  paused: { dot: 'bg-gray-400', label: 'Paused', color: 'text-gray-400' },
  cancelled: { dot: 'bg-gray-600', label: 'Cancelled', color: 'text-gray-600' },
};

function formatScheduleTime(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // If within 24 hours, show relative
    if (diffHours > 0 && diffHours < 24) {
      if (diffHours < 1) {
        const mins = Math.round(diffMs / (1000 * 60));
        return `in ${mins}m`;
      }
      return `in ${Math.round(diffHours)}h`;
    }

    // Otherwise show date/time
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    });
  } catch {
    return isoString;
  }
}

function formatRecurring(recurring: string): string {
  const map: Record<string, string> = {
    once: '',
    daily: 'Every day',
    weekly: 'Every week',
    biweekly: 'Every 2 weeks',
    monthly: 'Every month',
    quarterly: 'Every 3 months',
  };
  return map[recurring] || '';
}

export function ChatSidebarScheduledTasks({
  tasks,
  onPause,
  onResume,
  onDelete,
  onRefresh,
}: ChatSidebarScheduledTasksProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  const activeTasks = tasks.filter((t) => t.status !== 'cancelled');
  const pendingCount = activeTasks.filter(
    (t) => t.status === 'pending' || t.status === 'running'
  ).length;

  const handleMenuAction = useCallback(
    (taskId: string, action: 'pause' | 'resume' | 'delete') => {
      setMenuTaskId(null);
      if (action === 'pause') onPause(taskId);
      else if (action === 'resume') onResume(taskId);
      else if (action === 'delete') onDelete(taskId);
    },
    [onPause, onResume, onDelete]
  );

  if (activeTasks.length === 0) return null;

  return (
    <div className="mb-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group bg-glass">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <svg
            className={`h-3 w-3 transition-transform text-text-muted ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-base">{'\u23F0'}</span>
          <span className="text-xs font-semibold uppercase truncate text-text-muted">
            Scheduled
          </span>
          {pendingCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 font-medium">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className="p-1 opacity-0 group-hover:opacity-100 rounded text-text-muted hover:text-text-primary transition-opacity"
          title="Refresh tasks"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Task List */}
      {!isCollapsed && (
        <div className="mt-1 space-y-0.5 pl-1" role="list">
          {activeTasks.map((task) => {
            const icon = PLATFORM_ICONS[task.platform.toLowerCase()] || PLATFORM_ICONS.default;
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const recurring = formatRecurring(task.recurring);
            const menuOpen = menuTaskId === task.id;

            return (
              <div
                key={task.id}
                className="relative flex items-start gap-2 px-2 py-1.5 rounded-lg group hover:bg-white/5 transition-colors"
                role="listitem"
              >
                {/* Platform icon */}
                <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate font-medium">{task.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig.dot}`}
                    />
                    <span className={`text-[10px] ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {'\u00B7'} {formatScheduleTime(task.scheduled_for, task.timezone)}
                    </span>
                  </div>
                  {recurring && (
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {'\u{1F501}'} {recurring}
                    </div>
                  )}
                </div>

                {/* Menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTaskId(menuOpen ? null : task.id);
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 rounded text-text-muted transition-opacity flex-shrink-0"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01"
                    />
                  </svg>
                </button>

                {/* Context menu */}
                {menuOpen && (
                  <div className="absolute right-2 top-8 z-20 w-32 rounded-lg py-1 shadow-xl bg-background border border-theme">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleMenuAction(task.id, 'pause')}
                        className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-white/5"
                      >
                        {'\u23F8'} Pause
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={() => handleMenuAction(task.id, 'resume')}
                        className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-white/5"
                      >
                        {'\u25B6\uFE0F'} Resume
                      </button>
                    )}
                    <button
                      onClick={() => handleMenuAction(task.id, 'delete')}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-white/5"
                    >
                      {'\u{1F5D1}\uFE0F'} Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
