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
import type { Message } from '@/app/chat/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThreadSkeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { GetStartedCarousel } from './GetStartedCarousel';
import { SuggestedFollowups } from './SuggestedFollowups';
import { WelcomeScreen } from './WelcomeScreen';
import { ScrambleText } from '@/app/components/landing-v2/ScrambleText';
import { SplitFlapText, SplitFlapAudioProvider } from '@/app/components/landing-v2/SplitFlapText';
import { AnimatedNoise } from '@/app/components/landing-v2/AnimatedNoise';
import type { ActionPreviewData } from './ActionPreviewCard';
import type { DestructiveActionData } from './DestructiveActionCard';
import type { ScheduledActionData } from './ScheduledActionCard';

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
  /** Callback when destructive action is confirmed */
  onDestructiveConfirm?: (data: DestructiveActionData) => Promise<void>;
  /** Callback when destructive action is cancelled */
  onDestructiveCancel?: (data: DestructiveActionData) => void;
  /** Callback when scheduled action is confirmed */
  onScheduledConfirm?: (data: ScheduledActionData) => Promise<void>;
  /** Callback when scheduled action time is modified */
  onScheduledModifyTime?: (data: ScheduledActionData, newTime: string) => void;
  /** Callback when scheduled action is cancelled */
  onScheduledCancel?: (data: ScheduledActionData) => void;
  /** Callback when a suggested follow-up is clicked */
  onFollowupSelect?: (suggestion: string) => void;
  /** Whether messages are being loaded */
  isLoading?: boolean;
  /** Callback to retry the last failed message */
  onRetry?: () => void;
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
  onQuickPrompt,
  onCarouselSelect,
  onRegenerateImage,
  onActionSend,
  onActionEdit,
  onActionCancel,
  onDestructiveConfirm,
  onDestructiveCancel,
  onScheduledConfirm,
  onScheduledModifyTime,
  onScheduledCancel,
  onFollowupSelect,
  isLoading,
  onRetry,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Load logo from database (used by editorial theme welcome)
  const [, setMainLogo] = useState<string>('');
  const [, setLightModeLogo] = useState<string>('');
  const [, setIsLogoLoading] = useState<boolean>(true);

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
        <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-2xl lg:max-w-3xl pt-16">
          <ThreadSkeleton messageCount={4} />
        </div>
      </div>
    );
  }

  // Clean welcome screen - logo centered, carousel at bottom
  // Only show if no messages (strategy mode adds messages before chat is created)
  if (messages.length === 0) {
    // Editorial theme — full landing page experience
    if (theme === 'editorial') {
      return (
        <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
          {/* Grid background */}
          <div className="editorial-grid-bg" aria-hidden="true" />
          {/* Noise overlay */}
          <AnimatedNoise opacity={0.03} />

          {/* Top spacer */}
          <div className="flex-1" />

          {/* Section label */}
          <div className="text-center mb-6 relative z-10">
            <span className="editorial-section-label">01 / CHAT</span>
          </div>

          {/* SplitFlap logo — scaled for chat */}
          <div className="flex justify-center mb-6 relative z-10">
            <SplitFlapAudioProvider>
              <div className="transform scale-[0.35] md:scale-[0.45] origin-center -my-16 md:-my-12">
                <SplitFlapText text="JCIL.AI" speed={60} />
              </div>
            </SplitFlapAudioProvider>
          </div>

          {/* Accent bar */}
          <div className="w-32 mx-auto editorial-accent-bar mb-6 relative z-10" />

          {/* Greeting with decode */}
          <div className="text-center mb-8 relative z-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <ScrambleText
                text={`How can we help you ${getTimeGreeting()}?`}
                duration={0.8}
                delayMs={1800}
              />
            </p>
          </div>

          {/* Stats bar — like landing page hero */}
          <div className="flex justify-center gap-8 md:gap-12 mb-8 relative z-10">
            <div className="text-center">
              <div className="font-bebas text-2xl md:text-3xl text-accent">
                <ScrambleText text="51" duration={0.6} delayMs={2200} className="inline-block" />
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Tools
              </div>
            </div>
            <div className="text-center">
              <div className="font-bebas text-2xl md:text-3xl text-accent">
                <ScrambleText text="67+" duration={0.6} delayMs={2400} className="inline-block" />
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Connections
              </div>
            </div>
            <div className="text-center">
              <div className="font-bebas text-2xl md:text-3xl text-foreground">
                <ScrambleText text="AI" duration={0.4} delayMs={2600} className="inline-block" />
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                Powered
              </div>
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="flex-1" />

          {/* Editorial carousel */}
          {onCarouselSelect && (
            <div className="w-full px-1 pb-2 relative z-10">
              <GetStartedCarousel isAdmin={isAdmin} onSelectCard={onCarouselSelect} />
            </div>
          )}
        </div>
      );
    }

    return <WelcomeScreen onSendPrompt={(prompt) => onQuickPrompt?.(prompt)} />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 md:px-4 lg:px-8 chat-bg-orbs relative"
      role="region"
      aria-label="Conversation"
    >
      {/* Third animated orb (purple) */}
      <div className="chat-bg-orb-tertiary" />

      {/* Editorial grid + noise in message view */}
      {theme === 'editorial' && (
        <>
          <div className="editorial-grid-bg" aria-hidden="true" />
          <AnimatedNoise opacity={0.02} />
        </>
      )}

      <div
        className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-2xl lg:max-w-3xl space-y-3 md:space-y-4 pt-16 pb-8 relative z-10"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isStreaming}
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
                  onDestructiveConfirm={onDestructiveConfirm}
                  onDestructiveCancel={onDestructiveCancel}
                  onScheduledConfirm={onScheduledConfirm}
                  onScheduledModifyTime={onScheduledModifyTime}
                  onScheduledCancel={onScheduledCancel}
                  onRetry={onRetry}
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

        {/* Intelligent typing indicator — only show before first content arrives */}
        {isStreaming &&
          (() => {
            const lastMsg = messages[messages.length - 1];
            const hasContent =
              lastMsg?.role === 'assistant' && lastMsg.content && lastMsg.content.length > 0;
            if (hasContent) return null;
            return (
              <>
                <span className="sr-only" role="status">
                  AI is responding
                </span>
                <TypingIndicator documentType={documentType} userMessage={lastUserMessage} />
              </>
            );
          })()}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
