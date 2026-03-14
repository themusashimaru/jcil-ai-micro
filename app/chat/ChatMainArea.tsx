'use client';

import { useMemo, useCallback, useRef } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatComposer, SearchMode } from '@/components/chat/ChatComposer';
import {
  ChatContinuationBanner,
  CHAT_LENGTH_WARNING,
} from '@/components/chat/ChatContinuationBanner';
import { DeepStrategyProgress } from '@/components/chat/DeepStrategy';
import { getActiveAgent, type AgentModeId } from './agentModes';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';
import type { Message, Attachment, GeneratedImage } from './types';
import type { ActionPreviewData } from '@/components/chat/ActionPreviewCard';
import type { DestructiveActionData } from '@/components/chat/DestructiveActionCard';
import type { ChatState } from './useChatState';

interface ChatMainAreaProps {
  state: ChatState;
  handleNewChat: () => Promise<void>;
  handleSelectChat: (chatId: string) => Promise<void>;
  handleRenameChat: (chatId: string, newTitle: string) => void;
  handleDeleteChat: (chatId: string) => Promise<void>;
  handlePinChat: (chatId: string) => void;
  handleMoveToFolder: (
    chatId: string,
    folderId: string | null,
    folderData?: { id: string; name: string; color: string | null }
  ) => Promise<void>;
  handleSelectStrategySession: (sessionId: string) => Promise<void>;
  handleSendMessage: (
    content: string,
    attachments: Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => Promise<void>;
  handleStop: () => void;
  handleChatContinuation: () => Promise<void>;
  handleImageGenerated: (image: GeneratedImage) => void;
  handleRegenerateImage: (
    generationId: string,
    originalPrompt: string,
    feedback: string
  ) => Promise<void>;
  handleActionSend: (preview: ActionPreviewData) => Promise<void>;
  handleActionEdit: (preview: ActionPreviewData, instruction: string) => void;
  handleActionCancel: (preview: ActionPreviewData) => void;
  handleDestructiveConfirm: (data: DestructiveActionData) => Promise<void>;
  handleDestructiveCancel: (data: DestructiveActionData) => void;
  handleCarouselSelect: (cardId: string) => Promise<void>;
  startAgentMode: (modeId: AgentModeId) => Promise<void>;
  cancelAgentMode: (modeId: AgentModeId) => Promise<void>;
  exitAllAgentModes: () => Promise<void>;
}

export function ChatMainArea({
  state,
  handleNewChat,
  handleSelectChat,
  handleRenameChat,
  handleDeleteChat,
  handlePinChat,
  handleMoveToFolder,
  handleSelectStrategySession,
  handleSendMessage,
  handleStop,
  handleChatContinuation,
  handleImageGenerated,
  handleRegenerateImage,
  handleActionSend,
  handleActionEdit,
  handleActionCancel,
  handleDestructiveConfirm,
  handleDestructiveCancel,
  handleCarouselSelect,
  startAgentMode,
  cancelAgentMode,
  exitAllAgentModes,
}: ChatMainAreaProps) {
  const {
    chats,
    currentChatId,
    messages,
    isStreaming,
    isWaitingForReply,
    sidebarCollapsed,
    isAdmin,
    pendingDocumentType,
    continuationDismissed,
    setContinuationDismissed,
    isGeneratingSummary,
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
    modes,
  } = state;

  const lastUserMessage = useMemo(
    () => messages.filter((m: Message) => m.role === 'user').pop()?.content || '',
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
  const handleRetry = useCallback(() => {
    if (lastUserMessage) {
      handleSendMessageRef.current(lastUserMessage, []);
    }
  }, [lastUserMessage]);

  return (
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
            onDestructiveConfirm={handleDestructiveConfirm}
            onDestructiveCancel={handleDestructiveCancel}
            onFollowupSelect={handleFollowupSelect}
            onRetry={handleRetry}
          />
        </ErrorBoundary>

        {state.modes.strategy.phase === 'executing' && state.modes.strategy.events.length > 0 && (
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
            conversationId={currentChatId || undefined}
            onImageGenerated={handleImageGenerated}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
