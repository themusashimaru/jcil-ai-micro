/**
 * CHAT CLIENT COMPONENT
 *
 * Orchestrator that composes hooks and components for the chat interface.
 * All heavy logic lives in extracted hooks and modules.
 *
 * Extracted modules:
 * - useChatState.ts          — All useState/useRef declarations
 * - useChatInit.ts           — Initialization effects (admin, providers, sidebar, etc.)
 * - useChatConversations.ts  — Conversation CRUD, visibility handler, keyboard shortcuts
 * - useChatMessaging.ts      — Core send-message flow with streaming
 * - ChatImageHandlers.ts     — Image generation/regeneration and action handlers
 * - ChatMainArea.tsx         — Main render body (sidebar, thread, composer)
 * - chatApi.ts               — Database operations (save, fetch, create)
 * - documentMarkers.ts       — Document generation marker processing
 * - ChatHeader.tsx           — Header navigation component
 * - agentModes.ts            — Agent mode configuration and helpers
 * - chatUtils.ts             — Utility functions
 * - types.ts                 — Type definitions
 */

'use client';

import { ToastProvider, useToastActions } from '@/components/ui/Toast';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import PasskeyPromptModal from '@/components/auth/PasskeyPromptModal';
import { FirstRunModal } from '@/components/onboarding/FirstRunModal';
import { CodeExecutionProvider, useCodeExecution } from '@/contexts/CodeExecutionContext';
import { RepoSelector } from '@/components/chat/RepoSelector';
import { useChatState } from './useChatState';
import { useChatInit } from './useChatInit';
import { ChatHeader } from './ChatHeader';
import { useChatConversations } from './useChatConversations';
import { useChatMessaging } from './useChatMessaging';
import { createImageHandlers } from './ChatImageHandlers';
import { ChatMainArea } from './ChatMainArea';
import { useAgentOperations } from './useAgentOperations';

// Re-export types for convenience
export type { Chat, Message, ToolCall, Attachment } from './types';

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
    handleNewChat,
    handleSelectChat,
    handleRenameChat,
    handleDeleteChat,
    handlePinChat,
    handleMoveToFolder,
    handleChatContinuation,
    handleStop,
  } = useChatConversations({ state, toast });

  const {
    startAgentMode,
    cancelAgentMode,
    exitAllAgentModes,
    handleAgentInput,
    handleSelectStrategySession,
  } = useAgentOperations({
    modes: state.modes,
    setMessages: state.setMessages,
    setIsStreaming: state.setIsStreaming,
    handleNewChat,
  });

  const { handleSendMessage } = useChatMessaging({
    state,
    handleChatContinuation,
    handleAgentInput,
  });

  const {
    handleImageGenerated,
    handleRegenerateImage,
    handleActionSend,
    handleActionEdit,
    handleActionCancel,
    handleCarouselSelect,
  } = createImageHandlers({
    currentChatId: state.currentChatId,
    setMessages: state.setMessages,
    setQuickPromptText: state.setQuickPromptText,
    startAgentMode,
    handleSendMessage,
  });

  return (
    <CodeExecutionProvider>
      <div id="main-content" className="flex h-screen flex-col bg-background" role="main">
        <ChatHeader
          currentChatId={state.currentChatId}
          headerLogo={state.headerLogo}
          hasProfile={state.hasProfile}
          profileName={state.profile.name}
          onToggleSidebar={() => state.setSidebarCollapsed(!state.sidebarCollapsed)}
          onNewChat={handleNewChat}
          onOpenProfile={() => state.setIsProfileOpen(true)}
        />

        <ChatMainArea
          state={state}
          handleNewChat={handleNewChat}
          handleSelectChat={handleSelectChat}
          handleRenameChat={handleRenameChat}
          handleDeleteChat={handleDeleteChat}
          handlePinChat={handlePinChat}
          handleMoveToFolder={handleMoveToFolder}
          handleSelectStrategySession={handleSelectStrategySession}
          handleSendMessage={handleSendMessage}
          handleStop={handleStop}
          handleChatContinuation={handleChatContinuation}
          handleImageGenerated={handleImageGenerated}
          handleRegenerateImage={handleRegenerateImage}
          handleActionSend={handleActionSend}
          handleActionEdit={handleActionEdit}
          handleActionCancel={handleActionCancel}
          handleCarouselSelect={handleCarouselSelect}
          startAgentMode={startAgentMode}
          cancelAgentMode={cancelAgentMode}
          exitAllAgentModes={exitAllAgentModes}
        />

        <FirstRunModal
          isOpen={state.showFirstRun}
          onComplete={() => state.setShowFirstRun(false)}
        />
        <UserProfileModal
          isOpen={state.isProfileOpen}
          onClose={() => state.setIsProfileOpen(false)}
        />
        <PasskeyPromptModal
          isOpen={state.isPasskeyModalOpen}
          onClose={() => {
            state.setIsPasskeyModalOpen(false);
            state.dismissPasskeyPrompt();
          }}
          onSuccess={() => {
            state.setIsPasskeyModalOpen(false);
            state.dismissPasskeyPrompt();
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
