'use client';

import type { Message } from './UserInbox';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-muted',
  normal: '',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  general: 'General',
  account: 'Account',
  feature: 'New Feature',
  maintenance: 'Maintenance',
  promotion: 'Special Offer',
  support_response: 'Support',
  welcome: 'Welcome',
  warning: 'Important',
};

interface MessageDetailProps {
  message: Message;
  onToggleStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}

export function MessageDetail({ message, onToggleStar, onDelete, formatDate }: MessageDetailProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 py-4 border-b border-theme">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded bg-glass ${PRIORITY_STYLES[message.priority]} ${message.priority === 'normal' ? 'text-text-secondary' : ''}`}
              >
                {MESSAGE_TYPE_LABELS[message.message_type] || message.message_type}
              </span>
              {message.priority === 'urgent' && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                  Urgent
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-text-primary">{message.subject}</h2>
            <p className="text-sm mt-1 text-text-muted">
              {formatDate(message.created_at)} • From JCIL.AI Team
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleStar(message.id, message.is_starred)}
              className={`p-2 rounded-lg transition hover:opacity-80 ${message.is_starred ? 'text-yellow-500' : 'text-text-muted'}`}
            >
              <svg
                className="w-5 h-5"
                fill={message.is_starred ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
            <button
              onClick={() => onDelete(message.id)}
              className="p-2 rounded-lg transition hover:opacity-80 text-text-muted"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="prose max-w-none text-text-primary">
          <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
        </div>
      </div>
    </div>
  );
}
