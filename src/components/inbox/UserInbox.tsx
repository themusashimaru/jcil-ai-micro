/**
 * USER INBOX COMPONENT
 *
 * PURPOSE:
 * - Display user's messages from admin
 * - Support read/unread/delete/star actions
 * - Contact support form
 * - Responsive for mobile/tablet/desktop
 * - Theme-aware (dark/light/ocean modes)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Message {
  id: string;
  subject: string;
  message: string;
  message_type: string;
  priority: string;
  sender_admin_email: string;
  is_broadcast: boolean;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
}

interface Counts {
  total: number;
  unread: number;
  starred: number;
}

type ViewMode = 'list' | 'detail' | 'compose';
type FilterMode = 'all' | 'unread' | 'starred';

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

const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-muted',
  normal: '',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

interface UserInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserInbox({ isOpen, onClose }: UserInboxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, unread: 0, starred: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterMode>('all');

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/messages');
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data.messages || []);
      setCounts(data.counts || { total: 0, unread: 0, starred: 0 });
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen, fetchMessages]);

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message);
    setViewMode('detail');

    // Mark as read if not already
    if (!message.is_read) {
      try {
        await fetch(`/api/user/messages/${message.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        });

        // Update local state
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, is_read: true } : m)));
        setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleToggleStar = async (messageId: string, currentStarred: boolean) => {
    try {
      await fetch(`/api/user/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !currentStarred }),
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_starred: !currentStarred } : m))
      );
      setCounts((prev) => ({
        ...prev,
        starred: currentStarred ? prev.starred - 1 : prev.starred + 1,
      }));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage((prev) => (prev ? { ...prev, is_starred: !currentStarred } : null));
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const response = await fetch(`/api/user/messages/${messageId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.status}`);
      }

      const deletedMessage = messages.find((m) => m.id === messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setCounts((prev) => ({
        total: prev.total - 1,
        unread: deletedMessage?.is_read === false ? prev.unread - 1 : prev.unread,
        starred: deletedMessage?.is_starred ? prev.starred - 1 : prev.starred,
      }));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
        setViewMode('list');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleBack = () => {
    setSelectedMessage(null);
    setViewMode('list');
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === 'unread') return !m.is_read;
    if (filter === 'starred') return m.is_starred;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (hours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  // Use portal to render at document body level, escaping sidebar constraints
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - Full screen on mobile, constrained on desktop */}
      <div
        className="relative w-full h-full md:max-w-3xl md:h-[80vh] md:max-h-[700px] md:rounded-2xl overflow-hidden flex flex-col bg-surface border border-theme"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-theme">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-lg transition hover:opacity-80 bg-primary-hover"
              >
                <svg
                  className="w-5 h-5 text-text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {viewMode === 'list'
                  ? 'Inbox'
                  : viewMode === 'compose'
                    ? 'Contact Support'
                    : 'Message'}
              </h2>
              {viewMode === 'list' && counts.unread > 0 && (
                <p className="text-sm text-text-muted">{counts.unread} unread</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'list' && (
              <button
                onClick={() => setViewMode('compose')}
                className="px-3 py-2 rounded-lg text-sm font-medium transition bg-primary text-surface"
              >
                Contact Support
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition hover:opacity-80 text-text-muted"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'list' && (
            <MessageList
              messages={filteredMessages}
              filter={filter}
              setFilter={setFilter}
              counts={counts}
              loading={loading}
              onSelect={handleSelectMessage}
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          )}

          {viewMode === 'detail' && selectedMessage && (
            <MessageDetail
              message={selectedMessage}
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          )}

          {viewMode === 'compose' && <ContactSupportForm onSuccess={() => setViewMode('list')} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Message List Component
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

function MessageList({
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
                {/* Unread indicator */}
                <div className="pt-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${!message.is_read ? 'bg-primary' : 'bg-transparent'}`}
                  />
                </div>

                {/* Content */}
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

                {/* Actions */}
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

// Message Detail Component
interface MessageDetailProps {
  message: Message;
  onToggleStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}

function MessageDetail({ message, onToggleStar, onDelete, formatDate }: MessageDetailProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Message Header */}
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

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="prose max-w-none text-text-primary">
          <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
        </div>
      </div>
    </div>
  );
}

// Contact Support Form
interface ContactSupportFormProps {
  onSuccess: () => void;
}

function ContactSupportForm({ onSuccess }: ContactSupportFormProps) {
  const [formData, setFormData] = useState({
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'technical_support', label: 'Technical Support' },
    { value: 'bug_report', label: 'Report a Bug' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'billing', label: 'Billing Question' },
    { value: 'feedback', label: 'Feedback' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition appearance-none bg-glass border border-theme text-text-primary"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-surface">
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Subject</label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
            required
            placeholder="Brief description of your inquiry"
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-glass border border-theme text-text-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Message</label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
            required
            rows={6}
            placeholder="How can we help you?"
            className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition bg-glass border border-theme text-text-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50 bg-primary text-surface"
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>

        <p className="text-xs text-center text-text-muted">
          We typically respond within 24-48 hours
        </p>
      </form>
    </div>
  );
}
