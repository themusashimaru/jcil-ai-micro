'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, TrendingUp, Zap,
  Calendar, ArrowLeft, RefreshCw, Activity,
  Search, UserCog, Mail, Clock, BarChart3, LineChart,
  FileText, Download, MessageSquare, Paperclip, X, ExternalLink, Shield, Ban, AlertTriangle, Bell, ShieldAlert, Inbox
} from 'lucide-react';
import AdminInbox from '@/components/admin/AdminInbox';
import { Input } from '@/components/ui/input';
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface User {
  id: string;
  email: string;
  subscription_tier: string;
  daily_message_count: number;
  daily_message_limit: number;
  daily_token_count: number;
  last_active: string;
  created_at: string;
}

interface AdminStats {
  period: string;
  dateRange: { start: string; end: string };
  users: {
    total: number;
    byTier: Record<string, number>;
    newSignups: number;
  };
  revenue: {
    monthlyRecurring: number;
    byTier: Array<{ tier: string; count: number; monthlyRevenue: number }>;
    annualProjection: number;
  };
  usage: {
    totalMessages: number;
    totalTokens: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };
  costs: {
    totalApiCost: number;
    inputCost: number;
    outputCost: number;
    avgCostPerMessage: number;
  };
  profit: {
    gross: number;
    margin: number;
  };
}

type TabType = 'overview' | 'users' | 'notifications' | 'reports' | 'activity' | 'moderation' | 'safety' | 'iam' | 'inbox';

// Helper function to format time ago
function getTimeAgo(timestamp: string): string {
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
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [letterFilter, setLetterFilter] = useState<string>('all');
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'quarterly' | 'half' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

  // Notification state
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTier, setNotificationTier] = useState<string>('all');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // Activity feed state
  const [activities, setActivities] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState({ activeNow: 0, totalActivities: 0 });
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Conversation viewer state - User-centric approach
  const [activityUsers, setActivityUsers] = useState<any[]>([]);
  const [filteredActivityUsers, setFilteredActivityUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userLetterFilter, setUserLetterFilter] = useState<string>('all');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showModerationMenu, setShowModerationMenu] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingConversationDetail, setIsLoadingConversationDetail] = useState(false);

  // Moderation tab state
  const [moderatedUsers, setModeratedUsers] = useState<any[]>([]);
  const [filteredModeratedUsers, setFilteredModeratedUsers] = useState<any[]>([]);
  const [selectedModeratedUser, setSelectedModeratedUser] = useState<any>(null);
  const [modUserSearchQuery, setModUserSearchQuery] = useState('');
  const [modUserLetterFilter, setModUserLetterFilter] = useState<string>('all');
  const [modConversations, setModConversations] = useState<any[]>([]);
  const [filteredModConversations, setFilteredModConversations] = useState<any[]>([]);
  const [selectedModConversation, setSelectedModConversation] = useState<any>(null);
  const [modDateFilter, setModDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [modCustomStartDate, setModCustomStartDate] = useState('');
  const [modCustomEndDate, setModCustomEndDate] = useState('');
  const [modStatusFilter, setModStatusFilter] = useState<'all' | 'suspended' | 'banned'>('all');
  const [isLoadingModUsers, setIsLoadingModUsers] = useState(false);
  const [isLoadingModConversations, setIsLoadingModConversations] = useState(false);
  const [isLoadingModConversationDetail, setIsLoadingModConversationDetail] = useState(false);

  // Safety tab state
  const [safetyLogs, setSafetyLogs] = useState<any[]>([]);
  const [filteredSafetyLogs, setFilteredSafetyLogs] = useState<any[]>([]);
  const [selectedSafetyLog, setSelectedSafetyLog] = useState<any>(null);
  const [safetySeverityFilter, setSafetySeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [safetyCategoryFilter, setSafetyCategoryFilter] = useState<string>('all');
  const [safetyReviewedFilter, setSafetyReviewedFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [safetyDateFilter, setSafetyDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [safetyCustomStartDate, setSafetyCustomStartDate] = useState('');
  const [safetyCustomEndDate, setSafetyCustomEndDate] = useState('');
  const [isLoadingSafety, setIsLoadingSafety] = useState(false);

  // Notification counts
  const [generalNotifications, setGeneralNotifications] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState(0);
  const [cyberAlerts, setCyberAlerts] = useState(0);

  // IAM (Identity & Access Management) state
  const [iamUsers, setIamUsers] = useState<any[]>([]);
  const [filteredIamUsers, setFilteredIamUsers] = useState<any[]>([]);
  const [iamSearchQuery, setIamSearchQuery] = useState('');
  const [iamRoleFilter, setIamRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'cyber_analyst'>('all');
  const [isLoadingIam, setIsLoadingIam] = useState(false);
  const [selectedIamUser, setSelectedIamUser] = useState<any>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/stats?period=${period}`);

      if (response.status === 403) {
        setError('Access denied - Admin privileges required');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const response = await fetch('/api/admin/users');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setFilteredUsers(data.users);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserTier = async (userId: string, newTier: string) => {
    try {
      setIsUpdatingTier(true);
      const response = await fetch('/api/admin/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        const errorDetails = `${errorData.error}\nDetails: ${errorData.details || 'none'}\nCode: ${errorData.code || 'none'}\nHint: ${errorData.hint || 'none'}`;
        throw new Error(errorDetails);
      }

      const result = await response.json();
      console.log('Update result:', result);

      // Small delay to ensure DB has updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh users list and stats
      await fetchUsers();
      await fetchStats();

      // Close the modal
      setManagingUser(null);
      setSelectedTier('');

      alert('✅ User tier updated successfully!');
    } catch (err: any) {
      console.error('Failed to update user tier:', err);
      // Try to get detailed error from response
      const errorMsg = err.message || 'Unknown error';
      alert(`❌ Failed to update user tier: ${errorMsg}\n\nCheck console for details.`);
    } finally {
      setIsUpdatingTier(false);
    }
  };

  const handleManageUser = (user: User) => {
    setManagingUser(user);
    setSelectedTier(user.subscription_tier);
  };

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      alert('❌ Please fill in both title and message');
      return;
    }

    try {
      setIsSendingNotification(true);
      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle,
          message: notificationMessage,
          tierFilter: notificationTier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }

      const result = await response.json();
      alert(`✅ Notification sent successfully to ${result.sentCount} users!`);

      // Clear form
      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationTier('all');
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      alert(`❌ Failed to send notification: ${err.message}`);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const fetchActivity = async () => {
    try {
      setIsLoadingActivity(true);
      const response = await fetch('/api/admin/activity');

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      setActivities(data.activities || []);
      setActivityStats(data.stats || { activeNow: 0, totalActivities: 0 });
    } catch (err: any) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const fetchActivityUsers = async () => {
    try {
      setIsLoadingUsers(true);

      // Fetch ALL users from the system
      const usersResponse = await fetch('/api/admin/users');
      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users');
      }
      const usersData = await usersResponse.json();
      const allUsers = usersData.users || [];

      // Fetch conversations to get activity stats
      const convsResponse = await fetch('/api/admin/conversations');
      if (!convsResponse.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const convsData = await convsResponse.json();
      const conversations = convsData.conversations || [];

      // Create a map of conversation stats by user
      const statsMap = new Map<string, any>();
      conversations.forEach((conv: any) => {
        if (!statsMap.has(conv.user_id)) {
          statsMap.set(conv.user_id, {
            conversation_count: 0,
            total_messages: 0,
            total_attachments: 0,
          });
        }
        const stats = statsMap.get(conv.user_id)!;
        stats.conversation_count++;
        stats.total_messages += conv.message_count || 0;
        stats.total_attachments += conv.attachment_count || 0;
      });

      // Merge all users with their conversation stats
      const enrichedUsers = allUsers.map((user: any) => {
        const stats = statsMap.get(user.id) || {
          conversation_count: 0,
          total_messages: 0,
          total_attachments: 0,
        };
        return {
          id: user.id,
          email: user.email || 'No email',
          tier: user.subscription_tier || 'free',
          conversation_count: stats.conversation_count,
          total_messages: stats.total_messages,
          total_attachments: stats.total_attachments,
        };
      });

      setActivityUsers(enrichedUsers);
      setFilteredActivityUsers(enrichedUsers);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchUserConversations = async (userId: string) => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch(`/api/admin/conversations?userId=${userId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      const convs = data.conversations || [];
      setConversations(convs);
      setFilteredConversations(convs);
      // Reset date filter when selecting new user
      setDateFilter('all');
      setCustomStartDate('');
      setCustomEndDate('');
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchConversationDetail = async (conversationId: string) => {
    try {
      console.log('[ADMIN] Fetching conversation detail for:', conversationId);
      setIsLoadingConversationDetail(true);
      const response = await fetch(`/api/admin/conversations/${conversationId}`);

      console.log('[ADMIN] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ADMIN] Error response:', errorText);
        throw new Error(`Failed to fetch conversation details: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ADMIN] Conversation data:', data);
      setSelectedConversation(data);
    } catch (err: any) {
      console.error('[ADMIN] Failed to fetch conversation details:', err);
      alert(`Failed to load conversation: ${err.message}`);
    } finally {
      setIsLoadingConversationDetail(false);
    }
  };

  const fetchModeratedUsers = async () => {
    try {
      setIsLoadingModUsers(true);
      const response = await fetch('/api/admin/users');

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      const allUsers = data.users || [];

      // Filter for only suspended or banned users
      const moderatedOnly = allUsers.filter((user: any) =>
        user.is_suspended || user.is_banned
      );

      setModeratedUsers(moderatedOnly);
      setFilteredModeratedUsers(moderatedOnly);
    } catch (err: any) {
      console.error('Failed to fetch moderated users:', err);
    } finally {
      setIsLoadingModUsers(false);
    }
  };

  const fetchModUserConversations = async (userId: string) => {
    try {
      setIsLoadingModConversations(true);
      const response = await fetch(`/api/admin/conversations?userId=${userId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      const convs = data.conversations || [];
      setModConversations(convs);
      setFilteredModConversations(convs);
      setModDateFilter('all');
      setModCustomStartDate('');
      setModCustomEndDate('');
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoadingModConversations(false);
    }
  };

  const fetchModConversationDetail = async (conversationId: string) => {
    try {
      setIsLoadingModConversationDetail(true);
      const response = await fetch(`/api/admin/conversations/${conversationId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MOD] Error response:', errorText);
        throw new Error(`Failed to fetch conversation details: ${response.status}`);
      }

      const data = await response.json();
      setSelectedModConversation(data);
    } catch (err: any) {
      console.error('[MOD] Failed to fetch conversation details:', err);
      alert(`Failed to load conversation: ${err.message}`);
    } finally {
      setIsLoadingModConversationDetail(false);
    }
  };

  const fetchSafetyLogs = async () => {
    try {
      setIsLoadingSafety(true);
      const response = await fetch('/api/admin/safety-logs');

      if (!response.ok) {
        throw new Error('Failed to fetch safety logs');
      }

      const data = await response.json();
      setSafetyLogs(data.logs || []);
      setFilteredSafetyLogs(data.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch safety logs:', err);
    } finally {
      setIsLoadingSafety(false);
    }
  };

  const fetchNotificationCounts = async () => {
    try {
      // Fetch general notifications (unread user messages, system alerts, etc.)
      setGeneralNotifications(0); // TODO: Implement general notifications API

      // Fetch admin notifications (moderation needed, user reports, etc.)
      const safetyResponse = await fetch('/api/admin/safety-logs');
      if (safetyResponse.ok) {
        const safetyData = await safetyResponse.json();
        const unreviewedSafety = (safetyData.logs || []).filter((log: any) => !log.reviewed).length;
        setAdminNotifications(unreviewedSafety);
      }

      // Fetch critical cyber security alerts
      const statsResponse = await fetch('/api/security/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setCyberAlerts(statsData.critical_events || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch notification counts:', err);
    }
  };

  const fetchIamUsers = async () => {
    try {
      setIsLoadingIam(true);
      const response = await fetch('/api/admin/iam/users');

      if (!response.ok) {
        throw new Error('Failed to fetch IAM users');
      }

      const data = await response.json();
      setIamUsers(data.users || []);
      setFilteredIamUsers(data.users || []);
    } catch (err: any) {
      console.error('Failed to fetch IAM users:', err);
    } finally {
      setIsLoadingIam(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string, value: boolean) => {
    try {
      const response = await fetch('/api/admin/iam/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role, value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      const result = await response.json();
      alert(`✅ ${result.message}`);

      // Refresh IAM users
      fetchIamUsers();
    } catch (error: any) {
      console.error('Role update error:', error);
      alert(`❌ Failed to update role: ${error.message}`);
    }
  };

  const handleModerateUser = async (userId: string, action: string, duration?: string) => {
    const reason = prompt(`Reason for ${action}ing this user (optional):`);

    try {
      const response = await fetch('/api/admin/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action,
          duration,
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to moderate user');
      }

      const result = await response.json();
      alert(`✅ ${result.message}`);

      // Refresh data based on current context
      if (activeTab === 'moderation') {
        fetchModeratedUsers();
        if (selectedModeratedUser) {
          setSelectedModeratedUser(null);
          setModConversations([]);
          setSelectedModConversation(null);
        }
      } else if (selectedConversation) {
        fetchConversationDetail(selectedConversation.conversation.id);
      }
    } catch (error: any) {
      console.error('Moderation error:', error);
      alert(`❌ Failed to ${action} user: ${error.message}`);
    }
  };

  const handleEmailReport = (conversationId: string, userEmail: string, conversationTitle: string) => {
    // First, trigger the download
    window.open(`/api/admin/conversations/${conversationId}/export`, '_blank');

    // Small delay to ensure download starts, then open mailto
    setTimeout(() => {
      const subject = encodeURIComponent(`JCIL.AI - User Conversation Export: ${userEmail}`);
      const fileName = `conversation_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
      const exportDate = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const body = encodeURIComponent(`Dear Recipient,

This message contains a confidential user conversation export from JCIL.AI, provided in response to your authorized request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPORT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Account:         ${userEmail}
Conversation Title:   ${conversationTitle || 'Untitled Conversation'}
Export Generated:     ${exportDate}
Export ID:            ${conversationId}
Attachment:           ${fileName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENTIALITY NOTICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  This document contains private user communications and personally identifiable information (PII). The attached export includes the complete conversation history, message content, timestamps, and any associated file attachments.

This information is provided solely for authorized legal, compliance, investigative, or regulatory purposes. Unauthorized access, use, disclosure, or distribution is strictly prohibited and may be subject to legal action under applicable data protection and privacy laws.

By accessing this export, you acknowledge that:
• You are authorized to receive this information
• The information will be handled in accordance with applicable laws
• The information will be protected with appropriate security measures
• The information will only be used for the stated authorized purpose

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The complete conversation export is attached to this email as an HTML document. You may open it in any web browser or save it as a PDF for your records using your browser's print function.

If you have any questions regarding this export or require additional information, please contact our legal compliance team.

Best regards,
JCIL.AI Legal Compliance Team
adminactivities@jcil.ai

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This export was generated by an authorized administrator and is logged for audit purposes.
Document ID: ${conversationId}
Generated: ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 500);
  };

  // Filter users based on search query and letter filter
  useEffect(() => {
    let filtered = users;

    // Apply letter filter first
    if (letterFilter !== 'all') {
      filtered = filtered.filter((user) =>
        user.email.toLowerCase().startsWith(letterFilter.toLowerCase())
      );
    }

    // Then apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.subscription_tier.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [searchQuery, letterFilter, users]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchNotificationCounts();
  }, [period]);

  // Refresh notification counts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotificationCounts();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Fetch users when activity tab is opened
  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityUsers();
    } else if (activeTab === 'moderation') {
      fetchModeratedUsers();
    } else if (activeTab === 'safety') {
      fetchSafetyLogs();
    } else if (activeTab === 'iam') {
      fetchIamUsers();
    }
  }, [activeTab]);

  // Auto-refresh activity data every 30 seconds when on activity tab
  useEffect(() => {
    if (activeTab === 'activity') {
      const interval = setInterval(() => {
        fetchActivityUsers();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Auto-refresh moderation/suspensions data every 30 seconds when on moderation tab
  useEffect(() => {
    if (activeTab === 'moderation') {
      const interval = setInterval(() => {
        fetchModeratedUsers();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Filter users by letter and search query
  useEffect(() => {
    let filtered = activityUsers;

    // Apply letter filter first
    if (userLetterFilter !== 'all') {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().startsWith(userLetterFilter.toLowerCase())
      );
    }

    // Then apply search query
    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      );
    }

    setFilteredActivityUsers(filtered);
  }, [userLetterFilter, userSearchQuery, activityUsers]);

  // Filter conversations by date
  useEffect(() => {
    if (!selectedUser) {
      setFilteredConversations([]);
      return;
    }

    let filtered = conversations;
    const now = new Date();

    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = conversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= today;
      });
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = conversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= sevenDaysAgo;
      });
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = conversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= thirtyDaysAgo;
      });
    } else if (dateFilter === 'custom' && customStartDate) {
      const startDate = new Date(customStartDate);
      const endDate = customEndDate ? new Date(customEndDate) : now;
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);

      filtered = conversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= startDate && convDate <= endDate;
      });
    }

    setFilteredConversations(filtered);
  }, [dateFilter, customStartDate, customEndDate, conversations, selectedUser]);

  // Filter moderated users by status, letter, and search
  useEffect(() => {
    let filtered = moderatedUsers;

    // Filter by status (all/suspended/banned)
    if (modStatusFilter === 'suspended') {
      filtered = filtered.filter(user => user.is_suspended && !user.is_banned);
    } else if (modStatusFilter === 'banned') {
      filtered = filtered.filter(user => user.is_banned);
    }

    // Apply letter filter
    if (modUserLetterFilter !== 'all') {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().startsWith(modUserLetterFilter.toLowerCase())
      );
    }

    // Apply search query
    if (modUserSearchQuery.trim()) {
      const query = modUserSearchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      );
    }

    setFilteredModeratedUsers(filtered);
  }, [modStatusFilter, modUserLetterFilter, modUserSearchQuery, moderatedUsers]);

  // Filter moderated conversations by date
  useEffect(() => {
    if (!selectedModeratedUser) {
      setFilteredModConversations([]);
      return;
    }

    let filtered = modConversations;
    const now = new Date();

    if (modDateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = modConversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= today;
      });
    } else if (modDateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = modConversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= sevenDaysAgo;
      });
    } else if (modDateFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = modConversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= thirtyDaysAgo;
      });
    } else if (modDateFilter === 'custom' && modCustomStartDate) {
      const startDate = new Date(modCustomStartDate);
      const endDate = modCustomEndDate ? new Date(modCustomEndDate) : now;
      endDate.setHours(23, 59, 59, 999);

      filtered = modConversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate >= startDate && convDate <= endDate;
      });
    }

    setFilteredModConversations(filtered);
  }, [modDateFilter, modCustomStartDate, modCustomEndDate, modConversations, selectedModeratedUser]);

  // Filter safety logs by severity, category, reviewed status, and date
  useEffect(() => {
    let filtered = safetyLogs;

    // Filter by severity
    if (safetySeverityFilter !== 'all') {
      filtered = filtered.filter(log => log.severity === safetySeverityFilter);
    }

    // Filter by category
    if (safetyCategoryFilter !== 'all') {
      filtered = filtered.filter(log =>
        log.categories && log.categories.includes(safetyCategoryFilter)
      );
    }

    // Filter by reviewed status
    if (safetyReviewedFilter === 'reviewed') {
      filtered = filtered.filter(log => log.reviewed);
    } else if (safetyReviewedFilter === 'unreviewed') {
      filtered = filtered.filter(log => !log.reviewed);
    }

    // Filter by date
    const now = new Date();
    if (safetyDateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= today;
      });
    } else if (safetyDateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= sevenDaysAgo;
      });
    } else if (safetyDateFilter === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= thirtyDaysAgo;
      });
    } else if (safetyDateFilter === 'custom' && safetyCustomStartDate) {
      const startDate = new Date(safetyCustomStartDate);
      const endDate = safetyCustomEndDate ? new Date(safetyCustomEndDate) : now;
      endDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= startDate && logDate <= endDate;
      });
    }

    setFilteredSafetyLogs(filtered);
  }, [safetySeverityFilter, safetyCategoryFilter, safetyReviewedFilter, safetyDateFilter, safetyCustomStartDate, safetyCustomEndDate, safetyLogs]);

  // Filter IAM users by role and search query
  useEffect(() => {
    let filtered = iamUsers;

    // Filter by role
    if (iamRoleFilter === 'admin') {
      filtered = filtered.filter(user => user.is_admin);
    } else if (iamRoleFilter === 'moderator') {
      filtered = filtered.filter(user => user.is_moderator);
    } else if (iamRoleFilter === 'cyber_analyst') {
      filtered = filtered.filter(user => user.is_cyber_analyst);
    }

    // Filter by search query (email)
    if (iamSearchQuery.trim()) {
      const query = iamSearchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.email?.toLowerCase().includes(query)
      );
    }

    setFilteredIamUsers(filtered);
  }, [iamRoleFilter, iamSearchQuery, iamUsers]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Access Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const tierColors: Record<string, string> = {
    free: 'from-slate-500 to-slate-600',
    basic: 'from-blue-500 to-blue-600',
    pro: 'from-blue-600 to-blue-700',
    premium: 'from-purple-500 to-purple-600',
    executive: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-slate-600 mt-1">JCIL.AI Command Center</p>
            </div>
            <div className="flex gap-3">
              {/* Cyber Security Button with Critical Alerts Bell */}
              <Button
                onClick={() => router.push('/security')}
                className="bg-red-600 hover:bg-red-700 text-white relative"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Cyber Security
                {cyberAlerts > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
                    {cyberAlerts}
                  </span>
                )}
              </Button>

              {/* Admin Panel Button with Notifications Bell */}
              <Button
                className="bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 relative"
              >
                <Bell className="h-4 w-4 mr-2" />
                Admin
                {adminNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {adminNotifications}
                  </span>
                )}
              </Button>

              {/* Back to Chat Button with General Notifications */}
              <Button
                onClick={() => router.push('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white relative"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
                {generalNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {generalNotifications}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-1.5 md:gap-2 mt-6 flex-wrap">
            {([
              { key: 'daily', label: 'Today' },
              { key: 'monthly', label: 'This Month' },
              { key: 'quarterly', label: 'This Quarter' },
              { key: 'half', label: 'This Half' },
              { key: 'yearly', label: 'This Year' }
            ] as const).map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.key)}
                className={`text-xs md:text-sm h-8 md:h-9 ${period === p.key ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                {p.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              disabled={loading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 border-b border-slate-200">
            <div className="flex space-x-4 md:space-x-8 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {[
                { id: 'overview', label: 'Overview', icon: TrendingUp },
                { id: 'inbox', label: 'Inbox', icon: Inbox },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'notifications', label: 'Notifications', icon: Mail },
                { id: 'reports', label: 'Reports', icon: BarChart3 },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'moderation', label: 'Moderation', icon: Shield },
                { id: 'safety', label: 'Safety Threats', icon: AlertTriangle },
                { id: 'iam', label: 'IAM / Roles', icon: UserCog },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0
                      ${isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.users.total}</div>
              <p className="text-xs text-slate-500 mt-1">
                +{stats.users.newSignups} new this period
              </p>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card className="border-l-4 border-l-green-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Monthly Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${stats.revenue.monthlyRecurring.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ${stats.revenue.annualProjection.toLocaleString()} annual projection
              </p>
            </CardContent>
          </Card>

          {/* Total Messages */}
          <Card className="border-l-4 border-l-purple-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Messages</CardTitle>
              <Activity className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {stats.usage.totalMessages.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.usage.totalTokens.toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>

          {/* Gross Profit */}
          <Card className="border-l-4 border-l-amber-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Gross Profit</CardTitle>
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${stats.profit.gross.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.profit.margin}% margin
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-slate-900">Revenue by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.revenue.byTier.map((tier) => {
                const percentage = stats.revenue.monthlyRecurring > 0
                  ? (tier.monthlyRevenue / stats.revenue.monthlyRecurring) * 100
                  : 0;
                const showTextInside = percentage > 15; // Only show text inside if bar is wide enough
                const isFree = tier.monthlyRevenue === 0;

                return (
                  <div key={tier.tier}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900 capitalize w-24">
                          {tier.tier}
                        </span>
                        <span className="text-sm text-slate-600">
                          {tier.count} {tier.count === 1 ? 'user' : 'users'}
                        </span>
                      </div>
                      <span className={`font-bold text-lg ${isFree ? 'text-slate-500' : 'text-slate-900'}`}>
                        ${tier.monthlyRevenue.toLocaleString()}
                        {isFree && ' (Free)'}
                      </span>
                    </div>
                    <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden">
                      {isFree ? (
                        <div className="h-full flex items-center px-3">
                          <span className="text-slate-500 text-sm font-medium">
                            Free tier - no revenue
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`h-full bg-gradient-to-r ${tierColors[tier.tier]} transition-all duration-500 rounded-lg flex items-center ${showTextInside ? 'justify-end px-4' : ''}`}
                            style={{
                              width: `${Math.max(percentage, 2)}%`,
                            }}
                          >
                            {showTextInside && (
                              <span className="text-white text-sm font-semibold">
                                {percentage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {!showTextInside && (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-medium">
                              {percentage.toFixed(1)}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* API Costs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Zap className="h-5 w-5 mr-2 text-orange-500" />
                API Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-slate-600">Total API Cost</span>
                  <span className="text-2xl font-bold text-slate-900">
                    ${stats.costs.totalApiCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Input Tokens</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.inputCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Output Tokens</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.outputCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm text-slate-600">Avg Cost/Message</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.avgCostPerMessage.toFixed(4)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Activity className="h-5 w-5 mr-2 text-purple-500" />
                Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-slate-600">Total Tokens</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {(stats.usage.totalTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Input Tokens (est.)</span>
                  <span className="font-semibold text-slate-900">
                    {(stats.usage.estimatedInputTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Output Tokens (est.)</span>
                  <span className="font-semibold text-slate-900">
                    {(stats.usage.estimatedOutputTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm text-slate-600">Total Messages</span>
                  <span className="font-semibold text-slate-900">
                    {stats.usage.totalMessages.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue vs Costs Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <LineChart className="h-5 w-5 mr-2 text-green-600" />
                Revenue & Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={[
                  { name: 'Free', revenue: 0, cost: 0 },
                  { name: 'Basic', revenue: stats.revenue.byTier.find(t => t.tier === 'basic')?.monthlyRevenue || 0, cost: 0 },
                  { name: 'Pro', revenue: stats.revenue.byTier.find(t => t.tier === 'pro')?.monthlyRevenue || 0, cost: 0 },
                  { name: 'Executive', revenue: stats.revenue.byTier.find(t => t.tier === 'executive')?.monthlyRevenue || 0, cost: 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue ($)" />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                User Distribution by Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.revenue.byTier.filter(t => t.count > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tier, count }) => `${tier}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.revenue.byTier.map((entry, index) => {
                      const colors = ['#94a3b8', '#60a5fa', '#8b5cf6', '#f59e0b'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Token Usage Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Activity className="h-5 w-5 mr-2 text-purple-600" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={[
                  { name: 'Messages', value: stats.usage.totalMessages },
                  { name: 'Tokens (K)', value: Math.round(stats.usage.totalTokens / 1000) },
                  { name: 'Revenue ($)', value: stats.revenue.monthlyRecurring },
                  { name: 'Costs ($)', value: stats.costs.totalApiCost },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#c4b5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
          </>
        )}

        {/* Inbox Tab */}
        {activeTab === 'inbox' && <AdminInbox />}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
          {/* User Count by Tier */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                    <Users className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {users.filter(u => u.subscription_tier === 'free').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Free Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$0/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {users.filter(u => u.subscription_tier === 'basic').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Basic Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$12/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mb-3">
                    <Users className="h-6 w-6 text-yellow-600" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-900">
                    {users.filter(u => u.subscription_tier === 'pro').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Pro Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$30/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-3">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {users.filter(u => u.subscription_tier === 'executive').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Executive Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$150/month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management Table */}
          <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center text-slate-900">
                  <UserCog className="h-5 w-5 mr-2 text-blue-600" />
                  User Management
                </CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchUsers}
                    disabled={usersLoading}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Alphabetical Filter */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs md:text-sm font-medium text-slate-700">Filter by first letter:</p>
                  <Button
                    variant={letterFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLetterFilter('all')}
                    className={`text-[10px] md:text-xs px-1.5 md:px-2 h-6 md:h-7 ${letterFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                  >
                    All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-0.5 md:gap-1">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((letter) => {
                    const userCount = users.filter(u => u.email.toLowerCase().startsWith(letter.toLowerCase())).length;
                    return (
                      <Button
                        key={letter}
                        variant={letterFilter === letter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setLetterFilter(letter)}
                        disabled={userCount === 0}
                        className={`text-[10px] md:text-xs px-1 md:px-2 h-6 md:h-7 min-w-[24px] md:min-w-[32px] ${
                          letterFilter === letter
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : userCount === 0
                            ? 'opacity-30 cursor-not-allowed'
                            : ''
                        }`}
                        title={`${userCount} user${userCount !== 1 ? 's' : ''}`}
                      >
                        {letter}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {usersError ? (
              <div className="text-center py-8">
                <div className="text-red-600 font-semibold mb-2">Error loading users</div>
                <div className="text-sm text-slate-600 mb-4">{usersError}</div>
                <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg max-w-2xl mx-auto text-left">
                  <p className="font-semibold mb-2">💡 Did you run the SQL setup?</p>
                  <p>Make sure you ran the <code className="bg-white px-2 py-1 rounded">add-admin-user-management.sql</code> file in your Supabase SQL Editor.</p>
                  <p className="mt-2">This creates the <code className="bg-white px-2 py-1 rounded">get_all_users_for_admin()</code> function needed to fetch user data.</p>
                </div>
                <Button
                  onClick={fetchUsers}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : usersLoading ? (
              <div className="text-center py-8 text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {searchQuery ? 'No users found matching your search' : 'No users yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        <Mail className="h-4 w-4 inline mr-1" />
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Tier</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Today's Usage</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Tokens</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Last Active
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Joined</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const tierColorMap: Record<string, string> = {
                        free: 'bg-slate-100 text-slate-700',
                        basic: 'bg-blue-100 text-blue-700',
                        pro: 'bg-blue-200 text-blue-800',
                        premium: 'bg-purple-100 text-purple-700',
                        executive: 'bg-amber-100 text-amber-700',
                      };

                      return (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm text-slate-900">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold uppercase ${tierColorMap[user.subscription_tier] || tierColorMap.free}`}>
                              {user.subscription_tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-700">
                            {user.daily_message_count} / {user.daily_message_limit}
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-700">
                            {user.daily_token_count.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {new Date(user.last_active).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleManageUser(user)}
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </CardContent>
        </Card>
        </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-slate-900">
                  <Mail className="h-5 w-5 mr-2 text-blue-600" />
                  Send Notifications to Users
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Send announcements, updates, or messages to your users. Filter by subscription tier.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Audience
                  </label>
                  <select
                    value={notificationTier}
                    onChange={(e) => setNotificationTier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  >
                    <option value="all">All Users ({users.length} users)</option>
                    <option value="free">Free Tier ({users.filter(u => u.subscription_tier === 'free').length} users)</option>
                    <option value="basic">Basic Tier ({users.filter(u => u.subscription_tier === 'basic').length} users)</option>
                    <option value="pro">Pro Tier ({users.filter(u => u.subscription_tier === 'pro').length} users)</option>
                    <option value="executive">Executive Tier ({users.filter(u => u.subscription_tier === 'executive').length} users)</option>
                  </select>
                </div>

                {/* Notification Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notification Title
                  </label>
                  <Input
                    type="text"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    placeholder="e.g., New Features Released!"
                    className="w-full"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-500 mt-1">{notificationTitle.length}/100 characters</p>
                </div>

                {/* Notification Message */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    placeholder="Write your message here..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white min-h-[150px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1">{notificationMessage.length}/500 characters</p>
                </div>

                {/* Preview */}
                {(notificationTitle || notificationMessage) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-900 mb-2">Preview:</p>
                    {notificationTitle && <p className="font-semibold text-blue-900 mb-1">{notificationTitle}</p>}
                    {notificationMessage && <p className="text-sm text-blue-800">{notificationMessage}</p>}
                  </div>
                )}

                {/* Send Button */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setNotificationTitle('');
                      setNotificationMessage('');
                      setNotificationTier('all');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={isSendingNotification}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={sendNotification}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                  >
                    {isSendingNotification ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Notification
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                Export Reports
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Download comprehensive reports of your user data and statistics
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* CSV Export */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">CSV Export</h3>
                        <p className="text-sm text-slate-500">Spreadsheet format</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Download a CSV file containing all user data including emails, subscription tiers,
                      message counts, token usage, and activity dates. Perfect for importing into
                      Excel or Google Sheets.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="px-2 py-1 bg-slate-100 rounded">Email addresses</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Subscription tiers</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Usage statistics</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Activity dates</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.open('/api/admin/export/csv', '_blank')}
                    className="ml-4 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </div>

              {/* PDF Export */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">PDF Report</h3>
                        <p className="text-sm text-slate-500">Professional document</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Generate a comprehensive PDF report with dashboard statistics, revenue breakdowns,
                      user distribution charts, and detailed user listings. Includes formatted tables
                      and professional styling ready for presentations or archiving.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="px-2 py-1 bg-slate-100 rounded">Dashboard stats</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Revenue analysis</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">User breakdown</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Print-ready</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.open('/api/admin/export/pdf', '_blank')}
                    className="ml-4 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Export Information</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Exports include data for all {users.length} users in the system</li>
                      <li>• CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</li>
                      <li>• PDF reports will automatically open in a new tab with a print dialog</li>
                      <li>• All exports reflect real-time data at the moment of generation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Tab - User-Centric Conversation Viewer */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-red-100 rounded-full">
                    <ExternalLink className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-1">⚠️ Admin Conversation Viewer - Legal/Investigation Use Only</h3>
                  <p className="text-sm text-red-800">
                    This tool provides full access to all user conversations and attachments for legal compliance, investigations, and user support.
                    All access is logged. Use only when authorized.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-slate-900">
                      <Users className="h-5 w-5 mr-2 text-purple-600" />
                      Users
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchActivityUsers}
                      disabled={isLoadingUsers}
                      className="flex-shrink-0"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {/* Search Box with Autocomplete */}
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 z-10" />
                      <Input
                        type="text"
                        placeholder="Search by email or user ID..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setShowUserSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => userSearchQuery.length > 0 && setShowUserSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowUserSuggestions(false), 200)}
                        className="pl-10 w-full"
                      />
                      {showUserSuggestions && userSearchQuery && filteredActivityUsers.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                          <div className="p-2 text-xs text-slate-500 border-b">
                            {filteredActivityUsers.length} user{filteredActivityUsers.length !== 1 ? 's' : ''} found
                          </div>
                          {filteredActivityUsers.slice(0, 10).map((user) => (
                            <div
                              key={user.id}
                              onClick={() => {
                                setSelectedUser(user);
                                setSelectedConversation(null);
                                fetchUserConversations(user.id);
                                setUserSearchQuery('');
                                setShowUserSuggestions(false);
                              }}
                              className="p-3 hover:bg-purple-50 cursor-pointer border-b last:border-b-0 transition-colors"
                            >
                              <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">{user.conversation_count} conversations</span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-500 truncate">{user.id.substring(0, 8)}...</span>
                              </div>
                            </div>
                          ))}
                          {filteredActivityUsers.length > 10 && (
                            <div className="p-2 text-xs text-center text-slate-500 bg-slate-50">
                              +{filteredActivityUsers.length - 10} more users
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Letter Filter */}
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs md:text-sm font-medium text-slate-700">Filter by letter:</p>
                        <Button
                          variant={userLetterFilter === 'all' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setUserLetterFilter('all')}
                          className={`text-[10px] md:text-xs px-1.5 md:px-2 h-6 md:h-7 ${userLetterFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                        >
                          All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-0.5 md:gap-1">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((letter) => {
                          const userCount = activityUsers.filter(u => u.email.toLowerCase().startsWith(letter.toLowerCase())).length;
                          return (
                            <Button
                              key={letter}
                              variant={userLetterFilter === letter ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setUserLetterFilter(letter)}
                              disabled={userCount === 0}
                              className={`text-[10px] md:text-xs px-1 md:px-2 h-6 md:h-7 min-w-[24px] md:min-w-[32px] ${
                                userLetterFilter === letter
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : userCount === 0
                                  ? 'opacity-30 cursor-not-allowed'
                                  : ''
                              }`}
                              title={`${userCount} user${userCount !== 1 ? 's' : ''}`}
                            >
                              {letter}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Showing {filteredActivityUsers.length} of {activityUsers.length} users
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingUsers ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading users...</p>
                    </div>
                  ) : filteredActivityUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No users found</p>
                      <p className="text-sm text-slate-500">
                        {userSearchQuery ? 'No users match your search' : userLetterFilter !== 'all' ? 'No users starting with this letter' : 'No users with conversations'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredActivityUsers.map((user) => {
                        const getTierColor = (tier: string) => {
                          switch (tier) {
                            case 'free': return 'bg-slate-100 text-slate-700';
                            case 'basic': return 'bg-blue-100 text-blue-700';
                            case 'pro': return 'bg-yellow-100 text-yellow-700';
                            case 'executive': return 'bg-purple-100 text-purple-700';
                            default: return 'bg-slate-100 text-slate-700';
                          }
                        };

                        return (
                          <div
                            key={user.id}
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedConversation(null);
                              fetchUserConversations(user.id);
                            }}
                            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50 ${
                              selectedUser?.id === user.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {user.email}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getTierColor(user.tier)}`}>
                                {user.tier}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {user.conversation_count} chat{user.conversation_count !== 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {user.total_messages} msgs
                              </span>
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {user.total_attachments}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User's Conversations */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-slate-900">
                      {selectedUser ? (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          {selectedUser.email}'s Conversations
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-slate-400" />
                          Select a User
                        </>
                      )}
                    </CardTitle>
                    {selectedUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(null);
                          setConversations([]);
                          setFilteredConversations([]);
                          setSelectedConversation(null);
                          setDateFilter('all');
                          setCustomStartDate('');
                          setCustomEndDate('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Date Filter - Only show when user is selected */}
                  {selectedUser && (
                    <div className="mt-4 space-y-3">
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-sm font-medium text-slate-700 mb-2">Filter by date:</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant={dateFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateFilter('all')}
                            className={`text-xs ${dateFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          >
                            All Time
                          </Button>
                          <Button
                            variant={dateFilter === 'today' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateFilter('today')}
                            className={`text-xs ${dateFilter === 'today' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          >
                            Today
                          </Button>
                          <Button
                            variant={dateFilter === '7days' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateFilter('7days')}
                            className={`text-xs ${dateFilter === '7days' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          >
                            Last 7 Days
                          </Button>
                          <Button
                            variant={dateFilter === '30days' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateFilter('30days')}
                            className={`text-xs ${dateFilter === '30days' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          >
                            Last 30 Days
                          </Button>
                          <Button
                            variant={dateFilter === 'custom' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateFilter('custom')}
                            className={`text-xs ${dateFilter === 'custom' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          >
                            Custom Range
                          </Button>
                        </div>

                        {/* Custom Date Range Inputs */}
                        {dateFilter === 'custom' && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-600 mb-1 block">Start Date</label>
                              <Input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600 mb-1 block">End Date</label>
                              <Input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                          Showing {filteredConversations.length} of {conversations.length} conversations
                        </p>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedUser ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No user selected</p>
                      <p className="text-sm text-slate-500">Select a user to view their conversations</p>
                    </div>
                  ) : isLoadingConversations ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversations...</p>
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversations found</p>
                      <p className="text-sm text-slate-500">
                        {dateFilter !== 'all' ? 'No conversations in this date range' : 'This user has no conversations yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredConversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => fetchConversationDetail(conv.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50 ${
                            selectedConversation?.conversation?.id === conv.id
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-slate-200'
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900 truncate mb-2">
                            {conv.title || 'Untitled conversation'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {conv.message_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {conv.attachment_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(conv.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          {conv.latest_message && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                              {conv.latest_message.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversation Detail Viewer */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="flex items-center text-slate-900">
                      {selectedConversation ? (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          Conversation Details
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-slate-400" />
                          Select a Conversation
                        </>
                      )}
                    </CardTitle>
                    {selectedConversation && (
                      <div className="flex flex-col items-end gap-2 min-w-[160px]">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleEmailReport(
                            selectedConversation.conversation.id,
                            selectedConversation.conversation.user_email,
                            selectedConversation.conversation.title
                          )}
                          className="bg-purple-600 hover:bg-purple-700 text-white w-full"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email Report
                        </Button>

                        {/* Moderation Dropdown */}
                        <div className="relative w-full">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowModerationMenu(!showModerationMenu)}
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 w-full"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Moderate
                          </Button>

                          {showModerationMenu && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowModerationMenu(false)}
                              />
                              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2">
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-slate-700 px-2 py-1">Suspend User</p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleModerateUser(selectedConversation.conversation.user_id, 'suspend', '1h');
                                      setShowModerationMenu(false);
                                    }}
                                    className="w-full justify-start text-xs text-slate-900 hover:bg-yellow-50 hover:text-slate-900"
                                  >
                                    1 Hour
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleModerateUser(selectedConversation.conversation.user_id, 'suspend', '1d');
                                      setShowModerationMenu(false);
                                    }}
                                    className="w-full justify-start text-xs text-slate-900 hover:bg-yellow-50 hover:text-slate-900"
                                  >
                                    1 Day
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleModerateUser(selectedConversation.conversation.user_id, 'suspend', '1w');
                                      setShowModerationMenu(false);
                                    }}
                                    className="w-full justify-start text-xs text-slate-900 hover:bg-yellow-50 hover:text-slate-900"
                                  >
                                    1 Week
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleModerateUser(selectedConversation.conversation.user_id, 'suspend', '1m');
                                      setShowModerationMenu(false);
                                    }}
                                    className="w-full justify-start text-xs text-slate-900 hover:bg-yellow-50 hover:text-slate-900"
                                  >
                                    1 Month
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleModerateUser(selectedConversation.conversation.user_id, 'suspend', '6m');
                                      setShowModerationMenu(false);
                                    }}
                                    className="w-full justify-start text-xs text-slate-900 hover:bg-yellow-50 hover:text-slate-900"
                                  >
                                    6 Months
                                  </Button>

                                  <div className="border-t border-slate-200 my-2" />

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm('⚠️ Are you sure you want to PERMANENTLY BAN this user? This action should only be taken for serious violations.')) {
                                        handleModerateUser(selectedConversation.conversation.user_id, 'ban');
                                        setShowModerationMenu(false);
                                      }
                                    }}
                                    className="w-full justify-start text-xs text-red-700 hover:bg-red-50 hover:text-red-800 font-semibold"
                                  >
                                    <Ban className="h-3 w-3 mr-2" />
                                    Ban Permanently
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex gap-2 w-full">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/admin/conversations/${selectedConversation.conversation.id}/export`, '_blank')}
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedConversation(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingConversationDetail ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversation...</p>
                    </div>
                  ) : !selectedConversation ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversation selected</p>
                      <p className="text-sm text-slate-500">Click on a conversation to view full details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Conversation Meta */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 mb-1">User</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.conversation.user_email}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Tier</p>
                            <p className="font-semibold text-slate-900 capitalize">{selectedConversation.conversation.user_tier}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Messages</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.stats.total_messages}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Attachments</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.stats.total_attachments}</p>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        <h3 className="text-sm font-semibold text-slate-900 sticky top-0 bg-white pb-2">
                          Messages ({selectedConversation.stats.total_messages})
                        </h3>
                        {selectedConversation.messages.map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg border ${
                              msg.role === 'user'
                                ? 'bg-blue-50 border-blue-200'
                                : msg.role === 'assistant'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-semibold uppercase ${
                                msg.role === 'user' ? 'text-blue-700' :
                                msg.role === 'assistant' ? 'text-green-700' :
                                'text-slate-700'
                              }`}>
                                {msg.role}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                              {msg.content || '[No content]'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Attachments */}
                      {selectedConversation.attachments.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            Attachments ({selectedConversation.stats.total_attachments})
                          </h3>
                          {selectedConversation.attachments.map((att: any) => (
                            <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-slate-600" />
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{att.file_name || 'Unknown file'}</p>
                                  <p className="text-xs text-slate-500">
                                    {att.file_type} • {att.file_size ? (att.file_size / 1024).toFixed(2) + ' KB' : 'Unknown size'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(att.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Moderation Tab - Suspended & Banned Users */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-red-100 rounded-full">
                    <Shield className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-1">🚨 User Moderation Center</h3>
                  <p className="text-sm text-red-800">
                    This section shows suspended and banned users. All moderation actions are logged for compliance and audit purposes.
                    Exercise caution when lifting suspensions or unbanning users.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Moderated Users List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <Shield className="h-5 w-5 mr-2 text-red-600" />
                    Moderated Users
                  </CardTitle>
                  <div className="mt-4 space-y-4">
                    {/* Status Filter */}
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Filter by status:</p>
                      <div className="flex gap-2">
                        <Button
                          variant={modStatusFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setModStatusFilter('all')}
                          className={`text-xs ${modStatusFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                        >
                          All
                        </Button>
                        <Button
                          variant={modStatusFilter === 'suspended' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setModStatusFilter('suspended')}
                          className={`text-xs ${modStatusFilter === 'suspended' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                        >
                          Suspended
                        </Button>
                        <Button
                          variant={modStatusFilter === 'banned' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setModStatusFilter('banned')}
                          className={`text-xs ${modStatusFilter === 'banned' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        >
                          Banned
                        </Button>
                      </div>
                    </div>

                    {/* Search Box */}
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search by email or user ID..."
                        value={modUserSearchQuery}
                        onChange={(e) => setModUserSearchQuery(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>

                    {/* Letter Filter */}
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-slate-700">Filter by letter:</p>
                        <Button
                          variant={modUserLetterFilter === 'all' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setModUserLetterFilter('all')}
                          className={`text-xs px-2 h-7 ${modUserLetterFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                        >
                          All
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((letter) => {
                          const userCount = moderatedUsers.filter(u => u.email.toLowerCase().startsWith(letter.toLowerCase())).length;
                          return (
                            <Button
                              key={letter}
                              variant={modUserLetterFilter === letter ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setModUserLetterFilter(letter)}
                              disabled={userCount === 0}
                              className={`text-xs px-2 h-7 min-w-[32px] ${
                                modUserLetterFilter === letter
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : userCount === 0
                                  ? 'opacity-30 cursor-not-allowed'
                                  : ''
                              }`}
                              title={`${userCount} user${userCount !== 1 ? 's' : ''}`}
                            >
                              {letter}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Showing {filteredModeratedUsers.length} of {moderatedUsers.length} moderated users
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingModUsers ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading moderated users...</p>
                    </div>
                  ) : filteredModeratedUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No moderated users</p>
                      <p className="text-sm text-slate-500">
                        {modUserSearchQuery || modUserLetterFilter !== 'all' || modStatusFilter !== 'all'
                          ? 'No users match your filters'
                          : 'No suspended or banned users at this time'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredModeratedUsers.map((user) => {
                        const getStatusBadge = () => {
                          if (user.is_banned) {
                            return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">BANNED</span>;
                          }
                          if (user.is_suspended) {
                            const expiryDate = user.suspended_until ? new Date(user.suspended_until) : null;
                            const isExpired = expiryDate && expiryDate < new Date();
                            if (isExpired) {
                              return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">EXPIRED</span>;
                            }
                            return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">SUSPENDED</span>;
                          }
                          return null;
                        };

                        return (
                          <div
                            key={user.id}
                            onClick={() => {
                              setSelectedModeratedUser(user);
                              setSelectedModConversation(null);
                              fetchModUserConversations(user.id);
                            }}
                            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-red-300 hover:bg-red-50 ${
                              selectedModeratedUser?.id === user.id
                                ? 'border-red-500 bg-red-50'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {user.email}
                                </p>
                                {user.is_suspended && user.suspended_until && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Until: {new Date(user.suspended_until).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              {getStatusBadge()}
                            </div>
                            {(user.suspension_reason || user.ban_reason) && (
                              <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                                Reason: {user.suspension_reason || user.ban_reason}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User's Conversations - Same as Activity tab */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-slate-900">
                      {selectedModeratedUser ? (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          {selectedModeratedUser.email}'s Conversations
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-slate-400" />
                          Select a User
                        </>
                      )}
                    </CardTitle>
                    {selectedModeratedUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedModeratedUser(null);
                          setModConversations([]);
                          setFilteredModConversations([]);
                          setSelectedModConversation(null);
                          setModDateFilter('all');
                          setModCustomStartDate('');
                          setModCustomEndDate('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Date Filter - Same as Activity tab */}
                  {selectedModeratedUser && (
                    <div className="mt-4 space-y-3">
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-sm font-medium text-slate-700 mb-2">Filter by date:</p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant={modDateFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setModDateFilter('all')} className={`text-xs ${modDateFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}>All Time</Button>
                          <Button variant={modDateFilter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setModDateFilter('today')} className={`text-xs ${modDateFilter === 'today' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}>Today</Button>
                          <Button variant={modDateFilter === '7days' ? 'default' : 'outline'} size="sm" onClick={() => setModDateFilter('7days')} className={`text-xs ${modDateFilter === '7days' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}>Last 7 Days</Button>
                          <Button variant={modDateFilter === '30days' ? 'default' : 'outline'} size="sm" onClick={() => setModDateFilter('30days')} className={`text-xs ${modDateFilter === '30days' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}>Last 30 Days</Button>
                          <Button variant={modDateFilter === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setModDateFilter('custom')} className={`text-xs ${modDateFilter === 'custom' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}>Custom Range</Button>
                        </div>

                        {modDateFilter === 'custom' && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-600 mb-1 block">Start Date</label>
                              <Input type="date" value={modCustomStartDate} onChange={(e) => setModCustomStartDate(e.target.value)} className="text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600 mb-1 block">End Date</label>
                              <Input type="date" value={modCustomEndDate} onChange={(e) => setModCustomEndDate(e.target.value)} className="text-xs" />
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                          Showing {filteredModConversations.length} of {modConversations.length} conversations
                        </p>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedModeratedUser ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No user selected</p>
                      <p className="text-sm text-slate-500">Select a moderated user to view their conversations</p>
                    </div>
                  ) : isLoadingModConversations ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversations...</p>
                    </div>
                  ) : filteredModConversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversations found</p>
                      <p className="text-sm text-slate-500">
                        {modDateFilter !== 'all' ? 'No conversations in this date range' : 'This user has no conversations yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {filteredModConversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => fetchModConversationDetail(conv.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50 ${
                            selectedModConversation?.conversation?.id === conv.id
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-slate-200'
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900 truncate mb-2">
                            {conv.title || 'Untitled conversation'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{conv.message_count}</span>
                            <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{conv.attachment_count}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(conv.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversation Detail with Lift/Unban Buttons */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="flex items-center text-slate-900">
                      {selectedModConversation ? (
                        <><MessageSquare className="h-5 w-5 mr-2 text-purple-600" />Conversation Details</>
                      ) : (
                        <><MessageSquare className="h-5 w-5 mr-2 text-slate-400" />Select a Conversation</>
                      )}
                    </CardTitle>
                    {selectedModConversation && (
                      <div className="flex flex-col items-end gap-2 min-w-[160px]">
                        {selectedModeratedUser?.is_suspended && !selectedModeratedUser?.is_banned && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              if (confirm(`Lift suspension for ${selectedModeratedUser.email}?`)) {
                                handleModerateUser(selectedModeratedUser.id, 'lift');
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white w-full"
                          >
                            Lift Suspension
                          </Button>
                        )}
                        {selectedModeratedUser?.is_banned && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              if (confirm(`⚠️ Unban ${selectedModeratedUser.email}? They will regain full access.`)) {
                                handleModerateUser(selectedModeratedUser.id, 'unban');
                              }
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white w-full"
                          >
                            Unban User
                          </Button>
                        )}
                        <div className="flex gap-2 w-full">
                          <Button size="sm" variant="outline" onClick={() => window.open(`/api/admin/conversations/${selectedModConversation.conversation.id}/export`, '_blank')} className="flex-1">
                            <Download className="h-4 w-4 mr-2" />Export
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedModConversation(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingModConversationDetail ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversation...</p>
                    </div>
                  ) : !selectedModConversation ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversation selected</p>
                      <p className="text-sm text-slate-500">Click on a conversation to view full details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-slate-600 mb-1">User</p><p className="font-semibold text-slate-900">{selectedModConversation.conversation.user_email}</p></div>
                          <div><p className="text-slate-600 mb-1">Messages</p><p className="font-semibold text-slate-900">{selectedModConversation.stats.total_messages}</p></div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Messages</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {selectedModConversation.messages.map((msg: any, idx: number) => (
                            <div key={msg.id} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase text-slate-600">{msg.role}</span>
                                <span className="text-xs text-slate-500">{new Date(msg.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-900 whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Safety Threats Tab */}
        {activeTab === 'safety' && (
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-1">🚨 Safety Threats Monitoring Center</h3>
                  <p className="text-sm text-red-800">
                    This section displays flagged content detected by our AI moderation system. Critical threats (self-harm, violence, terrorism) require immediate review.
                    All logs are monitored for legal compliance and can be exported for law enforcement.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-red-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{safetyLogs.length}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Critical</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {safetyLogs.filter(l => l.severity === 'critical').length}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">High</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {safetyLogs.filter(l => l.severity === 'high').length}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Unreviewed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {safetyLogs.filter(l => !l.reviewed).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Filters & List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                    Flagged Content
                  </CardTitle>
                  <div className="mt-4 space-y-4">
                    {/* Severity Filter */}
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Filter by severity:</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={safetySeverityFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetySeverityFilter('all')}
                          className={`text-xs ${safetySeverityFilter === 'all' ? 'bg-slate-600 hover:bg-slate-700' : ''}`}
                        >
                          All
                        </Button>
                        <Button
                          variant={safetySeverityFilter === 'critical' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetySeverityFilter('critical')}
                          className={`text-xs ${safetySeverityFilter === 'critical' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        >
                          Critical
                        </Button>
                        <Button
                          variant={safetySeverityFilter === 'high' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetySeverityFilter('high')}
                          className={`text-xs ${safetySeverityFilter === 'high' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                        >
                          High
                        </Button>
                        <Button
                          variant={safetySeverityFilter === 'medium' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetySeverityFilter('medium')}
                          className={`text-xs ${safetySeverityFilter === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                        >
                          Medium
                        </Button>
                        <Button
                          variant={safetySeverityFilter === 'low' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetySeverityFilter('low')}
                          className={`text-xs ${safetySeverityFilter === 'low' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        >
                          Low
                        </Button>
                      </div>
                    </div>

                    {/* Review Status Filter */}
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Review status:</p>
                      <div className="flex gap-2">
                        <Button
                          variant={safetyReviewedFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyReviewedFilter('all')}
                          className={`text-xs ${safetyReviewedFilter === 'all' ? 'bg-slate-600 hover:bg-slate-700' : ''}`}
                        >
                          All
                        </Button>
                        <Button
                          variant={safetyReviewedFilter === 'unreviewed' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyReviewedFilter('unreviewed')}
                          className={`text-xs ${safetyReviewedFilter === 'unreviewed' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        >
                          Unreviewed
                        </Button>
                        <Button
                          variant={safetyReviewedFilter === 'reviewed' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyReviewedFilter('reviewed')}
                          className={`text-xs ${safetyReviewedFilter === 'reviewed' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        >
                          Reviewed
                        </Button>
                      </div>
                    </div>

                    {/* Date Filter */}
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Date range:</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={safetyDateFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyDateFilter('all')}
                          className={`text-xs ${safetyDateFilter === 'all' ? 'bg-slate-600 hover:bg-slate-700' : ''}`}
                        >
                          All Time
                        </Button>
                        <Button
                          variant={safetyDateFilter === 'today' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyDateFilter('today')}
                          className={`text-xs ${safetyDateFilter === 'today' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        >
                          Today
                        </Button>
                        <Button
                          variant={safetyDateFilter === '7days' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyDateFilter('7days')}
                          className={`text-xs ${safetyDateFilter === '7days' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        >
                          Last 7 Days
                        </Button>
                        <Button
                          variant={safetyDateFilter === '30days' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSafetyDateFilter('30days')}
                          className={`text-xs ${safetyDateFilter === '30days' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        >
                          Last 30 Days
                        </Button>
                      </div>
                    </div>

                    {/* Custom Date Range (if selected) */}
                    {safetyDateFilter === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-600 block mb-1">Start Date</label>
                          <input
                            type="date"
                            value={safetyCustomStartDate}
                            onChange={(e) => setSafetyCustomStartDate(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 block mb-1">End Date</label>
                          <input
                            type="date"
                            value={safetyCustomEndDate}
                            onChange={(e) => setSafetyCustomEndDate(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="max-h-[600px] overflow-y-auto">
                  {isLoadingSafety ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Loading safety logs...</p>
                    </div>
                  ) : filteredSafetyLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No flagged content found</p>
                      <p className="text-sm text-slate-500">
                        {safetyLogs.length === 0
                          ? 'The system has not detected any policy violations yet.'
                          : 'Try adjusting your filters to see more results.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 mb-2">
                        Showing {filteredSafetyLogs.length} of {safetyLogs.length} total flags
                      </p>
                      {filteredSafetyLogs.map((log) => {
                        const severityColors = {
                          critical: 'border-red-600 bg-red-50',
                          high: 'border-orange-600 bg-orange-50',
                          medium: 'border-yellow-600 bg-yellow-50',
                          low: 'border-blue-600 bg-blue-50',
                        };
                        const severityTextColors = {
                          critical: 'text-red-700',
                          high: 'text-orange-700',
                          medium: 'text-yellow-700',
                          low: 'text-blue-700',
                        };

                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedSafetyLog(log)}
                            className={`border-l-4 p-3 rounded-r-lg cursor-pointer transition-all hover:shadow-md ${
                              severityColors[log.severity as keyof typeof severityColors] || severityColors.low
                            } ${
                              selectedSafetyLog?.id === log.id ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                                  severityTextColors[log.severity as keyof typeof severityTextColors] || severityTextColors.low
                                }`}>
                                  {log.severity}
                                </span>
                                {!log.reviewed && (
                                  <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {getTimeAgo(log.created_at)}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 mb-1">{log.reason}</p>
                            <p className="text-xs text-slate-600 mb-2">User: {log.user_email || 'Unknown'}</p>
                            <div className="flex flex-wrap gap-1">
                              {log.categories?.map((cat: string, idx: number) => (
                                <span key={idx} className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detail View */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="flex items-center text-slate-900">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      Threat Details
                    </CardTitle>
                    {selectedSafetyLog && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSafetyLog(null)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {!selectedSafetyLog ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No flag selected</p>
                      <p className="text-sm text-slate-500">Click on a flagged item to view full details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Severity Badge */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-bold uppercase px-3 py-1.5 rounded ${
                            selectedSafetyLog.severity === 'critical' ? 'bg-red-600 text-white' :
                            selectedSafetyLog.severity === 'high' ? 'bg-orange-600 text-white' :
                            selectedSafetyLog.severity === 'medium' ? 'bg-yellow-600 text-white' :
                            'bg-blue-600 text-white'
                          }`}>
                            {selectedSafetyLog.severity} SEVERITY
                          </span>
                          {!selectedSafetyLog.reviewed && (
                            <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold">
                              UNREVIEWED
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 mb-1">User</p>
                            <p className="font-semibold text-slate-900">{selectedSafetyLog.user_email || 'Unknown'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Flagged At</p>
                            <p className="font-semibold text-slate-900">
                              {new Date(selectedSafetyLog.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Violation Type</h3>
                        <p className="text-sm text-slate-700 bg-red-50 border border-red-200 rounded p-3">
                          {selectedSafetyLog.reason}
                        </p>
                      </div>

                      {/* Categories */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedSafetyLog.categories?.map((cat: string, idx: number) => (
                            <span key={idx} className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded font-medium">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Flagged Content */}
                      {selectedSafetyLog.text && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">Flagged Content</h3>
                          <div className="bg-slate-50 border border-slate-200 rounded p-3 max-h-[200px] overflow-y-auto">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedSafetyLog.text}</p>
                          </div>
                        </div>
                      )}

                      {/* Tip */}
                      {selectedSafetyLog.tip && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">Guidance</h3>
                          <p className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded p-3">
                            {selectedSafetyLog.tip}
                          </p>
                        </div>
                      )}

                      {/* User Context */}
                      {(selectedSafetyLog.ip || selectedSafetyLog.user_agent) && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">User Context</h3>
                          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-xs">
                            {selectedSafetyLog.ip && (
                              <div>
                                <span className="text-slate-600">IP Address:</span>
                                <span className="ml-2 font-mono text-slate-900">{selectedSafetyLog.ip}</span>
                              </div>
                            )}
                            {selectedSafetyLog.user_agent && (
                              <div>
                                <span className="text-slate-600">User Agent:</span>
                                <span className="ml-2 font-mono text-slate-900 text-xs">{selectedSafetyLog.user_agent}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Review Info (if reviewed) */}
                      {selectedSafetyLog.reviewed && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">Review Information</h3>
                          <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2 text-sm">
                            <div>
                              <span className="text-slate-600">Reviewed by:</span>
                              <span className="ml-2 font-semibold text-slate-900">{selectedSafetyLog.reviewed_by_email || 'Unknown'}</span>
                            </div>
                            {selectedSafetyLog.reviewed_at && (
                              <div>
                                <span className="text-slate-600">Reviewed at:</span>
                                <span className="ml-2 text-slate-900">{new Date(selectedSafetyLog.reviewed_at).toLocaleString()}</span>
                              </div>
                            )}
                            {selectedSafetyLog.admin_notes && (
                              <div>
                                <span className="text-slate-600">Notes:</span>
                                <p className="mt-1 text-slate-900 whitespace-pre-wrap">{selectedSafetyLog.admin_notes}</p>
                              </div>
                            )}
                            {selectedSafetyLog.action_taken && (
                              <div>
                                <span className="text-slate-600">Action taken:</span>
                                <span className="ml-2 font-semibold text-slate-900">{selectedSafetyLog.action_taken}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-600 mb-3">Law Enforcement Actions:</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                            onClick={() => {
                              // TODO: Export to law enforcement
                              alert('Export functionality coming soon');
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export for Law Enforcement
                          </Button>
                          <Button
                            className="w-full bg-slate-600 hover:bg-slate-700 text-white"
                            size="sm"
                            onClick={() => {
                              // TODO: Email authorities
                              const subject = encodeURIComponent(`JCIL.AI - Critical Safety Threat Report`);
                              const body = encodeURIComponent(`CRITICAL SAFETY THREAT DETECTED

Severity: ${selectedSafetyLog.severity.toUpperCase()}
User: ${selectedSafetyLog.user_email || 'Unknown'}
Flagged At: ${new Date(selectedSafetyLog.created_at).toLocaleString()}

Violation: ${selectedSafetyLog.reason}
Categories: ${selectedSafetyLog.categories?.join(', ')}

${selectedSafetyLog.text ? `Content:\n${selectedSafetyLog.text}` : ''}

This is an automated safety report from JCIL.AI.
Log ID: ${selectedSafetyLog.id}

--
JCIL.AI Safety Team
adminactivities@jcil.ai`);
                              window.location.href = `mailto:?subject=${subject}&body=${body}`;
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email Authorities
                          </Button>
                          {!selectedSafetyLog.reviewed && (
                            <Button
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                              onClick={() => {
                                // TODO: Mark as reviewed
                                alert('Mark as reviewed functionality coming soon');
                              }}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Mark as Reviewed
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* IAM Tab */}
        {activeTab === 'iam' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <UserCog className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">Identity & Access Management (IAM)</h3>
                  <p className="text-sm text-blue-800">
                    Assign administrative roles to users. Admins have full platform access, Moderators can review flagged content, and Cyber Analysts can access security monitoring.
                  </p>
                </div>
              </div>
            </div>

            {/* Role Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-purple-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Admins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {iamUsers.filter(u => u.is_admin).length}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Moderators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {iamUsers.filter(u => u.is_moderator).length}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-600">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Cyber Analysts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {iamUsers.filter(u => u.is_cyber_analyst).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Role Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="flex items-center text-slate-900">
                    <UserCog className="h-5 w-5 mr-2 text-blue-600" />
                    User Roles & Permissions
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchIamUsers}
                    disabled={isLoadingIam}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingIam ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* Search and Filters */}
                <div className="mt-4 space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Search by email..."
                        value={iamSearchQuery}
                        onChange={(e) => setIamSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Role Filter Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={iamRoleFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIamRoleFilter('all')}
                      className={iamRoleFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      All Users
                    </Button>
                    <Button
                      variant={iamRoleFilter === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIamRoleFilter('admin')}
                      className={iamRoleFilter === 'admin' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                    >
                      Admins Only
                    </Button>
                    <Button
                      variant={iamRoleFilter === 'moderator' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIamRoleFilter('moderator')}
                      className={iamRoleFilter === 'moderator' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      Moderators Only
                    </Button>
                    <Button
                      variant={iamRoleFilter === 'cyber_analyst' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIamRoleFilter('cyber_analyst')}
                      className={iamRoleFilter === 'cyber_analyst' ? 'bg-red-600 hover:bg-red-700' : ''}
                    >
                      Cyber Analysts Only
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isLoadingIam ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading users...</p>
                  </div>
                ) : filteredIamUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">No users found</p>
                    <p className="text-sm text-slate-500">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Email</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Admin</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Moderator</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Cyber Analyst</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Tier</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIamUsers.map((user) => (
                          <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-900">{user.email}</td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={user.is_admin || false}
                                onChange={(e) => handleUpdateRole(user.id, 'is_admin', e.target.checked)}
                                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={user.is_moderator || false}
                                onChange={(e) => handleUpdateRole(user.id, 'is_moderator', e.target.checked)}
                                className="h-4 w-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={user.is_cyber_analyst || false}
                                onChange={(e) => handleUpdateRole(user.id, 'is_cyber_analyst', e.target.checked)}
                                className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.subscription_tier === 'executive' ? 'bg-amber-100 text-amber-800' :
                                user.subscription_tier === 'premium' ? 'bg-purple-100 text-purple-800' :
                                user.subscription_tier === 'pro' ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {user.subscription_tier || 'free'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {(user.is_admin || user.is_moderator || user.is_cyber_analyst) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm(`⚠️ Remove all permissions from ${user.email}?`)) {
                                      try {
                                        if (user.is_admin) await handleUpdateRole(user.id, 'is_admin', false);
                                        if (user.is_moderator) await handleUpdateRole(user.id, 'is_moderator', false);
                                        if (user.is_cyber_analyst) await handleUpdateRole(user.id, 'is_cyber_analyst', false);
                                        await fetchIamUsers();
                                      } catch (err) {
                                        console.error('Failed to remove permissions:', err);
                                      }
                                    }
                                  }}
                                  className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Remove All
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Role Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-purple-900 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-purple-800 space-y-1">
                    <li>• Full platform access</li>
                    <li>• User & subscription management</li>
                    <li>• Financial dashboard</li>
                    <li>• IAM role assignment</li>
                    <li>• All moderation & security tools</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Moderator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-green-800 space-y-1">
                    <li>• Review flagged content</li>
                    <li>• Safety threats monitoring</li>
                    <li>• User moderation actions</li>
                    <li>• Activity monitoring</li>
                    <li>• Limited admin access</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-red-50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Cyber Analyst
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-red-800 space-y-1">
                    <li>• Security Command Center access</li>
                    <li>• Threat monitoring & analysis</li>
                    <li>• IP intelligence management</li>
                    <li>• Security event review</li>
                    <li>• Incident response tools</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Date Range Info - Only on Overview Tab */}
        {activeTab === 'overview' && (
          <div className="text-center mt-8">
            <div className="text-sm text-slate-500">
              <Calendar className="h-4 w-4 inline mr-2" />
              Showing data from {new Date(stats.dateRange.start).toLocaleDateString()} to{' '}
              {new Date(stats.dateRange.end).toLocaleDateString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Usage stats (messages, tokens, costs) are filtered by fiscal period. User counts and revenue show current totals.
              <br />
              Fiscal year: January 1 - December 31
            </div>
          </div>
        )}
      </div>

      {/* Tier Management Modal */}
      {managingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Manage User Subscription</h3>

            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-1">User Email:</p>
              <p className="font-semibold text-slate-900">{managingUser.email}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-1">Current Tier:</p>
              <p className="font-semibold text-slate-900 capitalize">{managingUser.subscription_tier}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Subscription Tier:
              </label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                disabled={isUpdatingTier}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                <option value="free" className="text-slate-900">Free - $0/month</option>
                <option value="basic" className="text-slate-900">Basic - $12/month</option>
                <option value="pro" className="text-slate-900">Pro - $30/month</option>
                <option value="executive" className="text-slate-900">Executive - $150/month</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setManagingUser(null);
                  setSelectedTier('');
                }}
                variant="outline"
                className="flex-1"
                disabled={isUpdatingTier}
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateUserTier(managingUser.id, selectedTier)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedTier === managingUser.subscription_tier || isUpdatingTier}
              >
                {isUpdatingTier ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tier'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
