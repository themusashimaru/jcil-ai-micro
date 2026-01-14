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
import { useTheme } from '@/contexts/ThemeContext';

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
}

export function ChatThread({
  messages,
  isStreaming,
  currentChatId,
  isAdmin,
  documentType,
  onReply,
  enableCodeActions,
  lastUserMessage,
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

  // Clean welcome screen - like Claude/ChatGPT/DeepSeek
  if (!currentChatId || messages.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center p-4">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6">
            {isLogoLoading ? (
              <div className="h-24 md:h-32 w-auto mx-auto" />
            ) : theme === 'light' ? (
              lightModeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightModeLogo} alt="JCIL.ai" className="h-24 md:h-32 w-auto mx-auto" />
              ) : (
                <h1 className="text-5xl md:text-6xl font-normal">
                  <span style={{ color: 'var(--text-primary)' }}>jcil.</span>
                  <span style={{ color: 'var(--primary)' }}>ai</span>
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
                  className="h-24 md:h-32 w-auto mx-auto"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainLogo} alt="JCIL.ai" className="h-24 md:h-32 w-auto mx-auto" />
              )
            ) : (
              <h1 className="text-5xl md:text-6xl font-normal">
                <span className="text-white">jcil.</span>
                <span style={{ color: 'var(--primary)' }}>ai</span>
              </h1>
            )}
          </div>

          {/* Simple greeting */}
          <p className="text-lg md:text-xl" style={{ color: 'var(--text-secondary)' }}>
            Hey, what can I help you with?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 md:px-4 chat-bg-orbs"
    >
      {/* Third animated orb (purple) */}
      <div className="chat-bg-orb-tertiary" />

      <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl space-y-3 md:space-y-4 pt-16 pb-8 relative z-10">
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
                />
              </MessageErrorBoundary>
            </div>
          );
        })}

        {/* Intelligent typing indicator with contextual messages */}
        {isStreaming && (
          <TypingIndicator documentType={documentType} userMessage={lastUserMessage} />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
