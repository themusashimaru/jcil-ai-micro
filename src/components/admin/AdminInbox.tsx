'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail, Inbox, AlertTriangle, Shield, Users, ExternalLink,
  RefreshCw, Clock, CheckCircle, Archive, Trash, Reply,
  Sparkles, Send, X, ChevronRight, Circle, Star
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AdminMessage {
  id: string;
  message_type: string;
  category: string | null;
  severity: string | null;
  from_user_id: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  message: string;
  status: string;
  folder: string;
  parent_message_id: string | null;
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  read_at: string | null;
  metadata: any;
  from_user?: {
    subscription_tier: string;
  };
}

interface FolderCounts {
  all_unread: number;
  user_inquiries: number;
  cyber_emergencies: number;
  admin_emergencies: number;
  external_inquiries: number;
}

export default function AdminInbox() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<FolderCounts>({
    all_unread: 0,
    user_inquiries: 0,
    cyber_emergencies: 0,
    admin_emergencies: 0,
    external_inquiries: 0,
  });

  // Reply state
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [adminIntent, setAdminIntent] = useState('');
  const [selectedTone, setSelectedTone] = useState('professional');
  const [sending, setSending] = useState(false);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection state
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [selectedFolder, statusFilter]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedFolder !== 'all') params.append('folder', selectedFolder);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/admin/inbox/messages?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data.messages || []);
      setCounts(data.counts || counts);
    } catch (error: any) {
      console.error('Failed to fetch inbox messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMessage = async (message: AdminMessage) => {
    setSelectedMessage(message);
    setShowReplyComposer(false);
    setReplyMessage('');
    setAdminIntent('');

    // Mark as read
    if (message.status === 'unread') {
      await updateMessageStatus(message.id, 'read');
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/inbox/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          updates: { status },
        }),
      });

      if (response.ok) {
        await fetchMessages();
      }
    } catch (error) {
      console.error('Failed to update message status:', error);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selectedMessage || !adminIntent.trim()) {
      alert('Please describe what you want to communicate');
      return;
    }

    try {
      setAiDraftLoading(true);
      const response = await fetch('/api/admin/inbox/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          adminIntent,
          tone: selectedTone,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate draft');

      const data = await response.json();
      setReplyMessage(data.draft);
      setAdminIntent(''); // Clear intent after generating
    } catch (error: any) {
      console.error('Failed to generate AI draft:', error);
      alert('Failed to generate draft: ' + error.message);
    } finally {
      setAiDraftLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyMessage.trim()) {
      alert('Please write a reply message');
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/admin/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentMessageId: selectedMessage.id,
          replyMessage,
        }),
      });

      if (!response.ok) throw new Error('Failed to send reply');

      const data = await response.json();

      // If it's an external inquiry, open mailto instead of sending via API
      if (selectedMessage.from_email && !selectedMessage.from_user_id) {
        handleSendExternalEmail();
      } else {
        alert(
          data.notificationSent
            ? 'Reply sent! User has been notified.'
            : 'Reply saved.'
        );
      }

      setShowReplyComposer(false);
      setReplyMessage('');
      setAdminIntent('');
      await fetchMessages();

      // Update selected message
      if (selectedMessage) {
        setSelectedMessage({
          ...selectedMessage,
          status: 'replied',
          admin_reply: replyMessage,
        });
      }
    } catch (error: any) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendExternalEmail = () => {
    if (!selectedMessage || !replyMessage) return;

    // Build mailto link
    const recipientEmail = selectedMessage.from_email || '';
    const emailSubject = `Re: ${selectedMessage.subject}`;
    const emailBody = replyMessage;

    // Create mailto URL with proper encoding
    const mailtoLink = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Open mailto link
    window.location.href = mailtoLink;

    alert('Opening your default email client. Review and send when ready!');
  };

  // Delete messages
  const handleDeleteMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const confirmMessage = messageIds.length === 1
      ? 'Are you sure you want to delete this message?'
      : `Are you sure you want to delete ${messageIds.length} messages?`;

    if (!confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/inbox/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds }),
      });

      if (!response.ok) throw new Error('Failed to delete messages');

      const data = await response.json();
      alert(data.message);

      // Clear selection
      setSelectedMessageIds([]);

      // Clear selected message if it was deleted
      if (selectedMessage && messageIds.includes(selectedMessage.id)) {
        setSelectedMessage(null);
      }

      // Refresh messages
      await fetchMessages();
    } catch (error: any) {
      console.error('Failed to delete messages:', error);
      alert('Failed to delete messages: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Toggle selection for a single message
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedMessageIds.length === messages.length) {
      setSelectedMessageIds([]);
    } else {
      setSelectedMessageIds(messages.map((m) => m.id));
    }
  };

  // Filter and sort messages
  const getFilteredAndSortedMessages = () => {
    let filtered = [...messages];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) =>
        msg.subject.toLowerCase().includes(query) ||
        msg.message.toLowerCase().includes(query) ||
        msg.from_name?.toLowerCase().includes(query) ||
        msg.from_email?.toLowerCase().includes(query) ||
        msg.category?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'sender':
          return (a.from_name || '').localeCompare(b.from_name || '');
        case 'subject':
          return a.subject.localeCompare(b.subject);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getFolderIcon = (folder: string) => {
    switch (folder) {
      case 'cyber_emergencies':
        return <Shield className="h-4 w-4 text-red-600" />;
      case 'admin_emergencies':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'user_inquiries':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'external_inquiries':
        return <ExternalLink className="h-4 w-4 text-purple-600" />;
      default:
        return <Inbox className="h-4 w-4 text-slate-600" />;
    }
  };

  const getSeverityBadge = (severity: string | null) => {
    if (!severity) return null;
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[severity] || 'bg-gray-100 text-gray-800'}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      unread: 'bg-blue-100 text-blue-800',
      read: 'bg-gray-100 text-gray-800',
      replied: 'bg-green-100 text-green-800',
      archived: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return then.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Master Admin Inbox</h2>
          <p className="text-sm text-gray-700 mt-1">
            Manage user inquiries, system alerts, and critical notifications
          </p>
        </div>
        <Button onClick={fetchMessages} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Folders */}
        <div className="col-span-12 md:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Folders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { id: 'all', label: 'All Messages', count: counts.all_unread, icon: Inbox },
                { id: 'user_inquiries', label: 'User Inquiries', count: counts.user_inquiries, icon: Users },
                { id: 'cyber_emergencies', label: 'Cyber Emergencies', count: counts.cyber_emergencies, icon: Shield },
                { id: 'admin_emergencies', label: 'Admin Emergencies', count: counts.admin_emergencies, icon: AlertTriangle },
                { id: 'external_inquiries', label: 'External Inquiries', count: counts.external_inquiries, icon: ExternalLink },
              ].map((folder) => {
                const Icon = folder.icon;
                const isActive = selectedFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{folder.label}</span>
                    </div>
                    {folder.count > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                        {folder.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Status Filter */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-gray-900 font-semibold">
                  <SelectValue className="text-gray-900 font-semibold" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Message List */}
        <div className="col-span-12 md:col-span-4">
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-900">
                  {getFilteredAndSortedMessages().length} Messages
                </CardTitle>
              </div>

              {/* Search Input */}
              <Input
                placeholder="Search messages, senders, subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm"
              />

              {/* Sort and Bulk Actions */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-sm text-gray-900 font-semibold">
                    <SelectValue className="text-gray-900 font-semibold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest First</SelectItem>
                    <SelectItem value="date_asc">Oldest First</SelectItem>
                    <SelectItem value="sender">By Sender</SelectItem>
                    <SelectItem value="subject">By Subject</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                  </SelectContent>
                </Select>

                {selectedMessageIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteMessages(selectedMessageIds)}
                    disabled={deleting}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Delete ({selectedMessageIds.length})
                  </Button>
                )}
              </div>

              {/* Select All Checkbox */}
              {messages.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMessageIds.length === messages.length && messages.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                  <span>Select All</span>
                </label>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2 p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : getFilteredAndSortedMessages().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <Mail className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    {searchQuery ? 'No messages match your search' : 'No messages'}
                  </p>
                </div>
              ) : (
                getFilteredAndSortedMessages().map((msg) => (
                  <div
                    key={msg.id}
                    className={`w-full p-3 rounded-lg border transition-all ${
                      selectedMessage?.id === msg.id
                        ? 'bg-blue-50 border-blue-300'
                        : msg.status === 'unread'
                        ? 'bg-white border-slate-200 hover:border-blue-200'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.includes(msg.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleMessageSelection(msg.id);
                        }}
                        className="mt-1 rounded border-gray-300"
                      />

                      {/* Message Content */}
                      <button
                        onClick={() => handleSelectMessage(msg)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {getFolderIcon(msg.folder)}
                            <span className={`text-sm ${msg.status === 'unread' ? 'font-semibold' : 'font-medium'}`}>
                              {msg.from_name || msg.from_email || 'System'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {getTimeAgo(msg.created_at)}
                          </span>
                        </div>
                        <p className={`text-sm mb-1 ${msg.status === 'unread' ? 'font-semibold' : ''}`}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-gray-800 line-clamp-2 mb-2">
                          {msg.message}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getSeverityBadge(msg.severity)}
                          {getStatusBadge(msg.status)}
                        </div>
                      </button>

                      {/* Individual Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMessages([msg.id]);
                        }}
                        className="mt-1 p-1 hover:bg-red-50 rounded transition-colors"
                        title="Delete message"
                      >
                        <Trash className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Message Detail & Reply */}
        <div className="col-span-12 md:col-span-5">
          {selectedMessage ? (
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getFolderIcon(selectedMessage.folder)}
                      <h3 className="font-semibold text-lg">{selectedMessage.subject}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>From: {selectedMessage.from_name || selectedMessage.from_email || 'System'}</span>
                      {selectedMessage.from_user?.subscription_tier && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                          {selectedMessage.from_user.subscription_tier}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getSeverityBadge(selectedMessage.severity)}
                      {getStatusBadge(selectedMessage.status)}
                      <span className="text-xs text-slate-500">
                        {new Date(selectedMessage.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMessages([selectedMessage.id])}
                      title="Delete message"
                    >
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMessage(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Original Message */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Message:</h4>
                  <div className="bg-slate-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-900">
                    {selectedMessage.message}
                  </div>
                </div>

                {/* Metadata */}
                {selectedMessage.metadata && Object.keys(selectedMessage.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Additional Info:</h4>
                    <div className="bg-slate-50 rounded-lg p-4 text-xs font-mono text-gray-800">
                      {JSON.stringify(selectedMessage.metadata, null, 2)}
                    </div>
                  </div>
                )}

                {/* Existing Reply */}
                {selectedMessage.admin_reply && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-2">
                      Your Reply ({selectedMessage.replied_at ? new Date(selectedMessage.replied_at).toLocaleString() : ''}):
                    </h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 whitespace-pre-wrap text-sm">
                      {selectedMessage.admin_reply}
                    </div>
                  </div>
                )}

                {/* Reply Composer */}
                {showReplyComposer && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold text-blue-700">Compose Reply:</h4>

                    {/* AI Draft Helper */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <span className="font-semibold text-sm">AI Response Writer</span>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-900 mb-1 block">
                          Tone:
                        </label>
                        <Select value={selectedTone} onValueChange={setSelectedTone}>
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="apologetic">Apologetic</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-900 mb-1 block">
                          What do you want to communicate?
                        </label>
                        <Textarea
                          value={adminIntent}
                          onChange={(e) => setAdminIntent(e.target.value)}
                          placeholder="E.g., Tell the user their payment was successful and thank them for upgrading..."
                          rows={3}
                          className="bg-white"
                        />
                      </div>

                      <Button
                        onClick={handleGenerateAIDraft}
                        disabled={aiDraftLoading || !adminIntent.trim()}
                        size="sm"
                        className="w-full"
                      >
                        {aiDraftLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Draft
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Reply Message */}
                    <div>
                      <label className="text-xs font-medium text-gray-900 mb-1 block">
                        Your Reply:
                      </label>
                      <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Write your reply here..."
                        rows={8}
                        className="font-sans"
                      />
                    </div>

                    <div className="flex gap-2">
                      {/* Different button text for external vs internal */}
                      {selectedMessage.from_email && !selectedMessage.from_user_id ? (
                        <Button
                          onClick={handleSendReply}
                          disabled={sending || !replyMessage.trim()}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          {sending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Open in Email Client
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSendReply}
                          disabled={sending || !replyMessage.trim()}
                          className="flex-1"
                        >
                          {sending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Internal Notification
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setShowReplyComposer(false);
                          setReplyMessage('');
                          setAdminIntent('');
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>

                    {/* Helper text for external emails */}
                    {selectedMessage.from_email && !selectedMessage.from_user_id && (
                      <p className="text-xs text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-200">
                        📧 External inquiry - Clicking "Open in Email Client" will open Gmail/Outlook with a pre-filled draft. Review and send when ready!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>

              {/* Action Buttons */}
              {!showReplyComposer && selectedMessage.from_user_id && (
                <div className="border-t p-4">
                  <Button
                    onClick={() => setShowReplyComposer(true)}
                    className="w-full"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply to User
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="h-[700px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Mail className="h-12 w-12 mx-auto mb-3" />
                <p className="text-sm">Select a message to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
