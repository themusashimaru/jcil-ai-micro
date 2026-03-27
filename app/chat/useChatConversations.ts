'use client';

import { useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { fetchWithRetry } from '@/lib/api/retry';
import { fetchMessages, createConversationInDatabase } from './chatApi';
import { generateSummaryPrompt } from '@/components/chat/ChatContinuationBanner';
import type { Chat, Message } from './types';
import type { ChatState } from './useChatState';

const log = logger('ChatClient');

interface UseChatConversationsArgs {
  state: ChatState;
  toast: { error: (title: string, message: string) => void };
}

export function useChatConversations({ state, toast }: UseChatConversationsArgs) {
  const {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    setIsWaitingForReply,
    setSidebarCollapsed,
    activeFolderId: _activeFolderId,
    setActiveFolderId,
    setPendingToolSuggestion,
    setMessagesLoading,
    setContinuationDismissed,
    setIsGeneratingSummary,
    abortControllerRef,
    pollingIntervalRef,
    isMountedRef,
    lastConversationLoadRef,
    currentChatIdRef,
    messagesRef,
    isStreamingRef,
    isProcessingRef,
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
        // Wait briefly to see if the stream is still alive
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (isStreamingRef.current) {
          // Stream is likely dead after mobile app backgrounding —
          // the browser drops fetch connections when the app is suspended.
          // Abort the stale connection and trigger pending request recovery.
          log.info(
            'Stream still active after returning from background — aborting stale connection',
            { chatId }
          );
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setIsStreaming(false);
          // Wait for abort to propagate through the reader error handler
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
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
    // Update URL to /chat (no conversation ID)
    window.history.replaceState(null, '', '/chat');
  }, [setCurrentChatId, setMessages, setPendingToolSuggestion, setSidebarCollapsed]);

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setMessagesLoading(true);
    setContinuationDismissed(false);
    setPendingToolSuggestion(null);
    if (window.innerWidth < 768) setSidebarCollapsed(true);
    // Update URL to reflect selected conversation
    window.history.replaceState(null, '', `/chat/${chatId}`);

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
    const previousChats = chats;
    setChats((prev) =>
      prev.map((chat) =>
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
        setChats(previousChats);
        toast.error('Move Failed', 'Could not move the conversation.');
      }
    } catch {
      setChats(previousChats);
      toast.error('Move Failed', 'Could not move the conversation.');
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
      const dbId = await createConversationInDatabase('Continuation', 'general');
      const chatId = dbId || crypto.randomUUID();
      const newChat: Chat = {
        id: chatId,
        title: 'Continuation',
        isPinned: false,
        lastMessage: 'Continued from previous chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(chatId);
      currentChatIdRef.current = chatId;
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: contextMessage,
          timestamp: new Date(),
        },
      ]);
      setContinuationDismissed(false);
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

  const handleEnterProject = useCallback(
    (folderId: string) => {
      setActiveFolderId(folderId);
    },
    [setActiveFolderId]
  );

  const handleExitProject = useCallback(() => {
    setActiveFolderId(null);
  }, [setActiveFolderId]);

  return {
    handleNewChat,
    handleSelectChat,
    handleRenameChat,
    handleDeleteChat,
    handlePinChat,
    handleMoveToFolder,
    handleEnterProject,
    handleExitProject,
    handleChatContinuation,
    handleStop,
  };
}
