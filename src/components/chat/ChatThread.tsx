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
import { useUserProfile } from '@/contexts/UserProfileContext';
// REMOVED: Email and Essay tools - gpt-5-mini handles these in regular chat
// import { QuickEmailWriter } from './QuickEmailWriter';
// import { QuickResearchTool } from './QuickResearchTool'; // HIDDEN: Auto-search is now enabled for all conversations
// import { QuickEssayWriter } from './QuickEssayWriter';
import { QuickDailyDevotional } from './QuickDailyDevotional';
import { QuickBibleStudy } from './QuickBibleStudy';
// REMOVED: Breaking News - too complex, causing issues
// import { QuickBreakingNews } from './QuickBreakingNews';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
  isAdmin?: boolean;
  onSubmitPrompt?: (prompt: string) => void;
}

export function ChatThread({ messages, isStreaming, currentChatId, isAdmin, onSubmitPrompt }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const { profile, hasProfile } = useUserProfile();

  // Load design settings from database API
  const [mainLogo, setMainLogo] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('Faith-based AI tools for your everyday needs');
  const [modelName, setModelName] = useState<string>('');
  const [isLogoLoading, setIsLogoLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Use main_logo from database
          const logoUrl = settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setMainLogo(logoUrl);
          }
          if (settings.subtitle) {
            setSubtitle(settings.subtitle);
          }
          if (settings.model_name) {
            setModelName(settings.model_name);
          }
        }
      } catch (error) {
        console.error('[ChatThread] Failed to load design settings:', error);
      } finally {
        setIsLogoLoading(false);
      }
    };

    loadSettings();

    // Listen for settings updates
    const handleUpdate = () => loadSettings();
    window.addEventListener('design-settings-updated', handleUpdate);
    return () => window.removeEventListener('design-settings-updated', handleUpdate);
  }, []);

  // Auto-scroll to show user's message at top when new message is sent
  useEffect(() => {
    if (messages.length === 0) return;

    // Find the last user message
    const lastMessage = messages[messages.length - 1];

    // If the last message is from user, scroll to show it at the top
    if (lastMessage.role === 'user' && lastUserMessageRef.current) {
      // Scroll so the user message appears near the top of the viewport
      lastUserMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      // Otherwise scroll to bottom (for assistant responses)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Show logo and tools when no chat is selected OR when chat is empty
  if (!currentChatId || messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-1">
        <div className="text-center">
          {/* JCIL.ai Logo */}
          <div className="mb-1">
            {/* Logo - Dynamically loaded from database (supports images and videos) */}
            {isLogoLoading ? (
              // Show placeholder while loading to prevent flash
              <div className="h-36 md:h-72 w-auto mx-auto mb-2" />
            ) : mainLogo ? (
              // Check if logo is a video (MP4 or WebM)
              mainLogo.startsWith('data:video/') ? (
                <video
                  src={mainLogo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-36 md:h-72 w-auto mx-auto mb-2"
                />
              ) : (
                <img
                  src={mainLogo}
                  alt="JCIL.ai"
                  className="h-36 md:h-72 w-auto mx-auto mb-2"
                />
              )
            ) : (
              <h1 className="text-6xl md:text-8xl font-bold mb-2">
                <span className="text-white">JCIL</span>
                <span className="text-blue-500">.ai</span>
              </h1>
            )}
            {modelName && (
              <p className="text-sm md:text-xl text-white font-medium mb-1">
                {modelName}
              </p>
            )}
            <p className="text-xs md:text-sm text-white italic">
              {subtitle}
            </p>
          </div>

          {/* Personalized greeting if profile exists */}
          {hasProfile && currentChatId && (
            <p className="mb-1 text-xs md:text-lg text-white">
              Hi {profile.name}! How can I help you today?
            </p>
          )}

          {!currentChatId && (
            <p className="mb-2 text-xs md:text-sm text-white">
              Start a new chat or select an existing conversation
            </p>
          )}

          {/* Bible Tools */}
          <div className="flex justify-center gap-1 mb-1 mt-2">
            <QuickDailyDevotional />
            <QuickBibleStudy onSubmitPrompt={onSubmitPrompt} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden py-0 px-0 md:p-2"
    >
      <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl space-y-0 md:space-y-3">

        {messages.map((message, index) => {
          // Check if this is the last user message
          const isLastUserMessage = index === messages.length - 1 && message.role === 'user';

          return (
            <div
              key={message.id}
              ref={isLastUserMessage ? lastUserMessageRef : null}
            >
              <MessageBubble
                message={message}
                isLast={index === messages.length - 1}
                isAdmin={isAdmin}
              />
            </div>
          );
        })}

        {/* Professional typing indicator */}
        {isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
