/**
 * ADMIN CONVERSATION VIEWER
 * View full conversation with all messages
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: string;
  created_at: string;
  moderation_flagged: boolean;
  moderation_categories: Record<string, unknown> | null;
}

interface ConversationData {
  id: string;
  title: string;
  tool_context: string | null;
  created_at: string;
  last_message_at: string;
  message_count: number;
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export default function AdminConversationViewerPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/conversations/${params.conversationId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch conversation (${response.status})`);
        }

        const data = await response.json();
        setConversation(data.conversation);
        setMessages(data.messages || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [params.conversationId]);

  const handleExportPDF = () => {
    window.open(`/api/admin/conversations/${params.conversationId}/export`, '_blank');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-500/20 text-blue-300';
      case 'assistant':
        return 'bg-green-500/20 text-green-300';
      case 'system':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="glass-morphism rounded-2xl p-6">
        <div className="text-red-400 mb-4">Error: {error || 'Conversation not found'}</div>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          ← Back
        </button>
        <button
          onClick={handleExportPDF}
          className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 flex items-center gap-2"
        >
          <span>📄</span>
          <span>Export PDF</span>
        </button>
      </div>

      {/* Conversation Info */}
      <div className="glass-morphism rounded-2xl p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">{conversation.title}</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400 mb-1">User</div>
            <div className="font-medium">{conversation.user.full_name || conversation.user.email}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Context</div>
            <div className="font-medium">{conversation.tool_context || 'general'}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Created</div>
            <div className="font-medium">{new Date(conversation.created_at).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Messages</div>
            <div className="font-medium">{messages.length}</div>
          </div>
        </div>

        {/* Privacy Warning */}
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="text-sm">
            <strong className="text-yellow-400">⚠️ Privacy Notice:</strong> You are viewing private user data.
            Access is logged for audit purposes. Handle according to privacy policy.
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-6">Conversation Messages</h3>

        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No messages in this conversation</div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="border-b border-white/5 pb-6 last:border-0 last:pb-0">
                {/* Message Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(message.role)}`}>
                      {message.role.toUpperCase()}
                    </span>
                    {message.moderation_flagged && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300">
                        ⚠️ FLAGGED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(message.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Message Content */}
                <div className={`rounded-lg p-4 ${
                  message.role === 'user' ? 'bg-blue-500/10 border border-blue-500/20' :
                  message.role === 'assistant' ? 'bg-green-500/10 border border-green-500/20' :
                  'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                </div>

                {/* Moderation Details */}
                {message.moderation_flagged && message.moderation_categories && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="text-xs font-semibold text-red-400 mb-2">Moderation Flags:</div>
                    <div className="text-xs text-gray-300">
                      {JSON.stringify(message.moderation_categories, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="mt-6 text-center text-xs text-gray-500">
        Conversation ID: {conversation.id} • User ID: {conversation.user.id}
      </div>
    </div>
  );
}
