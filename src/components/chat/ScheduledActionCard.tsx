'use client';

/**
 * SCHEDULED ACTION CARD
 *
 * Shows a preview of an action scheduled for later execution.
 * User can confirm the schedule, modify the time, or cancel.
 * Matches the ActionPreviewCard design language.
 */

import { useState } from 'react';

export interface ScheduledActionData {
  action: string; // "Send Email", "Create Event", etc.
  platform: string; // Gmail, Calendar, Slack, etc.
  summary: string; // Brief description of what will happen
  scheduledFor: string; // ISO datetime or relative ("in 30 minutes")
  scheduledDisplay: string; // Human-readable: "Today at 3:00 PM"
  timezone?: string; // e.g., "America/New_York"
  toolName: string; // The tool to execute
  toolParams: Record<string, unknown>; // Parameters for the tool
  recurring?: string; // "daily", "weekly", "monthly", or null
}

interface ScheduledActionCardProps {
  data: ScheduledActionData;
  onConfirm: (data: ScheduledActionData) => Promise<void>;
  onModifyTime: (data: ScheduledActionData, newTime: string) => void;
  onCancel: (data: ScheduledActionData) => void;
  confirming?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  gmail: '\u2709\uFE0F',
  email: '\u2709\uFE0F',
  calendar: '\u{1F4C5}',
  'google calendar': '\u{1F4C5}',
  slack: '\u{1F4AC}',
  discord: '\u{1F3AE}',
  github: '\u{1F5C2}\uFE0F',
  reminder: '\u{1F514}',
  default: '\u23F0',
};

export default function ScheduledActionCard({
  data,
  onConfirm,
  onModifyTime,
  onCancel,
  confirming = false,
}: ScheduledActionCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const icon = PLATFORM_ICONS[data.platform.toLowerCase()] || PLATFORM_ICONS.default;

  if (confirmed) {
    return (
      <div className="my-4 rounded-xl overflow-hidden bg-zinc-900 border border-emerald-900/50 max-w-[500px]">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-emerald-400">{'\u2713'}</span>
          <span className="text-sm text-emerald-300">
            Scheduled: {data.action} for {data.scheduledDisplay}
          </span>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="my-4 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 max-w-[500px] opacity-60">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-gray-500">{'\u2717'}</span>
          <span className="text-sm text-gray-500">Schedule cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 max-w-[500px]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 bg-zinc-800 border-b border-zinc-700">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm">{data.platform}</div>
          <div className="text-xs text-gray-400">{data.action}</div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-900/40 text-orange-300">
          {'\u23F0'} Scheduled
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Summary */}
        <div className="text-sm text-white">{data.summary}</div>

        {/* Schedule details */}
        <div className="rounded-lg p-3 bg-neutral-800 border border-neutral-700 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16">When</span>
            <span className="text-sm text-white font-medium">{data.scheduledDisplay}</span>
          </div>
          {data.timezone && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">Timezone</span>
              <span className="text-xs text-gray-300">{data.timezone}</span>
            </div>
          )}
          {data.recurring && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">Repeats</span>
              <span className="text-xs text-orange-300 capitalize">{data.recurring}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2 bg-neutral-900 border-t border-zinc-700">
        <button
          onClick={async () => {
            setConfirmed(true);
            await onConfirm(data);
          }}
          disabled={confirming}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 bg-zinc-700 text-white"
        >
          {confirming ? (
            'Scheduling...'
          ) : (
            <>
              <span className="text-orange-400">{'\u23F0'}</span>
              Schedule
            </>
          )}
        </button>
        <button
          onClick={() => {
            // For now, prompt in chat for new time
            onModifyTime(data, '');
          }}
          disabled={confirming}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 bg-zinc-700 text-white"
        >
          <span className="text-gray-400">{'\u270F\uFE0F'}</span>
          Change Time
        </button>
        <button
          onClick={() => {
            setCancelled(true);
            onCancel(data);
          }}
          disabled={confirming}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 bg-zinc-700 text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse a scheduled-action code block from markdown.
 * Format: ```scheduled-action\n{JSON}\n```
 */
export function parseScheduledAction(block: string): ScheduledActionData | null {
  try {
    const match = block.match(/```scheduled-action\n([\s\S]*?)\n```/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!data.action || !data.scheduledFor || !data.toolName) return null;
    return data as ScheduledActionData;
  } catch {
    return null;
  }
}

export function hasScheduledAction(content: string): boolean {
  return content.includes('```scheduled-action');
}
