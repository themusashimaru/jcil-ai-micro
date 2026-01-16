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
// Voice Chat imports - Hidden until feature is production-ready
// import { useCallback } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer, SearchMode } from '@/components/chat/ChatComposer';
// Voice Button - Hidden until feature is production-ready
// import VoiceButton from './VoiceButton';
// REMOVED: Notification system - users have built-in phone notifications
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import {
  ChatContinuationBanner,
  CHAT_LENGTH_WARNING,
  generateSummaryPrompt,
} from '@/components/chat/ChatContinuationBanner';
import { LiveTodoList } from '@/components/chat/LiveTodoList';
import { parseSlashCommand } from '@/lib/slashCommands';
import { useUserProfile } from '@/contexts/UserProfileContext';
import PasskeyPromptModal, { usePasskeyPrompt } from '@/components/auth/PasskeyPromptModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { CodeExecutionProvider, useCodeExecution } from '@/contexts/CodeExecutionContext';
import { RepoSelector } from '@/components/chat/RepoSelector';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';
import type { Chat, Message, Attachment } from './types';

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
  // Conversation loading error state
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Polling interval ref for background reply checking
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track last time conversations were loaded to debounce visibility refreshes
  const lastConversationLoadRef = useRef<number>(0);

  /* Voice Chat - Hidden until feature is production-ready
  // Track current streaming assistant message ID for voice
  const currentAssistantMsgId = useRef<string | null>(null);

  // Add a complete user voice message - inserts BEFORE current AI response if one is streaming
  const addUserVoiceMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      isStreaming: false,
    };

    setMessages((prev) => {
      // If there's a streaming AI message, insert user message BEFORE it
      if (currentAssistantMsgId.current) {
        const aiMsgIndex = prev.findIndex(m => m.id === currentAssistantMsgId.current);
        if (aiMsgIndex >= 0) {
          // Insert user message before the AI message
          const next = [...prev];
          next.splice(aiMsgIndex, 0, newMessage);
          return next;
        }
      }
      // Otherwise append at the end
      return [...prev, newMessage];
    });
  }, []);

  // Handle assistant voice streaming (delta updates)
  const upsertAssistantStreaming = useCallback((delta: string, done?: boolean) => {
    setMessages((prev) => {
      // If done with empty delta, mark existing message as complete
      if (done && !delta) {
        if (currentAssistantMsgId.current) {
          const msgIndex = prev.findIndex(m => m.id === currentAssistantMsgId.current);
          if (msgIndex >= 0) {
            const next = [...prev];
            next[msgIndex] = { ...next[msgIndex], isStreaming: false };
            currentAssistantMsgId.current = null;
            return next;
          }
        }
        return prev;
      }

      // If no delta content, ignore
      if (!delta) return prev;

      // Check if we have an existing streaming message
      if (currentAssistantMsgId.current) {
        const msgIndex = prev.findIndex(m => m.id === currentAssistantMsgId.current);
        if (msgIndex >= 0 && prev[msgIndex].isStreaming) {
          const next = [...prev];
          next[msgIndex] = {
            ...next[msgIndex],
            content: next[msgIndex].content + delta,
            isStreaming: !done
          };
          if (done) currentAssistantMsgId.current = null;
          return next;
        }
      }

      // Create new message
      const newId = crypto.randomUUID?.() || Date.now().toString();
      currentAssistantMsgId.current = done ? null : newId;

      return [...prev, {
        id: newId,
        role: 'assistant' as const,
        content: delta,
        timestamp: new Date(),
        isStreaming: !done,
      }];
    });
  }, []);

  // Start a voice chat - creates a new chat if needed
  const startVoiceChat = useCallback(() => {
    if (!currentChatId) {
      const newChatId = Date.now().toString();
      const timestamp = new Date();
      const newChat: Chat = {
        id: newChatId,
        title: 'Voice Conversation',
        isPinned: false,
        lastMessage: '🎤 Voice conversation started',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setChats((prevChats) => [newChat, ...prevChats]);
      setCurrentChatId(newChatId);
      setMessages([]);
    }
  }, [currentChatId]);
  */

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
  }, [messages.length]); // Only run when message count changes

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
          }) => {
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

      // Check if last message is from user (meaning we're waiting for a reply)
      // Also check fetched messages in case local state is stale
      const lastFetchedMessage = fetchedMessages[fetchedMessages.length - 1];
      const lastLocalMessage = currentMessages[currentMessages.length - 1];
      const lastMessage = lastFetchedMessage || lastLocalMessage;

      if (lastMessage && lastMessage.role === 'user') {
        log.debug('Last message is from user, processing pending request...');
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
            // Add the new message to the UI
            const newMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: result.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, newMessage]);
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

    // Auto-close sidebar on mobile after creating new chat
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setContinuationDismissed(false); // Reset continuation banner for new chat
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

  /* REMOVED: handleImageGenerated, Code and Data handlers - all handled naturally in chat
  const handleCodeGenerated = (response: string, request: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: request,
      timestamp: new Date(),
    };
    const codeMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage, codeMessage]);
  };

  const handleSearchComplete = (response: string, query: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Search: ${query}`,
      timestamp: new Date(),
    };
    const searchMessage: Message = {
      id: (Date.now() + 1).toString(),
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
    attachmentUrls?: string[]
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
      const newChatId = Date.now().toString();
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
          id: crypto.randomUUID?.() || Date.now().toString(),
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

    // Check for slash commands
    const parsed = parseSlashCommand(content);
    if (parsed.isCommand) {
      // Handle /help and unknown commands - show as assistant message
      if (parsed.helpText) {
        const helpMessage: Message = {
          id: crypto.randomUUID?.() || Date.now().toString(),
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

    // Set streaming state EARLY to block any further submissions during async operations
    // This prevents race conditions where user clicks send multiple times quickly
    setIsStreaming(true);

    // REMOVED: Tool-specific handling - all tools now handled naturally in chat

    let newChatId: string;

    // Auto-create chat if none exists
    if (!currentChatId) {
      const tempId = Date.now().toString();
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

    const userMessageId = Date.now().toString();
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
        id: (Date.now() + 1).toString(),
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
      const assistantMessageId = (Date.now() + 1).toString();

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
                  // Update the message with accumulated content
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
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
      const docDownloadMatch = finalContent.match(/\[DOCUMENT_DOWNLOAD:(.+?)\]/s);
      if (docDownloadMatch) {
        try {
          const docData = JSON.parse(docDownloadMatch[1]);
          log.debug('Detected DOCUMENT_DOWNLOAD marker:', docData.filename);

          // Remove the marker from the displayed text
          const cleanedContent = finalContent.replace(/\[DOCUMENT_DOWNLOAD:.+?\]/s, '').trim();

          // Trigger auto-download using the dataUrl
          if (docData.dataUrl) {
            const link = document.createElement('a');
            link.href = docData.dataUrl;
            link.download = docData.filename || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Update the message to show success
            const successContent =
              cleanedContent +
              `\n\n✅ **Downloaded!** Check your downloads folder for "${docData.filename}"`;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: successContent } : msg
              )
            );
            finalContent = successContent;
          }
        } catch (docError) {
          log.error('Error parsing DOCUMENT_DOWNLOAD marker:', docError as Error);
        }
      }

      setIsStreaming(false);
      setPendingDocumentType(null); // Clear document type indicator
      // Clear the abort controller after successful completion
      abortControllerRef.current = null;

      // Save assistant message to database (skip for images - already saved above)
      if (!isImageResponse) {
        await saveMessageToDatabase(newChatId, 'assistant', finalContent, 'text');
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
      const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';
      let errorContent = '';

      // Check for specific error types and provide helpful messages
      if (
        errorMsg.includes('rate limit') ||
        errorMsg.includes('429') ||
        errorMsg.includes('too many')
      ) {
        errorContent = "You're sending messages too quickly. Please wait a moment and try again.";
      } else if (errorMsg.includes('token limit') || errorMsg.includes('usage limit')) {
        errorContent =
          "You've reached your usage limit. Check your account for details or upgrade your plan.";
      } else if (errorMsg.includes('moderation') || errorMsg.includes('content policy')) {
        errorContent =
          "Your message couldn't be processed due to content guidelines. Please rephrase and try again.";
      } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        errorContent = 'The request took too long. Please try again with a simpler message.';
      } else if (
        errorMsg.includes('server') ||
        errorMsg.includes('500') ||
        errorMsg.includes('503')
      ) {
        errorContent = 'The server is temporarily unavailable. Please try again in a few moments.';
      } else if (errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
        errorContent = 'Your session may have expired. Please refresh the page and try again.';
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
        // Generic fallback
        errorContent = 'Something went wrong processing your request. Please try again.';
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
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
              {/* Only show logo/site name when a chat is active */}
              {currentChatId &&
                (theme === 'light' ? (
                  // Light mode: Use text instead of logo
                  <h1 className="text-base md:text-xl font-normal">
                    <span style={{ color: 'var(--text-primary)' }}>jcil.</span>
                    <span style={{ color: 'var(--primary)' }}>ai</span>
                  </h1>
                ) : headerLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerLogo} alt="JCIL.ai" className="h-8" />
                ) : (
                  <h1 className="text-base md:text-xl font-semibold">
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
            />
            {/* Live To-Do List - extracted from AI responses */}
            <LiveTodoList messages={messages} conversationId={currentChatId} />
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
              showSearchButtons={true}
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
              initialText={quickPromptText}
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
