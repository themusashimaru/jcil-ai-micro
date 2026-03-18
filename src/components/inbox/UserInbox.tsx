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
import { MessageList } from './UserInboxMessageList';
import { MessageDetail } from './UserInboxMessageDetail';
import { ContactSupportForm } from './UserInboxContactForm';

export interface Message {
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

export interface Counts {
  total: number;
  unread: number;
  starred: number;
}

export type ViewMode = 'list' | 'detail' | 'compose';
export type FilterMode = 'all' | 'unread' | 'starred';

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
    if (isOpen) fetchMessages();
  }, [isOpen, fetchMessages]);

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessage(message);
    setViewMode('detail');

    if (!message.is_read) {
      try {
        await fetch(`/api/user/messages/${message.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        });
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
      if (!response.ok) throw new Error(`Failed to delete message: ${response.status}`);

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
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full h-full md:max-w-3xl md:h-[80vh] md:max-h-[700px] md:rounded-2xl overflow-hidden flex flex-col bg-surface border border-theme"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-theme">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-lg transition hover:opacity-80 bg-primary-hover"
              >
                <svg className="w-5 h-5 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {viewMode === 'list' ? 'Inbox' : viewMode === 'compose' ? 'Contact Support' : 'Message'}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
