/**
 * ADMIN USER DETAIL PAGE
 * Shows user info and their conversation history
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  created_at: string;
  total_messages: number;
  total_images: number;
  last_message_date: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  conversation_count: number;
  actual_message_count: number;
}

interface Conversation {
  id: string;
  title: string;
  tool_context: string | null;
  message_count: number;
  created_at: string;
  last_message_at: string;
}

export default function AdminUserDetailPage({ params }: { params: { userId: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchUserData();
    fetchConversations();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`/api/admin/users/${params.userId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
    }
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      let url = `/api/admin/users/${params.userId}/conversations`;

      // Add date filters if set
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      setConversations(data.conversations || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchConversations();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(fetchConversations, 0);
  };

  const handleExportPDF = (conversationId: string) => {
    window.open(`/api/admin/conversations/${conversationId}/export`, '_blank');
  };

  const getContextBadgeColor = (context: string | null) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-500/20 text-gray-300',
      email: 'bg-blue-500/20 text-blue-300',
      study: 'bg-purple-500/20 text-purple-300',
      research: 'bg-green-500/20 text-green-300',
      code: 'bg-orange-500/20 text-orange-300',
      image: 'bg-pink-500/20 text-pink-300',
      video: 'bg-red-500/20 text-red-300',
      sms: 'bg-cyan-500/20 text-cyan-300',
      scripture: 'bg-amber-500/20 text-amber-300',
    };
    return colors[context || 'general'] || colors.general;
  };

  if (error && !user) {
    return (
      <div className="glass-morphism rounded-2xl p-6">
        <div className="text-red-400 mb-4">Error: {error}</div>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          ← Back to Users
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-6 text-blue-400 hover:text-blue-300 flex items-center gap-2"
      >
        ← Back to Users
      </button>

      {/* User Info Card */}
      <div className="glass-morphism rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{user.full_name || 'No name'}</h2>
            <p className="text-gray-400">{user.email}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              user.subscription_tier === 'executive' ? 'bg-amber-500/20 text-amber-300' :
              user.subscription_tier === 'pro' ? 'bg-purple-500/20 text-purple-300' :
              user.subscription_tier === 'basic' ? 'bg-blue-500/20 text-blue-300' :
              'bg-gray-500/20 text-gray-300'
            }`}>
              {(user.subscription_tier || 'free').toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <div className="text-sm text-gray-400">Conversations</div>
            <div className="text-xl font-bold">{(user.conversation_count || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Messages</div>
            <div className="text-xl font-bold">{(user.actual_message_count || user.total_messages || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Images</div>
            <div className="text-xl font-bold">{(user.total_images || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Joined</div>
            <div className="text-sm">{new Date(user.created_at).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Last Active</div>
            <div className="text-sm">
              {user.last_message_date ? new Date(user.last_message_date).toLocaleDateString() : 'Never'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Status</div>
            <div className="text-sm">
              {user.subscription_status ? user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1) : 'None'}
            </div>
          </div>
        </div>

        {user.is_banned && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="font-semibold text-red-400">🚫 User Banned</div>
            <div className="text-sm text-gray-300">{user.ban_reason || 'No reason provided'}</div>
          </div>
        )}
      </div>

      {/* Date Filters */}
      <div className="glass-morphism rounded-2xl p-4 md:p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Filter Conversations by Date</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleApplyFilters}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 font-medium"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="rounded-lg bg-white/10 px-6 py-3 text-white hover:bg-white/20"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="glass-morphism rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">
            Conversation History ({conversations.length})
          </h3>
          <button
            onClick={fetchConversations}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No conversations found for this user
            {(startDate || endDate) && ' in the selected date range'}
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium mb-2 truncate">{conv.title}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className={`px-2 py-1 rounded ${getContextBadgeColor(conv.tool_context)}`}>
                        {conv.tool_context || 'general'}
                      </span>
                      <span>{conv.message_count} messages</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{new Date(conv.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Link
                      href={`/admin/conversations/${conv.id}`}
                      className="flex-1 md:flex-none text-center rounded-lg bg-blue-600 px-4 py-3 md:py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      View Chat
                    </Link>
                    <button
                      onClick={() => handleExportPDF(conv.id)}
                      className="flex-1 md:flex-none text-center rounded-lg bg-purple-600 px-4 py-3 md:py-2 text-sm font-medium text-white hover:bg-purple-700"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
