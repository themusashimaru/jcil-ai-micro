'use client';

/**
 * DESTRUCTIVE ACTION CONFIRMATION CARD
 *
 * Shows a confirmation card for destructive operations like deleting emails,
 * files, or making irreversible changes. User must explicitly approve.
 * Red-themed to signal danger.
 */

import { useState } from 'react';

export interface DestructiveActionData {
  platform: string; // Gmail, GitHub, Files, etc.
  action: string; // Delete, Remove, Cancel, etc.
  summary: string; // "Delete 5 emails from Robin Hood"
  items?: string[]; // List of specific items to show
  itemCount?: number; // Total count if items are truncated
  toolName: string; // The Composio tool to call
  toolParams: Record<string, unknown>; // Parameters for the tool
}

interface DestructiveActionCardProps {
  data: DestructiveActionData;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  gmail: '\u2709\uFE0F',
  email: '\u2709\uFE0F',
  outlook: '\u{1F4E7}',
  github: '\u{1F5C2}\uFE0F',
  slack: '\u{1F4AC}',
  files: '\u{1F4C1}',
  drive: '\u{1F4BE}',
  default: '\u26A0\uFE0F',
};

export default function DestructiveActionCard({
  data,
  onConfirm,
  onCancel,
  confirming = false,
}: DestructiveActionCardProps) {
  const [confirmed, setConfirmed] = useState(false);

  const icon = PLATFORM_ICONS[data.platform.toLowerCase()] || PLATFORM_ICONS.default;
  const displayItems = data.items?.slice(0, 5) || [];
  const remainingCount = data.itemCount
    ? data.itemCount - displayItems.length
    : (data.items?.length || 0) - displayItems.length;

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border max-w-[500px] bg-zinc-900 border-red-900/50">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b bg-red-950/30 border-red-900/50">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-semibold text-white">{data.platform}</div>
          <div className="text-xs text-red-400">{data.action}</div>
        </div>
        <div className="ml-auto">
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-900/40 text-red-300">
            Requires Confirmation
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="text-sm font-medium text-white mb-3">{data.summary}</div>

        {/* Item list */}
        {displayItems.length > 0 && (
          <div className="rounded-lg p-3 space-y-1.5 bg-neutral-800 border border-neutral-700">
            {displayItems.map((item, i) => (
              <div key={i} className="text-sm flex items-start gap-2 text-gray-300">
                <span className="text-red-400 mt-0.5 shrink-0">&bull;</span>
                <span className="break-words">{item}</span>
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="text-xs text-gray-500 pt-1">...and {remainingCount} more</div>
            )}
          </div>
        )}

        {/* Warning */}
        <div className="mt-3 text-xs text-red-400/80 flex items-center gap-1.5">
          <span>This action cannot be undone.</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2 border-t bg-neutral-900 border-zinc-700">
        <button
          onClick={handleConfirm}
          disabled={confirming || confirmed}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 bg-zinc-700 text-white"
        >
          {confirming ? (
            'Processing...'
          ) : confirmed ? (
            'Done'
          ) : (
            <>
              <span className="text-red-400">&#10003;</span>
              Confirm
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={confirming || confirmed}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 text-zinc-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Parse AI response for destructive action confirmation
 * Looks for special JSON block: ```action-confirm {...} ```
 */
export function parseDestructiveAction(content: string): DestructiveActionData | null {
  const match = content.match(/```action-confirm\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as DestructiveActionData;
  } catch {
    return null;
  }
}

/**
 * Check if content contains a destructive action confirmation
 */
export function hasDestructiveAction(content: string): boolean {
  return /```action-confirm\s*[\s\S]*?\s*```/.test(content);
}

/**
 * Remove destructive action block from content
 */
export function removeDestructiveAction(content: string): string {
  return content.replace(/```action-confirm\s*[\s\S]*?\s*```/g, '').trim();
}
