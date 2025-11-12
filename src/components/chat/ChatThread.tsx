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
import { QuickEmailWriter } from './QuickEmailWriter';
import { QuickResearchTool } from './QuickResearchTool';
import { QuickEssayWriter } from './QuickEssayWriter';
import { QuickDailyDevotional } from './QuickDailyDevotional';
import { QuickBibleStudy } from './QuickBibleStudy';
import { QuickBreakingNews } from './QuickBreakingNews';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
}

export function ChatThread({ messages, isStreaming, currentChatId }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const { profile, hasProfile } = useUserProfile();

  // Load design settings from API
  const [mainLogo, setMainLogo] = useState<string>('/images/logo.png');
  const [subtitle, setSubtitle] = useState<string>('Faith-based AI tools for your everyday needs');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
          const settings = await response.json();
          if (settings.mainLogo) setMainLogo(settings.mainLogo);
          if (settings.subtitle) setSubtitle(settings.subtitle);
        }
      } catch (error) {
        console.error('Failed to load design settings:', error);
      }
    };

    loadSettings();
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
            {/* Logo Image - Dynamically loaded from admin settings */}
            <img
              src={mainLogo}
              alt="JCIL.ai"
              className="h-12 md:h-24 w-auto mx-auto mb-2"
            />
            <p className="text-sm md:text-xl text-white font-medium mb-1">
              Slingshot 2.0
            </p>
            <p className="text-xs md:text-sm text-gray-400 italic">
              {subtitle}
            </p>
          </div>

          {/* Personalized greeting if profile exists */}
          {hasProfile && currentChatId && (
            <p className="mb-1 text-xs md:text-lg text-gray-300">
              Hi {profile.name}! How can I help you today?
            </p>
          )}

          {!currentChatId && (
            <p className="mb-2 text-xs md:text-sm text-gray-400">
              Start a new chat or select an existing conversation
            </p>
          )}

          {/* Main Tools */}
          <div className="flex flex-wrap justify-center gap-1 mb-1 mt-2">
            <QuickEmailWriter />
            <QuickResearchTool />
            <QuickEssayWriter />
          </div>

          {/* Bible Tools */}
          <div className="flex justify-center gap-1 mb-1">
            <QuickDailyDevotional />
            <QuickBibleStudy />
          </div>

          {/* Breaking News - Centered below Bible Tools */}
          <div className="flex justify-center">
            <QuickBreakingNews />
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
