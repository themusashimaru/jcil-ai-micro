/**
 * CHAT THREAD COMPONENT
 *
 * PURPOSE:
 * - Display message thread with virtualization for performance
 * - Show streaming responses with typing indicator
 * - Display tool call badges
 * - Support message attachments
 *
 * FEATURES:
 * - Virtualized scrolling for long conversations
 * - Glassmorphism message bubbles with tails
 * - Tool execution badges (pending, running, completed, error)
 * - Image thumbnails and file attachment badges
 * - Auto-scroll to bottom on new messages
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { Message } from '@/app/chat/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThreadSkeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { GetStartedCarousel } from './GetStartedCarousel';
import { SuggestedFollowups } from './SuggestedFollowups';
import type { ActionPreviewData } from './ActionPreviewCard';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
  isAdmin?: boolean;
  documentType?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | null;
  onReply?: (message: Message) => void;
  enableCodeActions?: boolean;
  lastUserMessage?: string;
  onQuickPrompt?: (prompt: string) => void;
  onCarouselSelect?: (cardId: string) => void;
  onRegenerateImage?: (generationId: string, originalPrompt: string, feedback: string) => void;
  /** Callback when action preview Send is clicked (for Composio integrations) */
  onActionSend?: (preview: ActionPreviewData) => Promise<void>;
  /** Callback when action preview Edit is requested */
  onActionEdit?: (preview: ActionPreviewData, instruction: string) => void;
  /** Callback when action preview is cancelled */
  onActionCancel?: (preview: ActionPreviewData) => void;
  /** Callback when a suggested follow-up is clicked */
  onFollowupSelect?: (suggestion: string) => void;
  /** Whether messages are being loaded */
  isLoading?: boolean;
}

/**
 * Get time-based greeting
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'this morning';
  if (hour < 17) return 'this afternoon';
  return 'this evening';
}

export function ChatThread({
  messages,
  isStreaming,
  currentChatId: _currentChatId,
  isAdmin,
  documentType,
  onReply,
  enableCodeActions,
  lastUserMessage,
  onCarouselSelect,
  onRegenerateImage,
  onActionSend,
  onActionEdit,
  onActionCancel,
  onFollowupSelect,
  isLoading,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Load logo from database
  const [mainLogo, setMainLogo] = useState<string>('');
  const [lightModeLogo, setLightModeLogo] = useState<string>('');
  const [isLogoLoading, setIsLogoLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          if (settings.main_logo && settings.main_logo !== '/images/logo.png') {
            setMainLogo(settings.main_logo);
          }
          if (settings.light_mode_logo) {
            setLightModeLogo(settings.light_mode_logo);
          }
        }
      } catch (error) {
        console.error('[ChatThread] Failed to load design settings:', error);
      } finally {
        setIsLogoLoading(false);
      }
    };

    loadSettings();

    const handleUpdate = () => loadSettings();
    window.addEventListener('design-settings-updated', handleUpdate);
    return () => window.removeEventListener('design-settings-updated', handleUpdate);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    const initialTimeout = setTimeout(scrollToBottom, 50);
    const secondaryTimeout = setTimeout(scrollToBottom, 300);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondaryTimeout);
    };
  }, [messages, messages.length]);

  // Show loading skeleton while messages are being fetched
  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-4">
        <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl pt-16">
          <ThreadSkeleton messageCount={4} />
        </div>
      </div>
    );
  }

  // Clean welcome screen - logo centered, carousel at bottom
  // Only show if no messages (strategy mode adds messages before chat is created)
  if (messages.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        {/* Top spacer - pushes logo to center */}
        <div className="flex-1" />

        {/* Logo and greeting - centered in middle */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="mb-4">
            {isLogoLoading ? (
              <div className="h-16 md:h-20 w-auto mx-auto" />
            ) : theme === 'light' ? (
              lightModeLogo ? (
                <Image
                  src={lightModeLogo}
                  alt="JCIL.ai"
                  width={240}
                  height={80}
                  className="h-16 md:h-20 w-auto mx-auto"
                />
              ) : (
                <h1 className="text-4xl md:text-5xl font-normal">
                  <span className="text-text-primary">jcil.</span>
                  <span className="text-primary">ai</span>
                </h1>
              )
            ) : mainLogo ? (
              mainLogo.startsWith('data:video/') ? (
                <video
                  src={mainLogo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-16 md:h-20 w-auto mx-auto"
                />
              ) : (
                <Image
                  src={mainLogo}
                  alt="JCIL.ai"
                  width={240}
                  height={80}
                  className="h-16 md:h-20 w-auto mx-auto"
                />
              )
            ) : (
              <h1 className="text-4xl md:text-5xl font-normal">
                <span className="text-white">jcil.</span>
                <span className="text-primary">ai</span>
              </h1>
            )}
          </div>

          {/* Simple time-based greeting */}
          <p className="text-base md:text-lg text-text-secondary">
            How can we help you {getTimeGreeting()}?
          </p>
        </div>

        {/* Bottom spacer - balances top spacer to center logo */}
        <div className="flex-1" />

        {/* Get Started Carousel - at bottom, just above input */}
        {onCarouselSelect && (
          <div className="w-full px-1 pb-2">
            <GetStartedCarousel isAdmin={isAdmin} onSelectCard={onCarouselSelect} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 md:px-4 chat-bg-orbs"
      role="region"
      aria-label="Conversation"
    >
      {/* Third animated orb (purple) */}
      <div className="chat-bg-orb-tertiary" />

      <div
        className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl space-y-3 md:space-y-4 pt-16 pb-8 relative z-10"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message, index) => {
          // Check if this is the last user message
          const isLastUserMessage = index === messages.length - 1 && message.role === 'user';
          // Add entrance animation to recent messages
          const isRecentMessage = index >= messages.length - 2;

          return (
            <div
              key={message.id}
              ref={isLastUserMessage ? lastUserMessageRef : null}
              className={isRecentMessage ? 'message-enter' : ''}
            >
              <MessageErrorBoundary>
                <MessageBubble
                  message={message}
                  isLast={index === messages.length - 1}
                  isAdmin={isAdmin}
                  onReply={onReply}
                  enableCodeActions={enableCodeActions}
                  onRegenerateImage={onRegenerateImage}
                  onActionSend={onActionSend}
                  onActionEdit={onActionEdit}
                  onActionCancel={onActionCancel}
                />
                {/* Suggested follow-ups: only on the last assistant message, not while streaming */}
                {index === messages.length - 1 &&
                  message.role === 'assistant' &&
                  !isStreaming &&
                  message.suggestedFollowups &&
                  message.suggestedFollowups.length > 0 && (
                    <SuggestedFollowups
                      suggestions={message.suggestedFollowups}
                      onSelect={(s) => onFollowupSelect?.(s)}
                      disabled={isStreaming}
                    />
                  )}
              </MessageErrorBoundary>
            </div>
          );
        })}

        {/* Intelligent typing indicator — one contextual message until stream starts */}
        {isStreaming && (
          <>
            <span className="sr-only" role="status">
              AI is responding
            </span>
            <TypingIndicator documentType={documentType} userMessage={lastUserMessage} />
          </>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
