/**
 * ADMIN INBOX
 * Outlook-style inbox for managing support tickets
 * - Folder sidebar with counts
 * - Ticket list with filters
 * - Ticket detail view with reply
 * - Mobile responsive
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Ticket {
  id: string;
  source: 'internal' | 'external';
  user_id: string | null;
  sender_email: string;
  sender_name: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    subscription_tier: string;
  };
}

interface Reply {
  id: string;
  admin_email: string;
  message: string;
  is_internal_note: boolean;
  delivery_method: string | null;
  created_at: string;
}

interface Counts {
  all: number;
  unread: number;
  starred: number;
  archived: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: { internal: number; external: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  technical_support: 'Support',
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  billing: 'Billing',
  content_moderation: 'Moderation',
  account_issue: 'Account',
  partnership: 'Partnership',
  feedback: 'Feedback',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_reply: 'Awaiting Reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

export default function AdminInboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Current filter from URL
  const currentFilter = searchParams.get('filter') || 'all';
  const currentCategory = searchParams.get('category');
  const currentStatus = searchParams.get('status');
  const currentSource = searchParams.get('source');

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (currentFilter === 'unread') params.set('is_read', 'false');
      if (currentFilter === 'starred') params.set('is_starred', 'true');
      if (currentFilter === 'archived') params.set('is_archived', 'true');
      if (currentCategory) params.set('category', currentCategory);
      if (currentStatus) params.set('status', currentStatus);
      if (currentSource) params.set('source', currentSource);

      const response = await fetch(`/api/admin/support/tickets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');

      const data = await response.json();
      setTickets(data.tickets || []);
      setCounts(data.counts);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [currentFilter, currentCategory, currentStatus, currentSource]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to fetch ticket');

      const data = await response.json();
      setSelectedTicket(data.ticket);
      setReplies(data.replies || []);

      // Update the ticket in the list as read
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, is_read: true } : t))
      );
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update ticket');

      const data = await response.json();

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, ...data.ticket } : t))
      );

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, ...data.ticket } : null));
      }

      // Refresh counts
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setReplySending(true);
      const response = await fetch(
        `/api/admin/support/tickets/${selectedTicket.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: replyText,
            isInternalNote,
            deliveryMethod: selectedTicket.source === 'external' ? 'mailto' : 'in_app',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send reply');

      const data = await response.json();
      setReplies((prev) => [...prev, data.reply]);
      setReplyText('');
      setIsInternalNote(false);

      // For external tickets, open mailto
      if (selectedTicket.source === 'external' && !isInternalNote) {
        openMailtoReply();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setReplySending(false);
    }
  };

  const openMailtoReply = () => {
    if (!selectedTicket) return;

    const subject = encodeURIComponent(`Re: ${selectedTicket.subject}`);
    const originalDate = new Date(selectedTicket.created_at).toLocaleString();
    const body = encodeURIComponent(
      `${replyText}\n\n` +
      `---\n` +
      `On ${originalDate}, ${selectedTicket.sender_name || selectedTicket.sender_email} wrote:\n\n` +
      `> ${selectedTicket.message.split('\n').join('\n> ')}`
    );

    window.open(`mailto:${selectedTicket.sender_email}?subject=${subject}&body=${body}`, '_blank');
  };

  const setFilter = (filter: string, value?: string) => {
    const params = new URLSearchParams();
    if (filter === 'category' && value) {
      params.set('category', value);
    } else if (filter === 'status' && value) {
      params.set('status', value);
    } else if (filter === 'source' && value) {
      params.set('source', value);
    } else if (filter !== 'all') {
      params.set('filter', filter);
    }
    router.push(`/admin/inbox?${params}`);
    setShowMobileSidebar(false);
  };

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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-4">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button
          onClick={() => setShowMobileSidebar(true)}
          className="px-4 py-2 bg-white/10 rounded-lg text-sm"
        >
          Filters {counts?.unread ? `(${counts.unread})` : ''}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${showMobileSidebar ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:block'}
          w-64 bg-zinc-900 rounded-xl p-4 overflow-y-auto
        `}
      >
        <div className="lg:hidden flex justify-between items-center mb-4">
          <h2 className="font-bold">Filters</h2>
          <button onClick={() => setShowMobileSidebar(false)} className="text-gray-400">
            X
          </button>
        </div>

        {/* Main Filters */}
        <div className="space-y-1 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left ${
              currentFilter === 'all' && !currentCategory && !currentStatus && !currentSource
                ? 'bg-blue-600'
                : 'hover:bg-white/10'
            }`}
          >
            <span>All Messages</span>
            <span className="text-sm text-gray-400">{counts?.all || 0}</span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left ${
              currentFilter === 'unread' ? 'bg-blue-600' : 'hover:bg-white/10'
            }`}
          >
            <span>Unread</span>
            <span className="text-sm bg-red-500 px-2 rounded-full">{counts?.unread || 0}</span>
          </button>
          <button
            onClick={() => setFilter('starred')}
            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left ${
              currentFilter === 'starred' ? 'bg-blue-600' : 'hover:bg-white/10'
            }`}
          >
            <span>Starred</span>
            <span className="text-sm text-gray-400">{counts?.starred || 0}</span>
          </button>
        </div>

        {/* By Source */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Source</h3>
          <div className="space-y-1">
            <button
              onClick={() => setFilter('source', 'internal')}
              className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm ${
                currentSource === 'internal' ? 'bg-blue-600' : 'hover:bg-white/10'
              }`}
            >
              <span>Internal (Users)</span>
              <span className="text-gray-400">{counts?.bySource.internal || 0}</span>
            </button>
            <button
              onClick={() => setFilter('source', 'external')}
              className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm ${
                currentSource === 'external' ? 'bg-blue-600' : 'hover:bg-white/10'
              }`}
            >
              <span>External (Contact)</span>
              <span className="text-gray-400">{counts?.bySource.external || 0}</span>
            </button>
          </div>
        </div>

        {/* By Category */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Category</h3>
          <div className="space-y-1">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter('category', key)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm ${
                  currentCategory === key ? 'bg-blue-600' : 'hover:bg-white/10'
                }`}
              >
                <span>{label}</span>
                <span className="text-gray-400">{counts?.byCategory[key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* By Status */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</h3>
          <div className="space-y-1">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter('status', key)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left text-sm ${
                  currentStatus === key ? 'bg-blue-600' : 'hover:bg-white/10'
                }`}
              >
                <span>{label}</span>
                <span className="text-gray-400">{counts?.byStatus[key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Archived */}
        <button
          onClick={() => setFilter('archived')}
          className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-left ${
            currentFilter === 'archived' ? 'bg-blue-600' : 'hover:bg-white/10'
          }`}
        >
          <span>Archived</span>
          <span className="text-sm text-gray-400">{counts?.archived || 0}</span>
        </button>
      </div>

      {/* Ticket List */}
      <div className="flex-1 lg:w-1/3 bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold">
            {currentFilter === 'all' && !currentCategory && !currentStatus && !currentSource
              ? 'All Messages'
              : currentFilter === 'unread'
              ? 'Unread'
              : currentFilter === 'starred'
              ? 'Starred'
              : currentFilter === 'archived'
              ? 'Archived'
              : currentCategory
              ? CATEGORY_LABELS[currentCategory]
              : currentStatus
              ? STATUS_LABELS[currentStatus]
              : currentSource === 'internal'
              ? 'Internal (Users)'
              : 'External (Contact)'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No tickets found</div>
          ) : (
            <div className="divide-y divide-white/5">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => fetchTicketDetail(ticket.id)}
                  className={`w-full p-4 text-left hover:bg-white/5 transition ${
                    selectedTicket?.id === ticket.id ? 'bg-white/10' : ''
                  } ${!ticket.is_read ? 'border-l-2 border-blue-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {ticket.is_starred && <span className="text-yellow-400">*</span>}
                      <span className={`font-medium truncate ${!ticket.is_read ? 'text-white' : 'text-gray-300'}`}>
                        {ticket.sender_name || ticket.sender_email}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(ticket.created_at)}
                    </span>
                  </div>
                  <div className={`text-sm truncate ${!ticket.is_read ? 'text-white' : 'text-gray-400'}`}>
                    {ticket.subject}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      ticket.source === 'internal' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {ticket.source === 'internal' ? 'User' : 'Contact'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>
                    <span className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                      {ticket.priority !== 'normal' && ticket.priority}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 rounded-xl overflow-hidden flex-col">
        {!selectedTicket ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a ticket to view details
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Loading...
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-lg font-semibold">{selectedTicket.subject}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateTicket(selectedTicket.id, { is_starred: !selectedTicket.is_starred })}
                    className={`p-2 rounded hover:bg-white/10 ${
                      selectedTicket.is_starred ? 'text-yellow-400' : 'text-gray-400'
                    }`}
                  >
                    {selectedTicket.is_starred ? '*' : 'Star'}
                  </button>
                  <button
                    onClick={() => updateTicket(selectedTicket.id, { is_archived: true })}
                    className="p-2 rounded hover:bg-white/10 text-gray-400"
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-400">
                  From: {selectedTicket.sender_name || selectedTicket.sender_email}
                  {selectedTicket.sender_name && (
                    <span className="text-gray-500"> ({selectedTicket.sender_email})</span>
                  )}
                </span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
                >
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key} className="bg-gray-900">
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTicket.priority}
                  onChange={(e) => updateTicket(selectedTicket.id, { priority: e.target.value })}
                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
                >
                  <option value="low" className="bg-gray-900">Low</option>
                  <option value="normal" className="bg-gray-900">Normal</option>
                  <option value="high" className="bg-gray-900">High</option>
                  <option value="urgent" className="bg-gray-900">Urgent</option>
                </select>
              </div>
              {selectedTicket.user && (
                <div className="mt-2 p-2 bg-white/5 rounded text-xs">
                  <span className="text-gray-400">User: </span>
                  <span>{selectedTicket.user.full_name || selectedTicket.user.email}</span>
                  <span className="text-gray-500"> ({selectedTicket.user.subscription_tier})</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Original Message */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-400">
                  <span>{selectedTicket.sender_name || selectedTicket.sender_email}</span>
                  <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
                <div className="whitespace-pre-wrap">{selectedTicket.message}</div>
              </div>

              {/* Replies */}
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`rounded-lg p-4 ${
                    reply.is_internal_note
                      ? 'bg-yellow-500/10 border border-yellow-500/20'
                      : 'bg-green-500/10 border border-green-500/20'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2 text-sm text-gray-400">
                    <span>
                      {reply.admin_email}
                      {reply.is_internal_note && <span className="ml-2 text-yellow-400">(Internal Note)</span>}
                    </span>
                    <span>{new Date(reply.created_at).toLocaleString()}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{reply.message}</div>
                </div>
              ))}
            </div>

            {/* Reply Box */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded"
                  />
                  Internal note (not visible to user)
                </label>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 resize-none focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-between items-center mt-2">
                {selectedTicket.source === 'external' && !isInternalNote ? (
                  <p className="text-xs text-gray-500">
                    Reply will open your email client with the message pre-filled
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    {isInternalNote ? 'Note will be saved but not sent to user' : 'Reply will be sent in-app'}
                  </p>
                )}
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || replySending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {replySending
                    ? 'Sending...'
                    : selectedTicket.source === 'external' && !isInternalNote
                    ? 'Open Email'
                    : 'Send Reply'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Ticket Detail Modal */}
      {selectedTicket && (
        <div className="lg:hidden fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => setSelectedTicket(null)}
              className="mb-4 text-blue-400"
            >
              Back to list
            </button>

            {detailLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">{selectedTicket.subject}</h2>
                <div className="text-sm text-gray-400 mb-4">
                  From: {selectedTicket.sender_name || selectedTicket.sender_email}
                </div>

                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded px-3 py-2 text-sm flex-1"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key} className="bg-gray-900">
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateTicket(selectedTicket.id, { is_starred: !selectedTicket.is_starred })}
                    className={`px-4 py-2 rounded ${
                      selectedTicket.is_starred ? 'bg-yellow-500' : 'bg-white/10'
                    }`}
                  >
                    Star
                  </button>
                </div>

                {/* Messages */}
                <div className="space-y-4 mb-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap">{selectedTicket.message}</div>
                  </div>

                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`rounded-lg p-4 ${
                        reply.is_internal_note
                          ? 'bg-yellow-500/10 border border-yellow-500/20'
                          : 'bg-green-500/10 border border-green-500/20'
                      }`}
                    >
                      <div className="text-sm text-gray-400 mb-2">
                        {reply.admin_email} - {new Date(reply.created_at).toLocaleString()}
                        {reply.is_internal_note && <span className="ml-2 text-yellow-400">(Internal)</span>}
                      </div>
                      <div className="whitespace-pre-wrap">{reply.message}</div>
                    </div>
                  ))}
                </div>

                {/* Reply */}
                <div className="sticky bottom-0 bg-black pt-4">
                  <label className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                    />
                    Internal note
                  </label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 resize-none"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || replySending}
                    className="w-full mt-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    {replySending
                      ? 'Sending...'
                      : selectedTicket.source === 'external' && !isInternalNote
                      ? 'Open Email to Reply'
                      : 'Send Reply'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
