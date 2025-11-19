/**
 * ADMIN NOTIFICATIONS PAGE
 * Send notifications to users and view notification history
 */

'use client';

import { useState, useEffect } from 'react';

interface NotificationHistory {
  id: string;
  type: string;
  priority: string;
  title: string;
  body: string;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
  recipientCount: number;
}

export default function AdminNotificationsPage() {
  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'system' | 'admin' | 'billing' | 'feature'>('admin');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'tier' | 'individual'>('all');
  const [targetTier, setTargetTier] = useState<'free' | 'basic' | 'pro' | 'executive'>('free');
  const [targetUserIds, setTargetUserIds] = useState('');

  // UI state
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load notification history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendNotification = async () => {
    // Validate form
    if (!title.trim() || !body.trim()) {
      setSendStatus({ type: 'error', message: 'Title and body are required' });
      return;
    }

    if (targetType === 'individual' && !targetUserIds.trim()) {
      setSendStatus({ type: 'error', message: 'Please enter at least one user ID' });
      return;
    }

    setSending(true);
    setSendStatus(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        priority,
        actionUrl: actionUrl.trim() || undefined,
        actionLabel: actionLabel.trim() || undefined,
        targetType,
        targetTier: targetType === 'tier' ? targetTier : undefined,
        targetUserIds: targetType === 'individual'
          ? targetUserIds.split(',').map(id => id.trim()).filter(Boolean)
          : undefined,
      };

      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSendStatus({
          type: 'success',
          message: `Successfully sent notification to ${data.count} user(s)!`,
        });

        // Reset form
        setTitle('');
        setBody('');
        setActionUrl('');
        setActionLabel('');
        setTargetUserIds('');

        // Refresh history
        fetchHistory();
      } else {
        setSendStatus({
          type: 'error',
          message: data.message || 'Failed to send notification',
        });
      }
    } catch (error) {
      setSendStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setSending(false);
      setTimeout(() => setSendStatus(null), 5000);
    }
  };

  const getTypeColor = (notifType: string) => {
    const colors: Record<string, string> = {
      system: 'bg-gray-500/20 text-gray-300',
      admin: 'bg-blue-500/20 text-blue-300',
      billing: 'bg-green-500/20 text-green-300',
      feature: 'bg-purple-500/20 text-purple-300',
    };
    return colors[notifType] || colors.admin;
  };

  const getPriorityColor = (notifPriority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500/20 text-gray-300',
      normal: 'bg-blue-500/20 text-blue-300',
      high: 'bg-orange-500/20 text-orange-300',
      urgent: 'bg-red-500/20 text-red-300',
    };
    return colors[notifPriority] || colors.normal;
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Send Notifications</h2>
      <p className="text-gray-400 mb-8">
        Send notifications to your users. Notifications appear in their notification bell.
      </p>

      {/* Send Status */}
      {sendStatus && (
        <div className={`mb-6 p-4 rounded-lg ${
          sendStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {sendStatus.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Send Notification Form */}
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-6">Compose Notification</h3>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                placeholder="e.g., New Feature Available!"
                maxLength={100}
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Message *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                placeholder="Your notification message..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{body.length}/500 characters</p>
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'system' | 'admin' | 'billing' | 'feature')}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="system">System</option>
                  <option value="billing">Billing</option>
                  <option value="feature">Feature</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Action Button (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Action Button (Optional)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  className="bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                  placeholder="Button text"
                />
                <input
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  className="bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                  placeholder="/some-page"
                />
              </div>
            </div>

            {/* Target Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Send To</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'all' | 'tier' | 'individual')}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none mb-3"
              >
                <option value="all">All Users</option>
                <option value="tier">Specific Tier</option>
                <option value="individual">Individual Users</option>
              </select>

              {targetType === 'tier' && (
                <select
                  value={targetTier}
                  onChange={(e) => setTargetTier(e.target.value as 'free' | 'basic' | 'pro' | 'executive')}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                >
                  <option value="free">Free Tier</option>
                  <option value="basic">Basic Tier</option>
                  <option value="pro">Pro Tier</option>
                  <option value="executive">Executive Tier</option>
                </select>
              )}

              {targetType === 'individual' && (
                <textarea
                  value={targetUserIds}
                  onChange={(e) => setTargetUserIds(e.target.value)}
                  className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                  placeholder="Enter user IDs, separated by commas"
                  rows={3}
                />
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendNotification}
              disabled={sending}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </div>

        {/* Notification History */}
        <div className="glass-morphism rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Recent Notifications</h3>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No notifications sent yet</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {history.map((notif) => (
                <div key={notif.id} className="border border-white/10 rounded-lg p-4 hover:bg-white/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium">{notif.title}</div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${getTypeColor(notif.type)}`}>
                        {notif.type}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(notif.priority)}`}>
                        {notif.priority}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">{notif.body}</div>
                  {notif.action_label && (
                    <div className="text-xs text-blue-400 mb-2">
                      Button: {notif.action_label} → {notif.action_url}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{notif.recipientCount} recipient(s)</span>
                    <span>{new Date(notif.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
