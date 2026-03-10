/**
 * ADMIN MESSAGES PAGE
 *
 * PURPOSE:
 * - Compose and send messages to users
 * - Individual messages by user ID/email
 * - Broadcast messages by tier (plus, pro, executive, all)
 * - View sent message history
 */

'use client';

import { useState, useEffect } from 'react';

interface SentMessage {
  id: string;
  subject: string;
  message: string;
  message_type: string;
  priority: string;
  is_broadcast: boolean;
  recipient_tier: string | null;
  recipient?: {
    email?: string;
    full_name?: string | null;
    tier?: string;
  };
  broadcast_sent_count: number;
  created_at: string;
}

type RecipientType = 'individual' | 'broadcast';

const MESSAGE_TYPES = [
  { value: 'general', label: 'General Announcement' },
  { value: 'account', label: 'Account Update' },
  { value: 'feature', label: 'New Feature' },
  { value: 'maintenance', label: 'Maintenance Notice' },
  { value: 'promotion', label: 'Special Offer' },
  { value: 'support_response', label: 'Support Response' },
  { value: 'welcome', label: 'Welcome Message' },
  { value: 'warning', label: 'Important Warning' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TIERS = [
  { value: 'all', label: 'All Users' },
  { value: 'free', label: 'Free Tier' },
  { value: 'basic', label: 'Plus (Basic)' },
  { value: 'pro', label: 'Pro' },
  { value: 'executive', label: 'Executive' },
];

export default function AdminMessagesPage() {
  const [activeTab, setActiveTab] = useState<'compose' | 'sent'>('compose');
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Compose form state
  const [recipientType, setRecipientType] = useState<RecipientType>('individual');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientTier, setRecipientTier] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [priority, setPriority] = useState('normal');

  // Fetch sent messages
  const fetchSentMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/messages');
      if (!response.ok) throw new Error('Failed to fetch messages');
      const responseData = await response.json();
      // API returns { ok: true, data: { messages } }
      const data = responseData.data || responseData;
      setSentMessages(data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sent') {
      fetchSentMessages();
    }
  }, [activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const payload: Record<string, unknown> = {
        recipient_type: recipientType,
        subject,
        message,
        message_type: messageType,
        priority,
      };

      if (recipientType === 'individual') {
        payload.recipient_email = recipientEmail.trim().toLowerCase();
      } else {
        payload.recipient_tier = recipientTier;
      }

      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to send message');
      }

      // API returns { ok: true, data: { recipientCount, messageId } }
      const data = responseData.data || responseData;
      const recipientCount = data.recipientCount || 1;
      setSuccess(
        `Message sent successfully to ${recipientCount} user${recipientCount > 1 ? 's' : ''}!`
      );

      // Reset form
      setRecipientEmail('');
      setSubject('');
      setMessage('');
      setMessageType('general');
      setPriority('normal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">User Messages</h1>
        <p className="text-text-secondary">
          Send messages directly to users or broadcast to subscription tiers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-theme">
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${activeTab === 'compose' ? 'text-primary border-b-primary' : 'text-text-secondary border-b-transparent'}`}
        >
          Compose Message
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${activeTab === 'sent' ? 'text-primary border-b-primary' : 'text-text-secondary border-b-transparent'}`}
        >
          Sent Messages
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="rounded-xl p-6 bg-glass border border-theme">
          <form onSubmit={handleSend} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                {success}
              </div>
            )}

            {/* Recipient Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-3 text-text-secondary">Send To</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="individual"
                    checked={recipientType === 'individual'}
                    onChange={() => setRecipientType('individual')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-text-primary">Individual User</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="broadcast"
                    checked={recipientType === 'broadcast'}
                    onChange={() => setRecipientType('broadcast')}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-text-primary">Broadcast to Tier</span>
                </label>
              </div>
            </div>

            {/* Individual Recipient */}
            {recipientType === 'individual' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  User Email
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
                />
              </div>
            )}

            {/* Broadcast Tier Selection */}
            {recipientType === 'broadcast' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  Target Tier
                </label>
                <select
                  value={recipientTier}
                  onChange={(e) => setRecipientTier(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
                >
                  {TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value} className="bg-surface">
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Message Type & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  Message Type
                </label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
                >
                  {MESSAGE_TYPES.map((type) => (
                    <option key={type.value} value={type.value} className="bg-surface">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-text-secondary">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value} className="bg-surface">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium mb-2 text-text-secondary">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Message subject"
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium mb-2 text-text-secondary">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={8}
                placeholder="Write your message here..."
                className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition bg-surface-elevated border border-theme text-text-primary"
              />
            </div>

            {/* Send Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 bg-primary text-surface"
              >
                {sending
                  ? 'Sending...'
                  : recipientType === 'broadcast'
                    ? 'Send Broadcast'
                    : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sent Messages Tab */}
      {activeTab === 'sent' && (
        <div className="rounded-xl overflow-hidden bg-glass border border-theme">
          {loading ? (
            <div className="p-8 text-center text-text-muted">Loading sent messages...</div>
          ) : sentMessages.length === 0 ? (
            <div className="p-8 text-center text-text-muted">No messages sent yet</div>
          ) : (
            <div className="divide-y divide-theme">
              {sentMessages.map((msg) => (
                <div key={msg.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-primary-hover text-primary">
                          {msg.is_broadcast ? `Broadcast: ${msg.recipient_tier}` : 'Individual'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-glass text-text-secondary">
                          {MESSAGE_TYPES.find((t) => t.value === msg.message_type)?.label ||
                            msg.message_type}
                        </span>
                        {msg.priority !== 'normal' && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              msg.priority === 'urgent'
                                ? 'bg-red-500/20 text-red-400'
                                : msg.priority === 'high'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {msg.priority}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-text-primary">{msg.subject}</h3>
                      <p className="text-sm mt-1 line-clamp-2 text-text-muted">{msg.message}</p>
                      <p className="text-xs mt-2 text-text-muted">
                        {msg.is_broadcast
                          ? `Sent to ${msg.broadcast_sent_count} users`
                          : `Sent to ${msg.recipient?.email || 'Unknown'}`}
                        {' • '}
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
