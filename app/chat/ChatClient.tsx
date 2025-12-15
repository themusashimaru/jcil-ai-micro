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
// Voice Chat imports - Hidden until feature is production-ready
// import { useCallback } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { CodeCommandInterface } from '@/components/code-command';
// Voice Button - Hidden until feature is production-ready
// import VoiceButton from './VoiceButton';
// REMOVED: Notification system - users have built-in phone notifications
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import { ChatContinuationBanner, CHAT_LENGTH_WARNING, generateSummaryPrompt } from '@/components/chat/ChatContinuationBanner';
import { LiveTodoList } from '@/components/chat/LiveTodoList';
import { parseSlashCommand } from '@/lib/slashCommands';
import { useUserProfile } from '@/contexts/UserProfileContext';
import PasskeyPromptModal, { usePasskeyPrompt } from '@/components/auth/PasskeyPromptModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
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
  if (pdfPatterns.some(pattern => pattern.test(lowerContent))) return 'pdf';
  if (excelPatterns.some(pattern => pattern.test(lowerContent))) return 'xlsx';
  if (pptxPatterns.some(pattern => pattern.test(lowerContent))) return 'pptx';
  if (docxPatterns.some(pattern => pattern.test(lowerContent))) return 'docx';

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

  return genericPatterns.some(pattern => pattern.test(title.trim()));
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
  // Track if image generation is available (depends on active provider)
  const [imageGenerationAvailable, setImageGenerationAvailable] = useState(true);
  const { profile, hasProfile } = useUserProfile();
  // Passkey prompt for Face ID / Touch ID setup
  const { shouldShow: showPasskeyPrompt, dismiss: dismissPasskeyPrompt } = usePasskeyPrompt();
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  // REMOVED: selectedTool state - all tools now handled naturally in chat
  // Header logo from design settings
  const [headerLogo, setHeaderLogo] = useState<string>('');
  // Code Command mode (admin only)
  const [showCodeCommand, setShowCodeCommand] = useState(false);
  // Document generation type (for progress indicator)
  const [pendingDocumentType, setPendingDocumentType] = useState<'pdf' | 'docx' | 'xlsx' | 'pptx' | null>(null);
  // Chat continuation - track when generating summary
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [continuationDismissed, setContinuationDismissed] = useState(false);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Polling interval ref for background reply checking
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

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
        console.error('[ChatClient] Failed to load header logo:', err);
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
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        console.error('[ChatClient] Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, []);

  // Check feature availability (image generation depends on provider)
  useEffect(() => {
    const checkFeatures = async () => {
      try {
        const response = await fetch('/api/features');
        if (response.ok) {
          const data = await response.json();
          setImageGenerationAvailable(data.imageGeneration === true);
        }
      } catch (error) {
        console.error('[ChatClient] Error checking features:', error);
        // Default to true on error (OpenAI behavior)
        setImageGenerationAvailable(true);
      }
    };
    checkFeatures();
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
      setSidebarCollapsed(prev => !prev);
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

  // Helper function to fetch and format messages
  const fetchMessages = async (chatId: string): Promise<Message[] | null> => {
    try {
      const response = await fetch(`/api/conversations/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        return data.messages.map((msg: {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type: string;
          attachment_urls: string[] | null;
          created_at: string;
        }) => {
          const imageUrl = msg.attachment_urls && msg.attachment_urls.length > 0
            ? msg.attachment_urls[0]
            : undefined;
          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            imageUrl,
            timestamp: new Date(msg.created_at),
          };
        });
      }
    } catch (error) {
      console.error('[ChatClient] Error fetching messages:', error);
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
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only check if tab is becoming visible and we have a current chat
      if (document.visibilityState !== 'visible') return;
      if (!currentChatIdRef.current) return;
      if (isProcessingRef.current) return; // Prevent duplicate processing

      const chatId = currentChatIdRef.current;
      const currentMessages = messagesRef.current;

      console.log('[ChatClient] Tab visible, checking for pending replies...', {
        chatId,
        messageCount: currentMessages.length,
        lastRole: currentMessages[currentMessages.length - 1]?.role,
        isStreaming,
      });

      // If currently streaming, check if we need to wait a bit
      // (Stream might have just completed)
      if (isStreaming) {
        // Give the stream a moment to complete naturally
        await new Promise(resolve => setTimeout(resolve, 500));
        // Re-check if still streaming
        if (isStreaming) {
          console.log('[ChatClient] Still streaming, will check on next visibility change');
          return;
        }
      }

      // First, check if we already have the response (server may have processed it)
      const fetchedMessages = await fetchMessages(chatId);
      if (!fetchedMessages || !isMountedRef.current) return;

      // If we got new messages, just display them
      if (fetchedMessages.length > currentMessages.length) {
        console.log('[ChatClient] New messages found:', fetchedMessages.length - currentMessages.length);
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
        console.log('[ChatClient] Last message is from user, processing pending request...');
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
          console.log('[ChatClient] Process pending result:', result.status);

          if (result.status === 'completed' && result.content) {
            // Add the new message to the UI
            const newMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: result.content,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, newMessage]);
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
            console.log('[ChatClient] Pending request timed out after 2 minutes');
          } else {
            console.error('[ChatClient] Error processing pending request:', error);
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
  }, [isStreaming]); // Keep isStreaming dependency for re-registration

  // Load conversations from database
  useEffect(() => {
    const loadConversations = async () => {
      try {
        console.log('[ChatClient] Loading conversations from API...');
        const response = await fetch('/api/conversations');
        console.log('[ChatClient] API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[ChatClient] Loaded conversations from DB:', {
            count: data.conversations?.length || 0,
            conversations: data.conversations,
          });

          const formattedChats: Chat[] = data.conversations.map((conv: {
            id: string;
            title: string;
            summary: string | null;
            tool_context: string | null;
            created_at: string;
            updated_at: string;
            last_message_at: string;
          }) => ({
            id: conv.id,
            title: conv.title,
            summary: conv.summary || undefined,
            isPinned: false, // TODO: Add isPinned to database schema
            lastMessage: '', // We'll update this if needed
            createdAt: new Date(conv.created_at),
            updatedAt: new Date(conv.last_message_at || conv.updated_at),
          }));
          setChats(formattedChats);
          console.log('[ChatClient] Set chats state with', formattedChats.length, 'conversations');
        } else {
          console.error('[ChatClient] Failed to load conversations:', response.statusText);
        }
      } catch (error) {
        console.error('[ChatClient] Error loading conversations:', error);
      }
    };

    loadConversations();
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
        const data = await response.json();
        const formattedMessages: Message[] = data.messages.map((msg: {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type: string;
          attachment_urls: string[] | null;
          created_at: string;
        }) => {
          // Check if there are any image attachments
          const imageUrl = msg.attachment_urls && msg.attachment_urls.length > 0
            ? msg.attachment_urls[0]
            : undefined;

          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            imageUrl,
            timestamp: new Date(msg.created_at),
          };
        });
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(chats.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat)));
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(chats.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }
  };

  const handlePinChat = (chatId: string) => {
    setChats(
      chats.map((chat) => (chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat))
    );
  };

  const handleMoveToFolder = (chatId: string, folder: string | undefined) => {
    setChats(chats.map((chat) => (chat.id === chatId ? { ...chat, folder } : chat)));
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
  const safeJsonParse = async (res: Response): Promise<{
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
      console.log('[ChatClient] Skipping save - no content or attachments');
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
        console.error(`[ChatClient] Save message failed: ${errorCode}: ${errorMsg}`);
        throw new Error(`${errorCode}: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      console.error('Error saving message to database:', error);
      // Don't re-throw - message display still works even if save fails
    }
  };

  // Helper function to create conversation in database
  const createConversationInDatabase = async (
    title: string,
    toolContext?: string
  ) => {
    try {
      console.log('[ChatClient] Creating conversation in DB:', { title, toolContext });
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't pass id - let the API generate it, then we'll get it back
          title,
          tool_context: toolContext || 'general',
        }),
      });

      console.log('[ChatClient] Conversation API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ChatClient] Conversation creation failed:', errorData);
        throw new Error(`Failed to create conversation: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('[ChatClient] Conversation API result:', result);

      // Return the database-generated UUID (don't update state here - let caller handle it)
      if (result.conversation && result.conversation.id) {
        console.log('[ChatClient] Returning conversation ID:', result.conversation.id);
        return result.conversation.id;
      }

      throw new Error('No conversation ID returned from API');
    } catch (error) {
      console.error('[ChatClient] Error creating conversation in database:', error);
      throw error; // Re-throw to let caller handle it
    }
  };

  /**
   * Handle stop button - abort the current streaming request
   */
  const handleStop = () => {
    if (abortControllerRef.current) {
      console.log('[ChatClient] User clicked stop - aborting request');
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
        messages.map(m => ({ role: m.role, content: m.content }))
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
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChatId);
      setMessages([{
        id: crypto.randomUUID?.() || Date.now().toString(),
        role: 'assistant',
        content: contextMessage,
        timestamp: new Date(),
      }]);
      setContinuationDismissed(false);

      // Create the conversation in the database
      await createConversationInDatabase('Continuation', 'general');

      console.log('[ChatClient] Created continuation chat with summary');
    } catch (error) {
      console.error('[ChatClient] Error creating continuation:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    if (!content.trim() && attachments.length === 0) return;

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
        setMessages(prev => [...prev, helpMessage]);
        return;
      }

      // For other commands, replace content with the generated prompt
      if (parsed.prompt) {
        content = parsed.prompt;
      }
    }

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

      // Create conversation in database - MUST succeed before proceeding
      try {
        const dbConversationId = await createConversationInDatabase('New Chat', 'general');
        console.log('[ChatClient] Created conversation:', { tempId, dbId: dbConversationId });

        // Validate we got a proper UUID back
        if (!dbConversationId || typeof dbConversationId !== 'string') {
          throw new Error('Invalid conversation ID returned from database');
        }

        // Use the database UUID for all subsequent operations
        newChatId = dbConversationId;
        setCurrentChatId(dbConversationId);
        setChats((prevChats) => {
          const updated = prevChats.map((chat) =>
            chat.id === tempId ? { ...chat, id: dbConversationId } : chat
          );
          const updatedChat = updated.find(c => c.id === dbConversationId);
          console.log('[ChatClient] Updated chats array - found chat with new UUID:', updatedChat?.id, 'title:', updatedChat?.title);
          return updated;
        });
      } catch (error) {
        console.error('Failed to create conversation:', error);
        // Remove the temporary chat from UI since we couldn't create it in database
        setChats((prevChats) => prevChats.filter(c => c.id !== tempId));
        setCurrentChatId(null);
        // Show error to user
        alert('Unable to start a new conversation. Please try again.');
        return; // Don't proceed with sending message
      }
    } else {
      newChatId = currentChatId;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setIsStreaming(true);

    // Detect if this is a document generation request for UI feedback
    const detectedDocType = detectDocumentTypeFromMessage(content);
    setPendingDocumentType(detectedDocType);
    if (detectedDocType) {
      console.log(`[ChatClient] Document generation detected: ${detectedDocType}`);
    }

    // Save user message to database
    const attachmentUrls = attachments
      .filter(att => att.url)
      .map(att => att.url!);
    await saveMessageToDatabase(
      newChatId,
      'user',
      content,
      'text',
      undefined,
      attachmentUrls.length > 0 ? attachmentUrls : undefined
    );

    try {
      // Get all messages including the new one
      const allMessages = [...messages, userMessage];

      // Find the index of the last user message with images (should be the new one)
      let lastImageMessageIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === 'user' && msg.attachments?.some(att => att.type.startsWith('image/'))) {
          lastImageMessageIndex = i;
          break;
        }
      }

      // Debug: Log attachment info
      console.log('[ChatClient] Message formatting:', {
        totalMessages: allMessages.length,
        lastImageMessageIndex,
        newMessageAttachments: userMessage.attachments?.map(a => ({
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
        if (index === allMessages.length - 1 && documentAttachments && documentAttachments.length > 0) {
          documentAttachments.forEach((doc) => {
            const fileContent = doc.url || '';

            // Check if content is base64 (unparsed) or text (parsed)
            const isBase64 = fileContent.startsWith('data:');

            if (isBase64) {
              // File wasn't parsed - just note it exists
              messageContent = `[File: ${doc.name} - Unable to extract content]\n\n${messageContent}`;
            } else {
              // File was parsed - include the actual content
              const fileLabel = doc.type.includes('spreadsheet') || doc.type.includes('excel')
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
          return {
            role: msg.role,
            content: messageContent,
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
      const messagesWithImages = apiMessages.filter(m => Array.isArray(m.content));
      if (messagesWithImages.length > 0) {
        console.log('[ChatClient] Messages with images being sent:', messagesWithImages.map(m => ({
          role: m.role,
          contentTypes: Array.isArray(m.content) ? m.content.map((c: { type: string }) => c.type) : 'string',
          imageDataLength: Array.isArray(m.content)
            ? m.content.filter((c: { type: string }) => c.type === 'image').map((c: { image?: string }) => c.image?.length || 0)
            : 0,
        })));
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

      // Check content type to determine if streaming or JSON
      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');

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
          console.log('[ChatClient] Received image generation response:', {
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
          await saveMessageToDatabase(newChatId, 'assistant', assistantMessage.content, 'image', data.url);
        } else if (data.type === 'video_job' && data.video_job) {
          // Video generation job started (admin only)
          console.log('[ChatClient] Received video job response:', {
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
            const maxAttempts = 120; // 10 minutes max (5s intervals)
            let attempts = 0;

            const poll = async () => {
              attempts++;
              try {
                const statusResponse = await fetch(statusUrl);
                if (!statusResponse.ok) {
                  console.error('[ChatClient] Video status check failed:', statusResponse.status);
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                  }
                  return;
                }

                const statusData = await statusResponse.json();
                console.log('[ChatClient] Video status:', statusData.status, 'progress:', statusData.progress);

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
                  console.log('[ChatClient] Video completed! Download URL:', statusData.download_url);
                } else if (statusData.status === 'failed') {
                  console.error('[ChatClient] Video generation failed:', statusData.error);
                }
              } catch (error) {
                console.error('[ChatClient] Error polling video status:', error);
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

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || '',
            citations: data.citations || [],
            sourcesUsed: data.sourcesUsed || 0,
            model: data.model || modelUsed,
            searchProvider: searchProvider,
            files: data.files, // Generated documents (Excel, PowerPoint, Word, PDF)
            timestamp: new Date(),
          };

          if (data.files?.length > 0) {
            console.log(`[ChatClient] Document generation: ${data.files.length} file(s) generated`);
          }
          if (data.citations?.length > 0 || data.sourcesUsed > 0) {
            console.log(`[ChatClient] Live Search: ${data.sourcesUsed} sources, ${data.citations?.length} citations`);
          }

          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        // Streaming response - read chunks and update progressively
        // AI SDK v5 uses simple text streaming (not data stream format)
        console.log('[ChatClient] Processing streaming response (text stream)');

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

              // Update the message with accumulated content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
          } catch (readerError) {
            // Stream was interrupted (user navigated away, network issue, etc.)
            console.log('[ChatClient] Stream interrupted:', readerError instanceof Error ? readerError.message : 'unknown');
            // If we have some content, use it instead of showing an error
            if (accumulatedContent.length > 0) {
              console.log('[ChatClient] Using partial content, length:', accumulatedContent.length);
              finalContent = accumulatedContent;
            } else {
              // Re-throw to trigger the outer error handler
              throw readerError;
            }
          } finally {
            reader.releaseLock();
          }

          if (!finalContent) {
            console.log('[ChatClient] Stream finished, total length:', accumulatedContent.length);
            finalContent = accumulatedContent;
          }
        }
      }

      // Check for [GENERATE_IMAGE: ...] marker in the response
      // This allows the AI to trigger image generation during vision/analysis conversations
      const imageMarkerMatch = finalContent.match(/\[GENERATE_IMAGE:\s*(.+?)\]/s);
      if (imageMarkerMatch) {
        const imagePrompt = imageMarkerMatch[1].trim();
        console.log('[ChatClient] Detected GENERATE_IMAGE marker, triggering generation:', imagePrompt.slice(0, 100));

        // Remove the marker from the displayed text
        const cleanedContent = finalContent.replace(/\[GENERATE_IMAGE:\s*.+?\]/s, '').trim();

        // Update the message to remove the marker
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: cleanedContent }
              : msg
          )
        );
        finalContent = cleanedContent;

        // Trigger image generation
        try {
          const imageResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: imagePrompt }],
              tool: 'image',
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            if (imageData.url) {
              console.log('[ChatClient] Auto-generated image successfully');

              // Add the generated image as a new message
              const imageMessage: Message = {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: '', // No additional text needed
                imageUrl: imageData.url,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, imageMessage]);

              // Save the image message to database
              await saveMessageToDatabase(
                newChatId,
                'assistant',
                `Generated image based on: "${imagePrompt.slice(0, 100)}..."`,
                'image',
                imageData.url
              );
            }
          } else {
            console.error('[ChatClient] Auto-image generation failed:', await imageResponse.text());
          }
        } catch (imageError) {
          console.error('[ChatClient] Error during auto-image generation:', imageError);
        }
      }

      // Check for [GENERATE_PDF: ...] marker in the response
      // This allows the AI to create downloadable PDF documents
      const pdfMarkerMatch = finalContent.match(/\[GENERATE_PDF:\s*(.+?)\]/s);
      if (pdfMarkerMatch) {
        const pdfTitle = pdfMarkerMatch[1].trim();
        console.log('[ChatClient] Detected GENERATE_PDF marker, title:', pdfTitle);

        // Extract the content after the marker (the markdown content for the PDF)
        const markerEnd = finalContent.indexOf(']', finalContent.indexOf('[GENERATE_PDF:')) + 1;
        const pdfContent = finalContent.slice(markerEnd).trim();

        // Get any text BEFORE the marker (intro text like "Creating your PDF now.")
        const textBeforeMarker = finalContent.slice(0, finalContent.indexOf('[GENERATE_PDF:')).trim();

        // Show ONLY the intro text + generating status - NOT the full content again
        // User already saw the content in the previous message
        const cleanedContent = textBeforeMarker
          ? `${textBeforeMarker}\n\n📄 **Generating PDF: ${pdfTitle}...**`
          : `📄 **Generating PDF: ${pdfTitle}...**`;

        // Update the message to show just the status (hide redundant content)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: cleanedContent }
              : msg
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
              console.log('[ChatClient] PDF generated successfully, storage:', pdfData.storage);

              if (isSupabaseUrl) {
                // Supabase Storage: Show clickable download link
                // UPDATE the existing message instead of adding new one (prevents screen flash)
                let messageContent = textBeforeMarker
                  ? `${textBeforeMarker}\n\n`
                  : '';
                messageContent += `✅ **Your PDF is ready!**\n\n`;
                messageContent += `📄 **[Download PDF](${downloadUrl})**`;
                messageContent += `\n\n*Link expires in 1 hour. If you need it later, just ask me to generate again.*`;

                // Update the SAME message (smoother UX, no flash)
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: messageContent }
                      : msg
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
                    msg.id === assistantMessageId
                      ? { ...msg, content: successContent }
                      : msg
                  )
                );
              }
            }
          } else {
            console.error('[ChatClient] PDF generation failed:', await pdfResponse.text());
            // Update message with error (no new message = no flash)
            const errorContent = textBeforeMarker
              ? `${textBeforeMarker}\n\n⚠️ Sorry, I couldn't generate the PDF. Please try again.`
              : `⚠️ Sorry, I couldn't generate the PDF. Please try again.`;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: errorContent }
                  : msg
              )
            );
          }
        } catch (pdfError) {
          console.error('[ChatClient] Error during PDF generation:', pdfError);
        }
      }

      // Check for [GENERATE_QR: ...] marker in the response
      // This allows the AI to create functional QR codes
      const qrMarkerMatch = finalContent.match(/\[GENERATE_QR:\s*(.+?)\]/s);
      if (qrMarkerMatch) {
        const qrData = qrMarkerMatch[1].trim();
        console.log('[ChatClient] Detected GENERATE_QR marker, data:', qrData.slice(0, 100));

        // Remove the marker from the displayed text
        const cleanedContent = finalContent.replace(/\[GENERATE_QR:\s*.+?\]/s, '🔲 **Generating QR Code...**\n\n').trim();

        // Update the message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: cleanedContent }
              : msg
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
              console.log('[ChatClient] QR code generated successfully');

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
            console.error('[ChatClient] QR generation failed:', await qrResponse.text());
            const errorMsg: Message = {
              id: (Date.now() + 4).toString(),
              role: 'assistant',
              content: `⚠️ Sorry, I couldn't generate the QR code. Here's the data you can use: ${qrData}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          }
        } catch (qrError) {
          console.error('[ChatClient] Error during QR generation:', qrError);
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
      const currentChat = chats.find(c => c.id === newChatId);
      const hasGenericTitle = currentChat && isGenericTitle(currentChat.title);
      const isMeaningfulMessage = content.length > 20; // Skip short greetings
      const shouldRegenerateTitle = hasGenericTitle && isMeaningfulMessage && messages.length > 0;

      console.log('[ChatClient] Title generation check:', {
        isNewConversation,
        messageCount: messages.length,
        newChatId,
        currentTitle: currentChat?.title,
        hasGenericTitle,
        shouldRegenerateTitle
      });

      if ((isNewConversation || shouldRegenerateTitle) && newChatId) {
        console.log('[ChatClient] STARTING title generation:', { isNewConversation, shouldRegenerateTitle });
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
            console.log('[ChatClient] Generated title:', generatedTitle);

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
          console.error('[ChatClient] Title generation error:', titleError);
        }
      }
    } catch (error) {
      // Check if this is an abort error (user navigated away or sent new message)
      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('aborted') ||
        error.message.toLowerCase().includes('abort')
      );

      // Check if this is a network error (connection lost, user navigated away)
      const isNetworkError = error instanceof Error && (
        error.name === 'TypeError' && error.message.toLowerCase().includes('fetch') ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('connection') ||
        error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('load failed')
      );

      if (isAbortError || isNetworkError) {
        // User navigated away or network issue - this is not a server error
        console.log('[ChatClient] Request interrupted:', error instanceof Error ? error.message : 'unknown');
        // Clean up abort controller to prevent memory leaks
        abortControllerRef.current = null;
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsStreaming(false);
          setPendingDocumentType(null);
        }
        return; // Don't show error message for interrupted requests
      }

      console.error('Chat API error:', error);
      // Log more details about the error for debugging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
      }

      // Only show error message if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Parse error message for specific error types
      const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';
      let errorContent = '';

      // Check for specific error types and provide helpful messages
      if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('too many')) {
        errorContent = 'You\'re sending messages too quickly. Please wait a moment and try again.';
      } else if (errorMsg.includes('token limit') || errorMsg.includes('usage limit')) {
        errorContent = 'You\'ve reached your usage limit. Check your account for details or upgrade your plan.';
      } else if (errorMsg.includes('moderation') || errorMsg.includes('content policy')) {
        errorContent = 'Your message couldn\'t be processed due to content guidelines. Please rephrase and try again.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        errorContent = 'The request took too long. Please try again with a simpler message.';
      } else if (errorMsg.includes('server') || errorMsg.includes('500') || errorMsg.includes('503')) {
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
    }
  };

  // Get theme for conditional rendering
  const { theme } = useTheme();

  return (
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
            {currentChatId && (
              theme === 'light' ? (
                // Light mode: Use text instead of logo
                <h1 className="text-base md:text-xl font-normal">
                  <span style={{ color: 'var(--text-primary)' }}>jcil.</span>
                  <span style={{ color: 'var(--primary)' }}>ai</span>
                </h1>
              ) : headerLogo ? (
                <img src={headerLogo} alt="JCIL.ai" className="h-8" />
              ) : (
                <h1 className="text-base md:text-xl font-semibold">
                  <span className="text-white">JCIL</span>
                  <span className="text-blue-500">.ai</span>
                </h1>
              )
            )}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
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
              <svg className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          onPinChat={handlePinChat}
          onMoveToFolder={handleMoveToFolder}
          onOpenCodeCommand={() => setShowCodeCommand(true)}
        />

        {/* Chat thread area */}
        <main className="flex flex-1 flex-col overflow-hidden relative">
          {showCodeCommand ? (
            // Code Command Interface (Admin only - terminal-style coding assistant)
            <CodeCommandInterface
              onClose={() => setShowCodeCommand(false)}
            />
          ) : (
            // Regular Chat Interface
            <>
              <ChatThread
                messages={messages}
                isStreaming={isStreaming}
                currentChatId={currentChatId}
                isAdmin={isAdmin}
                onSubmitPrompt={(prompt) => handleSendMessage(prompt, [])}
                documentType={pendingDocumentType}
              />
              {/* Reply incoming indicator - shown when waiting for background response */}
              {isWaitingForReply && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border-t border-blue-500/20">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-blue-400">Reply incoming...</span>
                </div>
              )}
              {/* Live To-Do List - extracted from AI responses */}
              <LiveTodoList
                messages={messages}
                conversationId={currentChatId}
              />
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
                hideImageSuggestion={!imageGenerationAvailable}
              />
              {/* Voice Button - Hidden until feature is production-ready
              <VoiceButton
                onStart={startVoiceChat}
                onUserText={addUserVoiceMessage}
                onAssistantText={upsertAssistantStreaming}
              />
              */}
            </>
          )}
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
    </div>
  );
}
