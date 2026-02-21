/**
 * CHAT CLIENT COMPONENT
 *
 * PURPOSE:
 * - Client-side chat interface with state management
 * - Handles user interactions, message sending, file uploads
 * - Manages sidebar state, search, and chat organization
 *
 * FEATURES:
 * - Sidebar: search, rename, delete, pin, folders
 * - Virtualized thread list
 * - Composer with file attachments
 * - Streaming message UI with tool badges
 *
 * STATE:
 * - chats: Array of chat conversations
 * - messages: Current thread messages
 * - isStreaming: Streaming state
 * - attachments: File attachments
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

const log = logger('ChatClient');
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer, SearchMode } from '@/components/chat/ChatComposer';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import {
  ChatContinuationBanner,
  CHAT_LENGTH_WARNING,
  generateSummaryPrompt,
} from '@/components/chat/ChatContinuationBanner';
// LiveTodoList removed - user prefers simple agentic approach without visible todo widget
import { parseSlashCommand } from '@/lib/slashCommands';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  analyzeResponse,
  isConfirmation,
  isDecline,
  type SuggestedAction,
} from '@/lib/response-analysis';
import PasskeyPromptModal, { usePasskeyPrompt } from '@/components/auth/PasskeyPromptModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { CodeExecutionProvider, useCodeExecution } from '@/contexts/CodeExecutionContext';
import { RepoSelector } from '@/components/chat/RepoSelector';
// Deep Strategy - now handled in chat, not modals
import type { StrategyStreamEvent, StrategyOutput } from '@/agents/strategy';
import { DeepStrategyProgress } from '@/components/chat/DeepStrategy';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';
// Inline creative components removed - all creative features now work through natural chat flow
import type { ActionPreviewData } from '@/components/chat/ActionPreviewCard';
import type { Chat, Message, Attachment, GeneratedImage } from './types';
import type { ProviderId } from '@/lib/ai/providers';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

/**
 * Detect document type from user message (client-side detection for UI feedback)
 * Mirrors server-side detection for progress indicator
 */
function detectDocumentTypeFromMessage(content: string): 'pdf' | 'docx' | 'xlsx' | 'pptx' | null {
  const lowerContent = content.toLowerCase();

  // PDF patterns
  const pdfPatterns = [
    /\b(slides?|presentation|powerpoint|deck)\b.*\b(as|in|to)\s*(a\s*)?(pdf|pdf\s*format)\b/i,
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\bpdf\b/i,
    /\bpdf\b.*\b(file|document|version|format)\b/i,
    /\bas\s*a?\s*pdf\b/i,
    /\bresume\b.*\bpdf\b/i,
    /\bpdf\s*resume\b/i,
  ];

  // Excel patterns
  const excelPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(excel|spreadsheet|xlsx|xls)\b/i,
    /\b(excel|spreadsheet|xlsx|xls)\b.*\b(file|document|for|with|that)\b/i,
    /\bbudget\b.*\b(spreadsheet|template|excel)\b/i,
  ];

  // PowerPoint patterns
  const pptxPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(powerpoint|pptx|presentation|slides?|slide deck)\b/i,
    /\b(powerpoint|pptx|presentation|slides?)\b.*\b(file|about|on|for|with)\b/i,
  ];

  // Word patterns
  const docxPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(word|docx)\b/i,
    /\b(word|docx)\s*(document|doc|file)?\b/i,
    /\beditable\s*(document|doc)\b/i,
  ];

  // Check in priority order: PDF -> Excel -> PowerPoint -> Word
  if (pdfPatterns.some((pattern) => pattern.test(lowerContent))) return 'pdf';
  if (excelPatterns.some((pattern) => pattern.test(lowerContent))) return 'xlsx';
  if (pptxPatterns.some((pattern) => pattern.test(lowerContent))) return 'pptx';
  if (docxPatterns.some((pattern) => pattern.test(lowerContent))) return 'docx';

  return null;
}

/**
 * Check if a chat title is generic/low-quality and should be regenerated
 * Returns true if the title is generic like "Initial Greeting", "Hello", "New Chat", etc.
 */
function isGenericTitle(title: string | undefined): boolean {
  if (!title) return true;

  const genericPatterns = [
    /^new chat$/i,
    /^hello$/i,
    /^hi$/i,
    /^hey$/i,
    /^greeting/i,
    /^initial/i,
    /^test/i,
    /^quick question$/i,
    /^general chat$/i,
    /^untitled/i,
    /^chat$/i,
    /^conversation$/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(title.trim()));
}

/**
 * Format Composio action success messages in a user-friendly way
 * Instead of showing raw JSON, display clean confirmation messages
 */
function formatActionSuccessMessage(platform: string, action: string, _data: unknown): string {
  const platformLower = platform.toLowerCase();
  const actionLower = action.toLowerCase();

  // Gmail
  if (platformLower === 'gmail') {
    if (actionLower.includes('send')) {
      return '✉️ Email sent successfully!';
    }
    if (actionLower.includes('draft')) {
      return '📝 Draft saved successfully!';
    }
    if (actionLower.includes('reply')) {
      return '↩️ Reply sent successfully!';
    }
    return `✉️ ${action} completed successfully!`;
  }

  // Twitter/X
  if (platformLower === 'twitter' || platformLower === 'x') {
    if (actionLower.includes('tweet') || actionLower.includes('post')) {
      return '🐦 Tweet posted successfully!';
    }
    if (actionLower.includes('retweet')) {
      return '🔁 Retweeted successfully!';
    }
    if (actionLower.includes('like')) {
      return '❤️ Liked successfully!';
    }
    return `🐦 ${action} completed successfully!`;
  }

  // Slack
  if (platformLower === 'slack') {
    if (actionLower.includes('message') || actionLower.includes('send')) {
      return '💬 Slack message sent successfully!';
    }
    return `💬 ${action} completed successfully!`;
  }

  // LinkedIn
  if (platformLower === 'linkedin') {
    if (actionLower.includes('post')) {
      return '💼 LinkedIn post published successfully!';
    }
    if (actionLower.includes('message')) {
      return '💼 LinkedIn message sent successfully!';
    }
    return `💼 ${action} completed successfully!`;
  }

  // Google Calendar
  if (platformLower === 'googlecalendar' || platformLower === 'google calendar') {
    if (actionLower.includes('create') || actionLower.includes('event')) {
      return '📅 Calendar event created successfully!';
    }
    if (actionLower.includes('update')) {
      return '📅 Calendar event updated successfully!';
    }
    if (actionLower.includes('delete')) {
      return '📅 Calendar event deleted successfully!';
    }
    return `📅 ${action} completed successfully!`;
  }

  // Google Drive
  if (platformLower === 'googledrive' || platformLower === 'google drive') {
    if (actionLower.includes('upload')) {
      return '📁 File uploaded to Drive successfully!';
    }
    if (actionLower.includes('create')) {
      return '📁 File created in Drive successfully!';
    }
    if (actionLower.includes('share')) {
      return '🔗 File shared successfully!';
    }
    return `📁 ${action} completed successfully!`;
  }

  // Notion
  if (platformLower === 'notion') {
    if (actionLower.includes('page') || actionLower.includes('create')) {
      return '📓 Notion page created successfully!';
    }
    if (actionLower.includes('update')) {
      return '📓 Notion page updated successfully!';
    }
    return `📓 ${action} completed successfully!`;
  }

  // GitHub
  if (platformLower === 'github') {
    if (actionLower.includes('issue')) {
      return '🐙 GitHub issue created successfully!';
    }
    if (actionLower.includes('pr') || actionLower.includes('pull')) {
      return '🐙 Pull request created successfully!';
    }
    if (actionLower.includes('commit')) {
      return '🐙 Committed successfully!';
    }
    return `🐙 ${action} completed successfully!`;
  }

  // Trello
  if (platformLower === 'trello') {
    if (actionLower.includes('card')) {
      return '📋 Trello card created successfully!';
    }
    return `📋 ${action} completed successfully!`;
  }

  // Asana
  if (platformLower === 'asana') {
    if (actionLower.includes('task')) {
      return '✅ Asana task created successfully!';
    }
    return `✅ ${action} completed successfully!`;
  }

  // Discord
  if (platformLower === 'discord') {
    if (actionLower.includes('message') || actionLower.includes('send')) {
      return '🎮 Discord message sent successfully!';
    }
    return `🎮 ${action} completed successfully!`;
  }

  // Default fallback - clean message without raw data
  return `✅ ${action} on ${platform} completed successfully!`;
}

export function ChatClient() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Waiting for background reply (shown when user returns to tab and answer is pending)
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  // Start with sidebar collapsed on mobile, open on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Deep Strategy Agent state - now chat-integrated (no modals)
  const [isStrategyMode, setIsStrategyMode] = useState(false);
  const [strategySessionId, setStrategySessionId] = useState<string | null>(null);
  const [strategyPhase, setStrategyPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [strategyLoading, setStrategyLoading] = useState(false); // Loading state while starting
  const [strategyEvents, setStrategyEvents] = useState<StrategyStreamEvent[]>([]); // Events for visual preview
  // Deep Research Agent state - shares engine with Strategy, different prompts
  const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);
  const [deepResearchSessionId, setDeepResearchSessionId] = useState<string | null>(null);
  const [deepResearchPhase, setDeepResearchPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [deepResearchLoading, setDeepResearchLoading] = useState(false);
  const [deepResearchEvents, setDeepResearchEvents] = useState<StrategyStreamEvent[]>([]);
  // Quick Research Agent state - lightweight version of Deep Research (1/4 scale)
  const [isQuickResearchMode, setIsQuickResearchMode] = useState(false);
  const [quickResearchSessionId, setQuickResearchSessionId] = useState<string | null>(null);
  const [quickResearchPhase, setQuickResearchPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [quickResearchLoading, setQuickResearchLoading] = useState(false);
  const [_quickResearchEvents, setQuickResearchEvents] = useState<StrategyStreamEvent[]>([]);
  // Quick Strategy Agent state - lightweight version of Deep Strategy (1/4 scale)
  const [isQuickStrategyMode, setIsQuickStrategyMode] = useState(false);
  const [quickStrategySessionId, setQuickStrategySessionId] = useState<string | null>(null);
  const [quickStrategyPhase, setQuickStrategyPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [quickStrategyLoading, setQuickStrategyLoading] = useState(false);
  const [_quickStrategyEvents, setQuickStrategyEvents] = useState<StrategyStreamEvent[]>([]);
  // Deep Writer Agent state - professional AI writing with research
  const [isDeepWriterMode, setIsDeepWriterMode] = useState(false);
  const [deepWriterSessionId, setDeepWriterSessionId] = useState<string | null>(null);
  const [deepWriterPhase, setDeepWriterPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [deepWriterLoading, setDeepWriterLoading] = useState(false);
  const [_deepWriterEvents, setDeepWriterEvents] = useState<StrategyStreamEvent[]>([]);
  // Quick Writer Agent state - fast AI writing with focused research
  const [isQuickWriterMode, setIsQuickWriterMode] = useState(false);
  const [quickWriterSessionId, setQuickWriterSessionId] = useState<string | null>(null);
  const [quickWriterPhase, setQuickWriterPhase] = useState<
    'idle' | 'intake' | 'executing' | 'complete' | 'error'
  >('idle');
  const [quickWriterLoading, setQuickWriterLoading] = useState(false);
  const [_quickWriterEvents, setQuickWriterEvents] = useState<StrategyStreamEvent[]>([]);
  const { profile, hasProfile } = useUserProfile();
  // Passkey prompt for Face ID / Touch ID setup
  const { shouldShow: showPasskeyPrompt, dismiss: dismissPasskeyPrompt } = usePasskeyPrompt();
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  // REMOVED: selectedTool state - all tools now handled naturally in chat
  // Header logo from design settings
  const [headerLogo, setHeaderLogo] = useState<string>('');
  // Document generation type (for progress indicator)
  const [pendingDocumentType, setPendingDocumentType] = useState<
    'pdf' | 'docx' | 'xlsx' | 'pptx' | null
  >(null);
  // Chat continuation - track when generating summary
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [continuationDismissed, setContinuationDismissed] = useState(false);
  // Reply to message feature - tracks which message is being replied to
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Quick prompt text from welcome screen
  const [quickPromptText, setQuickPromptText] = useState<string>('');
  // Carousel-triggered modal state (for creative buttons from welcome carousel)
  // Modal state removed - all creative features now use natural chat flow
  const [openCreateImage, setOpenCreateImage] = useState(false);
  const [openEditImage, setOpenEditImage] = useState(false);
  // Conversation loading error state
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  // AI Provider selection - allows users to choose between Claude, xAI, DeepSeek, etc.
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('claude');
  const [configuredProviders, setConfiguredProviders] = useState<ProviderId[]>(['claude']);
  // Pending tool suggestion from AI response analysis (for auto web search/fact check)
  const [pendingToolSuggestion, setPendingToolSuggestion] = useState<{
    action: SuggestedAction;
    originalQuestion: string | null;
  } | null>(null);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Polling interval ref for background reply checking
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track last time conversations were loaded to debounce visibility refreshes
  const lastConversationLoadRef = useRef<number>(0);

  // Load header logo from design settings
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Use header_logo, fall back to main_logo
          const logoUrl = settings.header_logo || settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setHeaderLogo(logoUrl);
          }
        }
      } catch (err) {
        log.error('Failed to load header logo:', err as Error);
      }
    };
    loadLogo();
  }, []);

  // Show passkey prompt modal after a short delay on first load
  useEffect(() => {
    if (showPasskeyPrompt) {
      // Wait 2 seconds after page load before showing the prompt
      const timer = setTimeout(() => {
        setIsPasskeyModalOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showPasskeyPrompt]);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/user/is-admin');
        if (response.ok) {
          const responseData = await response.json();
          // API returns { ok: true, data: { isAdmin: ... } }
          const data = responseData.data || responseData;
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        log.error('Error checking admin status:', error as Error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, []);

  // Fetch configured AI providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch('/api/providers/status');
        if (response.ok) {
          const data = await response.json();
          if (data.configured && data.configured.length > 0) {
            setConfiguredProviders(data.configured);
          }
        }
      } catch (error) {
        log.error('Error fetching provider status:', error as Error);
        // Default to Claude only if fetch fails
        setConfiguredProviders(['claude']);
      }
    };
    fetchProviders();
  }, []);

  // Detect screen size and set initial sidebar state
  useEffect(() => {
    const handleResize = () => {
      // Auto-open sidebar on desktop (≥768px), keep closed on mobile
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(false);
      }
    };

    // Handle toggle sidebar event from sidebar close button
    const handleToggleSidebar = () => {
      setSidebarCollapsed((prev) => !prev);
    };

    // Set initial state
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    window.addEventListener('toggle-sidebar', handleToggleSidebar);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  // Cleanup on unmount - abort any in-flight requests and stop polling
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any in-flight requests when navigating away
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Stop any active polling intervals to prevent memory leaks
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Ref to track current chat for visibility refresh
  const currentChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // Ref to track current messages for visibility refresh (avoids stale closure)
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // MEMORY OPTIMIZATION: Strip base64 image data from older messages to prevent memory bloat
  // Keep image URLs for last 10 messages, clear older ones to save memory
  const MAX_MESSAGES_WITH_IMAGES = 10;
  useEffect(() => {
    if (messages.length > MAX_MESSAGES_WITH_IMAGES) {
      const cutoffIndex = messages.length - MAX_MESSAGES_WITH_IMAGES;
      let needsUpdate = false;

      // Check if any old messages have imageUrl that's a data URL (base64)
      for (let i = 0; i < cutoffIndex; i++) {
        if (messages[i].imageUrl?.startsWith('data:')) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        setMessages((prev) =>
          prev.map((msg, index) => {
            // Keep recent messages intact
            if (index >= cutoffIndex) return msg;
            // Strip base64 data URLs from older messages (keep regular URLs)
            if (msg.imageUrl?.startsWith('data:')) {
              return { ...msg, imageUrl: undefined };
            }
            return msg;
          })
        );
        log.debug('Cleared base64 images from old messages to save memory');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only depend on length, not content, to avoid unnecessary iterations
  }, [messages.length]);

  // CRITICAL FIX: Ref to track streaming state for visibility handler
  // This prevents stale closures when the effect re-runs
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Helper function to fetch and format messages
  const fetchMessages = async (chatId: string): Promise<Message[] | null> => {
    try {
      const response = await fetch(`/api/conversations/${chatId}/messages`);
      if (response.ok) {
        const responseData = await response.json();
        // API returns { ok: true, data: { messages: [...] } }
        const data = responseData.data || responseData;
        return (data.messages || []).map(
          (msg: {
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            content_type: string;
            attachment_urls: string[] | null;
            created_at: string;
            metadata?: Record<string, unknown> | null;
          }) => {
            const imageUrl =
              msg.attachment_urls && msg.attachment_urls.length > 0
                ? msg.attachment_urls[0]
                : undefined;
            // Restore documentDownload from persisted metadata so download
            // buttons reappear after page refresh / conversation reload.
            const docDl = msg.metadata?.documentDownload as
              | { filename: string; mimeType: string; dataUrl: string; canPreview: boolean }
              | undefined;
            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              imageUrl,
              documentDownload: docDl || undefined,
              timestamp: new Date(msg.created_at),
            };
          }
        );
      }
    } catch (error) {
      log.error('Error fetching messages:', error as Error);
    }
    return null;
  };

  // Stop any active polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsWaitingForReply(false);
  };

  // Track if we're currently processing to avoid duplicate calls
  const isProcessingRef = useRef(false);

  // Process pending request immediately when returning to tab
  // CRITICAL FIX: Use refs instead of state to prevent stale closures
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only check if tab is becoming visible and we have a current chat
      if (document.visibilityState !== 'visible') return;
      if (!currentChatIdRef.current) return;
      if (isProcessingRef.current) return; // Prevent duplicate processing

      const chatId = currentChatIdRef.current;
      const currentMessages = messagesRef.current;
      const currentlyStreaming = isStreamingRef.current; // Use ref instead of state

      log.debug('Tab visible, checking for pending replies...', {
        chatId,
        messageCount: currentMessages.length,
        lastRole: currentMessages[currentMessages.length - 1]?.role,
        isStreaming: currentlyStreaming,
      });

      // If currently streaming, check if we need to wait a bit
      // (Stream might have just completed)
      if (currentlyStreaming) {
        // Give the stream a moment to complete naturally
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Re-check if still streaming (use ref for current value)
        if (isStreamingRef.current) {
          log.debug('Still streaming, will check on next visibility change');
          return;
        }
      }

      // First, check if we already have the response (server may have processed it)
      const fetchedMessages = await fetchMessages(chatId);
      if (!fetchedMessages || !isMountedRef.current) return;

      // If we got new messages, just display them
      if (fetchedMessages.length > currentMessages.length) {
        log.debug('New messages found:', {
          count: fetchedMessages.length - currentMessages.length,
        });
        setMessages(fetchedMessages);
        setIsStreaming(false); // Reset streaming state since we have the response
        return;
      }

      // Check if we need to process a pending request
      // This happens when:
      // 1. Last message is from user (waiting for a reply)
      // 2. Last message is from assistant but might be incomplete (user left mid-stream)
      const lastFetchedMessage = fetchedMessages[fetchedMessages.length - 1];
      const lastLocalMessage = currentMessages[currentMessages.length - 1];
      const lastMessage = lastFetchedMessage || lastLocalMessage;

      // Always check for pending requests - the server will tell us if there's nothing to process
      // This catches both "waiting for reply" AND "incomplete streaming response" cases
      const shouldCheckPending =
        lastMessage &&
        (lastMessage.role === 'user' || // Obvious case: waiting for reply
          (lastMessage.role === 'assistant' && !isStreamingRef.current)); // Could be incomplete

      if (shouldCheckPending) {
        log.debug('Checking for pending request...', { lastRole: lastMessage.role });
        isProcessingRef.current = true;
        setIsWaitingForReply(true);
        setIsStreaming(false); // Reset streaming state

        try {
          // Call the process-pending endpoint with a 2-minute timeout
          // This prevents the "Reply incoming" indicator from hanging indefinitely
          const pendingController = new AbortController();
          const timeoutId = setTimeout(() => pendingController.abort(), 120000); // 2 minute timeout

          const response = await fetch(`/api/conversations/${chatId}/process-pending`, {
            method: 'POST',
            signal: pendingController.signal,
          });

          clearTimeout(timeoutId); // Clear timeout if fetch completes

          if (!isMountedRef.current) return;

          const result = await response.json();
          log.debug('Process pending result:', result.status);

          if (result.status === 'completed' && result.content) {
            // Fetch messages from database to get the correct state
            // This handles both UPDATE (partial message updated) and INSERT (new message created)
            // Without this, we'd duplicate messages when an existing partial was updated
            const updatedMessages = await fetchMessages(chatId);
            if (updatedMessages && isMountedRef.current) {
              setMessages(updatedMessages);
            }
          } else if (result.status === 'no_pending_request') {
            // No pending request - maybe it was already processed or never created
            // Fetch messages again just in case
            const updatedMessages = await fetchMessages(chatId);
            if (updatedMessages && updatedMessages.length > currentMessages.length) {
              setMessages(updatedMessages);
            }
          }
          // For 'failed' or 'error', we just stop waiting - user can try again
        } catch (error) {
          // Check if this was a timeout abort
          const isTimeoutError = error instanceof Error && error.name === 'AbortError';
          if (isTimeoutError) {
            log.debug('Pending request timed out after 2 minutes');
          } else {
            log.error('Error processing pending request:', error as Error);
          }
        } finally {
          if (isMountedRef.current) {
            isProcessingRef.current = false;
            setIsWaitingForReply(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, []); // CRITICAL FIX: Empty deps - use refs for current values to prevent memory leaks

  // Load conversations from database
  useEffect(() => {
    const loadConversations = async (isRefresh = false) => {
      // Debounce: don't reload if we loaded within the last 5 seconds (for refresh)
      const now = Date.now();
      if (isRefresh && now - lastConversationLoadRef.current < 5000) {
        log.debug('Skipping conversation reload - debounced');
        return;
      }

      try {
        log.debug('Loading conversations from API...', { isRefresh });
        setConversationLoadError(null);
        const response = await fetch('/api/conversations');
        log.debug('API response status:', { status: response.status });

        if (response.ok) {
          const responseData = await response.json();
          // API returns { ok: true, data: { conversations: [...] } }
          const conversations =
            responseData.data?.conversations || responseData.conversations || [];
          log.debug('Loaded conversations from DB:', {
            count: conversations.length,
          });

          const formattedChats: Chat[] = conversations.map(
            (conv: {
              id: string;
              title: string;
              summary: string | null;
              tool_context: string | null;
              folder_id: string | null;
              folder: { id: string; name: string; color: string | null } | null;
              created_at: string;
              updated_at: string;
              last_message_at: string;
            }) => ({
              id: conv.id,
              title: conv.title,
              summary: conv.summary || undefined,
              folderId: conv.folder_id || undefined,
              folder: conv.folder
                ? {
                    id: conv.folder.id,
                    name: conv.folder.name,
                    color: conv.folder.color,
                    position: 0,
                  }
                : undefined,
              isPinned: false, // TODO: Add isPinned to database schema
              lastMessage: '', // We'll update this if needed
              createdAt: new Date(conv.created_at),
              updatedAt: new Date(conv.last_message_at || conv.updated_at),
            })
          );
          setChats(formattedChats);
          lastConversationLoadRef.current = now;
          log.debug('Set chats state with conversations', { count: formattedChats.length });
        } else if (response.status === 401) {
          // User not authenticated - this is expected if session expired
          log.debug('User not authenticated, clearing conversations');
          setChats([]);
          setConversationLoadError('Please sign in to view your conversations');
        } else {
          log.error('Failed to load conversations:', new Error(response.statusText));
          setConversationLoadError('Unable to load conversations. Please refresh the page.');
        }
      } catch (error) {
        log.error('Error loading conversations:', error as Error);
        setConversationLoadError('Unable to load conversations. Please check your connection.');
      }
    };

    // Initial load
    loadConversations();

    // Refresh conversations when app returns to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        log.debug('App returned to foreground, refreshing conversations...');
        loadConversations(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleNewChat = async () => {
    // Just reset to "new chat" state - don't create in database yet
    // The chat will be created when user sends their first message
    // This prevents blank/empty chats from accumulating
    setCurrentChatId(null);
    setMessages([]);
    setPendingToolSuggestion(null); // Clear any pending tool suggestion

    // Auto-close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  // Handle carousel card selection - pre-fills chat input for natural flow
  const handleCarouselSelect = async (cardId: string) => {
    switch (cardId) {
      case 'create-image':
        // Pre-fill chat with prompt template - natural language detection handles generation
        setQuickPromptText('Create an image of ');
        break;
      case 'edit-image':
        // Guide user to describe what they want to edit
        setQuickPromptText('Edit this image: ');
        break;
      case 'research':
        // Research agent prompt
        setQuickPromptText('Research ');
        break;
      case 'deep-research':
        // Start deep research mode
        await startDeepResearch();
        break;
      case 'deep-strategy':
        // Start strategy mode
        await startDeepStrategy();
        break;
      default:
        log.warn('Unknown carousel card selected', { cardId });
    }
  };

  // Handle image generated from creative tools - add to conversation
  const handleImageGenerated = (image: GeneratedImage) => {
    const messageId = `gen-${image.id}`;
    const typeLabel = image.type === 'edit' ? 'edited' : 'generated';
    const content = image.verification?.feedback
      ? `I've ${typeLabel} this image for you. ${image.verification.feedback}`
      : `I've ${typeLabel} this image based on your request: "${image.prompt}"`;

    const newMessage: Message = {
      id: messageId,
      role: 'assistant',
      content,
      generatedImage: image,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);

    log.info('Generated image added to conversation', {
      generationId: image.id,
      type: image.type,
      verified: image.verification?.matches,
    });
  };

  // Handle image regeneration request (when verification fails)
  const handleRegenerateImage = async (
    generationId: string,
    originalPrompt: string,
    feedback: string
  ) => {
    log.info('Regenerating image', { generationId, feedback });

    // Create an improved prompt based on feedback
    const improvedPrompt = `${originalPrompt}. Important: ${feedback}`;

    // Add a user message explaining the regeneration
    const userMessageId = `regen-user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: `Please regenerate this image. The previous result: ${feedback}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Trigger a new generation with the improved prompt
    try {
      const response = await fetch('/api/create/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: improvedPrompt,
          conversationId: currentChatId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add the regenerated image to conversation
        handleImageGenerated({
          id: data.id,
          type: 'create',
          imageUrl: data.imageUrl,
          prompt: originalPrompt,
          enhancedPrompt: data.enhancedPrompt,
          dimensions: data.dimensions,
          model: data.model || 'flux-2-pro',
          seed: data.seed,
          verification: data.verification,
        });
      } else {
        // Add error message
        const errorMessage: Message = {
          id: `regen-error-${Date.now()}`,
          role: 'assistant',
          content: `I couldn't regenerate the image: ${data.message || data.error || 'Unknown error'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      log.error('Regeneration failed', { error });
      const errorMessage: Message = {
        id: `regen-error-${Date.now()}`,
        role: 'assistant',
        content: 'I encountered an error while trying to regenerate the image. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // ============================================================================
  // COMPOSIO ACTION HANDLERS
  // These handle action preview card interactions (Send/Edit/Cancel)
  // ============================================================================

  /**
   * Handle action preview Send button click
   * Executes the Composio tool action (e.g., post tweet, send email)
   */
  const handleActionSend = async (preview: ActionPreviewData): Promise<void> => {
    log.info('Executing Composio action', {
      platform: preview.platform,
      action: preview.action,
      toolName: preview.toolName,
    });

    try {
      // Call the Composio execute API
      const response = await fetch('/api/composio/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: preview.toolName.replace(/^composio_/, ''), // Remove prefix
          params: preview.toolParams,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Add success message with user-friendly formatting
        const successMessage: Message = {
          id: `action-success-${Date.now()}`,
          role: 'assistant',
          content: formatActionSuccessMessage(preview.platform, preview.action, data.data),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);
        log.info('Composio action succeeded', { platform: preview.platform });
      } else {
        // Add error message
        const errorMessage: Message = {
          id: `action-error-${Date.now()}`,
          role: 'assistant',
          content: `Failed to ${preview.action.toLowerCase()} on ${preview.platform}: ${data.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        log.warn('Composio action failed', { platform: preview.platform, error: data.error });
      }
    } catch (error) {
      log.error('Composio action error', { error });
      const errorMessage: Message = {
        id: `action-error-${Date.now()}`,
        role: 'assistant',
        content: `An error occurred while trying to ${preview.action.toLowerCase()} on ${preview.platform}. Please check your connection and try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  /**
   * Handle action preview Edit button click
   * Sends a follow-up message to Claude to regenerate with changes
   */
  const handleActionEdit = (preview: ActionPreviewData, instruction: string): void => {
    log.info('Editing Composio action', {
      platform: preview.platform,
      instruction,
    });

    // Create an edit request message for the AI to regenerate the preview
    const editRequest = `Please update the ${preview.platform} ${preview.action.toLowerCase()} based on this feedback: ${instruction}`;

    // Add user message showing the edit request
    const userMessage: Message = {
      id: `action-edit-${Date.now()}`,
      role: 'user',
      content: editRequest,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Trigger a new AI response to regenerate the preview
    // Use the existing handleSendMessage flow
    handleSendMessage(editRequest, [], undefined, undefined);
  };

  /**
   * Handle action preview Cancel button click
   * Just acknowledges the cancellation
   */
  const handleActionCancel = (preview: ActionPreviewData): void => {
    log.info('Cancelled Composio action', {
      platform: preview.platform,
      action: preview.action,
    });

    // Add a cancellation acknowledgment
    const cancelMessage: Message = {
      id: `action-cancel-${Date.now()}`,
      role: 'assistant',
      content: `Okay, I've cancelled the ${preview.action.toLowerCase()} for ${preview.platform}. Let me know if you'd like to try something else!`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
  };

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setContinuationDismissed(false); // Reset continuation banner for new chat
    setPendingToolSuggestion(null); // Clear any pending tool suggestion
    // Auto-close sidebar on mobile after selecting chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }

    // Load messages from API
    try {
      const response = await fetch(`/api/conversations/${chatId}/messages`);
      if (response.ok) {
        const responseData = await response.json();
        // API returns { ok: true, data: { messages: [...] } }
        const data = responseData.data || responseData;
        const formattedMessages: Message[] = (data.messages || []).map(
          (msg: {
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            content_type: string;
            attachment_urls: string[] | null;
            created_at: string;
          }) => {
            // Check if there are any image attachments
            const imageUrl =
              msg.attachment_urls && msg.attachment_urls.length > 0
                ? msg.attachment_urls[0]
                : undefined;

            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              imageUrl,
              timestamp: new Date(msg.created_at),
            };
          }
        );
        setMessages(formattedMessages);
      }
    } catch (error) {
      log.error('Error loading messages:', error as Error);
      setMessages([]);
    }
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(chats.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat)));
  };

  const handleDeleteChat = async (chatId: string) => {
    // Optimistically remove from UI
    const previousChats = [...chats];
    setChats(chats.filter((chat) => chat.id !== chatId));

    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }

    // Call API to soft-delete in database
    try {
      const response = await fetch(`/api/conversations/${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert on failure
        log.error('Failed to delete conversation from database');
        setChats(previousChats);
        // Could show error toast here
      } else {
        log.debug('Conversation deleted from database', { chatId });
      }
    } catch (error) {
      log.error('Error deleting conversation:', error as Error);
      // Revert on error
      setChats(previousChats);
    }
  };

  const handlePinChat = (chatId: string) => {
    setChats(
      chats.map((chat) => (chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat))
    );
  };

  const handleMoveToFolder = async (
    chatId: string,
    folderId: string | null,
    folderData?: { id: string; name: string; color: string | null }
  ) => {
    // Optimistically update UI
    setChats(
      chats.map((chat) => {
        if (chat.id === chatId) {
          return {
            ...chat,
            folderId: folderId || undefined,
            folder: folderData ? { ...folderData, position: 0 } : undefined,
          };
        }
        return chat;
      })
    );

    // Call API to persist change
    try {
      const response = await fetch(`/api/conversations/${chatId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });

      if (!response.ok) {
        log.error('Failed to move chat to folder');
        // Revert on error
        setChats(chats);
      }
    } catch (error) {
      log.error('Error moving chat to folder:', error as Error);
      setChats(chats);
    }
  };

  /**
   * Handle selecting a strategy session from the sidebar
   * Loads the session results and displays them in chat
   */
  const handleSelectStrategySession = async (sessionId: string) => {
    try {
      log.debug('Loading strategy session', { sessionId });

      // Fetch the session data
      const response = await fetch(`/api/strategy?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to load strategy session');
      }

      const data = await response.json();

      // If session has a result, display it
      if (data.result) {
        // Create a new chat for this strategy session
        handleNewChat();

        // Add a summary message explaining this is a restored session
        const summaryMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `## 🧠 Strategy Session Restored

**This is a completed Deep Strategy session from ${new Date(data.started).toLocaleString()}**

**Cost:** $${data.totalCost?.toFixed(2) || '0.00'}
**Agents:** ${data.totalAgents || 0}
**Searches:** ${data.totalSearches || 0}

---`,
          timestamp: new Date(),
        };

        // Display the full result
        displayStrategyResult(data.result);
        setMessages((prev) => [summaryMessage, ...prev]);

        log.info('Strategy session loaded', { sessionId });
      } else if (data.phase === 'executing' || data.isActive) {
        // Session is still running - show a message
        const runningMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `## 🧠 Strategy Session In Progress

This strategy session is still running. Please wait for it to complete.

**Progress:** ${data.completedAgents || 0}/${data.totalAgents || '?'} agents
**Searches:** ${data.totalSearches || 0}`,
          timestamp: new Date(),
        };

        handleNewChat();
        setMessages([runningMessage]);
      } else {
        // Session exists but no result (might be intake phase or error)
        const statusMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `## 🧠 Strategy Session

**Status:** ${data.phase}
**Started:** ${new Date(data.started).toLocaleString()}

This session ${data.phase === 'error' ? 'encountered an error' : data.phase === 'cancelled' ? 'was cancelled' : 'is in ' + data.phase + ' phase'}.`,
          timestamp: new Date(),
        };

        handleNewChat();
        setMessages([statusMessage]);
      }
    } catch (error) {
      log.error('Error loading strategy session:', error as Error);
      // Show error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Failed to load strategy session. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  /* REMOVED: handleImageGenerated, Code and Data handlers - all handled naturally in chat
  const handleCodeGenerated = (response: string, request: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request,
      timestamp: new Date(),
    };
    const codeMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage, codeMessage]);
  };

  const handleSearchComplete = (response: string, query: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Search: ${query}`,
      timestamp: new Date(),
    };
    const searchMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage, searchMessage]);
  };

  const handleDataAnalysisComplete = async (response: string, source: string, type: 'file' | 'url') => {
    // Data analysis now handled in regular chat
  };
  */

  /**
   * Helper to safely parse JSON response and extract error message
   */
  const safeJsonParse = async (
    res: Response
  ): Promise<{
    ok: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  } | null> => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  /**
   * Helper function to save message to database
   * Supports both JSON (for text-only) and FormData (for file attachments)
   */
  const saveMessageToDatabase = async (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    contentType: 'text' | 'image' | 'code' | 'error' = 'text',
    imageUrl?: string,
    attachmentUrls?: string[],
    metadata?: Record<string, unknown> | null
  ) => {
    // Skip saving if content is empty and no attachments
    const hasContent = content && content.trim().length > 0;
    const hasAttachments = (attachmentUrls && attachmentUrls.length > 0) || imageUrl;

    if (!hasContent && !hasAttachments) {
      log.debug('Skipping save - no content or attachments');
      return null;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          content_type: contentType,
          image_url: imageUrl,
          attachment_urls: attachmentUrls,
          metadata: metadata || undefined,
        }),
      });

      const data = await safeJsonParse(response);

      if (!response.ok || data?.ok === false) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}`;
        const errorCode = data?.error?.code || 'UNKNOWN';
        log.error(`Save message failed: ${errorCode}: ${errorMsg}`);
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      log.error('Error saving message to database:', error as Error);
      // Don't re-throw - message display still works even if save fails
    }
  };

  // Helper function to create conversation in database
  const createConversationInDatabase = async (title: string, toolContext?: string) => {
    try {
      log.debug('Creating conversation in DB:', { title, toolContext });
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't pass id - let the API generate it, then we'll get it back
          title,
          tool_context: toolContext || 'general',
        }),
      });

      log.debug('Conversation API response status:', { status: response.status });

      if (!response.ok) {
        const errorData = await response.json();
        log.error('Conversation creation failed:', errorData);
        throw new Error(`Failed to create conversation: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      log.debug('Conversation API result:', result);

      // API returns { ok: true, data: { conversation: {...} } }
      const conversation = result.data?.conversation || result.conversation;
      if (conversation && conversation.id) {
        log.debug('Returning conversation ID:', conversation.id);
        return conversation.id;
      }

      throw new Error('No conversation ID returned from API');
    } catch (error) {
      log.error('Error creating conversation in database:', error as Error);
      throw error; // Re-throw to let caller handle it
    }
  };

  /**
   * Handle stop button - abort the current streaming request
   */
  const handleStop = () => {
    if (abortControllerRef.current) {
      log.debug('User clicked stop - aborting request');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  /**
   * Handle chat continuation - summarize and start a new chat
   */
  const handleChatContinuation = async () => {
    if (messages.length === 0) return;

    setIsGeneratingSummary(true);

    try {
      // Generate summary using AI
      const summaryPrompt = generateSummaryPrompt(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 1024,
        }),
      });

      let summaryContent = '';
      if (response.ok) {
        const data = await response.json();
        summaryContent = data.content || 'Previous conversation summary not available.';
      } else {
        // Fallback if summary generation fails
        summaryContent = `Continuing from previous conversation about: ${messages[0]?.content?.slice(0, 200) || 'general discussion'}`;
      }

      // Create new chat with context
      const newChatId = crypto.randomUUID();
      const contextMessage = `## Continuing from Previous Chat\n\n${summaryContent}\n\n---\n\n*This is a continuation of our previous conversation. I have the context above to help maintain continuity.*`;

      const newChat: Chat = {
        id: newChatId,
        title: 'Continuation',
        isPinned: false,
        lastMessage: 'Continued from previous chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add the new chat and switch to it
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChatId);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: contextMessage,
          timestamp: new Date(),
        },
      ]);
      setContinuationDismissed(false);

      // Create the conversation in the database
      await createConversationInDatabase('Continuation', 'general');

      log.debug('Created continuation chat with summary');
    } catch (error) {
      log.error('Error creating continuation:', error as Error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // ===========================================================================
  // DEEP STRATEGY - Chat-integrated (no modals)
  // ===========================================================================

  /**
   * Start Deep Strategy mode - adds intro message to chat and begins intake
   */
  const startDeepStrategy = async () => {
    if (isStrategyMode || strategyLoading) {
      return;
    }

    setStrategyLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🧠 Deep Strategy Mode Activated

**You've activated the most powerful AI strategy system ever built.**

This isn't just ChatGPT with a fancy prompt. I'm about to deploy:
- **Opus 4.6** as the Master Architect (designs your strategy)
- **Sonnet 4.6** Project Managers (coordinate research teams)
- **Up to 100 Haiku 4.5 Scouts** (parallel research army)
- **Hundreds of web searches** for real-time data

**But first, I need to understand your situation deeply.**

Don't summarize. Don't filter. Don't worry about being organized. Just... tell me everything. Vent if you need to. The more context I have, the better strategy I can build.

**What's going on? What are you trying to figure out?**

---
*Estimated: 2-5 min | $8-15 | Stop anytime by typing "cancel"*`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start strategy session via API
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start strategy');
      }

      // Get session ID from response header
      // Note: The API returns an SSE stream, not JSON, so we can only use the header
      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server. Check API response headers.');
      }

      setStrategySessionId(sessionId);
      setIsStrategyMode(true);
      setStrategyPhase('intake');

      log.debug('Strategy mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start strategy:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Strategy Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStrategyMode(false);
      setStrategyPhase('idle');
    } finally {
      setIsStreaming(false);
      setStrategyLoading(false);
    }
  };

  /**
   * Handle user input during strategy intake phase
   */
  const handleStrategyInput = async (input: string) => {
    if (!strategySessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelStrategy();
      return;
    }

    setIsStreaming(true);

    // Add user message to chat
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: strategySessionId,
          input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to process input');
      }

      const data = await response.json();

      // Add assistant response to chat
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Check if intake is complete - start execution
      if (data.isComplete) {
        await executeStrategy();
      }
    } catch (error) {
      log.error('Strategy input error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute the strategy after intake is complete
   */
  const executeStrategy = async () => {
    if (!strategySessionId) return;

    setStrategyPhase('executing');
    setIsStreaming(true);
    setStrategyEvents([]); // Clear events for fresh start

    // Add execution message
    const execMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## ⚡ Deploying Strategy Army...

Research is now underway. This will take 2-5 minutes.

I'll update you as scouts report back with findings.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, execMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: strategySessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute strategy');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      let lastProgressUpdate = Date.now();
      let progressMessageId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              try {
                const event = JSON.parse(data) as StrategyStreamEvent & {
                  data?: {
                    result?: StrategyOutput;
                    artifacts?: Array<{
                      id: string;
                      type: string;
                      title: string;
                      fileName: string;
                      mimeType: string;
                      sizeBytes: number;
                    }>;
                  };
                };

                // Collect events for BrowserPreviewWindow
                setStrategyEvents((prev) => [...prev, event]);

                // Show periodic progress updates (every 5 seconds)
                if (
                  Date.now() - lastProgressUpdate > 5000 &&
                  event.data?.completedAgents !== undefined
                ) {
                  lastProgressUpdate = Date.now();
                  const progressContent = `📊 **Progress:** ${event.data.completedAgents}/${event.data.totalAgents || '?'} agents complete | $${(event.data.cost || 0).toFixed(2)}`;

                  if (progressMessageId) {
                    // Update existing progress message
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === progressMessageId ? { ...m, content: progressContent } : m
                      )
                    );
                  } else {
                    // Create new progress message
                    progressMessageId = crypto.randomUUID();
                    const progressMessage: Message = {
                      id: progressMessageId,
                      role: 'assistant',
                      content: progressContent,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, progressMessage]);
                  }
                }

                // Check for completion
                if (event.type === 'strategy_complete' && event.data?.result) {
                  displayStrategyResult(event.data.result, event.data.artifacts);
                  setStrategyPhase('complete');
                  setIsStrategyMode(false);
                }

                // Check for error
                if (event.type === 'error') {
                  throw new Error(event.message);
                }

                // Check for kill switch
                if (event.type === 'kill_switch') {
                  throw new Error(`Strategy stopped: ${event.message}`);
                }
              } catch (e) {
                if (e instanceof Error && e.message.includes('Strategy stopped')) {
                  throw e;
                }
                log.warn('Failed to parse event:', { error: e });
              }
            }
          }
        }
      }
    } catch (error) {
      log.error('Strategy execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Strategy Failed**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStrategyPhase('error');
      setIsStrategyMode(false);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Display the final strategy result as a rich chat message
   */
  const displayStrategyResult = (
    result: StrategyOutput,
    artifacts?: Array<{
      id: string;
      type: string;
      title: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>
  ) => {
    const artifactSection =
      artifacts && artifacts.length > 0
        ? `\n### Generated Deliverables\n${artifacts
            .map((a) => `- **${a.title}** (${a.fileName}) — ${(a.sizeBytes / 1024).toFixed(1)} KB`)
            .join('\n')}\n\n*Deliverables are stored and can be retrieved from your session.*`
        : '';

    // Check if this is a writer mode result with a document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (result as any).document as
      | { title?: string; content?: string; citations?: string[] }
      | undefined;
    let content: string;

    if (doc?.content) {
      // Writer mode — display the full document
      content = `# ${doc.title || result.recommendation.title}\n\n${doc.content}`;

      if (doc.citations && doc.citations.length > 0) {
        content += `\n\n---\n\n**Sources:**\n${doc.citations.map((c: string) => `- ${c}`).join('\n')}`;
      }

      content += `${artifactSection}\n\n---\n*Content generated by ${result.metadata.totalAgents} agents in ${Math.round(result.metadata.executionTime / 1000)}s.*`;
    } else {
      // Strategy/Research mode — display the standard strategy output
      content = `## Strategy Complete

### Recommendation
**${result.recommendation.title}**

${result.recommendation.summary}

**Confidence:** ${result.recommendation.confidence}%
**Best For:** ${result.recommendation.bestFor}

### Key Reasoning
${result.recommendation.reasoning.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### Trade-offs to Consider
${result.recommendation.tradeoffs.map((item) => `- ${typeof item === 'object' && item !== null ? (item as { text?: string; description?: string }).text || (item as { text?: string; description?: string }).description || JSON.stringify(item) : item}`).join('\n')}

${result.alternatives.length > 0 ? `### Alternative Options\n${result.alternatives.map((alt) => `- **${alt.title || 'Alternative'}** (${alt.confidence ?? 'N/A'}% confidence)\n  ${alt.summary || ''}\n  *Why not top:* ${alt.whyNotTop || 'Not specified'}`).join('\n\n')}` : ''}

### Action Plan
${result.actionPlan.map((item, i) => `${i + 1}. **${item.action}**\n   Priority: ${item.priority} | Timeframe: ${item.timeframe}${item.details ? `\n   ${item.details}` : ''}`).join('\n\n')}

### Next Steps
${result.nextSteps.map((step) => `- ${step}`).join('\n')}

${result.gaps.length > 0 ? `### Information Gaps\n${result.gaps.map((gap) => `- ${gap}`).join('\n')}` : ''}
${artifactSection}

### Research Metadata
- **Agents Deployed:** ${result.metadata.totalAgents}
- **Searches Conducted:** ${result.metadata.totalSearches}
- **Total Cost:** $${result.metadata.totalCost.toFixed(2)}
- **Duration:** ${Math.round(result.metadata.executionTime / 1000)}s

---
*Strategy complete. Ask follow-up questions or start a new strategy.*`;
    }

    const resultMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resultMessage]);
  };

  /**
   * Cancel the current strategy
   */
  const cancelStrategy = async () => {
    if (!strategySessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${strategySessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Strategy cancelled.** You can start a new one anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsStrategyMode(false);
    setStrategyPhase('idle');
    setStrategySessionId(null);
    setIsStreaming(false);
  };

  // ===========================================================================
  // DEEP RESEARCH - Same engine as Strategy, research-focused prompts
  // ===========================================================================

  /**
   * Start Deep Research mode - adds intro message to chat and begins intake
   */
  const startDeepResearch = async () => {
    if (isDeepResearchMode || deepResearchLoading) {
      return;
    }

    setDeepResearchLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 📚 Deep Research Mode Activated

**You've activated the most powerful AI research system ever built.**

This isn't a simple search. I'm about to deploy an autonomous research army:
- **Opus 4.6** as the Research Director (designs your investigation)
- **Sonnet 4.6** Domain Leads (coordinate research teams)
- **Up to 100 Haiku 4.5 Investigators** (parallel research army)
- **14 specialized tools** including browser automation, vision AI, PDF extraction

**But first, I need to understand what you want to research.**

Tell me the topic, your questions, and what you'll use this research for. The more context you give me, the deeper I can go.

**What topic do you want me to research?**

---
*Estimated: 2-5 min | $8-15 | Stop anytime by typing "cancel"*`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start research session via strategy API with mode: 'research'
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 'research' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start research');
      }

      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      setDeepResearchSessionId(sessionId);
      setIsDeepResearchMode(true);
      setDeepResearchPhase('intake');

      log.debug('Deep Research mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start deep research:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Research Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsDeepResearchMode(false);
      setDeepResearchPhase('idle');
    } finally {
      setIsStreaming(false);
      setDeepResearchLoading(false);
    }
  };

  /**
   * Handle user input during deep research intake phase
   */
  const handleDeepResearchInput = async (input: string) => {
    if (!deepResearchSessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelDeepResearch();
      return;
    }

    setIsStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: deepResearchSessionId,
          input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to process input');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.isComplete) {
        await executeDeepResearch();
      }
    } catch (error) {
      log.error('Deep research input error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute the deep research after intake is complete
   */
  const executeDeepResearch = async () => {
    if (!deepResearchSessionId) return;

    setDeepResearchPhase('executing');
    setIsStreaming(true);
    setDeepResearchEvents([]);

    const execMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🔬 Deploying Research Army...

Research is now underway. This will take 2-5 minutes.

I'll update you as investigators report back with findings.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, execMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: deepResearchSessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute research');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      let lastProgressUpdate = Date.now();
      let progressMessageId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              try {
                const event = JSON.parse(data) as StrategyStreamEvent & {
                  data?: {
                    result?: StrategyOutput;
                    artifacts?: Array<{
                      id: string;
                      type: string;
                      title: string;
                      fileName: string;
                      mimeType: string;
                      sizeBytes: number;
                    }>;
                  };
                };

                setDeepResearchEvents((prev) => [...prev, event]);

                if (
                  Date.now() - lastProgressUpdate > 5000 &&
                  event.data?.completedAgents !== undefined
                ) {
                  lastProgressUpdate = Date.now();
                  const progressContent = `📊 **Progress:** ${event.data.completedAgents}/${event.data.totalAgents || '?'} investigators complete | $${(event.data.cost || 0).toFixed(2)}`;

                  if (progressMessageId) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === progressMessageId ? { ...m, content: progressContent } : m
                      )
                    );
                  } else {
                    progressMessageId = crypto.randomUUID();
                    const progressMessage: Message = {
                      id: progressMessageId,
                      role: 'assistant',
                      content: progressContent,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, progressMessage]);
                  }
                }

                if (event.type === 'strategy_complete' && event.data?.result) {
                  displayResearchResult(event.data.result, event.data.artifacts);
                  setDeepResearchPhase('complete');
                  setIsDeepResearchMode(false);
                }

                if (event.type === 'error') {
                  throw new Error(event.message);
                }

                if (event.type === 'kill_switch') {
                  throw new Error(`Research stopped: ${event.message}`);
                }
              } catch (e) {
                if (e instanceof Error && e.message.includes('Research stopped')) {
                  throw e;
                }
                log.warn('Failed to parse event:', { error: e });
              }
            }
          }
        }
      }
    } catch (error) {
      log.error('Deep research execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Research Failed**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setDeepResearchPhase('error');
      setIsDeepResearchMode(false);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Display the final research result as a rich chat message
   */
  const displayResearchResult = (
    result: StrategyOutput,
    artifacts?: Array<{
      id: string;
      type: string;
      title: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>
  ) => {
    const artifactSection =
      artifacts && artifacts.length > 0
        ? `\n### Generated Deliverables\n${artifacts
            .map((a) => `- **${a.title}** (${a.fileName}) — ${(a.sizeBytes / 1024).toFixed(1)} KB`)
            .join('\n')}\n\n*Deliverables are stored and can be retrieved from your session.*`
        : '';

    const content = `## 📚 Research Report Complete

### Executive Summary
**${result.recommendation.title}**

${result.recommendation.summary}

**Confidence:** ${result.recommendation.confidence}%

### Key Findings
${result.recommendation.reasoning.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### Limitations & Caveats
${result.recommendation.tradeoffs.map((item) => `- ${typeof item === 'object' && item !== null ? (item as { text?: string; description?: string }).text || (item as { text?: string; description?: string }).description || JSON.stringify(item) : item}`).join('\n')}

${result.alternatives.length > 0 ? `### Alternative Perspectives\n${result.alternatives.map((alt) => `- **${alt.title || 'Alternative'}** (${alt.confidence ?? 'N/A'}% confidence)\n  ${alt.summary || ''}`).join('\n\n')}` : ''}

### Recommended Next Steps
${result.actionPlan.map((item, i) => `${i + 1}. **${item.action}**\n   Priority: ${item.priority} | Timeframe: ${item.timeframe}${item.details ? `\n   ${item.details}` : ''}`).join('\n\n')}

### Further Research
${result.nextSteps.map((step) => `- ${step}`).join('\n')}

${result.gaps.length > 0 ? `### Knowledge Gaps\n${result.gaps.map((gap) => `- ${gap}`).join('\n')}` : ''}
${artifactSection}

### Research Metadata
- **Investigators Deployed:** ${result.metadata.totalAgents}
- **Searches Conducted:** ${result.metadata.totalSearches}
- **Total Cost:** $${result.metadata.totalCost.toFixed(2)}
- **Duration:** ${Math.round(result.metadata.executionTime / 1000)}s

---
*Research complete. Ask follow-up questions or start a new research session.*`;

    const resultMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resultMessage]);
  };

  /**
   * Cancel the current deep research
   */
  const cancelDeepResearch = async () => {
    if (!deepResearchSessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${deepResearchSessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Research cancelled.** You can start a new research session anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsDeepResearchMode(false);
    setDeepResearchPhase('idle');
    setDeepResearchSessionId(null);
    setIsStreaming(false);
  };

  // ===========================================================================
  // QUICK RESEARCH - Lightweight version of Deep Research (1/4 scale)
  // Uses the strategy engine with 'quick-research' mode for fast, focused research
  // ===========================================================================

  /**
   * Start Quick Research mode - streamlined intake for fast research
   */
  const startQuickResearch = async () => {
    if (isQuickResearchMode || quickResearchLoading) {
      return;
    }

    setQuickResearchLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🔍 Quick Research Mode

I'll deploy a focused research team to investigate your topic.

**What you get:**
- **10-15 intelligent scouts** (Claude Sonnet 4.6)
- **All research tools:** Browser automation, web search, PDF extraction, vision analysis
- **Opus synthesis:** Claude Opus 4.6 compiles findings

**Estimated: 1-2 min | $2-3**

**What do you want me to research?**`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start research session via strategy API with mode: 'quick-research'
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 'quick-research' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start research');
      }

      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      setQuickResearchSessionId(sessionId);
      setIsQuickResearchMode(true);
      setQuickResearchPhase('intake');

      log.debug('Quick Research mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start quick research:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Research Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsQuickResearchMode(false);
      setQuickResearchPhase('idle');
    } finally {
      setIsStreaming(false);
      setQuickResearchLoading(false);
    }
  };

  /**
   * Handle user input during quick research intake phase
   */
  const handleQuickResearchInput = async (input: string) => {
    if (!quickResearchSessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelQuickResearch();
      return;
    }

    setIsStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: quickResearchSessionId,
          input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to process input');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.isComplete) {
        await executeQuickResearch();
      }
    } catch (error) {
      log.error('Quick research input error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute the quick research after intake is complete
   */
  const executeQuickResearch = async () => {
    if (!quickResearchSessionId) return;

    setQuickResearchPhase('executing');
    setIsStreaming(true);
    setQuickResearchEvents([]);

    const execMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🚀 Deploying Research Scouts...

Research is now underway. This will take 1-2 minutes.

I'll update you as scouts report back with findings.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, execMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: quickResearchSessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute research');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StrategyStreamEvent;
              setQuickResearchEvents((prev) => [...prev, event]);

              // Handle completion
              if (event.type === 'strategy_complete' && event.data?.result) {
                displayResearchResult(event.data.result, event.data.artifacts);
                setQuickResearchPhase('complete');
                setIsQuickResearchMode(false);
              }

              // Handle errors and kill switch
              if (event.type === 'error') {
                throw new Error(`Agent error: ${event.message}`);
              }
              if (event.type === 'kill_switch') {
                throw new Error(`Agent error: ${event.message}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Agent error:')) {
                throw e;
              }
              log.warn('Failed to parse SSE event:', { error: e });
            }
          }
        }
      }
    } catch (error) {
      log.error('Quick research execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Research Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setQuickResearchPhase('error');
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Cancel quick research session
   */
  const cancelQuickResearch = async () => {
    if (!quickResearchSessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${quickResearchSessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Research cancelled.** You can start a new research session anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsQuickResearchMode(false);
    setQuickResearchPhase('idle');
    setQuickResearchSessionId(null);
    setIsStreaming(false);
  };

  // ===========================================================================
  // QUICK STRATEGY - Lightweight version of Deep Strategy (1/4 scale)
  // Uses the strategy engine with 'quick-strategy' mode for fast decisions
  // ===========================================================================

  /**
   * Start Quick Strategy mode - streamlined intake for fast strategic decisions
   */
  const startQuickStrategy = async () => {
    if (isQuickStrategyMode || quickStrategyLoading) {
      return;
    }

    setQuickStrategyLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🎯 Quick Strategy Mode

I'll deploy a focused team to help you make this decision.

**What you get:**
- **10-15 intelligent scouts** (Claude Sonnet 4.6)
- **All research tools:** Browser automation, web search, data analysis
- **Opus synthesis:** Claude Opus 4.6 analyzes and recommends

**Estimated: 1-2 min | $2-3**

**What decision do you need help with?**`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start strategy session via strategy API with mode: 'quick-strategy'
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 'quick-strategy' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start strategy');
      }

      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      setQuickStrategySessionId(sessionId);
      setIsQuickStrategyMode(true);
      setQuickStrategyPhase('intake');

      log.debug('Quick Strategy mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start quick strategy:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Strategy Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsQuickStrategyMode(false);
      setQuickStrategyPhase('idle');
    } finally {
      setIsStreaming(false);
      setQuickStrategyLoading(false);
    }
  };

  /**
   * Handle user input during quick strategy intake phase
   */
  const handleQuickStrategyInput = async (input: string) => {
    if (!quickStrategySessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelQuickStrategy();
      return;
    }

    setIsStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: quickStrategySessionId,
          input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to process input');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.isComplete) {
        await executeQuickStrategy();
      }
    } catch (error) {
      log.error('Quick strategy input error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute the quick strategy after intake is complete
   */
  const executeQuickStrategy = async () => {
    if (!quickStrategySessionId) return;

    setQuickStrategyPhase('executing');
    setIsStreaming(true);
    setQuickStrategyEvents([]);

    const execMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 🚀 Deploying Strategy Scouts...

Analysis is now underway. This will take 1-2 minutes.

I'll update you as scouts report back with findings.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, execMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: quickStrategySessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute strategy');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StrategyStreamEvent;
              setQuickStrategyEvents((prev) => [...prev, event]);

              // Handle completion
              if (event.type === 'strategy_complete' && event.data?.result) {
                displayStrategyResult(event.data.result, event.data.artifacts);
                setQuickStrategyPhase('complete');
                setIsQuickStrategyMode(false);
              }

              // Handle errors and kill switch
              if (event.type === 'error') {
                throw new Error(`Agent error: ${event.message}`);
              }
              if (event.type === 'kill_switch') {
                throw new Error(`Agent error: ${event.message}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Agent error:')) {
                throw e;
              }
              log.warn('Failed to parse SSE event:', { error: e });
            }
          }
        }
      }
    } catch (error) {
      log.error('Quick strategy execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Strategy Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setQuickStrategyPhase('error');
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Cancel quick strategy session
   */
  const cancelQuickStrategy = async () => {
    if (!quickStrategySessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${quickStrategySessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Strategy cancelled.** You can start a new strategy session anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsQuickStrategyMode(false);
    setQuickStrategyPhase('idle');
    setQuickStrategySessionId(null);
    setIsStreaming(false);
  };

  // ===========================================================================
  // DEEP WRITER AGENT - Professional AI Writing with Research
  // ===========================================================================

  /**
   * Start Deep Writer mode - professional writing with full research
   */
  const startDeepWriter = async () => {
    if (isDeepWriterMode || deepWriterLoading) {
      return;
    }

    setDeepWriterLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## ✍️ Deep Writer Mode Activated

**You've activated the most advanced AI writing system ever built.**

This is a full publishing operation:
- **Claude Opus 4.6** - Editorial Director & Writers
- **Claude Sonnet 4.6** - Research Corps (15-50 agents)
- **Full browser tools** - Web research, PDF extraction, data gathering

**The Process:**
1. Deep intake - I understand exactly what you're creating
2. Research phase - Agents gather ALL facts first
3. Writing phase - Professional writers craft each section
4. Editorial phase - Voice consistency, polish, citations
5. Export - Markdown, PDF, or DOCX

**What are you writing today?**`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start strategy session via strategy API with mode: 'deep-writer'
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 'deep-writer' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start writer');
      }

      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      setDeepWriterSessionId(sessionId);
      setIsDeepWriterMode(true);
      setDeepWriterPhase('intake');

      log.debug('Deep Writer mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start deep writer:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Writer Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsDeepWriterMode(false);
      setDeepWriterPhase('idle');
    } finally {
      setIsStreaming(false);
      setDeepWriterLoading(false);
    }
  };

  /**
   * Handle user input during deep writer intake phase
   */
  const handleDeepWriterInput = async (input: string) => {
    if (!deepWriterSessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelDeepWriter();
      return;
    }

    setIsStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: deepWriterSessionId,
          input,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to process input');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.isComplete) {
        await executeDeepWriter();
      }
    } catch (error) {
      log.error('Deep writer input error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute the deep writer after intake is complete
   */
  const executeDeepWriter = async () => {
    if (!deepWriterSessionId) return;

    setDeepWriterPhase('executing');
    setIsStreaming(true);
    setDeepWriterEvents([]);

    const execMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## 📚 Writing Operation Underway

**Phase 1: Research**
Deploying research scouts to gather facts, quotes, and sources...

**Phase 2: Writing**
Writers will craft each section using verified research...

**Phase 3: Editorial**
Final polish, voice consistency, and citations...

This may take 5-15 minutes depending on document length.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, execMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: deepWriterSessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute writer');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StrategyStreamEvent;
              setDeepWriterEvents((prev) => [...prev, event]);

              // Handle completion
              if (event.type === 'strategy_complete' && event.data?.result) {
                displayStrategyResult(event.data.result, event.data.artifacts);
                setDeepWriterPhase('complete');
                setIsDeepWriterMode(false);
              }

              // Handle errors and kill switch
              if (event.type === 'error') {
                throw new Error(`Agent error: ${event.message}`);
              }
              if (event.type === 'kill_switch') {
                throw new Error(`Agent error: ${event.message}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Agent error:')) {
                throw e;
              }
              log.warn('Failed to parse SSE event:', { error: e });
            }
          }
        }
      }
    } catch (error) {
      log.error('Deep writer execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Writer Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setDeepWriterPhase('error');
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Cancel deep writer session
   */
  const cancelDeepWriter = async () => {
    if (!deepWriterSessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${deepWriterSessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Writing cancelled.** You can start a new writing project anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsDeepWriterMode(false);
    setDeepWriterPhase('idle');
    setDeepWriterSessionId(null);
    setIsStreaming(false);
  };

  // ===========================================================================
  // QUICK WRITER AGENT - Fast AI Writing with Focused Research
  // ===========================================================================

  /**
   * Start Quick Writer mode - fast writing with focused research
   */
  const startQuickWriter = async () => {
    if (isQuickWriterMode || quickWriterLoading) {
      return;
    }

    setQuickWriterLoading(true);
    setIsStreaming(true);

    // Add intro message to chat
    const introMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `## ✍️ Quick Writer Mode

I'll deploy a focused team to research and write your content.

**What you get:**
- **10-15 research scouts** (Claude Sonnet 4.6) - gather facts first
- **Opus writers** (Claude Opus 4.6) - craft polished content
- **Fast turnaround:** 2-3 minutes

**Best for:**
- Blog posts and articles
- Short reports and summaries
- Professional emails
- Product descriptions

**What do you want me to write?**`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, introMessage]);

    try {
      // Start strategy session via strategy API with mode: 'quick-writer'
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode: 'quick-writer' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start writer');
      }

      const sessionId = response.headers.get('X-Session-Id');

      if (!sessionId) {
        throw new Error('No session ID returned from server.');
      }

      setQuickWriterSessionId(sessionId);
      setIsQuickWriterMode(true);
      setQuickWriterPhase('intake');

      log.debug('Quick Writer mode activated', { sessionId });
    } catch (error) {
      log.error('Failed to start quick writer:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Writer Error**\n\n${(error as Error).message}\n\nPlease try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsQuickWriterMode(false);
      setQuickWriterPhase('idle');
    } finally {
      setIsStreaming(false);
      setQuickWriterLoading(false);
    }
  };

  /**
   * Handle user input during quick writer intake phase
   */
  const handleQuickWriterInput = async (input: string) => {
    if (!quickWriterSessionId) {
      return;
    }

    // Check for cancel command
    if (input.toLowerCase().trim() === 'cancel') {
      await cancelQuickWriter();
      return;
    }

    setIsStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Send to strategy API for intake processing
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'input',
          sessionId: quickWriterSessionId,
          input: input,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process input');
      }

      const data = await response.json();

      if (data.isComplete) {
        // Intake complete - start execution
        setQuickWriterPhase('executing');
        await executeQuickWriter();
      } else {
        // More intake needed - show follow-up question
        const followUp: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            data.response || 'Could you provide more details about what you want me to write?',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, followUp]);
      }
    } catch (error) {
      log.error('Quick writer intake error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '❌ Something went wrong. Please try again or type "cancel" to exit.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Execute quick writer research and writing
   */
  const executeQuickWriter = async () => {
    if (!quickWriterSessionId) return;

    setIsStreaming(true);

    const statusMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '**Writing in progress...** Opus is crafting your content.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, statusMessage]);

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sessionId: quickWriterSessionId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to execute quick writer');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const event: StrategyStreamEvent = JSON.parse(jsonStr);
              setQuickWriterEvents((prev) => [...prev, event]);

              // Handle completion
              if (event.type === 'strategy_complete' && event.data?.result) {
                const result = event.data.result;
                const doc = result.recommendation;

                // Format the final document
                let finalContent = `# ${doc.title}\n\n`;

                if ('document' in result && result.document) {
                  const docData = result.document as {
                    content?: string;
                    citations?: string[];
                  };
                  finalContent += docData.content || doc.summary;

                  // Add citations if present
                  if (docData.citations && docData.citations.length > 0) {
                    finalContent += '\n\n---\n\n**Sources:**\n';
                    docData.citations.forEach((citation: string) => {
                      finalContent += `- ${citation}\n`;
                    });
                  }
                } else {
                  finalContent += doc.summary;
                }

                const finalMessage: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: finalContent,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, finalMessage]);
                setQuickWriterPhase('complete');
                setIsQuickWriterMode(false);
                setQuickWriterSessionId(null);
              }

              // Handle errors and kill switch
              if (event.type === 'error' || event.type === 'kill_switch') {
                throw new Error(`Agent error: ${event.message || 'Writer error'}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Agent error:')) {
                throw e;
              }
              log.warn('Failed to parse SSE event:', { error: e });
            }
          }
        }
      }
    } catch (error) {
      log.error('Quick writer execution error:', error as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **Writing Error**\n\n${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setQuickWriterPhase('error');
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * Cancel quick writer session
   */
  const cancelQuickWriter = async () => {
    if (!quickWriterSessionId) return;

    try {
      await fetch(`/api/strategy?sessionId=${quickWriterSessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      log.warn('Cancel request failed:', { error: e });
    }

    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✋ **Writing cancelled.** You can start a new writing project anytime.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setIsQuickWriterMode(false);
    setQuickWriterPhase('idle');
    setQuickWriterSessionId(null);
    setIsStreaming(false);
  };

  const handleSendMessage = async (
    content: string,
    attachments: Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => {
    if (!content.trim() && attachments.length === 0) return;

    // CRITICAL: Prevent double-submission by checking and setting isStreaming FIRST
    // This check uses the ref for immediate synchronous check, avoiding React state batching delays
    if (isStreaming) {
      log.debug('Blocked duplicate submission - already streaming');
      return;
    }

    // PROACTIVE CONTEXT MANAGEMENT: If we're at or above the hard limit,
    // trigger automatic continuation before even trying to send
    const HARD_CONTEXT_LIMIT = 45; // Above this, continuation is mandatory
    if (messages.length >= HARD_CONTEXT_LIMIT && !continuationDismissed) {
      log.debug('Message count at hard limit, triggering proactive continuation', {
        messageCount: messages.length,
        limit: HARD_CONTEXT_LIMIT,
      });
      // Store the pending message so we can send it after continuation
      const pendingContent = content;
      const pendingAttachments = attachments;
      const pendingSearchMode = searchMode;

      // Trigger continuation
      await handleChatContinuation();

      // After continuation, automatically send the user's message in the new chat
      // Give it a moment for the state to update
      setTimeout(() => {
        handleSendMessage(pendingContent, pendingAttachments, pendingSearchMode, selectedRepo);
      }, 500);
      return;
    }

    // Check for slash commands
    const parsed = parseSlashCommand(content);
    if (parsed.isCommand) {
      // Handle /help and unknown commands - show as assistant message
      if (parsed.helpText) {
        const helpMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: parsed.helpText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, helpMessage]);
        return;
      }

      // For other commands, replace content with the generated prompt
      if (parsed.prompt) {
        content = parsed.prompt;
      }
    }

    // DEEP STRATEGY MODE: If we're in strategy intake, send to strategy API
    if (isStrategyMode && strategyPhase === 'intake' && strategySessionId) {
      await handleStrategyInput(content);
      return;
    }

    // DEEP RESEARCH MODE: If we're in deep research intake, send to strategy API
    if (isDeepResearchMode && deepResearchPhase === 'intake' && deepResearchSessionId) {
      await handleDeepResearchInput(content);
      return;
    }

    // QUICK RESEARCH MODE: If we're in quick research intake, send to strategy API
    if (isQuickResearchMode && quickResearchPhase === 'intake' && quickResearchSessionId) {
      await handleQuickResearchInput(content);
      return;
    }

    // QUICK STRATEGY MODE: If we're in quick strategy intake, send to strategy API
    if (isQuickStrategyMode && quickStrategyPhase === 'intake' && quickStrategySessionId) {
      await handleQuickStrategyInput(content);
      return;
    }

    // DEEP WRITER MODE: If we're in deep writer intake, send to strategy API
    if (isDeepWriterMode && deepWriterPhase === 'intake' && deepWriterSessionId) {
      await handleDeepWriterInput(content);
      return;
    }

    // QUICK WRITER MODE: If we're in quick writer intake, send to strategy API
    if (isQuickWriterMode && quickWriterPhase === 'intake' && quickWriterSessionId) {
      await handleQuickWriterInput(content);
      return;
    }

    // STEERING: If we're in execution phase, send as context/steering command
    if (
      (isStrategyMode && strategyPhase === 'executing' && strategySessionId) ||
      (isDeepResearchMode && deepResearchPhase === 'executing' && deepResearchSessionId) ||
      (isQuickResearchMode && quickResearchPhase === 'executing' && quickResearchSessionId) ||
      (isQuickStrategyMode && quickStrategyPhase === 'executing' && quickStrategySessionId) ||
      (isDeepWriterMode && deepWriterPhase === 'executing' && deepWriterSessionId) ||
      (isQuickWriterMode && quickWriterPhase === 'executing' && quickWriterSessionId)
    ) {
      const sessionId =
        strategySessionId ||
        deepResearchSessionId ||
        quickResearchSessionId ||
        quickStrategySessionId ||
        deepWriterSessionId ||
        quickWriterSessionId;
      if (sessionId) {
        // Show user message in chat
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);

        try {
          const res = await fetch('/api/strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'context',
              sessionId,
              message: content,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const responseContent = data.steeringApplied
              ? `**Steering Applied** (${data.steeringAction})\n\n${data.message}`
              : `Context received: "${content.slice(0, 100)}${content.length > 100 ? '...' : ''}"`;

            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
        } catch (err) {
          log.warn('Failed to send steering command', { error: err });
        }
        return;
      }
    }

    // SMART TOOL SUGGESTIONS: Check if this is a response to a pending tool suggestion
    // If user confirms ("yes", "sure", etc.), auto-trigger the suggested tool
    // contentForAI holds what the AI should process (may differ from what user typed)
    let contentForAI = content;
    if (pendingToolSuggestion) {
      const userConfirmed = isConfirmation(content);
      const userDeclined = isDecline(content);

      if (userConfirmed) {
        log.debug('User confirmed tool suggestion:', {
          action: pendingToolSuggestion.action,
          originalQuestion: pendingToolSuggestion.originalQuestion?.slice(0, 50),
        });

        // Map the suggested action to the appropriate search mode
        if (pendingToolSuggestion.action === 'search') {
          searchMode = 'search';
        } else if (pendingToolSuggestion.action === 'factcheck') {
          searchMode = 'factcheck';
        }

        // Use the original question for the AI to search, but keep user's actual input ("yes") for display
        if (pendingToolSuggestion.originalQuestion) {
          contentForAI = pendingToolSuggestion.originalQuestion;
        }

        // Clear the pending suggestion
        setPendingToolSuggestion(null);
      } else if (userDeclined) {
        log.debug('User declined tool suggestion');
        // Clear the pending suggestion and continue with normal message flow
        setPendingToolSuggestion(null);
      } else {
        // User sent a different message entirely - clear suggestion and process normally
        setPendingToolSuggestion(null);
      }
    }

    // Set streaming state EARLY to block any further submissions during async operations
    // This prevents race conditions where user clicks send multiple times quickly
    setIsStreaming(true);

    // REMOVED: Tool-specific handling - all tools now handled naturally in chat

    let newChatId: string;

    // Auto-create chat if none exists
    if (!currentChatId) {
      const tempId = crypto.randomUUID();
      const newChat: Chat = {
        id: tempId,
        title: 'New Chat',
        isPinned: false,
        lastMessage: content.slice(0, 50),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats([newChat, ...chats]);
      setCurrentChatId(tempId);
      // Update ref immediately to avoid race conditions
      currentChatIdRef.current = tempId;

      // Create conversation in database - MUST succeed before proceeding
      try {
        const dbConversationId = await createConversationInDatabase('New Chat', 'general');
        log.debug('Created conversation:', { tempId, dbId: dbConversationId });

        // Validate we got a proper UUID back
        if (!dbConversationId || typeof dbConversationId !== 'string') {
          throw new Error('Invalid conversation ID returned from database');
        }

        // Use the database UUID for all subsequent operations
        newChatId = dbConversationId;
        setCurrentChatId(dbConversationId);
        // CRITICAL: Update ref immediately to fix race condition with streaming
        // setState is async, but ref update is synchronous
        currentChatIdRef.current = dbConversationId;
        setChats((prevChats) => {
          const updated = prevChats.map((chat) =>
            chat.id === tempId ? { ...chat, id: dbConversationId } : chat
          );
          const updatedChat = updated.find((c) => c.id === dbConversationId);
          log.debug('Updated chats array - found chat with new UUID:', {
            id: updatedChat?.id,
            title: updatedChat?.title,
          });
          return updated;
        });
      } catch (error) {
        log.error('Failed to create conversation:', error as Error);
        // Remove the temporary chat from UI since we couldn't create it in database
        setChats((prevChats) => prevChats.filter((c) => c.id !== tempId));
        setCurrentChatId(null);
        // Reset streaming state since we're returning early
        setIsStreaming(false);
        // Show error to user
        alert('Unable to start a new conversation. Please try again.');
        return; // Don't proceed with sending message
      }
    } else {
      newChatId = currentChatId;
    }

    // If replying to a message, prepend the quoted context
    let finalContent = content;
    if (replyingTo) {
      // Truncate long messages for the quote - clean format for the AI
      const quotedContent =
        replyingTo.content.length > 200
          ? replyingTo.content.slice(0, 200) + '...'
          : replyingTo.content;
      // Simple bracketed format that AI understands but looks clean to user
      finalContent = `[Replying to: "${quotedContent}"]\n\n${content}`;
      // Clear the reply state
      setReplyingTo(null);
    }

    const userMessageId = crypto.randomUUID();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: finalContent,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
    };

    // CRITICAL FIX: Save to database FIRST with rollback on failure
    // This prevents "ghost messages" that appear in UI but aren't persisted
    const attachmentUrls = attachments.filter((att) => att.url).map((att) => att.url!);

    try {
      // Save user message to database BEFORE displaying
      // Note: We don't need the result, just ensuring the save succeeds before displaying
      await saveMessageToDatabase(
        newChatId,
        'user',
        content,
        'text',
        undefined,
        attachmentUrls.length > 0 ? attachmentUrls : undefined
      );

      // Only show message in UI AFTER successful database save
      setMessages([...messages, userMessage]);
      // Note: isStreaming is already set to true at the start of handleSendMessage

      // Detect if this is a document generation request for UI feedback
      const detectedDocType = detectDocumentTypeFromMessage(content);
      setPendingDocumentType(detectedDocType);
      if (detectedDocType) {
        log.debug(`Document generation detected: ${detectedDocType}`);
      }
    } catch (saveError) {
      // Database save failed - show error to user instead of ghost message
      log.error('Failed to save user message:', saveError as Error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Sorry, your message could not be sent. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
      return; // Exit early - don't proceed with API call
    }

    try {
      // Get all messages including the new one
      const allMessages = [...messages, userMessage];

      // If this was a confirmation (user typed "yes"), override the last message's content
      // for AI processing with the original question, while keeping "yes" displayed in UI
      if (contentForAI !== content) {
        const lastIndex = allMessages.length - 1;
        allMessages[lastIndex] = {
          ...allMessages[lastIndex],
          content: contentForAI, // AI receives the original question
        };
      }

      // Find the index of the last user message with images (should be the new one)
      let lastImageMessageIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === 'user' && msg.attachments?.some((att) => att.type.startsWith('image/'))) {
          lastImageMessageIndex = i;
          break;
        }
      }

      // Debug: Log attachment info
      log.debug('Message formatting:', {
        totalMessages: allMessages.length,
        lastImageMessageIndex,
        newMessageAttachments: userMessage.attachments?.map((a) => ({
          name: a.name,
          type: a.type,
          hasThumbnail: !!a.thumbnail,
          hasUrl: !!a.url,
          urlLength: a.url?.length || 0,
          thumbnailLength: a.thumbnail?.length || 0,
        })),
      });

      // Format messages for API, handling both images and document attachments
      // This prevents payload bloat from accumulated image history
      const apiMessages = allMessages.map((msg, index) => {
        // Check if this message has image attachments
        const imageAttachments = msg.attachments?.filter(
          (att) => att.type.startsWith('image/') && att.thumbnail
        );

        // Check for document attachments (CSV, TXT, XLSX, PDF with content)
        const documentAttachments = msg.attachments?.filter(
          (att) => !att.type.startsWith('image/') && att.url
        );

        // Build message content with any document data
        let messageContent = msg.content || '';

        // If this is the current message and has document attachments, include content
        if (
          index === allMessages.length - 1 &&
          documentAttachments &&
          documentAttachments.length > 0
        ) {
          documentAttachments.forEach((doc) => {
            const fileContent = doc.url || '';

            // Check if content is base64 (unparsed) or text (parsed)
            const isBase64 = fileContent.startsWith('data:');

            if (isBase64) {
              // File wasn't parsed - just note it exists
              messageContent = `[File: ${doc.name} - Unable to extract content]\n\n${messageContent}`;
            } else {
              // File was parsed - include the actual content
              const fileLabel =
                doc.type.includes('spreadsheet') || doc.type.includes('excel')
                  ? 'Spreadsheet'
                  : doc.type.includes('pdf')
                    ? 'Document'
                    : 'File';
              messageContent = `[${fileLabel}: ${doc.name}]\n\n${fileContent}\n\n---\n\n${messageContent}`;
            }
          });
        }

        // If no images, send message with any document content appended
        if (!imageAttachments || imageAttachments.length === 0) {
          // Ensure non-empty content for Claude API validation
          const content =
            messageContent.trim() || (msg.role === 'assistant' ? '[Response]' : '[Message]');
          return {
            role: msg.role,
            content,
          };
        }

        // Only include images for the most recent image message
        // Strip images from older messages to keep payload small
        if (index !== lastImageMessageIndex) {
          // Return text-only version with placeholder for stripped images
          return {
            role: msg.role,
            content: messageContent || '[User shared an image]',
          };
        }

        // Format message with images (Vercel AI SDK format)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentParts: any[] = [];

        // Add images first (Vercel AI SDK format)
        imageAttachments.forEach((image) => {
          contentParts.push({
            type: 'image',
            image: image.thumbnail, // Base64 data URL
          });
        });

        // Add text content (including any document data)
        if (messageContent) {
          contentParts.push({
            type: 'text',
            text: messageContent,
          });
        }

        return {
          role: msg.role,
          content: contentParts,
        };
      });

      // Debug: Log the formatted API messages
      const messagesWithImages = apiMessages.filter((m) => Array.isArray(m.content));
      if (messagesWithImages.length > 0) {
        log.debug('Messages with images being sent:', {
          messages: messagesWithImages.map((m) => ({
            role: m.role,
            contentTypes: Array.isArray(m.content)
              ? m.content.map((c: { type: string }) => c.type)
              : 'string',
            imageDataLength: Array.isArray(m.content)
              ? m.content
                  .filter((c: { type: string }) => c.type === 'image')
                  .map((c: { image?: string }) => c.image?.length || 0)
              : 0,
          })),
        });
      }

      // Build user context for personalization
      const userContext = hasProfile
        ? {
            name: profile.name,
            role: profile.isStudent ? 'student' : 'professional',
            field: profile.jobTitle,
            purpose: profile.description,
          }
        : undefined;

      // Create AbortController for this request
      // Abort any previous in-flight request first
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Call API with regular chat (no auto tool selection)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          userContext,
          conversationId: newChatId, // Pass current conversation ID to exclude from history
          // No tool parameter - let users manually select tools via buttons
          // Pass search mode for Anthropic (search/factcheck triggers Perplexity)
          searchMode: searchMode || 'none',
          // Pass selected GitHub repo for code review operations
          selectedRepo: selectedRepo || undefined,
          // Pass selected AI provider (Claude, xAI, DeepSeek, etc.)
          provider: selectedProvider,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        // Prioritize 'details' field for debugging, then other error formats
        const errorMsg =
          (errorData as { details?: string })?.details ||
          (typeof errorData?.error === 'string' ? errorData.error : null) ||
          errorData?.error?.message ||
          (errorData as { message?: string })?.message ||
          `HTTP ${response.status}`;
        const errorCode = errorData?.error?.code || 'API_ERROR';
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      // CRITICAL FIX: Validate response before processing
      // Check content type to determine if streaming or JSON
      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const isTextStream =
        contentType.includes('text/plain') || contentType.includes('text/event-stream');

      // Validate that we have a processable response type
      if (!isJsonResponse && !isTextStream && !response.body) {
        log.error('Invalid response type:', new Error(contentType));
        throw new Error('INVALID_RESPONSE: Server returned unexpected content type');
      }

      // Validate response body exists for streaming
      if (!isJsonResponse && !response.body) {
        log.error('Missing response body for streaming');
        throw new Error('INVALID_RESPONSE: No response body for streaming');
      }

      // Get model and search provider from response headers (for admin debugging)
      const modelUsed = response.headers.get('X-Model-Used') || undefined;
      const searchProvider = response.headers.get('X-Web-Search') || undefined;

      let finalContent = '';
      let isImageResponse = false;
      const assistantMessageId = crypto.randomUUID();

      if (isJsonResponse) {
        // Non-streaming response (for images or fallback)
        const data = await response.json();

        // Check if this is an image generation response
        if (data.type === 'image' && data.url) {
          isImageResponse = true;
          log.debug('Received image generation response:', {
            prompt: data.prompt,
            model: data.model,
            hasUrl: !!data.url,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: `Here's your generated image based on: "${data.prompt || content}"`,
            imageUrl: data.url,
            model: data.model || modelUsed,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save the image message to database
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            assistantMessage.content,
            'image',
            data.url
          );
        } else if (data.type === 'image_generation' && data.generatedImage) {
          // Natural language image generation response (FLUX.2)
          isImageResponse = true;
          log.debug('Received natural language image generation response:', {
            id: data.generatedImage.id,
            prompt: data.generatedImage.prompt,
            model: data.generatedImage.model,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || `I've created this image for you.`,
            generatedImage: data.generatedImage as GeneratedImage,
            model: data.generatedImage.model || modelUsed,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save to database with image URL
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            assistantMessage.content,
            'image',
            data.generatedImage.imageUrl
          );
        } else if (data.type === 'code_preview' && data.codePreview) {
          // Website/landing page code generation response
          log.debug('Received code preview response:', {
            title: data.codePreview.title,
            language: data.codePreview.language,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || 'Here is your generated code:',
            model: data.model || modelUsed,
            codePreview: {
              code: data.codePreview.code,
              language: data.codePreview.language,
              title: data.codePreview.title,
              description: data.codePreview.description,
            },
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save the code preview message to database
          await saveMessageToDatabase(newChatId, 'assistant', assistantMessage.content, 'text');
        } else if (data.type === 'multi_page_website' && data.multiPageWebsite) {
          // FORGE: Multi-page website generation response
          log.debug('Received multi-page website response:', {
            title: data.multiPageWebsite.title,
            pageCount: data.multiPageWebsite.pages?.length || 0,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || 'Here is your multi-page website:',
            model: data.model || modelUsed,
            multiPageWebsite: {
              pages: data.multiPageWebsite.pages,
              title: data.multiPageWebsite.title,
              description: data.multiPageWebsite.description,
              businessName: data.multiPageWebsite.businessName,
              category: data.multiPageWebsite.category,
            },
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save the multi-page website message to database
          await saveMessageToDatabase(newChatId, 'assistant', assistantMessage.content, 'text');
        } else if (data.type === 'video_job' && data.video_job) {
          // Video generation job started (admin only)
          log.debug('Received video job response:', {
            job_id: data.video_job.job_id,
            status: data.video_job.status,
            model: data.video_job.model,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || '',
            model: data.model || modelUsed,
            videoJob: {
              job_id: data.video_job.job_id,
              status: data.video_job.status,
              progress: data.video_job.progress || 0,
              model: data.video_job.model,
              size: data.video_job.size,
              seconds: data.video_job.seconds,
              status_url: data.video_job.status_url,
              download_url: data.video_job.download_url,
              prompt: data.video_job.prompt,
              segment: data.video_job.segment,
            },
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save the video job message to database
          await saveMessageToDatabase(newChatId, 'assistant', assistantMessage.content, 'text');

          // Start polling for video status
          const pollVideoStatus = async () => {
            const statusUrl = data.video_job.status_url;
            if (!statusUrl) {
              log.error('No status URL for video job');
              return;
            }

            const maxAttempts = 120; // 10 minutes max (5s intervals)
            let attempts = 0;

            const poll = async () => {
              attempts++;
              try {
                const statusResponse = await fetch(statusUrl);
                if (!statusResponse.ok) {
                  log.error(
                    'Video status check failed:',
                    new Error(`Status: ${statusResponse.status}`)
                  );
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                  }
                  return;
                }

                const statusData = await statusResponse.json();
                log.debug('Video status:', {
                  status: statusData.status,
                  progress: statusData.progress,
                });

                // Update the message with new status
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId && msg.videoJob
                      ? {
                          ...msg,
                          videoJob: {
                            ...msg.videoJob,
                            status: statusData.status,
                            progress: statusData.progress || msg.videoJob.progress,
                            download_url: statusData.download_url || msg.videoJob.download_url,
                            error: statusData.error,
                          },
                        }
                      : msg
                  )
                );

                // Continue polling if still in progress
                if (statusData.status === 'queued' || statusData.status === 'in_progress') {
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                  }
                } else if (statusData.status === 'completed') {
                  log.debug('Video completed! Download URL:', statusData.download_url);
                } else if (statusData.status === 'failed') {
                  log.error('Video generation failed:', statusData.error);
                }
              } catch (error) {
                log.error('Error polling video status:', error as Error);
                if (attempts < maxAttempts) {
                  setTimeout(poll, 5000);
                }
              }
            };

            // Start polling after a short delay
            setTimeout(poll, 3000);
          };

          pollVideoStatus();
        } else if (data.type === 'analytics' && data.analytics) {
          // Data analytics response with charts and insights
          log.debug('Received data analytics response:', {
            filename: data.analytics.filename,
            totalRows: data.analytics.totalRows,
            chartsCount: data.analytics.charts?.length || 0,
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || 'Here is your data analysis:',
            model: data.model || modelUsed,
            analytics: data.analytics,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
          finalContent = assistantMessage.content;

          // Save the analytics message to database
          await saveMessageToDatabase(newChatId, 'assistant', assistantMessage.content, 'text');
        } else {
          // Regular text response
          finalContent = data.content || '';

          // Check if this response includes a document download (native generation)
          // This happens when Gemini/etc generates native DOCX/XLSX files
          let messageContent = data.content || '';
          if (data.documentDownload?.url) {
            log.debug('Document download included in response:', {
              filename: data.documentDownload.filename,
              format: data.documentDownload.format,
            });
            // Append download link to the message content
            const downloadUrl = data.documentDownload.url;
            const format = (data.documentDownload.format || 'file').toUpperCase();
            messageContent += `\n\n✅ **Your ${format} is ready!**\n\n`;
            messageContent += `📄 **[Download ${format}](${downloadUrl})**`;
            messageContent += `\n\n*Link expires in 1 hour. If you need it later, just ask me to generate again.*`;
            finalContent = messageContent;
          }

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: messageContent,
            citations: data.citations || [],
            sourcesUsed: data.sourcesUsed || 0,
            model: data.model || modelUsed,
            searchProvider: searchProvider,
            files: data.files, // Generated documents (Excel, PowerPoint, Word, PDF)
            timestamp: new Date(),
          };

          if (data.files?.length > 0) {
            log.debug(`Document generation: ${data.files.length} file(s) generated`);
          }
          if (data.citations?.length > 0 || data.sourcesUsed > 0) {
            log.debug(
              `Live Search: ${data.sourcesUsed} sources, ${data.citations?.length} citations`
            );
          }

          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        // Check if this is an SSE stream (website generation uses SSE for progress)
        const isSSE = contentType.includes('text/event-stream');

        if (isSSE) {
          // SSE streaming for website generation
          log.debug('Processing SSE stream (website generation)');

          // Create initial assistant message with progress indicator
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '🚀 Generating your website...',
            model: modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                      const event = JSON.parse(data);

                      // CRITICAL FIX: Only update UI if still on the same chat
                      // Use ref instead of state to avoid stale closure during async streaming
                      const shouldUpdateUI = currentChatIdRef.current === newChatId;

                      if (event.type === 'progress') {
                        // Update message with progress
                        log.debug('Website progress:', event.message);
                        if (shouldUpdateUI) {
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === assistantMessageId
                                ? { ...msg, content: event.message }
                                : msg
                            )
                          );
                        }
                      } else if (event.type === 'code_preview' && event.codePreview) {
                        // Final website response
                        log.debug('Website generated:', event.codePreview.title);
                        if (shouldUpdateUI) {
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === assistantMessageId
                                ? {
                                    ...msg,
                                    content: event.content || 'Here is your website:',
                                    codePreview: {
                                      code: event.codePreview.code,
                                      language: event.codePreview.language,
                                      title: event.codePreview.title,
                                      description: event.codePreview.description,
                                    },
                                  }
                                : msg
                            )
                          );
                        }
                        finalContent = event.content;

                        // Save to database (always save regardless of UI state)
                        await saveMessageToDatabase(
                          newChatId,
                          'assistant',
                          event.content || 'Generated website',
                          'text'
                        );
                      } else if (event.type === 'error') {
                        log.error('Website generation error:', event.message);
                        if (shouldUpdateUI) {
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === assistantMessageId
                                ? { ...msg, content: `❌ Error: ${event.message}` }
                                : msg
                            )
                          );
                        }
                      }
                    } catch (parseError) {
                      // Not valid JSON, might be partial data
                      log.debug('SSE parse error:', { error: parseError });
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          }
        } else {
          // Regular text streaming response
          log.debug('Processing streaming response (text stream)');

          // Create initial empty assistant message
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            model: modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Read the stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            let accumulatedContent = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Simple text streaming - just decode and append
                const chunk = decoder.decode(value, { stream: true });
                accumulatedContent += chunk;

                // CRITICAL FIX: Only update UI if still on the same chat
                // This prevents streaming responses from appearing in wrong conversations
                // Use ref instead of state to avoid stale closure during async streaming
                if (currentChatIdRef.current === newChatId) {
                  // Strip suggested-followups tags during streaming so users never see raw markup
                  const displayContent = accumulatedContent
                    .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/g, '')
                    .replace(/<suggested-followups>[\s\S]*$/g, '')
                    .trimEnd();
                  // Update the message with accumulated content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: displayContent } : msg
                    )
                  );
                }
              }
            } catch (readerError) {
              // Stream was interrupted (user navigated away, network issue, etc.)
              log.debug('Stream interrupted:', {
                message: readerError instanceof Error ? readerError.message : 'unknown',
              });
              // If we have some content, use it instead of showing an error
              if (accumulatedContent.length > 0) {
                log.debug('Using partial content, length:', { length: accumulatedContent.length });
                finalContent = accumulatedContent;
              } else {
                // Re-throw to trigger the outer error handler
                throw readerError;
              }
            } finally {
              reader.releaseLock();
            }

            // Set final content from accumulated stream
            if (!finalContent && accumulatedContent) {
              log.debug('Stream finished, total length:', { length: accumulatedContent.length });
              finalContent = accumulatedContent;
            }
          }
        }
      }

      // Check for [GENERATE_PDF: ...] marker in the response
      // This allows the AI to create downloadable PDF documents
      const pdfMarkerMatch = finalContent.match(/\[GENERATE_PDF:\s*(.+?)\]/s);
      if (pdfMarkerMatch) {
        const pdfTitle = pdfMarkerMatch[1].trim();
        log.debug('Detected GENERATE_PDF marker, title:', { title: pdfTitle });

        // Extract the content after the marker (the markdown content for the PDF)
        const markerStartIndex = finalContent.indexOf('[GENERATE_PDF:');
        const markerEnd = finalContent.indexOf(']', markerStartIndex) + 1;
        const pdfContent = markerEnd > 0 ? finalContent.slice(markerEnd).trim() : '';

        // Get any text BEFORE the marker (intro text like "Creating your PDF now.")
        const textBeforeMarker =
          markerStartIndex > 0 ? finalContent.slice(0, markerStartIndex).trim() : '';

        // Validate content before proceeding
        if (!pdfTitle || !pdfContent || pdfContent.length < 10) {
          log.warn('PDF marker found but content is empty or too short');
          // Don't try to generate, just clean up the response
          const cleanedContent =
            textBeforeMarker ||
            'I tried to generate a PDF but encountered an issue. Please try again with more content.';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: cleanedContent } : msg
            )
          );
          // Skip the PDF generation
        } else {
          // Show ONLY the intro text + generating status - NOT the full content again
          // User already saw the content in the previous message
          const cleanedContent = textBeforeMarker
            ? `${textBeforeMarker}\n\n📄 **Generating PDF: ${pdfTitle}...**`
            : `📄 **Generating PDF: ${pdfTitle}...**`;

          // Update the message to show just the status (hide redundant content)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: cleanedContent } : msg
            )
          );
          finalContent = cleanedContent;

          // Trigger PDF generation
          try {
            const pdfResponse = await fetch('/api/documents/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: pdfContent,
                title: pdfTitle,
                format: 'pdf',
              }),
            });

            if (pdfResponse.ok) {
              const pdfData = await pdfResponse.json();

              // Check for downloadUrl (Supabase Storage) or dataUrl (fallback)
              const downloadUrl = pdfData.downloadUrl || pdfData.dataUrl;
              const isSupabaseUrl = !!pdfData.downloadUrl;

              if (downloadUrl) {
                log.debug('PDF generated successfully, storage:', pdfData.storage);

                if (isSupabaseUrl) {
                  // Supabase Storage: Show clickable download link
                  // UPDATE the existing message instead of adding new one (prevents screen flash)
                  let messageContent = textBeforeMarker ? `${textBeforeMarker}\n\n` : '';
                  messageContent += `✅ **Your PDF is ready!**\n\n`;
                  messageContent += `📄 **[Download PDF](${downloadUrl})**`;
                  messageContent += `\n\n*Link expires in 1 hour. If you need it later, just ask me to generate again.*`;

                  // Update the SAME message (smoother UX, no flash)
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: messageContent } : msg
                    )
                  );
                } else {
                  // Data URL fallback: Trigger auto-download
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = pdfData.filename || `${pdfTitle}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  // Update the SAME message (smoother UX)
                  const successContent = textBeforeMarker
                    ? `${textBeforeMarker}\n\n✅ **${pdfTitle}.pdf** has been downloaded!\n\nCheck your downloads folder.`
                    : `✅ **${pdfTitle}.pdf** has been downloaded!\n\nCheck your downloads folder.`;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: successContent } : msg
                    )
                  );
                }
              }
            } else {
              log.error('PDF generation failed:', new Error(await pdfResponse.text()));
              // Update message with error (no new message = no flash)
              const errorContent = textBeforeMarker
                ? `${textBeforeMarker}\n\n⚠️ Sorry, I couldn't generate the PDF. Please try again.`
                : `⚠️ Sorry, I couldn't generate the PDF. Please try again.`;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: errorContent } : msg
                )
              );
            }
          } catch (pdfError) {
            log.error('Error during PDF generation:', pdfError as Error);
            // Show error to user instead of silently failing
            const errorContent = textBeforeMarker
              ? `${textBeforeMarker}\n\n⚠️ Sorry, there was an error generating your PDF. Please try again.`
              : `⚠️ Sorry, there was an error generating your PDF. Please try again.`;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: errorContent } : msg
              )
            );
          }
        }
      }

      // Check for [GENERATE_XLSX: ...] marker in the response
      // This allows the AI to create downloadable Excel spreadsheets
      const xlsxMarkerMatch = finalContent.match(/\[GENERATE_XLSX:\s*(.+?)\]/s);
      if (xlsxMarkerMatch) {
        const xlsxTitle = xlsxMarkerMatch[1].trim();
        log.debug('Detected GENERATE_XLSX marker, title:', { title: xlsxTitle });

        // Extract the content after the marker (the markdown table content)
        const markerStartIndex = finalContent.indexOf('[GENERATE_XLSX:');
        const markerEnd = finalContent.indexOf(']', markerStartIndex) + 1;
        const xlsxContent = markerEnd > 0 ? finalContent.slice(markerEnd).trim() : '';

        // Get any text BEFORE the marker (intro text)
        const textBeforeMarker =
          markerStartIndex > 0 ? finalContent.slice(0, markerStartIndex).trim() : '';

        // Validate content before proceeding
        if (!xlsxTitle || !xlsxContent || xlsxContent.length < 10) {
          log.warn('XLSX marker found but content is empty or too short');
          const cleanedContent =
            textBeforeMarker ||
            'I tried to generate a spreadsheet but encountered an issue. Please try again with more content.';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: cleanedContent } : msg
            )
          );
        } else {
          // Show generating status
          const cleanedContent = textBeforeMarker
            ? `${textBeforeMarker}\n\n📊 **Generating Excel: ${xlsxTitle}...**`
            : `📊 **Generating Excel: ${xlsxTitle}...**`;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: cleanedContent } : msg
            )
          );
          finalContent = cleanedContent;

          // Trigger Excel generation
          try {
            const xlsxResponse = await fetch('/api/documents/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: xlsxContent,
                title: xlsxTitle,
                format: 'xlsx',
              }),
            });

            if (xlsxResponse.ok) {
              const xlsxData = await xlsxResponse.json();
              const downloadUrl = xlsxData.downloadUrl || xlsxData.dataUrl;
              const isSupabaseUrl = !!xlsxData.downloadUrl;

              if (downloadUrl) {
                log.debug('Excel generated successfully, storage:', xlsxData.storage);

                if (isSupabaseUrl) {
                  // Supabase Storage: Show clickable download link
                  let messageContent = textBeforeMarker ? `${textBeforeMarker}\n\n` : '';
                  messageContent += `✅ **Your Excel spreadsheet is ready!**\n\n`;
                  messageContent += `📊 **[Download ${xlsxTitle}.xlsx](${downloadUrl})**`;
                  messageContent += `\n\n*Link expires in 1 hour. If you need it later, just ask me to generate again.*`;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: messageContent } : msg
                    )
                  );
                } else {
                  // Data URL fallback: Trigger auto-download
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = xlsxData.filename || `${xlsxTitle}.xlsx`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  const successContent = textBeforeMarker
                    ? `${textBeforeMarker}\n\n✅ **Excel Downloaded!** Check your downloads folder for "${xlsxTitle}.xlsx"`
                    : `✅ **Excel Downloaded!** Check your downloads folder for "${xlsxTitle}.xlsx"`;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: successContent } : msg
                    )
                  );
                }
              } else {
                log.error('Excel response missing download URL');
              }
            } else {
              log.error('Excel generation failed:', new Error(await xlsxResponse.text()));
            }
          } catch (xlsxError) {
            log.error('Error during Excel generation:', xlsxError as Error);
            const errorContent = textBeforeMarker
              ? `${textBeforeMarker}\n\n⚠️ Sorry, there was an error generating your spreadsheet. Please try again.`
              : `⚠️ Sorry, there was an error generating your spreadsheet. Please try again.`;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: errorContent } : msg
              )
            );
          }
        }
      }

      // Check for [GENERATE_QR: ...] marker in the response
      // This allows the AI to create functional QR codes
      const qrMarkerMatch = finalContent.match(/\[GENERATE_QR:\s*(.+?)\]/s);
      if (qrMarkerMatch) {
        const qrData = qrMarkerMatch[1].trim();
        log.debug('Detected GENERATE_QR marker, data:', { data: qrData.slice(0, 100) });

        // Remove the marker from the displayed text
        const cleanedContent = finalContent
          .replace(/\[GENERATE_QR:\s*.+?\]/s, '🔲 **Generating QR Code...**\n\n')
          .trim();

        // Update the message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: cleanedContent } : msg
          )
        );
        finalContent = cleanedContent;

        // Trigger QR code generation
        try {
          const qrResponse = await fetch('/api/qrcode/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: qrData,
              size: 300,
            }),
          });

          if (qrResponse.ok) {
            const qrResult = await qrResponse.json();
            if (qrResult.dataUrl) {
              log.debug('QR code generated successfully');

              // Add a message with the QR code image
              const qrMessage: Message = {
                id: (Date.now() + 4).toString(),
                role: 'assistant',
                content: `📱 **Your QR Code is ready!**\n\nScan this code to access: ${qrData.length > 50 ? qrData.slice(0, 50) + '...' : qrData}`,
                imageUrl: qrResult.dataUrl,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, qrMessage]);
            }
          } else {
            log.error('QR generation failed:', new Error(await qrResponse.text()));
            const errorMsg: Message = {
              id: (Date.now() + 4).toString(),
              role: 'assistant',
              content: `⚠️ Sorry, I couldn't generate the QR code. Here's the data you can use: ${qrData}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          }
        } catch (qrError) {
          log.error('Error during QR generation:', qrError as Error);
        }
      }

      // Check for [DOCUMENT_DOWNLOAD: ...] marker in the response
      // This handles native document generation (Excel, Word, PDF) from the chat route
      let documentDownloadMeta: Record<string, unknown> | null = null;
      const docDownloadMatch = finalContent.match(/\[DOCUMENT_DOWNLOAD:(.+?)\]/s);
      if (docDownloadMatch) {
        try {
          const docData = JSON.parse(docDownloadMatch[1]);
          log.debug('Detected DOCUMENT_DOWNLOAD marker:', docData.filename);

          // Remove the marker from the displayed text
          const cleanedContent = finalContent.replace(/\[DOCUMENT_DOWNLOAD:.+?\]/s, '').trim();

          // Store document data in message for preview/download buttons (no auto-download)
          if (docData.dataUrl) {
            const docDownload = {
              filename: docData.filename || 'document',
              mimeType: docData.mimeType || 'application/octet-stream',
              dataUrl: docData.dataUrl,
              canPreview: docData.canPreview || false,
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: cleanedContent,
                      documentDownload: docDownload,
                    }
                  : msg
              )
            );
            finalContent = cleanedContent;
            // Persist document metadata so it survives page refreshes
            documentDownloadMeta = { documentDownload: docDownload };
          }
        } catch (docError) {
          log.error('Error parsing DOCUMENT_DOWNLOAD marker:', docError as Error);
        }
      }

      // Parse suggested follow-ups from AI response
      const followupsMatch = finalContent.match(
        /<suggested-followups>\s*(\[[\s\S]*?\])\s*<\/suggested-followups>/
      );
      if (followupsMatch) {
        try {
          const followups = JSON.parse(followupsMatch[1]) as string[];
          if (Array.isArray(followups) && followups.length > 0) {
            // Strip the tag from displayed content
            const cleanedContent = finalContent
              .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
              .trimEnd();
            finalContent = cleanedContent;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: cleanedContent, suggestedFollowups: followups.slice(0, 3) }
                  : msg
              )
            );
          }
        } catch {
          // Malformed JSON — just strip the tag
          finalContent = finalContent
            .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
            .trimEnd();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: finalContent } : msg
            )
          );
        }
      }

      setIsStreaming(false);
      setPendingDocumentType(null); // Clear document type indicator
      // Clear the abort controller after successful completion
      abortControllerRef.current = null;

      // SMART TOOL SUGGESTIONS: Analyze AI response for knowledge cutoff or uncertainty
      // If detected, append a suggestion prompt and track for confirmation handling
      // Skip analysis if search was already used (searchProvider is set)
      if (!searchProvider && finalContent && !isImageResponse) {
        const analysisResult = analyzeResponse(finalContent);

        if (
          analysisResult.triggerType !== 'none' &&
          analysisResult.suggestedAction !== 'none' &&
          analysisResult.suggestedPrompt
        ) {
          log.debug('Response trigger detected:', {
            type: analysisResult.triggerType,
            action: analysisResult.suggestedAction,
            confidence: analysisResult.confidence,
          });

          // Append the suggestion prompt to the message
          const updatedContent = finalContent + analysisResult.suggestedPrompt;
          finalContent = updatedContent;

          // Update the message in the UI with the appended prompt
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: updatedContent } : msg
            )
          );

          // Store the pending suggestion for confirmation handling
          setPendingToolSuggestion({
            action: analysisResult.suggestedAction,
            originalQuestion: content, // The user's original question
          });
        }
      }

      // Save assistant message to database (skip for images - already saved above)
      if (!isImageResponse) {
        await saveMessageToDatabase(
          newChatId,
          'assistant',
          finalContent,
          'text',
          undefined,
          undefined,
          documentDownloadMeta
        );
      }

      // Generate chat title for new conversations OR regenerate if current title is generic
      const isNewConversation = messages.length === 0;

      // Check if current chat has a generic title that should be regenerated
      const currentChat = chats.find((c) => c.id === newChatId);
      const hasGenericTitle = currentChat && isGenericTitle(currentChat.title);
      const isMeaningfulMessage = content.length > 20; // Skip short greetings
      const shouldRegenerateTitle = hasGenericTitle && isMeaningfulMessage && messages.length > 0;

      log.debug('Title generation check:', {
        isNewConversation,
        messageCount: messages.length,
        newChatId,
        currentTitle: currentChat?.title,
        hasGenericTitle,
        shouldRegenerateTitle,
      });

      if ((isNewConversation || shouldRegenerateTitle) && newChatId) {
        log.debug('STARTING title generation:', { isNewConversation, shouldRegenerateTitle });
        try {
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userMessage: content,
              assistantMessage: finalContent,
            }),
          });

          if (titleResponse.ok) {
            const titleData = await titleResponse.json();
            const generatedTitle = titleData.title || 'New Chat';
            log.debug('Generated title:', generatedTitle);

            // Only update if the new title is better (not generic)
            if (!isGenericTitle(generatedTitle) || isNewConversation) {
              setChats((prevChats) =>
                prevChats.map((chat) =>
                  chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
                )
              );

              await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: newChatId,
                  title: generatedTitle,
                }),
              });
            }
          }
        } catch (titleError) {
          log.error('Title generation error:', titleError as Error);
        }
      }
    } catch (error) {
      // Check if this is an abort error (user navigated away or sent new message)
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.toLowerCase().includes('aborted') ||
          error.message.toLowerCase().includes('abort'));

      // Check if this is a network error (connection lost, user navigated away)
      const isNetworkError =
        error instanceof Error &&
        ((error.name === 'TypeError' && error.message.toLowerCase().includes('fetch')) ||
          error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('connection') ||
          error.message.toLowerCase().includes('failed to fetch') ||
          error.message.toLowerCase().includes('load failed'));

      if (isAbortError || isNetworkError) {
        // User navigated away or network issue - this is not a server error
        log.debug('Request interrupted:', {
          message: error instanceof Error ? error.message : 'unknown',
        });

        // CRITICAL FIX: Save partial content before returning
        // This prevents data loss when user navigates away during streaming
        if (finalContent && finalContent.length > 0) {
          log.debug('Saving partial content before abort cleanup', {
            contentLength: finalContent.length,
          });
          try {
            await saveMessageToDatabase(newChatId, 'assistant', finalContent, 'text');
          } catch (saveErr) {
            log.warn('Failed to save partial content on abort', { error: saveErr });
          }
        }

        // Clean up abort controller to prevent memory leaks
        abortControllerRef.current = null;
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsStreaming(false);
          setPendingDocumentType(null);
        }
        return; // Don't show error message for interrupted requests
      }

      log.error('Chat API error:', error as Error);
      // Log more details about the error for debugging
      if (error instanceof Error) {
        log.debug('Error name:', { name: error.name });
        log.debug('Error message:', { message: error.message });
      }

      // Only show error message if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Parse error message for specific error types
      const rawErrorMsg = error instanceof Error ? error.message : '';
      const errorMsg = rawErrorMsg.toLowerCase();
      let errorContent = '';

      // Extract error code from message if present (format: "[CODE] message")
      const errorCodeMatch = rawErrorMsg.match(/^\[([^\]]+)\]/);
      const errorCode = errorCodeMatch ? errorCodeMatch[1].toLowerCase() : '';

      // Log the error details for debugging
      log.debug('Parsing error for user message', { rawErrorMsg, errorCode });

      // Check for specific error types and provide helpful messages

      // CONTEXT EXHAUSTION - Auto-continue in new chat
      if (
        errorCode === 'context_too_long' ||
        errorMsg.includes('context') ||
        errorMsg.includes('context_length') ||
        errorMsg.includes('maximum context') ||
        errorMsg.includes('too long') ||
        errorMsg.includes('exceeds the model')
      ) {
        log.debug('Context exhaustion detected, triggering automatic continuation');
        // Trigger automatic continuation
        handleChatContinuation().catch((e) => log.error('Auto-continuation failed:', e));
        errorContent =
          'This conversation has reached its context limit. Creating a new chat with your conversation summary...';
        // Early return - the continuation will handle the rest
        const contextErrorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, contextErrorMessage]);
        setIsStreaming(false);
        setPendingDocumentType(null);
        abortControllerRef.current = null;
        return;
      }

      // Map error codes and message patterns to user-friendly messages
      if (
        errorCode === 'rate_limited' ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('429') ||
        errorMsg.includes('too many')
      ) {
        errorContent = "You're sending messages too quickly. Please wait a moment and try again.";
      } else if (errorMsg.includes('token limit') || errorMsg.includes('usage limit')) {
        errorContent =
          "You've reached your usage limit. Check your account for details or upgrade your plan.";
      } else if (
        errorCode === 'content_filtered' ||
        errorMsg.includes('moderation') ||
        errorMsg.includes('content policy')
      ) {
        errorContent =
          "Your message couldn't be processed due to content guidelines. Please rephrase and try again.";
      } else if (
        errorCode === 'timeout' ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('timed out')
      ) {
        errorContent = 'The request took too long. Please try again with a simpler message.';
      } else if (
        errorCode === 'server_error' ||
        errorMsg.includes('server') ||
        errorMsg.includes('500') ||
        errorMsg.includes('503')
      ) {
        errorContent = 'The server is temporarily unavailable. Please try again in a few moments.';
      } else if (
        errorCode === 'auth_failed' ||
        errorMsg.includes('unauthorized') ||
        errorMsg.includes('401')
      ) {
        errorContent = 'Your session may have expired. Please refresh the page and try again.';
      } else if (
        errorCode === 'invalid_request' ||
        errorMsg.includes('invalid') ||
        errorMsg.includes('400')
      ) {
        // Provide more context for invalid request errors
        errorContent =
          'There was an issue with the request. This might be a temporary problem with app integrations. Please try again.';
      } else if (
        errorCode === 'model_unavailable' ||
        errorMsg.includes('model') ||
        errorMsg.includes('unavailable')
      ) {
        errorContent =
          'The AI model is temporarily unavailable. Please try again in a few moments.';
      } else if (pendingDocumentType) {
        // Document generation specific error
        const docTypeNames: Record<string, string> = {
          pdf: 'PDF',
          docx: 'Word document',
          xlsx: 'Excel spreadsheet',
          pptx: 'PowerPoint presentation',
        };
        const docName = docTypeNames[pendingDocumentType] || 'document';
        errorContent = `I wasn't able to create your ${docName}. Document generation can take up to 2 minutes for complex files. Please try again, or simplify your request if this keeps happening.`;
      } else {
        // Generic fallback - include hint about what might help
        errorContent =
          'Something went wrong processing your request. Please try again. If this persists, try starting a new conversation.';
      }

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsStreaming(false);
      setPendingDocumentType(null);
      // Clean up abort controller to prevent memory leaks
      abortControllerRef.current = null;

      // Save error message to database (keep technical details in logs only)
      await saveMessageToDatabase(newChatId, 'assistant', errorMessage.content, 'error');
    } finally {
      // CRITICAL: Always clean up abort controller to prevent memory leaks
      // This runs on both success AND error paths
      abortControllerRef.current = null;

      // Ensure streaming state is always reset
      if (isMountedRef.current) {
        setIsStreaming(false);
        setPendingDocumentType(null);
      }
    }
  };

  // Get theme for conditional rendering
  const { theme } = useTheme();

  return (
    <CodeExecutionProvider>
      <div className="flex h-screen flex-col" style={{ backgroundColor: 'var(--background)' }}>
        {/* Header */}
        <header className="glass-morphism border-b border-white/10 py-0.5 px-1 md:p-3">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
                aria-label="Toggle sidebar"
              >
                {/* Menu/Close icon */}
                <svg
                  className="h-5 w-5 md:h-6 md:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              {/* Connectors Link - between hamburger and logo/+ button */}
              <a
                href="/settings?tab=connectors"
                className="flex rounded-lg px-1.5 md:px-3 py-1 md:py-1.5 text-sm hover:bg-white/10 items-center gap-1 transition-colors"
                title="Connect 150+ apps"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold">
                  NEW
                </span>
              </a>

              {/* Only show logo/site name when a chat is active */}
              {currentChatId &&
                (theme === 'light' ? (
                  // Light mode: Use text instead of logo
                  <h1 className="text-base md:text-xl font-normal hidden sm:block">
                    <span style={{ color: 'var(--text-primary)' }}>jcil.</span>
                    <span style={{ color: 'var(--primary)' }}>ai</span>
                  </h1>
                ) : headerLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerLogo} alt="JCIL.ai" className="h-8 hidden sm:block" />
                ) : (
                  <h1 className="text-base md:text-xl font-semibold hidden sm:block">
                    <span className="text-white">JCIL</span>
                    <span className="text-blue-500">.ai</span>
                  </h1>
                ))}
            </div>

            {/* New Chat Button - Mobile Only, Centered */}
            <button
              onClick={handleNewChat}
              className="absolute left-1/2 -translate-x-1/2 md:hidden rounded-full p-1.5 hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="New chat"
              title="Start new chat"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <div className="flex items-center gap-0.5">
              {/* Theme Toggle - Light/Dark Mode */}
              <ThemeToggle />

              {/* Profile Button */}
              <button
                onClick={() => setIsProfileOpen(true)}
                className="rounded-lg px-1 py-0.5 md:px-3 md:py-1.5 text-xs md:text-sm hover:bg-white/10 flex items-center justify-center gap-0.5 focus:outline-none"
                aria-label="User Profile"
              >
                <svg
                  className="h-3 w-3 md:h-4 md:w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {hasProfile ? profile.name : 'Profile'}
              </button>
            </div>
          </div>
        </header>

        {/* Main chat area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <ChatSidebar
            chats={chats}
            currentChatId={currentChatId}
            collapsed={sidebarCollapsed}
            loadError={conversationLoadError}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onRenameChat={handleRenameChat}
            onDeleteChat={handleDeleteChat}
            onPinChat={handlePinChat}
            onMoveToFolder={handleMoveToFolder}
            onSelectStrategySession={handleSelectStrategySession}
          />

          {/* Chat thread area */}
          <main className="flex flex-1 flex-col overflow-hidden relative">
            <ChatThread
              messages={messages}
              isStreaming={isStreaming}
              currentChatId={currentChatId}
              isAdmin={isAdmin}
              documentType={pendingDocumentType}
              onReply={(message) => setReplyingTo(message)}
              enableCodeActions
              lastUserMessage={messages.filter((m) => m.role === 'user').pop()?.content || ''}
              onQuickPrompt={(prompt) => setQuickPromptText(prompt)}
              onCarouselSelect={handleCarouselSelect}
              onRegenerateImage={handleRegenerateImage}
              onActionSend={handleActionSend}
              onActionEdit={handleActionEdit}
              onActionCancel={handleActionCancel}
              onFollowupSelect={(suggestion) => handleSendMessage(suggestion, [])}
            />
            {/* Live To-Do List removed - user prefers simple agentic approach
                The AI can manage its own tasks internally without showing a UI widget */}
            {/* Deep Strategy Progress - shows live research activity */}
            {strategyPhase === 'executing' && strategyEvents.length > 0 && (
              <div className="px-4 pb-4">
                <DeepStrategyProgress
                  events={strategyEvents}
                  isComplete={false}
                  onCancel={cancelStrategy}
                />
              </div>
            )}
            {/* Deep Research Progress - same visual preview for research mode */}
            {deepResearchPhase === 'executing' && deepResearchEvents.length > 0 && (
              <div className="px-4 pb-4">
                <DeepStrategyProgress
                  events={deepResearchEvents}
                  isComplete={false}
                  onCancel={cancelDeepResearch}
                />
              </div>
            )}
            {/* Chat continuation banner - shown when conversation is getting long */}
            {!continuationDismissed && messages.length >= CHAT_LENGTH_WARNING && (
              <ChatContinuationBanner
                messageCount={messages.length}
                onContinue={handleChatContinuation}
                onDismiss={() => setContinuationDismissed(true)}
                isGenerating={isGeneratingSummary}
              />
            )}

            <ChatComposer
              onSendMessage={handleSendMessage}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={isWaitingForReply}
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
              initialText={quickPromptText}
              isAdmin={isAdmin}
              activeAgent={
                isStrategyMode
                  ? 'strategy'
                  : isDeepResearchMode
                    ? 'deep-research'
                    : isQuickResearchMode
                      ? 'quick-research'
                      : isQuickStrategyMode
                        ? 'quick-strategy'
                        : isDeepWriterMode
                          ? 'deep-writer'
                          : isQuickWriterMode
                            ? 'quick-writer'
                            : null
              }
              strategyLoading={strategyLoading}
              deepResearchLoading={deepResearchLoading}
              quickResearchLoading={quickResearchLoading}
              quickStrategyLoading={quickStrategyLoading}
              deepWriterLoading={deepWriterLoading}
              quickWriterLoading={quickWriterLoading}
              onAgentSelect={async (agent) => {
                // Helper to cancel strategy session on server
                const cancelStrategySession = async () => {
                  if (strategySessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${strategySessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail - session may already be cleaned up
                    }
                  }
                };

                // Helper to cancel deep research session on server
                const cancelDeepResearchSession = async () => {
                  if (deepResearchSessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${deepResearchSessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail
                    }
                  }
                };

                // Helper to cancel quick research session on server
                const cancelQuickResearchSession = async () => {
                  if (quickResearchSessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${quickResearchSessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail
                    }
                  }
                };

                // Helper to cancel quick strategy session on server
                const cancelQuickStrategySession = async () => {
                  if (quickStrategySessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${quickStrategySessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail
                    }
                  }
                };

                // Helper to cancel deep writer session on server
                const cancelDeepWriterSession = async () => {
                  if (deepWriterSessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${deepWriterSessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail
                    }
                  }
                };

                // Helper to cancel quick writer session on server
                const cancelQuickWriterSession = async () => {
                  if (quickWriterSessionId) {
                    try {
                      await fetch(`/api/strategy?sessionId=${quickWriterSessionId}`, {
                        method: 'DELETE',
                      });
                    } catch {
                      // Silently fail
                    }
                  }
                };

                // Helper to exit all other agent modes
                const exitAllAgentModes = async () => {
                  if (isStrategyMode) {
                    await cancelStrategySession();
                    setIsStrategyMode(false);
                    setStrategyPhase('idle');
                    setStrategySessionId(null);
                  }
                  if (isDeepResearchMode) {
                    await cancelDeepResearchSession();
                    setIsDeepResearchMode(false);
                    setDeepResearchPhase('idle');
                    setDeepResearchSessionId(null);
                  }
                  if (isQuickResearchMode) {
                    await cancelQuickResearchSession();
                    setIsQuickResearchMode(false);
                    setQuickResearchPhase('idle');
                    setQuickResearchSessionId(null);
                  }
                  if (isQuickStrategyMode) {
                    await cancelQuickStrategySession();
                    setIsQuickStrategyMode(false);
                    setQuickStrategyPhase('idle');
                    setQuickStrategySessionId(null);
                  }
                  if (isDeepWriterMode) {
                    await cancelDeepWriterSession();
                    setIsDeepWriterMode(false);
                    setDeepWriterPhase('idle');
                    setDeepWriterSessionId(null);
                  }
                  if (isQuickWriterMode) {
                    await cancelQuickWriterSession();
                    setIsQuickWriterMode(false);
                    setQuickWriterPhase('idle');
                    setQuickWriterSessionId(null);
                  }
                };

                if (agent === 'strategy') {
                  if (isStrategyMode) {
                    // Toggle off - cancel strategy mode
                    await cancelStrategySession();
                    setIsStrategyMode(false);
                    setStrategyPhase('idle');
                    setStrategySessionId(null);
                  } else {
                    // Exit other modes and start strategy
                    await exitAllAgentModes();
                    await startDeepStrategy();
                  }
                } else if (agent === 'deep-research') {
                  if (isDeepResearchMode) {
                    // Toggle off - cancel deep research mode
                    await cancelDeepResearchSession();
                    setIsDeepResearchMode(false);
                    setDeepResearchPhase('idle');
                    setDeepResearchSessionId(null);
                  } else {
                    // Exit other modes and start deep research
                    await exitAllAgentModes();
                    await startDeepResearch();
                  }
                } else if (agent === 'quick-research') {
                  if (isQuickResearchMode) {
                    // Toggle off - cancel quick research mode
                    await cancelQuickResearchSession();
                    setIsQuickResearchMode(false);
                    setQuickResearchPhase('idle');
                    setQuickResearchSessionId(null);
                  } else {
                    // Exit other modes and start quick research
                    await exitAllAgentModes();
                    await startQuickResearch();
                  }
                } else if (agent === 'quick-strategy') {
                  if (isQuickStrategyMode) {
                    // Toggle off - cancel quick strategy mode
                    await cancelQuickStrategySession();
                    setIsQuickStrategyMode(false);
                    setQuickStrategyPhase('idle');
                    setQuickStrategySessionId(null);
                  } else {
                    // Exit other modes and start quick strategy
                    await exitAllAgentModes();
                    await startQuickStrategy();
                  }
                } else if (agent === 'deep-writer') {
                  if (isDeepWriterMode) {
                    // Toggle off - cancel deep writer mode
                    await cancelDeepWriterSession();
                    setIsDeepWriterMode(false);
                    setDeepWriterPhase('idle');
                    setDeepWriterSessionId(null);
                  } else {
                    // Exit other modes and start deep writer
                    await exitAllAgentModes();
                    await startDeepWriter();
                  }
                } else if (agent === 'quick-writer') {
                  if (isQuickWriterMode) {
                    // Toggle off - cancel quick writer mode
                    await cancelQuickWriterSession();
                    setIsQuickWriterMode(false);
                    setQuickWriterPhase('idle');
                    setQuickWriterSessionId(null);
                  } else {
                    // Exit other modes and start quick writer
                    await exitAllAgentModes();
                    await startQuickWriter();
                  }
                } else if (agent === 'research') {
                  // Legacy: exit all modes (old research mode is replaced by quick-research)
                  await exitAllAgentModes();
                }
              }}
              openCreateImage={openCreateImage}
              openEditImage={openEditImage}
              onCloseCreateImage={() => setOpenCreateImage(false)}
              onCloseEditImage={() => setOpenEditImage(false)}
              onCreativeMode={(mode) => {
                // All creative features now use natural chat flow with prompt pre-fill
                if (mode === 'view-gallery') {
                  // Gallery still uses modal for now
                } else if (mode === 'create-image') {
                  setQuickPromptText('Create an image of ');
                } else if (mode === 'edit-image') {
                  setQuickPromptText('Edit this image: ');
                }
              }}
              // Provider selection - allows users to pick between Claude, xAI, DeepSeek, etc.
              selectedProvider={selectedProvider}
              onProviderChange={setSelectedProvider}
              configuredProviders={configuredProviders}
              conversationId={currentChatId || undefined}
              onImageGenerated={handleImageGenerated}
            />
            {/* Voice Button - Hidden until feature is production-ready
              <VoiceButton
                onStart={startVoiceChat}
                onUserText={addUserVoiceMessage}
                onAssistantText={upsertAssistantStreaming}
              />
              */}
          </main>
        </div>

        {/* User Profile Modal */}
        <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

        {/* Passkey Setup Prompt Modal */}
        <PasskeyPromptModal
          isOpen={isPasskeyModalOpen}
          onClose={() => {
            setIsPasskeyModalOpen(false);
            dismissPasskeyPrompt();
          }}
          onSuccess={() => {
            setIsPasskeyModalOpen(false);
            dismissPasskeyPrompt();
          }}
        />

        {/* GitHub Repo Selector Modal - for code push to GitHub */}
        <RepoSelectorWrapper />

        {/* Deep Strategy - Now handled in chat, no modal needed */}
      </div>
    </CodeExecutionProvider>
  );
}

/**
 * Wrapper component for RepoSelector that connects to CodeExecutionContext
 */
function RepoSelectorWrapper() {
  const { showRepoSelector, setShowRepoSelector, selectRepo } = useCodeExecution();

  return (
    <RepoSelector
      isOpen={showRepoSelector}
      onClose={() => setShowRepoSelector(false)}
      onSelect={(repo) => {
        selectRepo(repo);
        setShowRepoSelector(false);
      }}
    />
  );
}
