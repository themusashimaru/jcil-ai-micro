/**
 * CHAT STATE HOOK
 *
 * Centralizes all useState/useRef declarations for ChatClient.
 * Keeps the main component focused on orchestration.
 */

import { useState, useRef, useMemo } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { usePasskeyPrompt } from '@/components/auth/PasskeyPromptModal';
// Agent mode imports removed — agent system deprecated
import type { Chat, Message } from './types';
import type { SuggestedAction } from '@/lib/response-analysis';
import type { ProviderId } from '@/lib/ai/providers';

export function useChatState() {
  // Core chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // UI modals/dialogs
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);

  // Header
  const [headerLogo, setHeaderLogo] = useState<string>('');

  // Document generation
  const [pendingDocumentType, setPendingDocumentType] = useState<
    'pdf' | 'docx' | 'xlsx' | 'pptx' | null
  >(null);

  // Chat continuation
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [continuationDismissed, setContinuationDismissed] = useState(false);

  // Reply / quick prompt
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [quickPromptText, setQuickPromptText] = useState<string>('');

  // Creative modes (carousel-triggered)
  const [openCreateImage, setOpenCreateImage] = useState(false);
  const [openEditImage, setOpenEditImage] = useState(false);

  // Conversation loading
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('claude');
  const [configuredProviders, setConfiguredProviders] = useState<ProviderId[]>(['claude']);

  // Tool suggestion
  const [pendingToolSuggestion, setPendingToolSuggestion] = useState<{
    action: SuggestedAction;
    originalQuestion: string | null;
  } | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastConversationLoadRef = useRef<number>(0);
  const currentChatIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const isStreamingRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Agent modes removed — stub for backward compat with ChatMainArea props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modes: Record<string, any> = useMemo(() => ({}), []);

  // External hooks
  const { profile, hasProfile } = useUserProfile();
  const { shouldShow: showPasskeyPrompt, dismiss: dismissPasskeyPrompt } = usePasskeyPrompt();

  return {
    // Core state
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
    activeFolderId,
    setActiveFolderId,

    // UI modals
    isProfileOpen,
    setIsProfileOpen,
    isAdmin,
    setIsAdmin,
    showFirstRun,
    setShowFirstRun,
    isPasskeyModalOpen,
    setIsPasskeyModalOpen,

    // Header
    headerLogo,
    setHeaderLogo,

    // Document generation
    pendingDocumentType,
    setPendingDocumentType,

    // Chat continuation
    isGeneratingSummary,
    setIsGeneratingSummary,
    continuationDismissed,
    setContinuationDismissed,

    // Reply / quick prompt
    replyingTo,
    setReplyingTo,
    quickPromptText,
    setQuickPromptText,

    // Creative modes
    openCreateImage,
    setOpenCreateImage,
    openEditImage,
    setOpenEditImage,

    // Conversation loading
    conversationLoadError,
    setConversationLoadError,
    messagesLoading,
    setMessagesLoading,

    // Provider
    selectedProvider,
    setSelectedProvider,
    configuredProviders,
    setConfiguredProviders,

    // Tool suggestion
    pendingToolSuggestion,
    setPendingToolSuggestion,

    // Refs
    abortControllerRef,
    pollingIntervalRef,
    isMountedRef,
    lastConversationLoadRef,
    currentChatIdRef,
    messagesRef,
    isStreamingRef,
    isProcessingRef,

    // Agent modes
    modes,

    // External
    profile,
    hasProfile,
    showPasskeyPrompt,
    dismissPasskeyPrompt,
  };
}

export type ChatState = ReturnType<typeof useChatState>;
