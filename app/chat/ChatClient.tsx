/**
 * CHAT CLIENT COMPONENT
 *
 * Orchestrator that composes hooks and components for the chat interface.
 * All heavy logic lives in extracted hooks and modules.
 *
 * Extracted modules:
 * - useChatState.ts     — All useState/useRef declarations
 * - useChatInit.ts      — Initialization effects (admin, providers, sidebar, etc.)
 * - chatApi.ts          — Database operations (save, fetch, create)
 * - documentMarkers.ts  — Document generation marker processing
 * - ChatHeader.tsx       — Header navigation component
 * - agentModes.ts       — Agent mode configuration and helpers
 * - chatUtils.ts        — Utility functions
 * - types.ts            — Type definitions
 */

'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/lib/logger';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ToastProvider, useToastActions } from '@/components/ui/Toast';
import { fetchWithRetry } from '@/lib/api/retry';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer, SearchMode } from '@/components/chat/ChatComposer';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import {
  ChatContinuationBanner,
  CHAT_LENGTH_WARNING,
  generateSummaryPrompt,
} from '@/components/chat/ChatContinuationBanner';
import { parseSlashCommand } from '@/lib/slashCommands';
import { analyzeResponse, isConfirmation, isDecline } from '@/lib/response-analysis';
import PasskeyPromptModal from '@/components/auth/PasskeyPromptModal';
import { FirstRunModal } from '@/components/onboarding/FirstRunModal';
import { CodeExecutionProvider, useCodeExecution } from '@/contexts/CodeExecutionContext';
import { RepoSelector } from '@/components/chat/RepoSelector';
import { DeepStrategyProgress } from '@/components/chat/DeepStrategy';
import {
  getActiveAgent,
  isAnyModeInPhase,
  isAnyModeExecuting,
  type AgentModeId,
} from './agentModes';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';
import type { ActionPreviewData } from '@/components/chat/ActionPreviewCard';
import type { Chat, Message, Attachment, GeneratedImage } from './types';
import { extractCitationsFromText } from './types';
import {
  detectDocumentTypeFromMessage,
  isGenericTitle,
  formatActionSuccessMessage,
  formatMessagesForApi,
} from './chatUtils';
import { useChatState } from './useChatState';
import { useChatInit } from './useChatInit';
import { ChatHeader } from './ChatHeader';
import {
  fetchMessages,
  saveMessageToDatabase,
  createConversationInDatabase,
  safeJsonParse,
} from './chatApi';
import { processDocumentMarkers } from './documentMarkers';
import { useAgentOperations } from './useAgentOperations';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

const log = logger('ChatClient');

export function ChatClient() {
  return (
    <ToastProvider>
      <ChatClientInner />
    </ToastProvider>
  );
}

function ChatClientInner() {
  const toast = useToastActions();
  const state = useChatState();
  useChatInit(state);

  const {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    isWaitingForReply,
    setIsWaitingForReply,
    sidebarCollapsed,
    setSidebarCollapsed,
    isProfileOpen,
    setIsProfileOpen,
    isAdmin,
    showFirstRun,
    setShowFirstRun,
    isPasskeyModalOpen,
    setIsPasskeyModalOpen,
    headerLogo,
    pendingDocumentType,
    setPendingDocumentType,
    isGeneratingSummary,
    setIsGeneratingSummary,
    continuationDismissed,
    setContinuationDismissed,
    replyingTo,
    setReplyingTo,
    quickPromptText,
    setQuickPromptText,
    openCreateImage,
    setOpenCreateImage,
    openEditImage,
    setOpenEditImage,
    conversationLoadError,
    messagesLoading,
    setMessagesLoading,
    selectedProvider,
    setSelectedProvider,
    configuredProviders,
    pendingToolSuggestion,
    setPendingToolSuggestion,
    abortControllerRef,
    pollingIntervalRef,
    isMountedRef,
    lastConversationLoadRef,
    currentChatIdRef,
    messagesRef,
    isStreamingRef,
    isProcessingRef,
    modes,
    profile,
    hasProfile,
    dismissPasskeyPrompt,
  } = state;

  // ── Visibility Change Handler (pending reply recovery) ──

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsWaitingForReply(false);
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!currentChatIdRef.current) return;
      if (isProcessingRef.current) return;

      const chatId = currentChatIdRef.current;
      const currentMessages = messagesRef.current;

      if (isStreamingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (isStreamingRef.current) return;
      }

      const fetchedMessages = await fetchMessages(chatId);
      if (!fetchedMessages || !isMountedRef.current) return;

      if (fetchedMessages.length > currentMessages.length) {
        setMessages(fetchedMessages);
        setIsStreaming(false);
        return;
      }

      const lastFetchedMessage = fetchedMessages[fetchedMessages.length - 1];
      const lastLocalMessage = currentMessages[currentMessages.length - 1];
      const lastMessage = lastFetchedMessage || lastLocalMessage;

      const shouldCheckPending =
        lastMessage &&
        (lastMessage.role === 'user' ||
          (lastMessage.role === 'assistant' && !isStreamingRef.current));

      if (shouldCheckPending) {
        isProcessingRef.current = true;
        setIsWaitingForReply(true);
        setIsStreaming(false);

        try {
          const pendingController = new AbortController();
          const timeoutId = setTimeout(() => pendingController.abort(), 120000);

          const response = await fetch(`/api/conversations/${chatId}/process-pending`, {
            method: 'POST',
            signal: pendingController.signal,
          });

          clearTimeout(timeoutId);
          if (!isMountedRef.current) return;

          const result = await response.json();

          if (result.status === 'completed' && result.content) {
            const updatedMessages = await fetchMessages(chatId);
            if (updatedMessages && isMountedRef.current) {
              setMessages(updatedMessages);
            }
          } else if (result.status === 'no_pending_request') {
            const updatedMessages = await fetchMessages(chatId);
            if (updatedMessages && updatedMessages.length > currentMessages.length) {
              setMessages(updatedMessages);
            }
          }
        } catch (error) {
          const isTimeoutError = error instanceof Error && error.name === 'AbortError';
          if (!isTimeoutError) {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load Conversations ──

  useEffect(() => {
    const loadConversations = async (isRefresh = false) => {
      const now = Date.now();
      if (isRefresh && now - lastConversationLoadRef.current < 5000) return;

      try {
        const response = await fetchWithRetry('/api/conversations', { maxRetries: 2 });
        if (response.ok) {
          const responseData = await response.json();
          const conversations =
            responseData.data?.conversations || responseData.conversations || [];
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
              isPinned: false,
              lastMessage: '',
              createdAt: new Date(conv.created_at),
              updatedAt: new Date(conv.last_message_at || conv.updated_at),
            })
          );
          setChats(formattedChats);
          lastConversationLoadRef.current = now;
        } else if (response.status === 401) {
          setChats([]);
        }
      } catch (error) {
        log.error('Error loading conversations:', error as Error);
        toast.error(
          'Connection Error',
          'Unable to load conversations. Please check your connection.'
        );
      }
    };

    loadConversations();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadConversations(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation CRUD Handlers ──

  const handleNewChat = useCallback(async () => {
    setCurrentChatId(null);
    setMessages([]);
    setPendingToolSuggestion(null);
    if (window.innerWidth < 768) setSidebarCollapsed(true);
  }, [setCurrentChatId, setMessages, setPendingToolSuggestion, setSidebarCollapsed]);

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setMessagesLoading(true);
    setContinuationDismissed(false);
    setPendingToolSuggestion(null);
    if (window.innerWidth < 768) setSidebarCollapsed(true);

    try {
      const response = await fetchWithRetry(`/api/conversations/${chatId}/messages`, {
        maxRetries: 2,
      });
      if (response.ok) {
        const responseData = await response.json();
        const data = responseData.data || responseData;
        const formattedMessages: Message[] = (data.messages || []).map(
          (msg: {
            id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            content_type: string;
            attachment_urls: string[] | null;
            created_at: string;
          }) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            imageUrl: msg.attachment_urls?.[0] || undefined,
            timestamp: new Date(msg.created_at),
          })
        );
        setMessages(formattedMessages);
      }
    } catch (error) {
      log.error('Error loading messages:', error as Error);
      setMessages([]);
      toast.error('Load Failed', 'Could not load messages for this conversation.');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleRenameChat = useCallback(
    (chatId: string, newTitle: string) => {
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat))
      );
    },
    [setChats]
  );

  const handleDeleteChat = async (chatId: string) => {
    const previousChats = [...chats];
    setChats(chats.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }
    try {
      const response = await fetch(`/api/conversations/${chatId}`, { method: 'DELETE' });
      if (!response.ok) {
        setChats(previousChats);
        toast.error('Delete Failed', 'Could not delete the conversation.');
      }
    } catch {
      setChats(previousChats);
      toast.error('Delete Failed', 'Could not delete the conversation.');
    }
  };

  const handlePinChat = useCallback(
    (chatId: string) => {
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat))
      );
    },
    [setChats]
  );

  const handleMoveToFolder = async (
    chatId: string,
    folderId: string | null,
    folderData?: { id: string; name: string; color: string | null }
  ) => {
    setChats(
      chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              folderId: folderId || undefined,
              folder: folderData ? { ...folderData, position: 0 } : undefined,
            }
          : chat
      )
    );
    try {
      const response = await fetch(`/api/conversations/${chatId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        setChats(chats);
        toast.error('Move Failed', 'Could not move the conversation.');
      }
    } catch {
      setChats(chats);
      toast.error('Move Failed', 'Could not move the conversation.');
    }
  };

  // ── Agent Mode Operations (extracted to useAgentOperations) ──

  const {
    startAgentMode,
    cancelAgentMode,
    exitAllAgentModes,
    handleAgentInput,
    handleSelectStrategySession,
  } = useAgentOperations({ modes, setMessages, setIsStreaming, handleNewChat });

  // ── Image & Action Handlers ──

  const handleImageGenerated = (image: GeneratedImage) => {
    const typeLabel = image.type === 'edit' ? 'edited' : 'generated';
    const content = image.verification?.feedback
      ? `I've ${typeLabel} this image for you. ${image.verification.feedback}`
      : `I've ${typeLabel} this image based on your request: "${image.prompt}"`;
    setMessages((prev) => [
      ...prev,
      {
        id: `gen-${image.id}`,
        role: 'assistant',
        content,
        generatedImage: image,
        timestamp: new Date(),
      },
    ]);
  };

  const handleRegenerateImage = async (
    _generationId: string,
    originalPrompt: string,
    feedback: string
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `regen-user-${Date.now()}`,
        role: 'user',
        content: `Please regenerate this image. The previous result: ${feedback}`,
        timestamp: new Date(),
      },
    ]);
    try {
      const response = await fetch('/api/create/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${originalPrompt}. Important: ${feedback}`,
          conversationId: currentChatId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
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
        setMessages((prev) => [
          ...prev,
          {
            id: `regen-error-${Date.now()}`,
            role: 'assistant',
            content: `I couldn't regenerate the image: ${data.message || data.error || 'Unknown error'}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `regen-error-${Date.now()}`,
          role: 'assistant',
          content: 'I encountered an error while trying to regenerate the image. Please try again.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleActionSend = async (preview: ActionPreviewData): Promise<void> => {
    try {
      const response = await fetch('/api/composio/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: preview.toolName.replace(/^composio_/, ''),
          params: preview.toolParams,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `action-success-${Date.now()}`,
            role: 'assistant',
            content: formatActionSuccessMessage(preview.platform, preview.action, data.data),
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `action-error-${Date.now()}`,
            role: 'assistant',
            content: `Failed to ${preview.action.toLowerCase()} on ${preview.platform}: ${data.error || 'Unknown error'}.`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `action-error-${Date.now()}`,
          role: 'assistant',
          content: `An error occurred while trying to ${preview.action.toLowerCase()} on ${preview.platform}.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleActionEdit = (preview: ActionPreviewData, instruction: string): void => {
    const editRequest = `Please update the ${preview.platform} ${preview.action.toLowerCase()} based on this feedback: ${instruction}`;
    setMessages((prev) => [
      ...prev,
      {
        id: `action-edit-${Date.now()}`,
        role: 'user',
        content: editRequest,
        timestamp: new Date(),
      },
    ]);
    handleSendMessage(editRequest, [], undefined, undefined);
  };

  const handleActionCancel = (preview: ActionPreviewData): void => {
    setMessages((prev) => [
      ...prev,
      {
        id: `action-cancel-${Date.now()}`,
        role: 'assistant',
        content: `Okay, I've cancelled the ${preview.action.toLowerCase()} for ${preview.platform}. Let me know if you'd like to try something else!`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleCarouselSelect = async (cardId: string) => {
    switch (cardId) {
      case 'create-image':
        setQuickPromptText('Create an image of ');
        break;
      case 'edit-image':
        setQuickPromptText('Edit this image: ');
        break;
      case 'research':
        setQuickPromptText('Research ');
        break;
      case 'deep-research':
        await startAgentMode('deep-research');
        break;
      case 'deep-strategy':
        await startAgentMode('strategy');
        break;
    }
  };

  // ── Chat Continuation ──

  const handleChatContinuation = async () => {
    if (messages.length === 0) return;
    setIsGeneratingSummary(true);
    try {
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
      const summaryContent = response.ok
        ? (await response.json()).content || 'Previous conversation summary not available.'
        : `Continuing from: ${messages[0]?.content?.slice(0, 200) || 'general discussion'}`;
      const contextMessage = `## Continuing from Previous Chat\n\n${summaryContent}\n\n---`;
      const newChat: Chat = {
        id: crypto.randomUUID(),
        title: 'Continuation',
        isPinned: false,
        lastMessage: 'Continued from previous chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: contextMessage,
          timestamp: new Date(),
        },
      ]);
      setContinuationDismissed(false);
      await createConversationInDatabase('Continuation', 'general');
    } catch (error) {
      log.error('Error creating continuation:', error as Error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // ── Stop Handler ──

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, [abortControllerRef, setIsStreaming]);

  // ── Keyboard Shortcuts ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        handleStop();
        return;
      }
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
        return;
      }
      if (isMeta && e.key === '/' && !isInput) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, handleStop, handleNewChat, setSidebarCollapsed]);

  // ── Send Message (main chat flow) ──
  // This is the core function. It handles routing, streaming, and post-processing.
  // Document marker processing is delegated to documentMarkers.ts.

  const handleSendMessage = async (
    content: string,
    attachments: Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => {
    if (!content.trim() && attachments.length === 0) return;
    if (isStreaming) return;

    // Proactive continuation at hard limit
    const HARD_CONTEXT_LIMIT = 45;
    if (messages.length >= HARD_CONTEXT_LIMIT && !continuationDismissed) {
      await handleChatContinuation();
      setTimeout(() => handleSendMessage(content, attachments, searchMode, selectedRepo), 500);
      return;
    }

    // Slash commands
    const parsed = parseSlashCommand(content);
    if (parsed.isCommand) {
      if (parsed.helpText) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: parsed.helpText!,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (parsed.prompt) content = parsed.prompt;
    }

    // Agent mode intake
    const intakeMode = isAnyModeInPhase(modes, 'intake');
    if (intakeMode.active && intakeMode.modeId) {
      await handleAgentInput(intakeMode.modeId, content);
      return;
    }

    // Agent mode steering
    const execMode = isAnyModeExecuting(modes);
    if (execMode.executing && execMode.sessionId) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() },
      ]);
      try {
        const res = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'context',
            sessionId: execMode.sessionId,
            message: content,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.steeringApplied
                ? `**Steering Applied** (${data.steeringAction})\n\n${data.message}`
                : `Context received.`,
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        /* ok */
      }
      return;
    }

    // Tool suggestion confirmation
    let contentForAI = content;
    if (pendingToolSuggestion) {
      if (isConfirmation(content)) {
        if (pendingToolSuggestion.action === 'search') searchMode = 'search';
        else if (pendingToolSuggestion.action === 'factcheck') searchMode = 'factcheck';
        if (pendingToolSuggestion.originalQuestion)
          contentForAI = pendingToolSuggestion.originalQuestion;
        setPendingToolSuggestion(null);
      } else if (isDecline(content)) {
        setPendingToolSuggestion(null);
      } else {
        setPendingToolSuggestion(null);
      }
    }

    setIsStreaming(true);

    // Auto-create chat if none exists
    let newChatId: string;
    if (!currentChatId) {
      const tempId = crypto.randomUUID();
      setChats([
        {
          id: tempId,
          title: 'New Chat',
          isPinned: false,
          lastMessage: content.slice(0, 50),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ...chats,
      ]);
      setCurrentChatId(tempId);
      currentChatIdRef.current = tempId;

      try {
        const dbConversationId = await createConversationInDatabase('New Chat', 'general');
        if (!dbConversationId || typeof dbConversationId !== 'string')
          throw new Error('Invalid conversation ID');
        newChatId = dbConversationId;
        setCurrentChatId(dbConversationId);
        currentChatIdRef.current = dbConversationId;
        setChats((prev) =>
          prev.map((chat) => (chat.id === tempId ? { ...chat, id: dbConversationId } : chat))
        );
      } catch {
        setChats((prev) => prev.filter((c) => c.id !== tempId));
        setCurrentChatId(null);
        setIsStreaming(false);
        return;
      }
    } else {
      newChatId = currentChatId;
    }

    // Reply context
    let finalContent = content;
    if (replyingTo) {
      const quoted =
        replyingTo.content.length > 200
          ? replyingTo.content.slice(0, 200) + '...'
          : replyingTo.content;
      finalContent = `[Replying to: "${quoted}"]\n\n${content}`;
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
    const attachmentUrls = attachments.filter((att) => att.url).map((att) => att.url!);

    // Save user message to database FIRST
    try {
      await saveMessageToDatabase(
        newChatId,
        'user',
        content,
        'text',
        undefined,
        attachmentUrls.length > 0 ? attachmentUrls : undefined
      );
      setMessages([...messages, userMessage]);
      const detectedDocType = detectDocumentTypeFromMessage(content);
      setPendingDocumentType(detectedDocType);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Sorry, your message could not be sent. Please check your connection and try again.',
          timestamp: new Date(),
        },
      ]);
      setIsStreaming(false);
      return;
    }

    let streamFinalContent = '';
    try {
      // Format messages for API (handle images, documents, etc.)
      const allMessages = [...messages, userMessage];
      if (contentForAI !== content) {
        allMessages[allMessages.length - 1] = {
          ...allMessages[allMessages.length - 1],
          content: contentForAI,
        };
      }

      // Format messages for API (handles images, documents, plain text)
      const apiMessages = formatMessagesForApi(allMessages);

      const userContext = hasProfile
        ? {
            name: profile.name,
            role: profile.isStudent ? 'student' : 'professional',
            field: profile.jobTitle,
            purpose: profile.description,
          }
        : undefined;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const chatTimeoutId = setTimeout(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
      }, 180_000);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          userContext,
          conversationId: newChatId,
          searchMode: searchMode || 'none',
          selectedRepo: selectedRepo || undefined,
          provider: selectedProvider,
        }),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(chatTimeoutId);
      if (!response.ok) {
        const errorData = await safeJsonParse(response);
        throw new Error(
          (errorData as { details?: string })?.details ||
            errorData?.error?.message ||
            `HTTP ${response.status}`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');
      const modelUsed = response.headers.get('X-Model-Used') || undefined;
      const searchProvider = response.headers.get('X-Web-Search') || undefined;
      const assistantMessageId = crypto.randomUUID();
      let isImageResponse = false;

      if (isJsonResponse) {
        const data = await response.json();
        // Handle all JSON response types (image, code_preview, multi_page_website, video_job, analytics, text)
        if (data.type === 'image' && data.url) {
          isImageResponse = true;
          const msg: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: `Here's your generated image based on: "${data.prompt || content}"`,
            imageUrl: data.url,
            model: data.model || modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
          streamFinalContent = msg.content;
          await saveMessageToDatabase(newChatId, 'assistant', msg.content, 'image', data.url);
        } else if (data.type === 'image_generation' && data.generatedImage) {
          isImageResponse = true;
          const msg: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: data.content || "I've created this image for you.",
            generatedImage: data.generatedImage as GeneratedImage,
            model: data.generatedImage.model || modelUsed,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
          streamFinalContent = msg.content;
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            msg.content,
            'image',
            data.generatedImage.imageUrl
          );
        } else if (data.type === 'code_preview' && data.codePreview) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your generated code:',
              model: data.model || modelUsed,
              codePreview: data.codePreview,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'multi_page_website' && data.multiPageWebsite) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your multi-page website:',
              model: data.model || modelUsed,
              multiPageWebsite: data.multiPageWebsite,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'video_job' && data.video_job) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || '',
              model: data.model || modelUsed,
              videoJob: data.video_job,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else if (data.type === 'analytics' && data.analytics) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: data.content || 'Here is your data analysis:',
              model: data.model || modelUsed,
              analytics: data.analytics,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = data.content;
          await saveMessageToDatabase(newChatId, 'assistant', data.content, 'text');
        } else {
          let messageContent = data.content || '';
          if (data.documentDownload?.url) {
            const format = (data.documentDownload.format || 'file').toUpperCase();
            messageContent += `\n\n✅ **Your ${format} is ready!**\n\n📄 **[Download ${format}](${data.documentDownload.url})**\n\n*Link expires in 1 hour.*`;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: messageContent,
              citations: data.citations || [],
              sourcesUsed: data.sourcesUsed || 0,
              model: data.model || modelUsed,
              searchProvider,
              files: data.files,
              timestamp: new Date(),
            },
          ]);
          streamFinalContent = messageContent;
        }
      } else {
        // Streaming response (text or SSE)
        const isSSE = contentType.includes('text/event-stream');

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: isSSE ? '🚀 Generating...' : '',
            model: modelUsed,
            timestamp: new Date(),
          },
        ]);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let accumulatedContent = '';
          try {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });

              if (isSSE) {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;
                  try {
                    const event = JSON.parse(data);
                    if (currentChatIdRef.current === newChatId) {
                      if (event.type === 'progress') {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId ? { ...msg, content: event.message } : msg
                          )
                        );
                      } else if (event.type === 'code_preview' && event.codePreview) {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? {
                                  ...msg,
                                  content: event.content || 'Here is your website:',
                                  codePreview: event.codePreview,
                                }
                              : msg
                          )
                        );
                        streamFinalContent = event.content;
                        await saveMessageToDatabase(
                          newChatId,
                          'assistant',
                          event.content || 'Generated website',
                          'text'
                        );
                      } else if (event.type === 'error') {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? { ...msg, content: `❌ Error: ${event.message}` }
                              : msg
                          )
                        );
                      }
                    }
                  } catch {
                    /* partial SSE data */
                  }
                }
              } else {
                accumulatedContent += chunk;
                if (currentChatIdRef.current === newChatId) {
                  const displayContent = accumulatedContent
                    .replace(/\n?\[DONE]\n?/g, '')
                    .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/g, '')
                    .replace(/<suggested-followups>[\s\S]*$/g, '')
                    .trimEnd();
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: displayContent } : msg
                    )
                  );
                }
              }
            }
          } catch (readerError) {
            if (accumulatedContent.length > 0) {
              streamFinalContent = accumulatedContent.replace(/\n?\[DONE]\n?/g, '').trimEnd();
            } else throw readerError;
          } finally {
            reader.releaseLock();
          }
          if (!streamFinalContent && accumulatedContent) {
            streamFinalContent = accumulatedContent.replace(/\n?\[DONE]\n?/g, '').trimEnd();
          }
        }
      }

      // Post-processing: document markers, follow-ups, citations, title
      if (streamFinalContent) {
        const { content: processedContent, documentDownloadMeta } = await processDocumentMarkers(
          streamFinalContent,
          assistantMessageId,
          setMessages
        );
        streamFinalContent = processedContent;

        // Parse suggested follow-ups
        const followupsMatch = streamFinalContent.match(
          /<suggested-followups>\s*(\[[\s\S]*?\])\s*<\/suggested-followups>/
        );
        if (followupsMatch) {
          try {
            const followups = JSON.parse(followupsMatch[1]) as string[];
            if (Array.isArray(followups) && followups.length > 0) {
              streamFinalContent = streamFinalContent
                .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
                .trimEnd();
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: streamFinalContent,
                        suggestedFollowups: followups.slice(0, 3),
                      }
                    : msg
                )
              );
            }
          } catch {
            streamFinalContent = streamFinalContent
              .replace(/<suggested-followups>[\s\S]*?<\/suggested-followups>/, '')
              .trimEnd();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: streamFinalContent } : msg
              )
            );
          }
        }

        // Extract citations
        const extractedCitations = extractCitationsFromText(streamFinalContent);
        if (extractedCitations.length > 0) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, citations: extractedCitations, sourcesUsed: extractedCitations.length }
                : msg
            )
          );
        }

        // Smart tool suggestions
        if (!searchProvider && !isImageResponse) {
          const analysisResult = analyzeResponse(streamFinalContent);
          if (
            analysisResult.triggerType !== 'none' &&
            analysisResult.suggestedAction !== 'none' &&
            analysisResult.suggestedPrompt
          ) {
            const updatedContent = streamFinalContent + analysisResult.suggestedPrompt;
            streamFinalContent = updatedContent;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: updatedContent } : msg
              )
            );
            setPendingToolSuggestion({
              action: analysisResult.suggestedAction,
              originalQuestion: content,
            });
          }
        }

        // Save assistant message
        if (!isImageResponse) {
          await saveMessageToDatabase(
            newChatId,
            'assistant',
            streamFinalContent,
            'text',
            undefined,
            undefined,
            documentDownloadMeta
          );
        }
      }

      setIsStreaming(false);
      setPendingDocumentType(null);
      abortControllerRef.current = null;

      // Generate/regenerate title
      const isNewConversation = messages.length === 0;
      const currentChat = chats.find((c) => c.id === newChatId);
      const shouldGenerateTitle =
        (isNewConversation ||
          (currentChat && isGenericTitle(currentChat.title) && content.length > 20)) &&
        newChatId;

      if (shouldGenerateTitle) {
        try {
          const titleResponse = await fetch('/api/chat/generate-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage: content, assistantMessage: streamFinalContent }),
          });
          if (titleResponse.ok) {
            const { title: generatedTitle } = await titleResponse.json();
            if (generatedTitle && (!isGenericTitle(generatedTitle) || isNewConversation)) {
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === newChatId ? { ...chat, title: generatedTitle } : chat
                )
              );
              await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: newChatId, title: generatedTitle }),
              });
            }
          }
        } catch {
          /* title gen is best-effort */
        }
      }
    } catch (error) {
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'));
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('Load failed'));

      if (isAbortError || isNetworkError) {
        if (streamFinalContent) {
          try {
            await saveMessageToDatabase(newChatId, 'assistant', streamFinalContent, 'text');
          } catch {
            /* ok */
          }
        }
        abortControllerRef.current = null;
        if (isMountedRef.current) {
          setIsStreaming(false);
          setPendingDocumentType(null);
        }
        return;
      }

      log.error('Chat API error:', error as Error);
      if (!isMountedRef.current) return;

      const rawErrorMsg = error instanceof Error ? error.message : '';
      const errorMsg = rawErrorMsg.toLowerCase();

      // Context exhaustion auto-recovery
      if (
        errorMsg.includes('context') ||
        errorMsg.includes('too long') ||
        errorMsg.includes('exceeds the model')
      ) {
        handleChatContinuation().catch((e) => log.error('Auto-continuation failed:', e));
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'This conversation has reached its context limit. Creating a new chat with your conversation summary...',
            timestamp: new Date(),
          },
        ]);
        setIsStreaming(false);
        setPendingDocumentType(null);
        return;
      }

      // User-friendly error messages
      let errorContent = 'Something went wrong. Please try again.';
      if (errorMsg.includes('rate limit') || errorMsg.includes('429'))
        errorContent = "You're sending messages too quickly. Please wait a moment.";
      else if (errorMsg.includes('token limit')) errorContent = "You've reached your usage limit.";
      else if (errorMsg.includes('moderation') || errorMsg.includes('content policy'))
        errorContent = "Your message couldn't be processed due to content guidelines.";
      else if (errorMsg.includes('timeout'))
        errorContent = 'The request took too long. Please try again.';
      else if (errorMsg.includes('unauthorized') || errorMsg.includes('401'))
        errorContent = 'Your session may have expired. Please refresh.';

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorContent,
          timestamp: new Date(),
        },
      ]);
      setIsStreaming(false);
      setPendingDocumentType(null);
      abortControllerRef.current = null;
      await saveMessageToDatabase(newChatId, 'assistant', errorContent, 'error');
    } finally {
      abortControllerRef.current = null;
      if (isMountedRef.current) {
        setIsStreaming(false);
        setPendingDocumentType(null);
      }
    }
  };

  // ── Memoized Values ──

  const lastUserMessage = useMemo(
    () => messages.filter((m) => m.role === 'user').pop()?.content || '',
    [messages]
  );
  const handleReply = useCallback((message: Message) => setReplyingTo(message), [setReplyingTo]);
  const handleQuickPrompt = useCallback(
    (prompt: string) => setQuickPromptText(prompt),
    [setQuickPromptText]
  );
  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;
  const handleFollowupSelect = useCallback(
    (suggestion: string) => handleSendMessageRef.current(suggestion, []),
    []
  );
  const handleClearReply = useCallback(() => setReplyingTo(null), [setReplyingTo]);

  // ── Render ──

  return (
    <CodeExecutionProvider>
      <div id="main-content" className="flex h-screen flex-col bg-background" role="main">
        <ChatHeader
          currentChatId={currentChatId}
          headerLogo={headerLogo}
          hasProfile={hasProfile}
          profileName={profile.name}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNewChat={handleNewChat}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          <ErrorBoundary
            fallback={
              <aside
                className="w-72 md:w-80 p-4 flex items-center justify-center border-r border-theme"
                role="complementary"
                aria-label="Chat sidebar (error state)"
              >
                <div className="text-center">
                  <p className="text-sm mb-2 text-text-secondary">Sidebar unavailable</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs underline text-primary"
                  >
                    Reload
                  </button>
                </div>
              </aside>
            }
          >
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
          </ErrorBoundary>

          <main className="flex flex-1 flex-col overflow-hidden relative">
            <ErrorBoundary
              fallback={
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <p className="text-sm mb-2 text-text-secondary">Failed to load messages</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs underline text-primary"
                    >
                      Reload chat
                    </button>
                  </div>
                </div>
              }
            >
              <ChatThread
                messages={messages}
                isStreaming={isStreaming}
                isLoading={messagesLoading}
                currentChatId={currentChatId}
                isAdmin={isAdmin}
                documentType={pendingDocumentType}
                onReply={handleReply}
                enableCodeActions
                lastUserMessage={lastUserMessage}
                onQuickPrompt={handleQuickPrompt}
                onCarouselSelect={handleCarouselSelect}
                onRegenerateImage={handleRegenerateImage}
                onActionSend={handleActionSend}
                onActionEdit={handleActionEdit}
                onActionCancel={handleActionCancel}
                onFollowupSelect={handleFollowupSelect}
              />
            </ErrorBoundary>

            {state.modes.strategy.phase === 'executing' &&
              state.modes.strategy.events.length > 0 && (
                <div className="px-4 pb-4">
                  <DeepStrategyProgress
                    events={state.modes.strategy.events}
                    isComplete={false}
                    onCancel={() => cancelAgentMode('strategy')}
                  />
                </div>
              )}
            {state.modes['deep-research'].phase === 'executing' &&
              state.modes['deep-research'].events.length > 0 && (
                <div className="px-4 pb-4">
                  <DeepStrategyProgress
                    events={state.modes['deep-research'].events}
                    isComplete={false}
                    onCancel={() => cancelAgentMode('deep-research')}
                  />
                </div>
              )}

            {!continuationDismissed && messages.length >= CHAT_LENGTH_WARNING && (
              <ChatContinuationBanner
                messageCount={messages.length}
                onContinue={handleChatContinuation}
                onDismiss={() => setContinuationDismissed(true)}
                isGenerating={isGeneratingSummary}
              />
            )}

            <ErrorBoundary
              fallback={
                <div className="p-4 text-center border-t border-theme">
                  <p className="text-sm mb-2 text-text-secondary">Composer failed to load</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs underline text-primary"
                  >
                    Reload
                  </button>
                </div>
              }
            >
              <ChatComposer
                onSendMessage={handleSendMessage}
                onStop={handleStop}
                isStreaming={isStreaming}
                disabled={isWaitingForReply}
                replyingTo={replyingTo}
                onClearReply={handleClearReply}
                initialText={quickPromptText}
                isAdmin={isAdmin}
                activeAgent={getActiveAgent(modes)}
                strategyLoading={state.modes.strategy.loading}
                deepResearchLoading={state.modes['deep-research'].loading}
                quickResearchLoading={state.modes['quick-research'].loading}
                quickStrategyLoading={state.modes['quick-strategy'].loading}
                deepWriterLoading={state.modes['deep-writer'].loading}
                quickWriterLoading={state.modes['quick-writer'].loading}
                onAgentSelect={async (agent) => {
                  const modeId = agent as AgentModeId;
                  const mode = modes[modeId];
                  if (mode) {
                    if (mode.isActive) await cancelAgentMode(modeId);
                    else {
                      await exitAllAgentModes();
                      await startAgentMode(modeId);
                    }
                  } else if (agent === 'research') await exitAllAgentModes();
                }}
                openCreateImage={openCreateImage}
                openEditImage={openEditImage}
                onCloseCreateImage={() => setOpenCreateImage(false)}
                onCloseEditImage={() => setOpenEditImage(false)}
                onCreativeMode={(mode) => {
                  if (mode === 'create-image') setQuickPromptText('Create an image of ');
                  else if (mode === 'edit-image') setQuickPromptText('Edit this image: ');
                }}
                selectedProvider={selectedProvider}
                onProviderChange={setSelectedProvider}
                configuredProviders={configuredProviders}
                conversationId={currentChatId || undefined}
                onImageGenerated={handleImageGenerated}
              />
            </ErrorBoundary>
          </main>
        </div>

        <FirstRunModal isOpen={showFirstRun} onComplete={() => setShowFirstRun(false)} />
        <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
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
        <RepoSelectorWrapper />
      </div>
    </CodeExecutionProvider>
  );
}

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
