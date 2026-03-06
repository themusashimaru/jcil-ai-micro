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
import { Ticket, Reply, Counts } from './components/types';
import { InboxSidebar } from './components/InboxSidebar';
import { TicketList } from './components/TicketList';
import { TicketDetail } from './components/TicketDetail';
import { MobileTicketDetail } from './components/MobileTicketDetail';

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

      const responseData = await response.json();
      // API returns { ok: true, data: { tickets, counts } }
      const data = responseData.data || responseData;
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

      const responseData = await response.json();
      // API returns { ok: true, data: { ticket, replies } }
      const data = responseData.data || responseData;
      setSelectedTicket(data.ticket);
      setReplies(data.replies || []);

      // Update the ticket in the list as read
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, is_read: true } : t)));
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

      const responseData = await response.json();
      // API returns { ok: true, data: { ticket, success } }
      const data = responseData.data || responseData;

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...data.ticket } : t)));

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, ...data.ticket } : null));
      }

      // Refresh counts
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
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

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setReplySending(true);
      const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: replyText,
          isInternalNote,
          deliveryMethod: selectedTicket.source === 'external' ? 'mailto' : 'in_app',
        }),
      });

      if (!response.ok) throw new Error('Failed to send reply');

      const responseData = await response.json();
      // API returns { ok: true, data: { reply, success } }
      const data = responseData.data || responseData;
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

  const isAllFilter =
    currentFilter === 'all' && !currentCategory && !currentStatus && !currentSource;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-4">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <button
          onClick={() => setShowMobileSidebar(true)}
          className="px-4 py-2 rounded-lg text-sm bg-glass border border-theme"
        >
          Filters {counts?.unread ? `(${counts.unread})` : ''}
        </button>
      </div>

      <InboxSidebar
        counts={counts}
        currentFilter={currentFilter}
        currentCategory={currentCategory}
        currentStatus={currentStatus}
        currentSource={currentSource}
        isAllFilter={isAllFilter}
        showMobileSidebar={showMobileSidebar}
        setFilter={setFilter}
        setShowMobileSidebar={setShowMobileSidebar}
      />

      <TicketList
        tickets={tickets}
        selectedTicket={selectedTicket}
        loading={loading}
        isAllFilter={isAllFilter}
        currentFilter={currentFilter}
        currentCategory={currentCategory}
        currentStatus={currentStatus}
        currentSource={currentSource}
        fetchTicketDetail={fetchTicketDetail}
        formatDate={formatDate}
      />

      <TicketDetail
        selectedTicket={selectedTicket}
        detailLoading={detailLoading}
        replies={replies}
        replyText={replyText}
        isInternalNote={isInternalNote}
        replySending={replySending}
        setReplyText={setReplyText}
        setIsInternalNote={setIsInternalNote}
        updateTicket={updateTicket}
        sendReply={sendReply}
      />

      {/* Mobile Ticket Detail Modal */}
      {selectedTicket && (
        <MobileTicketDetail
          selectedTicket={selectedTicket}
          detailLoading={detailLoading}
          replies={replies}
          replyText={replyText}
          isInternalNote={isInternalNote}
          replySending={replySending}
          setSelectedTicket={setSelectedTicket}
          setReplyText={setReplyText}
          setIsInternalNote={setIsInternalNote}
          updateTicket={updateTicket}
          sendReply={sendReply}
        />
      )}
    </div>
  );
}
