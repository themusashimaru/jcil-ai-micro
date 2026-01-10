/**
 * SUPPORT SECTION COMPONENT
 * - Submit support tickets
 * - View existing tickets and replies
 * - Mobile responsive
 */

'use client';

import { useState, useEffect } from 'react';

interface Ticket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  reply_count: number;
}

interface Reply {
  id: string;
  admin_email: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General Question' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'account_issue', label: 'Account Issue' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400' },
  awaiting_reply: { label: 'Reply Sent', color: 'bg-green-500/20 text-green-400' },
  resolved: { label: 'Resolved', color: 'bg-gray-500/20 text-gray-400' },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400' },
};

export default function SupportSection() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'general',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/support/tickets');
      if (!response.ok) throw new Error('Failed to fetch tickets');
      const responseData = await response.json();
      // API returns { ok: true, data: { tickets: [...] } }
      const data = responseData.data || responseData;
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      // For users, we just show the ticket with its replies
      // The user API returns tickets with reply count, but we need to fetch replies separately
      const response = await fetch(`/api/support/tickets/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data.ticket);
        setReplies(data.replies || []);
      } else {
        // If no detail endpoint, just select the ticket from list
        const ticket = tickets.find((t) => t.id === ticketId);
        if (ticket) {
          setSelectedTicket(ticket);
          setReplies([]);
        }
      }
    } catch {
      // Fallback to just selecting from list
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
        setReplies([]);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit ticket');
      }

      setSubmitStatus('success');
      setFormData({ category: 'general', subject: '', message: '' });
      fetchTickets(); // Refresh ticket list

      // Reset after 3 seconds
      setTimeout(() => {
        setSubmitStatus('idle');
        setShowForm(false);
      }, 3000);
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Support
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>Contact us or view your support requests.</p>
      </div>

      {/* New Ticket Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-6 py-3 rounded-lg font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Contact Support
        </button>
      )}

      {/* New Ticket Form */}
      {showForm && (
        <section className="glass-morphism rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              New Support Request
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ color: 'var(--text-muted)' }}
              className="hover:opacity-70"
            >
              Cancel
            </button>
          </div>

          {submitStatus === 'success' ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">done</div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Message Sent
              </h4>
              <p style={{ color: 'var(--text-secondary)' }}>
                We typically respond within 24-48 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Category
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option
                      key={cat.value}
                      value={cat.value}
                      style={{ backgroundColor: 'var(--surface-elevated)' }}
                    >
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Brief description of your issue"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{
                    backgroundColor: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Please describe your issue or question in detail"
                />
              </div>

              {submitStatus === 'error' && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Ticket History */}
      <section className="glass-morphism rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Your Requests
        </h3>

        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            No support requests yet
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => fetchTicketDetail(ticket.id)}
                className="w-full text-left p-4 rounded-lg transition"
                style={{
                  backgroundColor: 'var(--glass-bg)',
                  boxShadow: selectedTicket?.id === ticket.id ? '0 0 0 2px var(--primary)' : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {ticket.subject}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${STATUS_LABELS[ticket.status]?.color || 'bg-gray-500/20 text-gray-400'}`}
                  >
                    {STATUS_LABELS[ticket.status]?.label || ticket.status}
                  </span>
                </div>
                <div
                  className="flex items-center gap-3 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>{formatDate(ticket.created_at)}</span>
                  {ticket.reply_count > 0 && (
                    <span className="text-green-500">
                      {ticket.reply_count} {ticket.reply_count === 1 ? 'reply' : 'replies'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selectedTicket.subject}</h3>
                <div className="text-sm text-gray-400">{formatDate(selectedTicket.created_at)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${STATUS_LABELS[selectedTicket.status]?.color || 'bg-gray-500/20 text-gray-400'}`}
                >
                  {STATUS_LABELS[selectedTicket.status]?.label || selectedTicket.status}
                </span>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  X
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <>
                  {/* Original Message */}
                  <div
                    className="rounded-lg p-4"
                    style={{
                      backgroundColor: 'var(--primary-hover)',
                      border: '1px solid var(--primary)',
                    }}
                  >
                    <div className="text-xs text-gray-400 mb-2">You wrote:</div>
                    <div className="whitespace-pre-wrap">{selectedTicket.message}</div>
                  </div>

                  {/* Replies */}
                  {replies.length > 0 ? (
                    replies
                      .filter((r) => !r.is_internal_note)
                      .map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-green-500/10 border border-green-500/20 rounded-lg p-4"
                        >
                          <div className="text-xs text-gray-400 mb-2">
                            Support replied on {formatDate(reply.created_at)}:
                          </div>
                          <div className="whitespace-pre-wrap">{reply.message}</div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No replies yet. We typically respond within 24-48 hours.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => setSelectedTicket(null)}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
