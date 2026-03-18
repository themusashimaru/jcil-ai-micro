'use client';

import type { Message, FilterMode, Counts } from './UserInbox';

interface MessageListProps {
  messages: Message[];
  filter: FilterMode;
  setFilter: (filter: FilterMode) => void;
  counts: Counts;
  loading: boolean;
  onSelect: (message: Message) => void;
  onToggleStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}

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

export function MessageList({
  messages,
  filter,
  setFilter,
  counts,
  loading,
  onSelect,
  onToggleStar,
  onDelete,
  formatDate,
}: MessageListProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Filter Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-theme">
        {[
          { key: 'all', label: 'All', count: counts.total },
          { key: 'unread', label: 'Unread', count: counts.unread },
          { key: 'starred', label: 'Starred', count: counts.starred },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as FilterMode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === tab.key ? 'bg-primary-hover text-primary' : 'bg-transparent text-text-secondary'}`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <svg
              className="w-16 h-16 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg font-medium">No messages</p>
            <p className="text-sm mt-1">
              {filter === 'unread'
                ? 'All caught up!'
                : filter === 'starred'
                  ? 'No starred messages'
                  : 'Your inbox is empty'}
            </p>
          </div>
        ) : (
          <div>
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition ${index < messages.length - 1 ? 'border-b border-theme' : ''} ${!message.is_read ? 'bg-primary-hover' : 'bg-transparent'}`}
                onClick={() => onSelect(message)}
              >
                <div className="pt-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${!message.is_read ? 'bg-primary' : 'bg-transparent'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded bg-glass ${PRIORITY_STYLES[message.priority]} ${message.priority === 'normal' ? 'text-text-secondary' : ''}`}
                    >
                      {MESSAGE_TYPE_LABELS[message.message_type] || message.message_type}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  <h3
                    className={`font-medium truncate ${!message.is_read ? 'text-text-primary' : 'text-text-secondary'}`}
                  >
                    {message.subject}
                  </h3>
                  <p className="text-sm truncate mt-0.5 text-text-muted">
                    {message.message.substring(0, 100)}...
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(message.id, message.is_starred);
                    }}
                    className={`p-1.5 rounded transition hover:opacity-80 ${message.is_starred ? 'text-yellow-500' : 'text-text-muted'}`}
                  >
                    <svg
                      className="w-4 h-4"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(message.id);
                    }}
                    className="p-1.5 rounded transition hover:opacity-80 text-text-muted"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
