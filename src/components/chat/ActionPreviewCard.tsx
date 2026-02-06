'use client';

/**
 * ACTION PREVIEW CARD
 *
 * Shows a preview of an action (tweet, message, email, etc.) before sending.
 * User can approve with buttons or request edits via text.
 * Dark grey theme with black/white fonts.
 */

import { useState } from 'react';

export interface ActionPreviewData {
  platform: string; // Twitter, Slack, Email, etc.
  action: string; // Post, Send, Create, etc.
  content: string; // The actual content
  recipient?: string; // For emails/DMs
  subject?: string; // For emails
  metadata?: Record<string, string>; // Additional fields
  toolName: string; // The Composio tool to call
  toolParams: Record<string, unknown>; // Parameters for the tool
}

interface ActionPreviewCardProps {
  preview: ActionPreviewData;
  onSend: () => void;
  onEdit: (instruction: string) => void;
  onCancel: () => void;
  sending?: boolean;
}

// Platform icons and button text
const PLATFORM_CONFIG: Record<string, { icon: string; buttonText: string }> = {
  twitter: { icon: '𝕏', buttonText: 'Post Tweet' },
  x: { icon: '𝕏', buttonText: 'Post Tweet' },
  instagram: { icon: '📷', buttonText: 'Post' },
  facebook: { icon: '📘', buttonText: 'Post' },
  linkedin: { icon: '💼', buttonText: 'Post' },
  slack: { icon: '💬', buttonText: 'Send Message' },
  discord: { icon: '🎮', buttonText: 'Send Message' },
  email: { icon: '✉️', buttonText: 'Send Email' },
  gmail: { icon: '✉️', buttonText: 'Send Email' },
  notion: { icon: '📝', buttonText: 'Create Page' },
  whatsapp: { icon: '💚', buttonText: 'Send Message' },
  telegram: { icon: '✈️', buttonText: 'Send Message' },
  default: { icon: '🔗', buttonText: 'Send' },
};

export default function ActionPreviewCard({
  preview,
  onSend,
  onEdit,
  onCancel,
  sending = false,
}: ActionPreviewCardProps) {
  const [editMode, setEditMode] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  const platformKey = preview.platform.toLowerCase();
  const config = PLATFORM_CONFIG[platformKey] || PLATFORM_CONFIG.default;

  const handleEdit = () => {
    if (editInstruction.trim()) {
      onEdit(editInstruction.trim());
      setEditInstruction('');
      setEditMode(false);
    }
  };

  return (
    <div
      className="my-4 rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        maxWidth: '500px',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: '#252525', borderBottom: '1px solid #333' }}
      >
        <span className="text-2xl">{config.icon}</span>
        <div>
          <div className="font-semibold text-white">{preview.platform}</div>
          <div className="text-xs text-gray-400">{preview.action}</div>
        </div>
        <div className="ml-auto">
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{ backgroundColor: '#333', color: '#fff' }}
          >
            Draft
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Recipient (for emails/DMs) */}
        {preview.recipient && (
          <div className="mb-3 text-sm">
            <span className="text-gray-500">To: </span>
            <span className="text-white">{preview.recipient}</span>
          </div>
        )}

        {/* Subject (for emails) */}
        {preview.subject && (
          <div className="mb-3 text-sm">
            <span className="text-gray-500">Subject: </span>
            <span className="font-medium text-white">{preview.subject}</span>
          </div>
        )}

        {/* Main content */}
        <div
          className="p-3 rounded-lg text-sm whitespace-pre-wrap"
          style={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #404040',
            color: '#ffffff',
          }}
        >
          {preview.content}
        </div>

        {/* Metadata */}
        {preview.metadata && Object.keys(preview.metadata).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(preview.metadata).map(([key, value]) => (
              <span
                key={key}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: '#333', color: '#999' }}
              >
                {key}: {value}
              </span>
            ))}
          </div>
        )}

        {/* Edit input */}
        {editMode && (
          <div className="mt-4">
            <input
              type="text"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              placeholder="What would you like to change?"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #404040',
                color: '#ffffff',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEdit();
                if (e.key === 'Escape') setEditMode(false);
              }}
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleEdit}
                disabled={!editInstruction.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: '#3b82f6' }}
              >
                Apply Edit
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!editMode && (
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ backgroundColor: '#1f1f1f', borderTop: '1px solid #333' }}
        >
          <button
            onClick={onSend}
            disabled={sending}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: '#22c55e' }}
          >
            {sending ? (
              <>
                <span className="animate-spin">⏳</span>
                Sending...
              </>
            ) : (
              <>
                <span>✓</span>
                {config.buttonText}
              </>
            )}
          </button>
          <button
            onClick={() => setEditMode(true)}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#333', color: '#fff' }}
          >
            ✏️ Edit
          </button>
          <button
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Parse AI response for action preview
 * Looks for special JSON block: ```action-preview {...} ```
 */
export function parseActionPreview(content: string): ActionPreviewData | null {
  const match = content.match(/```action-preview\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as ActionPreviewData;
  } catch {
    return null;
  }
}

/**
 * Check if content contains an action preview
 */
export function hasActionPreview(content: string): boolean {
  return /```action-preview\s*[\s\S]*?\s*```/.test(content);
}

/**
 * Remove action preview block from content
 */
export function removeActionPreview(content: string): string {
  return content.replace(/```action-preview\s*[\s\S]*?\s*```/g, '').trim();
}
